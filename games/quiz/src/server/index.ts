// Serverlogik Allgemeinwissen-Quiz (server-authoritative).
// Ablauf: intro → (question → reveal → standings)* → final → ctx.end().
// Nach der letzten Auflösung folgt direkt das Finale statt eines Zwischenstands.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { QUESTIONS_BY_CATEGORY } from "../data/index.js";
import {
  CATEGORY_IDS,
  QuizInputSchema,
  TIMING,
  pointsForCorrect,
  type CategoryId,
  type QuizInput,
  type QuizPick,
  type QuizPlayerInfo,
  type QuizPlayerView,
  type QuizResultData,
  type QuizSettings,
  type QuizTvState,
} from "../shared.js";
import { drawQuestions, type RoundQuestion } from "./questions.js";
import { rankScores } from "./ranking.js";

type Ctx = GameContext<QuizSettings, QuizTvState, QuizPlayerView>;
type Phase = "intro" | "question" | "reveal" | "standings" | "final" | "done";

interface PlayerState {
  score: number;
  rank: number;
  previousRank: number | null;
  roundPoints: number;
  correctCount: number;
  left: boolean;
  order: number;
}

interface Answer {
  choice: number;
  points: number;
}

/** Rohwerte (bereits gegen das Manifest validiert) → typisierte Settings. Defensiv gegen Fremdwerte. */
export function parseQuizSettings(values: SettingsValues): QuizSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    categories: categories.length > 0 ? categories : [...CATEGORY_IDS],
    rounds: num(values.rounds, 10, 1, 50),
    answerSeconds: num(values.answerSeconds, 20, 5, 120),
  };
}

function previousQuestionIds(ctx: Ctx): Set<string> {
  const data = ctx.previous?.data as Partial<QuizResultData> | undefined;
  return new Set(Array.isArray(data?.questionIds) ? data.questionIds.filter((x) => typeof x === "string") : []);
}

