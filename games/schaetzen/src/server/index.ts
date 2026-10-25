// Serverlogik „Schätzen!“ (server-authoritative), 1–8 Spieler.
// Ablauf: intro → (question → reveal → standings)* → final → ctx.end(); nach der letzten Frage direkt final.
// Pro Frage tippen alle gleichzeitig eine Zahl; „Fertig“ macht den Tipp endgültig. Die Frage endet nach der
// Antwortzeit oder sobald alle verbundenen Spieler fertig sind. Wertung siehe scoring.ts.
// Fragen werden erst gezogen, wenn sie dran sind – Kategorien reihum, darin bevorzugt solche, die noch kein
// Teilnehmer gestellt bekam (Handys melden das, siehe seen.ts) und die nicht in der Vorrunde dran waren.
// Wartezeiten (Lesezeit der Auflösung, Zwischenstand, Finale) sind überspringbar; nicht überspringbar sind das
// Intro (Handys melden dort ihre gesehenen Fragen), die Antwortzeit und die Auflösungs-Animation.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { isYearUnit } from "../constants.js";
import { QUESTIONS_BY_CATEGORY, type Estimate } from "../data/index.js";
import { scoreGuesses } from "../scoring.js";
import { unpackSeen } from "../seen.js";
import {
  CATEGORY_IDS,
  TIMING,
  type CategoryId,
  type EsGuess,
  type EsInput,
  type EsPlayerInfo,
  type EsPlayerView,
  type EsResultData,
  type EsSettings,
  type EsTvState,
} from "../shared.js";
import { EsInputSchema } from "./input.js";

type Ctx = GameContext<EsSettings, EsTvState, EsPlayerView>;
type Phase = "intro" | "question" | "reveal" | "standings" | "final" | "done";

export function parseEsSettings(values: SettingsValues): EsSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    categories: categories.length > 0 ? [...new Set(categories)] : [...CATEGORY_IDS],
    rounds: num(values.rounds, 10, 5, 20),
    answerSeconds: num(values.answerSeconds, 30, 20, 60),
  };
}

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  bullseyes: number;
  left: boolean;
  order: number;
}

