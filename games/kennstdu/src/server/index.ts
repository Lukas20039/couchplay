// Serverlogik „Wie gut kennst du mich?“ (server-authoritative), 2–8 Spieler.
// Ablauf: intro → (ask → reveal → standings)* → final → ctx.end().
// Reihum (gemischte Reihenfolge, `turns` Mal pro Person) ist eine Person Hauptperson: Sie wählt ihre
// ehrliche Antwort, alle anderen raten gleichzeitig. Richtig geraten = POINTS.guess; die Hauptperson
// bekommt POINTS.perGuesser je richtigem Rater. Fragen werden erst gezogen, wenn sie dran sind –
// bevorzugt solche, die noch kein Teilnehmer gestellt bekam (Handys melden das, siehe seen.ts).
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { NAME } from "../constants.js";
import { QUESTIONS_BY_CATEGORY, type Question } from "../data/index.js";
import { unpackSeen } from "../seen.js";
import {
  CATEGORY_IDS,
  POINTS,
  TIMING,
  type CategoryId,
  type Hotseat,
  type KdGuess,
  type KdInput,
  type KdPlayerInfo,
  type KdPlayerView,
  type KdResultData,
  type KdSettings,
  type KdTvState,
} from "../shared.js";
import { KdInputSchema } from "./input.js";

type Ctx = GameContext<KdSettings, KdTvState, KdPlayerView>;
type Phase = "intro" | "ask" | "reveal" | "standings" | "final" | "done";

export function parseKdSettings(values: SettingsValues): KdSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    categories: categories.length > 0 ? categories : [...CATEGORY_IDS],
    turns: num(values.turns, 2, 1, 4),
    answerSeconds: num(values.answerSeconds, 25, 10, 60),
  };
}

/** Frage mit eingesetztem Namen. */
export const fillName = (about: string, name: string): string => about.replace(NAME, name);

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  /** Wie oft andere sie richtig eingeschätzt haben bzw. sie richtig geraten hat. */
  matches: number;
  left: boolean;
  order: number;
}

