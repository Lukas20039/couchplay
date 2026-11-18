// Beispielzustände für Preview und View-Tests (fest eingefrorene Serverzeit NOW).
import type { Player } from "@couchplay/protocol";
import { TIMING, type AonPlayerInfo, type AonPlayerView, type AonTvState } from "../src/shared.js";

export const NOW = 1_000_000;

const P = (
  id: string,
  name: string,
  avatar: AonPlayerInfo["avatar"],
  color: number,
  score: number,
  rank: number,
  extra: Partial<AonPlayerInfo> = {},
): AonPlayerInfo => ({ id, name, avatar, color, score, rank, previousRank: rank, roundPoints: 0, status: null, stage: 0, jackpots: 0, left: false, ...extra });

const BASE_PLAYERS: AonPlayerInfo[] = [
  P("p1", "Anna", "fuchs", 0, 9, 1, { jackpots: 2 }),
  P("p2", "Ben", "eule", 1, 6, 2, { jackpots: 1 }),
  P("p3", "Chiara", "panda", 2, 4, 3),
  P("p4", "David", "roboter", 3, 1, 4),
  P("p5", "Emma", "einhorn", 4, -2, 5),
];

export const LIVE_PLAYERS: Player[] = BASE_PLAYERS.map((p, i) => ({
  id: p.id,
  name: p.name,
  avatar: p.avatar,
  color: p.color,
  connected: i !== 4,
  isHost: i === 0,
}));

const withStatus = (statuses: Array<Partial<AonPlayerInfo>>): AonPlayerInfo[] => BASE_PLAYERS.map((p, i) => ({ ...p, ...statuses[i] }));

const Q = {
  total: 10,
  index: 3,
  category: "rechtschreibung" as const,
  text: "Wie schreibt man das Wort für eine nebensächliche, unbedeutende Angelegenheit?",
  answers: ["Lapalie", "Lappalie", "Lapallie", "Lappallie"],
};

export const TV_SAMPLES: Record<string, AonTvState> = {
  intro: { phase: "intro", total: 10, players: BASE_PLAYERS, categories: ["rechtschreibung", "woerter", "geografie", "geschichte", "natur", "kultur", "sport", "alltag"], endsAt: NOW + 4_000 },
  pick: { ...Q, phase: "pick", players: BASE_PLAYERS, struck: [], endsAt: NOW + 13_000, durationMs: 25_000, answered: ["p1", "p3", "p4"] },
  spin: {
    ...Q,
    phase: "spin",
    players: withStatus([{ status: "in" }, { status: "in" }, { status: "abstain" }, { status: "in" }, { status: "in" }]),
    struck: [],
    stage: 1,
    path: [2, 3, 1, 0, 2, 3, 1, 0, 2, 3, 1, 0],
    startedAt: NOW - 2_000,
    runMs: TIMING.spinRunMs,
    endsAt: NOW + 4_400,
  },
  hit: {
    ...Q,
    phase: "spin",
    players: withStatus([{ status: "in" }, { status: "cashed", stage: 1, roundPoints: 1 }, { status: "abstain" }, { status: "in" }, { status: "out", stage: 1, roundPoints: -1 }]),
    struck: [3],
    stage: 2,
    path: [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2],
    startedAt: NOW - TIMING.spinRunMs - 300,
    runMs: TIMING.spinRunMs,
    endsAt: NOW + 900,
  },
  decide: {
    ...Q,
    phase: "decide",
    players: withStatus([{ status: "in" }, { status: "in" }, { status: "abstain" }, { status: "in" }, { status: "out", stage: 1, roundPoints: -1 }]),
    struck: [3],
    stage: 1,
    endsAt: NOW + 9_000,
    durationMs: TIMING.decideMs,
    decided: ["p1", "p4"],
  },
  reveal: {
    ...Q,
    phase: "reveal",
    players: withStatus([
      { status: "won", stage: 3, roundPoints: 4, score: 13 },
      { status: "cashed", stage: 1, roundPoints: 1, score: 7 },
      { status: "abstain" },
      { status: "out", stage: 2, roundPoints: -2, score: -1 },
      { status: "out", stage: 1, roundPoints: -1, score: -3 },
    ]),
    struck: [3, 0, 2],
    correctIndex: 1,
    picks: [
      { playerId: "p1", choice: 1, status: "won", stage: 3, points: 4 },
      { playerId: "p2", choice: 1, status: "cashed", stage: 1, points: 1 },
      { playerId: "p3", choice: null, status: "abstain", stage: 0, points: 0 },
      { playerId: "p4", choice: 0, status: "out", stage: 2, points: -2 },
      { playerId: "p5", choice: 3, status: "out", stage: 1, points: -1 },
    ],
    soloBonus: "p1",
    endsAt: NOW + 6_000,
  },
  standings: {
    phase: "standings",
    total: 10,
    index: 3,
    players: [
      P("p1", "Anna", "fuchs", 0, 13, 1, { previousRank: 1, roundPoints: 4 }),
      P("p2", "Ben", "eule", 1, 7, 2, { previousRank: 2, roundPoints: 1 }),
      P("p3", "Chiara", "panda", 2, 4, 3, { previousRank: 3 }),
      P("p4", "David", "roboter", 3, -1, 4, { previousRank: 4, roundPoints: -2 }),
      P("p5", "Emma", "einhorn", 4, -3, 5, { previousRank: 5, roundPoints: -1, left: true }),
    ],
    endsAt: NOW + 5_000,
  },
  final: {
    phase: "final",
    total: 10,
    players: [
      P("p1", "Anna", "fuchs", 0, 17, 1, { jackpots: 4 }),
      P("p2", "Ben", "eule", 1, 11, 2, { jackpots: 2 }),
      P("p3", "Chiara", "panda", 2, 11, 2, { jackpots: 1 }),
      P("p4", "David", "roboter", 3, 3, 4),
      P("p5", "Emma", "einhorn", 4, -4, 5, { left: true }),
    ],
    endsAt: NOW + 3_000,
  },
};