/** Fragen je Kategorie, Kategorien reihum; innerhalb der Kategorie die mit der kleinsten Strafe. */
function createDeck(categories: readonly CategoryId[], ctx: Ctx) {
  const queues = ctx.rng.shuffle([...categories]).map((c) => ctx.rng.shuffle([...QUESTIONS_BY_CATEGORY[c]]));
  let turn = 0;
  return (penalty: (id: string) => number): Estimate | null => {
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

export default defineGame<EsSettings, EsInput, EsTvState, EsPlayerView>({
  manifest,
  inputSchema: EsInputSchema,
  parseSettings: parseEsSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const durationMs = settings.answerSeconds * 1000;
    const nextQuestion = createDeck(settings.categories, ctx);
    const available = settings.categories.reduce((n, c) => n + QUESTIONS_BY_CATEGORY[c].length, 0);
    const total = Math.min(settings.rounds, available);
    const previousIds = new Set(
      ((ctx.previous?.data as Partial<EsResultData> | undefined)?.questionIds ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, bullseyes: 0, left: false, order }]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;

    const seenBy = new Map<PlayerId, Set<string>>();
    const penalty = (id: string): number => {
      let n = previousIds.has(id) ? 1 : 0;
      for (const [pid, seen] of seenBy) if (!state(pid).left && seen.has(id)) n += 2;
      return n;
    };

    let phase: Phase = "intro";
    let round = -1;
    let endsAt = 0;
    let revealAt = 0;
    let timer: TimerId | null = null;
    let question: Estimate | null = null;
    /** Wertung nach Genauigkeit, wenn bei Fragebeginn nur ein Teilnehmer übrig ist. */
    let solo = ctx.players.length === 1;
    let guesses = new Map<PlayerId, number>();
    let scored: EsGuess[] = [];
    const askedIds: string[] = [];

    const recomputeRanks = (): void => {
      const sorted = [...players.values()].sort((a, b) => b.score - a.score);
      sorted.forEach((s, i) => {
        const prev = sorted[i - 1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): EsPlayerInfo[] =>
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
            bullseyes: s.bullseyes,
            left: s.left,
          };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const nearest = (): PlayerId[] => scored.filter((g) => g.place === 1).map((g) => g.playerId);

    const tvState = (): EsTvState => {
      const base = { round: Math.max(0, round), total, solo, players: playerInfos() };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt, durationMs: TIMING.introMs, categories: [...settings.categories] };
        case "question":
        case "reveal": {
          const q = question!;
          const common = { ...base, category: q.category, text: q.question, unit: q.unit };
          if (phase === "question") {
            return { ...common, phase, endsAt, durationMs, answered: ctx.players.filter((p) => guesses.has(p.id)).map((p) => p.id) };
          }
          return { ...common, phase, answer: q.answer, fact: q.fact ?? null, revealAt, endsAt, guesses: scored, nearest: nearest() };
        }
        case "standings":
          return { ...base, phase, endsAt };
        case "final":
        case "done":
          return { ...base, phase: "final", endsAt, durationMs: TIMING.finalMs };
      }
    };

    const viewFor = (id: PlayerId): EsPlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total, score: s.score, rank: s.rank, playerCount: ctx.players.length, solo };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "question": {
          const q = question!;
          return { ...base, phase, questionId: q.id, text: q.question, unit: q.unit, guess: guesses.get(id) ?? null, endsAt, durationMs };
        }
        case "reveal": {
          const q = question!;
          const mine = scored.find((g) => g.playerId === id);
          return {
            ...base,
            phase,
            text: q.question,
            unit: q.unit,
            answer: q.answer,
            revealAt,
            guess: mine?.value ?? null,
            distance: mine?.distance ?? null,
            place: mine?.place ?? null,
            bullseye: mine?.bullseye ?? false,
            points: mine?.points ?? 0,
          };
        }
        case "standings":
          return { ...base, phase };
        case "final":
        case "done":
          return { ...base, phase: "final", bullseyes: s.bullseyes };
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

    // ---------------------------------------------------------------- Phasen

    const startQuestion = (): void => {
      const q = round + 1 < total && ctx.activePlayerIds().length > 0 ? nextQuestion(penalty) : null;
      if (!q) return showFinal();
      question = q;
      askedIds.push(q.id);
      guesses = new Map();
      scored = [];
      solo = ctx.activePlayerIds().length === 1;
      round++;
      phase = "question";
      schedule(durationMs, reveal, false);
      publish();
    };

    const reveal = (): void => {
      if (phase !== "question") return;
      const q = question!;
      for (const s of players.values()) s.roundPoints = 0;
      scored = scoreGuesses(
        ctx.activePlayerIds().map((id) => ({ playerId: id, value: guesses.get(id) ?? null })),
        q.answer,
        q.unit,
        solo,
      );
      for (const g of scored) {
        const s = state(g.playerId);
        s.score += g.points;
        s.roundPoints = g.points;
        if (g.bullseye) s.bullseyes++;
      }
      recomputeRanks();
      phase = "reveal";
      revealAt = ctx.now();
      const next = round + 1 >= total ? showFinal : showStandings;
      // Erst die Animation (nicht überspringbar), dann Lesezeit (überspringbar).
      schedule(TIMING.revealAnimMs, () => schedule(TIMING.revealHoldMs, next, true), false);
      endsAt = revealAt + TIMING.revealAnimMs + TIMING.revealHoldMs;
      publish();
    };

    const showStandings = (): void => {
      phase = "standings";
      schedule(TIMING.standingsMs, startQuestion, true);
      publish();
    };

    const showFinal = (): void => {
      if (phase === "final" || phase === "done") return;
      phase = "final";
      recomputeRanks();
      schedule(TIMING.finalMs, finish, true);
      publish();
    };

    const finish = (): void => {
      if (phase === "done") return;
      phase = "done";
      recomputeRanks();
      const infos = playerInfos();
      const data: EsResultData = {
        questionIds: askedIds,
        total: askedIds.length,
        players: infos.map(({ id, name, score, rank, bullseyes, left }) => ({ id, name, score, rank, bullseyes, left })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Vorzeitig auflösen, wenn alle verbundenen Spieler fertig sind (mindestens einer muss verbunden sein). */
    const checkAllAnswered = (): void => {
      if (phase !== "question") return;
      const connected = ctx.activePlayerIds().filter((id) => ctx.isConnected(id));
      if (connected.length > 0 && connected.every((id) => guesses.has(id))) reveal();
    };

    // Intro nicht überspringbar: In dieser Zeit melden die Handys ihre gesehenen Fragen (Wiederholungsschutz).
    schedule(TIMING.introMs, startQuestion, false);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (input.type === "seen") {
          seenBy.set(playerId, new Set(unpackSeen(input.ids)));
          return;
        }
        if (phase !== "question" || state(playerId).left || guesses.has(playerId)) return;
        // Jahreszahlen nur ganzzahlig (das Ziffernfeld bietet dort kein Komma an).
        if (isYearUnit(question!.unit) && !Number.isInteger(input.value)) return;
        guesses.set(playerId, input.value);
        ctx.broadcastTv(tvState());
        ctx.sendToPlayer(playerId, viewFor(playerId));
        checkAllAnswered();
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        guesses.delete(playerId);
        if (ctx.activePlayerIds().length === 0) {
          showFinal();
          return;
        }
        recomputeRanks();
        publish();
        checkAllAnswered();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllAnswered();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