/** Fragen je Kategorie, Kategorien reihum; innerhalb der Kategorie die mit der kleinsten Strafe. */
function createDeck(categories: readonly CategoryId[], ctx: Ctx) {
  const queues = ctx.rng.shuffle([...new Set(categories)]).map((c) => ctx.rng.shuffle([...QUESTIONS_BY_CATEGORY[c]]));
  let turn = 0;
  return (penalty: (id: string) => number): Question | null => {
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

export default defineGame<KdSettings, KdInput, KdTvState, KdPlayerView>({
  manifest,
  inputSchema: KdInputSchema,
  parseSettings: parseKdSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const durationMs = settings.answerSeconds * 1000;
    const nextQuestion = createDeck(settings.categories, ctx);
    const previousIds = new Set(
      ((ctx.previous?.data as Partial<KdResultData> | undefined)?.questionIds ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, matches: 0, left: false, order }]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;
    const gamePlayer = (id: PlayerId) => ctx.players.find((p) => p.id === id)!;

    // Reihenfolge der Hauptpersonen: gemischt, jede Runde gleiche Reihenfolge.
    const order = ctx.rng.shuffle(ctx.players.map((p) => p.id));
    const schedule_: PlayerId[] = [];
    for (let t = 0; t < settings.turns; t++) schedule_.push(...order);

    const seenBy = new Map<PlayerId, Set<string>>();
    const penalty = (id: string): number => {
      let n = previousIds.has(id) ? 1 : 0;
      for (const [pid, seen] of seenBy) if (!state(pid).left && seen.has(id)) n += 2;
      return n;
    };

    let phase: Phase = "intro";
    let round = -1;
    let pos = -1;
    let endsAt = 0;
    let timer: TimerId | null = null;
    let question: Question | null = null;
    let hotseatId: PlayerId | null = null;
    let hotseatChoice: number | null = null;
    let guesses = new Map<PlayerId, number>();
    let lastGuesses: KdGuess[] = [];
    const askedIds: string[] = [];

    const active = (id: PlayerId): boolean => !state(id).left;
    /** Verbleibende Fragen (Positionen, deren Hauptperson noch da ist) + bereits gestellte. */
    const total = (): number => round + 1 + schedule_.slice(pos + 1).filter(active).length;

    const recomputeRanks = (): void => {
      const sorted = [...players].sort(([, a], [, b]) => b.score - a.score);
      sorted.forEach(([, s], i) => {
        const prev = sorted[i - 1]?.[1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): KdPlayerInfo[] =>
      ctx.players
        .map((p) => {
          const s = state(p.id);
          return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, score: s.score, rank: s.rank, roundPoints: s.roundPoints, left: s.left };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const hotseat = (): Hotseat => {
      const p = gamePlayer(hotseatId!);
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color };
    };

    const tvState = (): KdTvState => {
      const base = { round: Math.max(0, round), total: total(), players: playerInfos() };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "ask":
        case "reveal": {
          const q = question!;
          const common = { ...base, hotseat: hotseat(), category: q.category, text: fillName(q.about, hotseat().name), answers: [...q.answers] };
          if (phase === "ask") {
            return {
              ...common,
              phase,
              endsAt,
              durationMs,
              hotseatAnswered: hotseatChoice !== null,
              guessed: ctx.players.filter((p) => guesses.has(p.id)).map((p) => p.id),
            };
          }
          const distribution = q.answers.map(() => 0);
          for (const g of lastGuesses) if (g.choice !== null) distribution[g.choice]!++;
          return { ...common, phase, endsAt, hotseatChoice, guesses: lastGuesses, distribution };
        }
        case "standings":
          return { ...base, phase, endsAt };
        case "final":
        case "done":
          return { ...base, phase: "final", endsAt };
      }
    };

    const viewFor = (id: PlayerId): KdPlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total: total(), score: s.score, rank: s.rank, playerCount: ctx.players.length };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "ask": {
          const q = question!;
          const isHot = id === hotseatId;
          return {
            ...base,
            phase,
            role: isHot ? "hotseat" : "guess",
            questionId: q.id,
            text: isHot ? q.toYou : fillName(q.about, hotseat().name),
            answers: [...q.answers],
            hotseat: hotseat(),
            choice: isHot ? hotseatChoice : (guesses.get(id) ?? null),
            endsAt,
            durationMs,
          };
        }
        case "reveal": {
          const isHot = id === hotseatId;
          const right = lastGuesses.filter((g) => g.correct).length;
          const mine = lastGuesses.find((g) => g.playerId === id);
          return {
            ...base,
            phase,
            role: isHot ? "hotseat" : "guess",
            answers: [...question!.answers],
            hotseat: hotseat(),
            hotseatChoice,
            choice: isHot ? hotseatChoice : (mine?.choice ?? null),
            correct: isHot ? right > 0 : (mine?.correct ?? false),
            points: s.roundPoints,
            rightGuessers: right,
          };
        }
        case "standings":
          return { ...base, phase };
        case "final":
        case "done":
          return { ...base, phase: "final", matches: s.matches };
      }
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      ctx.sendToAllPlayers((p) => viewFor(p.id));
    };

    const schedule = (ms: number, next: () => void): void => {
      if (timer !== null) ctx.timers.clear(timer);
      const cd = ctx.timers.countdown(ms, () => {
        timer = null;
        next();
      });
      timer = cd.id;
      endsAt = cd.endsAt;
    };

    // ---------------------------------------------------------------- Phasen

    const startQuestion = (): void => {
      // Nächste Hauptperson, die noch dabei ist; ohne mindestens einen Rater ist das Spiel aus.
      do pos++;
      while (pos < schedule_.length && !active(schedule_[pos]!));
      const q = pos < schedule_.length ? nextQuestion(penalty) : null;
      if (!q || ctx.activePlayerIds().length < 2) return showFinal();
      question = q;
      askedIds.push(q.id);
      hotseatId = schedule_[pos]!;
      hotseatChoice = null;
      guesses = new Map();
      round++;
      phase = "ask";
      schedule(durationMs, reveal);
      publish();
    };

    const reveal = (): void => {
      if (phase !== "ask") return;
      if (timer !== null) ctx.timers.clear(timer);
      for (const s of players.values()) s.roundPoints = 0;
      lastGuesses = ctx.players
        .filter((p) => p.id !== hotseatId)
        .map((p) => {
          const choice = guesses.get(p.id) ?? null;
          return { playerId: p.id, choice, correct: hotseatChoice !== null && choice === hotseatChoice };
        });
      const hot = state(hotseatId!);
      for (const g of lastGuesses) {
        if (!g.correct) continue;
        const s = state(g.playerId);
        s.score += POINTS.guess;
        s.roundPoints = POINTS.guess;
        s.matches++;
        hot.score += POINTS.perGuesser;
        hot.roundPoints += POINTS.perGuesser;
        hot.matches++;
      }
      recomputeRanks();
      phase = "reveal";
      const last = schedule_.slice(pos + 1).filter(active).length === 0;
      schedule(TIMING.revealMs, last ? showFinal : showStandings);
      publish();
    };

    const showStandings = (): void => {
      phase = "standings";
      schedule(TIMING.standingsMs, startQuestion);
      publish();
    };

    const showFinal = (): void => {
      phase = "final";
      recomputeRanks();
      schedule(TIMING.finalMs, finish);
      publish();
    };

    const finish = (): void => {
      if (phase === "done") return;
      phase = "done";
      recomputeRanks();
      const infos = playerInfos();
      const data: KdResultData = {
        questionIds: askedIds,
        total: askedIds.length,
        players: infos.map(({ id, name, score, rank, left }) => ({ id, name, score, rank, matches: state(id).matches, left })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Vorzeitig auflösen, wenn die Hauptperson und alle verbundenen Rater geantwortet haben. */
    const checkAllAnswered = (): void => {
      if (phase !== "ask") return;
      const hotGone = !ctx.isConnected(hotseatId!) || state(hotseatId!).left;
      if (hotseatChoice === null && !hotGone) return;
      const raters = ctx.activePlayerIds().filter((id) => id !== hotseatId && ctx.isConnected(id));
      if (raters.every((id) => guesses.has(id))) reveal();
    };

    schedule(TIMING.introMs, startQuestion);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (input.type === "seen") {
          seenBy.set(playerId, new Set(unpackSeen(input.ids)));
          return;
        }
        if (phase !== "ask" || state(playerId).left || input.index >= question!.answers.length) return;
        if (playerId === hotseatId) {
          if (hotseatChoice !== null) return;
          hotseatChoice = input.index;
        } else {
          if (guesses.has(playerId)) return;
          guesses.set(playerId, input.index);
        }
        ctx.broadcastTv(tvState());
        ctx.sendToPlayer(playerId, viewFor(playerId));
        checkAllAnswered();
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        if (ctx.activePlayerIds().length < 2) {
          if (phase === "ask" || phase === "reveal" || phase === "standings" || phase === "intro") showFinal();
          return;
        }
        // Geht die Hauptperson mitten in der Frage, wird sofort (ohne Wertung) aufgelöst.
        if (phase === "ask" && playerId === hotseatId) reveal();
        else {
          publish();
          checkAllAnswered();
        }
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllAnswered();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