const VB = { total: 10, score: 4, rank: 3, playerCount: 5 };
const VQ = { ...VB, index: 3, answers: Q.answers, struck: [] as number[], choice: 1 as number | null, points: 0 };

export const CONTROLLER_SAMPLES: Record<string, AonPlayerView> = {
  intro: { ...VB, phase: "intro", endsAt: NOW + 4_000 },
  pick: { ...VB, phase: "pick", index: 3, questionId: "rs-017", category: "rechtschreibung", answers: Q.answers, endsAt: NOW + 13_000, durationMs: 25_000, locked: false, choice: null },
  locked: { ...VB, phase: "pick", index: 3, questionId: "rs-017", category: "rechtschreibung", answers: Q.answers, endsAt: NOW + 13_000, durationMs: 25_000, locked: true, choice: 1 },
  abstained: { ...VB, phase: "pick", index: 3, questionId: "rs-017", category: "rechtschreibung", answers: Q.answers, endsAt: NOW + 13_000, durationMs: 25_000, locked: true, choice: null },
  spin: { ...VQ, phase: "spin", stage: 1, status: "in" },
  decide: { ...VQ, phase: "decide", stage: 1, struck: [3], status: "in", endsAt: NOW + 9_000, durationMs: TIMING.decideMs, decision: null },
  decided: { ...VQ, phase: "decide", stage: 2, struck: [3, 0], status: "in", endsAt: NOW + 9_000, durationMs: TIMING.decideMs, decision: "stay" },
  out: { ...VQ, phase: "decide", stage: 1, struck: [3], choice: 3, status: "out", points: -1, score: 3, endsAt: NOW + 9_000, durationMs: TIMING.decideMs, decision: null },
  cashed: { ...VQ, phase: "spin", stage: 2, struck: [3], status: "cashed", points: 1, score: 5 },
  won: { ...VQ, phase: "reveal", struck: [3, 0, 2], status: "won", points: 4, score: 8, correctIndex: 1, bonus: true },
  lost: { ...VQ, phase: "reveal", struck: [3, 0, 2], choice: 0, status: "out", points: -2, score: 2, correctIndex: 1, bonus: false },
  standings: { ...VB, phase: "standings", index: 3, previousRank: 4 },
  final: { ...VB, phase: "final", rank: 1, score: 17, jackpots: 4 },
};
