// Beispielzustände für die Preview-Seite und die View-Tests (kein Produktionscode).
import type { Player } from "@couchplay/protocol";
import type { QuizPlayerInfo, QuizPlayerView, QuizTvState } from "../src/shared.js";

export const NOW = 1_700_000_000_000;

export const LIVE_PLAYERS: Player[] = [
  { id: "p1", name: "Anna", avatar: "fuchs", color: 0, connected: true, isHost: true },
  { id: "p2", name: "Ben", avatar: "eule", color: 1, connected: true, isHost: false },
  { id: "p3", name: "Chiara", avatar: "panda", color: 2, connected: true, isHost: false },
  { id: "p4", name: "Dominik", avatar: "roboter", color: 3, connected: false, isHost: false },
  { id: "p5", name: "Elif", avatar: "einhorn", color: 4, connected: true, isHost: false },
  { id: "p6", name: "Florian", avatar: "krake", color: 5, connected: true, isHost: false },
];

const info = (
  i: number,
  score: number,
  rank: number,
  previousRank: number | null,
  roundPoints: number,
  extra: Partial<QuizPlayerInfo> = {},
): QuizPlayerInfo => {
  const p = LIVE_PLAYERS[i]!;
  return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, score, rank, previousRank, roundPoints, correctCount: Math.round(score / 800), left: false, ...extra };
};

/** Nach Rang sortiert, inkl. Gleichstand (Rang 3 doppelt) und einem Spieler, der verlassen hat. */
const PLAYERS: QuizPlayerInfo[] = [
  info(2, 4120, 1, 2, 912),
  info(0, 3890, 2, 1, 0),
  info(1, 3105, 3, 4, 875),
  info(4, 3105, 3, 3, 640),
  info(3, 1960, 5, 5, 0),
  info(5, 1210, 6, 6, 0, { left: true }),
];

const Q = {
  index: 6,
  total: 10,
  category: "geografie" as const,
  text: "Welches Gewässer liegt am tiefsten Punkt der Landoberfläche der Erde?",
  answers: ["Kaspisches Meer", "Totes Meer", "Baikalsee", "See Genezareth"],
};

export const TV_SAMPLES: Record<string, QuizTvState> = {
  intro: {
    phase: "intro",
    total: 10,
    players: PLAYERS.map((p) => ({ ...p, score: 0, rank: 1, previousRank: null, roundPoints: 0 })),
    categories: ["geografie", "geschichte", "wissenschaft", "sport", "kultur", "unterhaltung", "essen", "technik"],
    endsAt: NOW + 3_400,
  },
  question: { phase: "question", ...Q, players: PLAYERS, endsAt: NOW + 12_300, durationMs: 20_000, answered: ["p1", "p3", "p5"] },
  reveal: {
    phase: "reveal",
    ...Q,
    players: PLAYERS,
    correctIndex: 1,
    distribution: [1, 3, 0, 1],
    picks: [
      { playerId: "p1", choice: 0, correct: false, points: 0 },
      { playerId: "p2", choice: 1, correct: true, points: 875 },
      { playerId: "p3", choice: 1, correct: true, points: 912 },
      { playerId: "p4", choice: null, correct: false, points: 0 },
      { playerId: "p5", choice: 1, correct: true, points: 640 },
      { playerId: "p6", choice: 3, correct: false, points: 0 },
    ],
    endsAt: NOW + 5_000,
  },
  standings: { phase: "standings", total: 10, index: 6, players: PLAYERS, endsAt: NOW + 5_000 },
  final: { phase: "final", total: 10, players: PLAYERS, endsAt: NOW + 2_000 },
};

const base = { total: 10, score: 3105, rank: 3, playerCount: 6 };

export const CONTROLLER_SAMPLES: Record<string, QuizPlayerView> = {
  intro: { ...base, score: 0, rank: 1, phase: "intro", endsAt: NOW + 3_400 },
  question: { ...base, phase: "question", index: Q.index, category: Q.category, answers: Q.answers, endsAt: NOW + 12_300, durationMs: 20_000, choice: null },
  locked: { ...base, phase: "question", index: Q.index, category: Q.category, answers: Q.answers, endsAt: NOW + 12_300, durationMs: 20_000, choice: 2 },
  correct: { ...base, phase: "reveal", index: Q.index, answers: Q.answers, choice: 1, correctIndex: 1, correct: true, points: 875 },
  wrong: { ...base, score: 3890, rank: 2, phase: "reveal", index: Q.index, answers: Q.answers, choice: 0, correctIndex: 1, correct: false, points: 0 },
  standings: { ...base, phase: "standings", index: Q.index, previousRank: 4 },
  final: { ...base, score: 4120, rank: 1, phase: "final", correctCount: 8 },
};