export default defineGame<QuizSettings, QuizInput, QuizTvState, QuizPlayerView>({
  manifest,
  inputSchema: QuizInputSchema,
  parseSettings: parseQuizSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const questions: RoundQuestion[] = drawQuestions(
      QUESTIONS_BY_CATEGORY,
      settings.categories,
      settings.rounds,
      ctx.rng,
      previousQuestionIds(ctx),
    );
    const total = questions.length;
    const durationMs = settings.answerSeconds * 1000;

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [
        p.id,
        { score: 0, rank: 1, previousRank: null, roundPoints: 0, correctCount: 0, left: false, order },
      ]),
    );

    let phase: Phase = "intro";
    let index = -1;
    let endsAt = 0;
    let timer: TimerId | null = null;
    let answers = new Map<PlayerId, Answer>();
    let lastPicks: QuizPick[] = [];

    // ---------------------------------------------------------------- Hilfen

    const state = (id: PlayerId): PlayerState => players.get(id)!;

    const recomputeRanks = (): void => {
      const ranked = rankScores([...players].map(([id, s]) => ({ id, score: s.score, order: s.order })));
      for (const r of ranked) state(r.id).rank = r.rank;
    };

    /** Spielerliste für den TV, sortiert nach Rang (Gleichstand: Startreihenfolge). */
    const playerInfos = (): QuizPlayerInfo[] =>
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
            previousRank: s.previousRank,
            roundPoints: s.roundPoints,
            correctCount: s.correctCount,
            left: s.left,
          };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const base = (id: PlayerId) => ({
      total,
      score: state(id).score,
      rank: state(id).rank,
      playerCount: ctx.players.length,
    });

    const current = (): RoundQuestion => questions[index]!;

    const schedule = (ms: number, next: () => void): void => {
      if (timer !== null) ctx.timers.clear(timer);
      const cd = ctx.timers.countdown(ms, () => {
        timer = null;
        next();
      });
      timer = cd.id;
      endsAt = cd.endsAt;
    };

    // --------------------------------------------------------------- Ausgabe

    const tvState = (): QuizTvState => {
      const players = playerInfos();
      switch (phase) {
        case "intro":
          return { phase, total, players, categories: [...settings.categories], endsAt };
        case "question": {
          const q = current();
          return {
            phase,
            total,
            players,
            index,
            category: q.category,
            text: q.text,
            answers: [...q.answers],
            endsAt,
            durationMs,
            // In Startreihenfolge, nicht in Antwortreihenfolge → verrät nichts über Tempo-Ränge.
            answered: ctx.players.filter((p) => answers.has(p.id)).map((p) => p.id),
          };
        }
        case "reveal": {
          const q = current();
          const distribution = [0, 0, 0, 0];
          for (const a of answers.values()) distribution[a.choice]!++;
          return {
            phase,
            total,
            players,
            index,
            category: q.category,
            text: q.text,
            answers: [...q.answers],
            correctIndex: q.correctIndex,
            distribution,
            picks: lastPicks,
            endsAt,
          };
        }
        case "standings":
          return { phase, total, players, index, endsAt };
        case "final":
        case "done":
          return { phase: "final", total, players, endsAt };
      }
    };

    const viewFor = (id: PlayerId): QuizPlayerView => {
      const b = base(id);
      switch (phase) {
        case "intro":
          return { ...b, phase, endsAt };
        case "question": {
          const q = current();
          return {
            ...b,
            phase,
            index,
            category: q.category,
            answers: [...q.answers],
            endsAt,
            durationMs,
            choice: answers.get(id)?.choice ?? null,
          };
        }
        case "reveal": {
          const q = current();
          const a = answers.get(id);
          return {
            ...b,
            phase,
            index,
            answers: [...q.answers],
            choice: a?.choice ?? null,
            correctIndex: q.correctIndex,
            correct: a !== undefined && a.choice === q.correctIndex,
            points: a?.points ?? 0,
          };
        }
        case "standings":
          return { ...b, phase, index, previousRank: state(id).previousRank };
        case "final":
        case "done":
          return { ...b, phase: "final", correctCount: state(id).correctCount };
      }
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      ctx.sendToAllPlayers((p) => viewFor(p.id));
    };

    // ---------------------------------------------------------------- Phasen

    const startQuestion = (i: number): void => {
      index = i;
      answers = new Map();
      phase = "question";
      schedule(durationMs, reveal);
      publish();
    };

    const reveal = (): void => {
      if (phase !== "question") return;
      if (timer !== null) ctx.timers.clear(timer);
      const q = current();
      for (const s of players.values()) {
        s.previousRank = s.rank;
        s.roundPoints = 0;
      }
      lastPicks = ctx.players.map((p) => {
        const a = answers.get(p.id);
        const correct = a !== undefined && a.choice === q.correctIndex;
        const s = state(p.id);
        if (a && correct) {
          s.score += a.points;
          s.roundPoints = a.points;
          s.correctCount++;
        }
        return { playerId: p.id, choice: a?.choice ?? null, correct, points: correct ? a!.points : 0 };
      });
      recomputeRanks();
      phase = "reveal";
      const isLast = index >= total - 1;
      schedule(TIMING.revealMs, isLast ? showFinal : showStandings);
      publish();
    };

    const showStandings = (): void => {
      phase = "standings";
      schedule(TIMING.standingsMs, () => startQuestion(index + 1));
      publish();
    };

    const showFinal = (): void => {
      phase = "final";
      schedule(TIMING.finalMs, finish);
      publish();
    };

    const finish = (): void => {
      if (phase === "done") return;
      phase = "done";
      recomputeRanks();
      const infos = playerInfos();
      const data: QuizResultData = {
        questionIds: questions.map((q) => q.id),
        total,
        players: infos.map(({ id, name, score, rank, correctCount, left }) => ({ id, name, score, rank, correctCount, left })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /**
     * Frage vorzeitig auflösen, wenn alle verbundenen aktiven Spieler geantwortet haben.
     * Ist gerade niemand verbunden, läuft die Zeit normal ab (kein Durchrauschen).
     */
    const checkAllAnswered = (): void => {
      if (phase !== "question") return;
      const relevant = ctx.activePlayerIds().filter((id) => ctx.isConnected(id));
      if (relevant.length > 0 && relevant.every((id) => answers.has(id))) reveal();
    };

    // ---------------------------------------------------------------- Start

    if (total === 0) {
      // Kann mit gültigen Settings nicht passieren (≥ 40 Fragen je Kategorie), aber nie hängen bleiben.
      ctx.log.error("Quiz: keine Fragen für die gewählten Kategorien", { categories: settings.categories });
      finish();
      return { onPlayerInput() {}, onPlayerLeave() {} };
    }

    schedule(TIMING.introMs, () => startQuestion(0));
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (input.type !== "answer") return;
        // Nur während der Frage, nur einmal, nur für aktive Teilnehmer.
        if (phase !== "question" || answers.has(playerId) || state(playerId).left) return;
        const remaining = endsAt - ctx.now();
        if (remaining < 0) return;
        const q = current();
        const points = input.index === q.correctIndex ? pointsForCorrect(remaining, durationMs) : 0;
        answers.set(playerId, { choice: input.index, points });
        ctx.broadcastTv(tvState());
        ctx.sendToPlayer(playerId, viewFor(playerId));
        checkAllAnswered();
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        if (ctx.activePlayerIds().length === 0) {
          finish();
          return;
        }
        ctx.broadcastTv(tvState());
        checkAllAnswered();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllAnswered();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
