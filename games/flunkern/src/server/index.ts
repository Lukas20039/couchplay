// Serverlogik „Flunkern“ (server-authoritative), 2–8 Spieler – Bluff-Spiel à la Fibbage.
// Ablauf: intro → (write → choose → reveal → standings)* → final → ctx.end(); nach der letzten Runde direkt final.
// write:  Jeder schreibt eine glaubwürdige Lüge (zu nah an der Wahrheit → abgelehnt, gleiche Lügen werden
//         zusammengelegt). Wer nichts abschickt, bekommt eine Hauslüge zugeteilt. Endet vorzeitig, wenn alle
//         verbundenen Spieler fertig sind.
// choose: Wahrheit + Lügen gemischt, aufgefüllt auf mindestens 4. Jeder tippt, was er für wahr hält (eigene Lüge
//         gesperrt). Endet vorzeitig, wenn alle verbundenen Spieler gewählt haben.
// reveal: Schritt für Schritt (Server-Timer): jede gewählte Lüge mit Reingefallenen und Autor, zuletzt die Wahrheit.
//         Die ganze Auflösung ist EINE überspringbare Wartezeit (Skip → sofort Zwischenstand bzw. Finale);
//         die Schritt-Timer selbst sind nicht einzeln überspringbar (so überspringt ein Doppelklick nie zu viel).
// Punkte werden erst beim Aufdecken der Wahrheit gutgeschrieben, damit die Handys vorher nichts verraten.
// Nicht überspringbar: Intro (Handys melden ihre gesehenen Fragen), Schreib- und Wählzeit.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { QUESTIONS_BY_CATEGORY, type Bluff } from "../data/index.js";
import { cleanText, isValidLie } from "../normalize.js";
import { addLie, buildOptions, computeAwards, scoreRound, type Answer, type Lie, type RoundScore } from "../round.js";
import { unpackSeen } from "../seen.js";
import {
  CATEGORY_IDS,
  TIMING,
  type CategoryId,
  type FlAward,
  type FlInput,
  type FlPlayerInfo,
  type FlPlayerView,
  type FlResultData,
  type FlRoundResult,
  type FlSettings,
  type FlTvState,
} from "../shared.js";
import { FlInputSchema } from "./input.js";

type Ctx = GameContext<FlSettings, FlTvState, FlPlayerView>;
type Phase = "intro" | "write" | "choose" | "reveal" | "standings" | "final" | "done";

export function parseFlSettings(values: SettingsValues): FlSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    categories: categories.length > 0 ? [...new Set(categories)] : [...CATEGORY_IDS],
    rounds: num(values.rounds, 7, 3, 12),
    writeSeconds: num(values.writeSeconds, 60, 30, 120),
    chooseSeconds: num(values.chooseSeconds, 20, 15, 40),
  };
}

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  fooled: number;
  truths: number;
  /** So oft auf eine Lüge reingefallen (für die Auszeichnung „Leichtgläubig“). */
  gullible: number;
  left: boolean;
  order: number;
}

/** Dauer der gesamten Auflösung bei n Schritten (n-1 Lügen + Wahrheit). */
export const revealDurationMs = (steps: number): number => Math.max(0, steps - 1) * TIMING.revealLieMs + TIMING.revealTruthMs;

/** Fragen je Kategorie, Kategorien reihum; innerhalb der Kategorie die mit der kleinsten Strafe. */
function createDeck(categories: readonly CategoryId[], ctx: Ctx) {
  const queues = ctx.rng.shuffle([...categories]).map((c) => ctx.rng.shuffle([...QUESTIONS_BY_CATEGORY[c]]));
  let turn = 0;
  return (penalty: (id: string) => number): Bluff | null => {
    for (let tries = 0; tries < queues.length; tries++) {
      const queue = queues[turn % queues.length]!;
      turn++;
      if (queue.length === 0) continue;
      let best = 0;
      let bestScore = penalty(queue[0]!.id);
      for (let i = 1; i < queue.length && bestScore > 0; i++) {
        const s = penalty(queue[i]!.id);
        if (s < bestScore) {
          best = i;
          bestScore = s;
        }
      }
      return queue.splice(best, 1)[0]!;
    }
    return null;
  };
}

