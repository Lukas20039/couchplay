// Beispielzustände für die Preview-Seite und die View-Tests (kein Produktionscode).
import type { Player } from "@couchplay/protocol";
import { levelInfo, resolveConfig, type Board, type WgPlayerInfo, type WgPlayerView, type WgTvState } from "../src/shared.js";

export const NOW = 1_700_000_000_000;

export const LIVE_PLAYERS: Player[] = [
  { id: "p1", name: "Anna", avatar: "fuchs", color: 0, connected: true, isHost: true },
  { id: "p2", name: "Ben", avatar: "eule", color: 1, connected: true, isHost: false },
  { id: "p3", name: "Chiara", avatar: "panda", color: 2, connected: true, isHost: false },
  { id: "p4", name: "Dominik", avatar: "roboter", color: 3, connected: false, isHost: false },
];

const info = (i: number, score: number, rank: number, roundPoints: number, blooms: number[], extra: Partial<WgPlayerInfo> = {}): WgPlayerInfo => {
  const p = LIVE_PLAYERS[i]!;
  return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, score, rank, roundPoints, blooms, left: false, ...extra };
};

const PLAYERS: WgPlayerInfo[] = [
  info(2, 86, 1, 31, [4, 3, 5, 6, 4, 7, 3, 4, 5]),
  info(0, 74, 2, 22, [3, 4, 4, 5, 3, 8]),
  info(1, 51, 3, 18, [4, 3, 3, 5]),
  info(3, 12, 4, 0, [], { left: true }),
];

/** 5×5 mit HAUS (waagrecht/senkrecht) und schrägen Wörtern. */
export const BOARD: Board = {
  size: 5,
  letters: ["G", "A", "R", "T", "E", "H", "U", "S", "E", "N", "B", "L", "U", "M", "E", "E", "I", "N", "R", "S", "T", "Ä", "K", "O", "W"],
  gold: [7, 18],
};

const LEVEL = levelInfo(310);
const { config: CONFIG } = resolveConfig({ mode: "klassisch", gridSize: "auto", rounds: 3, roundSeconds: 120 }, LEVEL.level);
const ROUND = { round: 1, board: BOARD, config: CONFIG, endsAt: NOW + 47_000, durationMs: 120_000 };

export const TV_SAMPLES: Record<string, WgTvState> = {
  intro: {
    phase: "intro",
    rounds: 3,
    players: PLAYERS.map((p) => ({ ...p, blooms: [] })),
    endsAt: NOW + 6000,
    durationMs: 9000,
    level: LEVEL,
    config: CONFIG,
    locked: { mode: "blitz", size: null },
  },
  round: { phase: "round", rounds: 3, players: PLAYERS, ...ROUND },
  roundEnd: {
    phase: "roundEnd",
    rounds: 3,
    round: 1,
    board: BOARD,
    players: PLAYERS.map((p) => ({ ...p, blooms: [] })),
    results: [
      {
        playerId: "p3",
        points: 31,
        words: [
          { word: "GARTEN", points: 12, unique: true },
          { word: "BLUME", points: 8, unique: true },
          { word: "HAUS", points: 4, unique: false },
          { word: "SEEN", points: 2, unique: false },
          { word: "RUHE", points: 4, unique: true },
          { word: "TEE", points: 1, unique: false },
        ],
      },
      { playerId: "p1", points: 22, words: [{ word: "BLUMEN", points: 12, unique: true }, { word: "HAUS", points: 4, unique: false }, { word: "SEEN", points: 2, unique: false }, { word: "TEE", points: 1, unique: false }] },
      { playerId: "p2", points: 18, words: [{ word: "MUSE", points: 4, unique: true }, { word: "HAUS", points: 4, unique: false }] },
      { playerId: "p4", points: 0, words: [] },
    ],
    missed: ["GÄRTEN", "SAUBER", "MUSTER", "RUHEN", "STERN", "BEIN"],
    possible: 214,
    longest: { word: "BLUMEN", playerIds: ["p1"] },
    uniqueBonus: true,
    endsAt: NOW + 9000,
    durationMs: 15_000,
  },
  final: {
    phase: "final",
    rounds: 3,
    players: PLAYERS.map((p) => ({ ...p, blooms: [] })),
    levelBefore: 4,
    level: levelInfo(445),
    newUnlocks: ["blitz"],
    endsAt: NOW + 7000,
    durationMs: 14_000,
  },
};

const VBASE = { rounds: 3, score: 86, rank: 1, playerCount: 4 };

export const CONTROLLER_SAMPLES: Record<string, WgPlayerView> = {
  intro: { ...VBASE, phase: "intro", endsAt: NOW + 6000, helloReceived: true, level: LEVEL, config: CONFIG, locked: { mode: null, size: null } },
  round: {
    ...VBASE,
    phase: "round",
    ...ROUND,
    found: [
      { word: "BLUME", points: 6 },
      { word: "GARTEN", points: 9 },
      { word: "HAUS", points: 4 },
      { word: "TEE", points: 1 },
    ],
    last: { seq: 4, word: "BLUME", result: "ok", points: 6, multiplier: 1.5 },
    tipsLeft: 1,
    tip: null,
    streak: 3,
    streakEndsAt: NOW + 5000,
  },
  tip: {
    ...VBASE,
    phase: "round",
    ...ROUND,
    found: [{ word: "HAUS", points: 4 }],
    last: { seq: 2, word: "SUH", result: "unknown", points: 0, multiplier: 1 },
    tipsLeft: 0,
    tip: { start: 10, length: 5, prefix: "BL" },
    streak: 0,
    streakEndsAt: 0,
  },
  roundEnd: {
    ...VBASE,
    phase: "roundEnd",
    round: 1,
    roundPoints: 31,
    words: TV_SAMPLES.roundEnd!.phase === "roundEnd" ? TV_SAMPLES.roundEnd!.results[0]!.words : [],
    possible: 214,
    uniqueBonus: true,
  },
  final: { ...VBASE, phase: "final", xpBefore: 310, xpAfter: 445, level: levelInfo(445), newUnlocks: ["blitz"], wordCount: 23, longest: "BLUMEN" },
};