export default defineGame<FlSettings, FlInput, FlTvState, FlPlayerView>({
  manifest,
  inputSchema: FlInputSchema,
  parseSettings: parseFlSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const writeMs = settings.writeSeconds * 1000;
    const chooseMs = settings.chooseSeconds * 1000;
    const nextQuestion = createDeck(settings.categories, ctx);
    const available = settings.categories.reduce((n, c) => n + QUESTIONS_BY_CATEGORY[c].length, 0);
    const total = Math.min(settings.rounds, available);
    const previousIds = new Set(
      ((ctx.previous?.data as Partial<FlResultData> | undefined)?.questionIds ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, fooled: 0, truths: 0, gullible: 0, left: false, order }]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;
    const nameOf = (id: PlayerId): string => ctx.players.find((p) => p.id === id)?.name ?? "?";

    const seenBy = new Map<PlayerId, Set<string>>();
    const penalty = (id: string): number => {
      let n = previousIds.has(id) ? 1 : 0;
      for (const [pid, seen] of seenBy) if (!state(pid).left && seen.has(id)) n += 2;
      return n;
    };

    let phase: Phase = "intro";
    let round = -1;
    let endsAt = 0;
    let timer: TimerId | null = null;
    let stepTimers: TimerId[] = [];
    let question: Bluff | null = null;
    /** Spielerlügen dieser Runde (zusammengelegte mit mehreren Autoren). */
    let lies: Lie[] = [];
    /** Eigener, abgeschickter Text je Spieler (bei zusammengelegten Lügen kann der Anzeigetext abweichen). */
    let ownText = new Map<PlayerId, string>();
    /** Letzter Versuch war zu nah an der Wahrheit. */
    let rejected = new Set<PlayerId>();
    let options: Answer[] = [];
    let choices = new Map<PlayerId, number>();
    let scored: RoundScore | null = null;
    let step = 0;
    let stepAt = 0;
    let applied = false;
    let awards: FlAward[] = [];
    const askedIds: string[] = [];

    const isDouble = (r: number): boolean => total > 1 && r === total - 1;

    const recomputeRanks = (): void => {
      const sorted = [...players.values()].sort((a, b) => b.score - a.score);
      sorted.forEach((s, i) => {
        const prev = sorted[i - 1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): FlPlayerInfo[] =>
      ctx.players
        .map((p) => {
          const s = state(p.id);
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            color: p.color,
            score: s.score,
            rank: s.rank,
            roundPoints: s.roundPoints,
            fooled: s.fooled,
            truths: s.truths,
            left: s.left,
          };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const hasLie = (id: PlayerId): boolean => ownText.has(id);
    const ownOption = (id: PlayerId): number | null => {
      const i = options.findIndex((o) => o.authors.includes(id));
      return i < 0 ? null : i;
    };
    const truthShown = (): boolean => scored !== null && step >= scored.steps.length - 1;

    const tvState = (): FlTvState => {
      const base = { round: Math.max(0, round), total, players: playerInfos() };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt, durationMs: TIMING.introMs, categories: [...settings.categories] };
        case "write":
        case "choose":
        case "reveal": {
          const q = question!;
          const common = { ...base, category: q.category, text: q.question, double: isDouble(round) };
          if (phase === "write") {
            return { ...common, phase, endsAt, durationMs: writeMs, done: ctx.players.filter((p) => hasLie(p.id)).map((p) => p.id) };
          }
          const texts = options.map((o) => o.text);
          if (phase === "choose") {
            return { ...common, phase, options: texts, endsAt, durationMs: chooseMs, chosen: ctx.players.filter((p) => choices.has(p.id)).map((p) => p.id) };
          }
          const steps = scored!.steps;
          return { ...common, phase, options: texts, steps: steps.slice(0, step + 1), stepCount: steps.length, stepAt };
        }
        case "standings":
          return { ...base, phase, endsAt, durationMs: TIMING.standingsMs, nextDouble: isDouble(round + 1) };
        case "final":
        case "done":
          return { ...base, phase: "final", endsAt, durationMs: TIMING.finalMs, awards };
      }
    };

    const roundResult = (id: PlayerId): FlRoundResult => {
      const sc = scored!;
      const truth = sc.steps.at(-1)!;
      const index = choices.get(id);
      const fell = sc.fellFor.get(id);
      const own = ownOption(id);
      const ownStep = sc.steps.find((s) => s.kind === "lie" && s.option === own);
      return {
        truth: truth.text,
        choice: index === undefined ? null : (options[index]?.text ?? null),
        foundTruth: sc.finders.includes(id),
        fooledBy: fell === undefined ? null : options[fell]!.authors.map(nameOf),
        lie: own === null ? null : options[own]!.text,
        fooledNames: ownStep?.kind === "lie" ? ownStep.fooled.map(nameOf) : [],
        points: sc.points.get(id) ?? 0,
      };
    };

    const viewFor = (id: PlayerId): FlPlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total, score: s.score, rank: s.rank, playerCount: ctx.players.length, double: isDouble(round) };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "write": {
          const q = question!;
          return { ...base, phase, questionId: q.id, text: q.question, endsAt, durationMs: writeMs, lie: ownText.get(id) ?? null, rejected: rejected.has(id) };
        }
        case "choose": {
          const own = ownOption(id);
          return {
            ...base,
            phase,
            text: question!.question,
            options: options.map((o) => o.text),
            own,
            auto: own !== null && options[own]!.auto,
            choice: choices.get(id) ?? null,
            endsAt,
            durationMs: chooseMs,
          };
        }
        case "reveal":
          return { ...base, phase, text: question!.question, result: truthShown() ? roundResult(id) : null };
        case "standings":
          return { ...base, phase };
        case "final":
        case "done":
          return {
            ...base,
            phase: "final",
            fooled: s.fooled,
            truths: s.truths,
            awards: awards.filter((a) => a.playerIds.includes(id)).map((a) => a.kind),
          };
      }
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      ctx.sendToAllPlayers((p) => viewFor(p.id));
    };

    const schedule = (ms: number, next: () => void, skippable: boolean): void => {
      if (timer !== null) ctx.timers.clear(timer);
      const cd = ctx.timers.countdown(
        ms,
        () => {
          timer = null;
          next();
        },
        { skippable },
      );
      timer = cd.id;
      endsAt = cd.endsAt;
    };

    const clearSteps = (): void => {
      for (const id of stepTimers) ctx.timers.clear(id);
      stepTimers = [];
    };

    // ---------------------------------------------------------------- Phasen

    const startRound = (): void => {
      const q = round + 1 < total && ctx.activePlayerIds().length > 0 ? nextQuestion(penalty) : null;
      if (!q) return showFinal();
      question = q;
      askedIds.push(q.id);
      lies = [];
      ownText = new Map();
      rejected = new Set();
      options = [];
      choices = new Map();
      scored = null;
      applied = false;
      for (const s of players.values()) s.roundPoints = 0;
      round++;
      phase = "write";
      schedule(writeMs, startChoose, false);
      publish();
    };

    const startChoose = (): void => {
      if (phase !== "write") return;
      const q = question!;
      // Wer (noch dabei) nichts abgeschickt hat, bekommt eine Hauslüge zugeteilt.
      const autoFor = ctx.activePlayerIds().filter((id) => !hasLie(id));
      options = buildOptions(q, lies, autoFor, ctx.rng);
      rejected = new Set();
      phase = "choose";
      schedule(chooseMs, startReveal, false);
      publish();
    };

    /** Punkte und Statistik der Runde gutschreiben (beim Aufdecken der Wahrheit bzw. beim Überspringen). */
    const applyRound = (): void => {
      if (applied || !scored) return;
      applied = true;
      for (const [id, n] of scored.points) {
        const s = state(id);
        s.score += n;
        s.roundPoints = n;
      }
      for (const [id, n] of scored.fooled) state(id).fooled += n;
      for (const id of scored.finders) state(id).truths++;
      for (const id of scored.fellFor.keys()) state(id).gullible++;
      recomputeRanks();
    };

    const startReveal = (): void => {
      if (phase !== "choose") return;
      const ordered = new Map(ctx.players.filter((p) => choices.has(p.id)).map((p) => [p.id, choices.get(p.id)!]));
      scored = scoreRound(options, ordered, isDouble(round), question!.fact ?? null);
      phase = "reveal";
      step = 0;
      stepAt = ctx.now();
      const count = scored.steps.length;
      clearSteps();
      for (let i = 1; i < count; i++) {
        stepTimers.push(
          ctx.timers.setTimeout(() => {
            step = i;
            stepAt = ctx.now();
            if (i === count - 1) applyRound();
            publish();
          }, i * TIMING.revealLieMs),
        );
      }
      if (count === 1) applyRound();
      // Die ganze Auflösung ist eine überspringbare Wartezeit.
      schedule(revealDurationMs(count), afterReveal, true);
      publish();
    };

    const afterReveal = (): void => {
      clearSteps();
      applyRound();
      if (round + 1 >= total) showFinal();
      else showStandings();
    };

    const showStandings = (): void => {
      phase = "standings";
      schedule(TIMING.standingsMs, startRound, true);
      publish();
    };

    const showFinal = (): void => {
      if (phase === "final" || phase === "done") return;
      clearSteps();
      applyRound();
      phase = "final";
      recomputeRanks();
      awards = computeAwards(
        ctx.players
          .filter((p) => !state(p.id).left)
          .map((p) => {
            const s = state(p.id);
            return { id: p.id, fooled: s.fooled, truths: s.truths, gullible: s.gullible };
          }),
      );
      schedule(TIMING.finalMs, finish, true);
      publish();
    };

    const finish = (): void => {
      if (phase === "done") return;
      phase = "done";
      recomputeRanks();
      const infos = playerInfos();
      const data: FlResultData = {
        questionIds: askedIds,
        total: askedIds.length,
        awards,
        players: infos.map(({ id, name, score, rank, fooled, truths, left }) => ({ id, name, score, rank, fooled, truths, left })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Vorzeitig weiter, wenn alle verbundenen Spieler fertig sind (mindestens einer muss verbunden sein). */
    const checkAllDone = (): void => {
      const connected = ctx.activePlayerIds().filter((id) => ctx.isConnected(id));
      if (connected.length === 0) return;
      if (phase === "write" && connected.every(hasLie)) startChoose();
      else if (phase === "choose" && connected.every((id) => choices.has(id))) startReveal();
    };

    // Intro nicht überspringbar: In dieser Zeit melden die Handys ihre gesehenen Fragen (Wiederholungsschutz).
    schedule(TIMING.introMs, startRound, false);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (input.type === "seen") {
          seenBy.set(playerId, new Set(unpackSeen(input.ids)));
          return;
        }
        if (state(playerId).left) return;
        if (input.type === "lie") {
          if (phase !== "write" || hasLie(playerId)) return;
          const text = cleanText(input.text);
          if (!isValidLie(text)) return;
          const check = addLie(question!, lies, playerId, text);
          if (check.kind === "truth") {
            // Zu nah an der Wahrheit: nur der Absender erfährt es (eigener Status statt Fehlercode).
            rejected.add(playerId);
            ctx.sendToPlayer(playerId, viewFor(playerId));
            return;
          }
          rejected.delete(playerId);
          ownText.set(playerId, text);
          ctx.broadcastTv(tvState());
          ctx.sendToPlayer(playerId, viewFor(playerId));
          checkAllDone();
          return;
        }
        // choose
        if (phase !== "choose" || choices.has(playerId)) return;
        if (input.index >= options.length || input.index === ownOption(playerId)) return;
        choices.set(playerId, input.index);
        ctx.broadcastTv(tvState());
        ctx.sendToPlayer(playerId, viewFor(playerId));
        checkAllDone();
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        // Offene Eingaben fallen weg; eine schon geschriebene Lüge bleibt im Spiel.
        rejected.delete(playerId);
        if (phase === "choose") choices.delete(playerId);
        if (ctx.activePlayerIds().length === 0) {
          showFinal();
          return;
        }
        publish();
        checkAllDone();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllDone();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
