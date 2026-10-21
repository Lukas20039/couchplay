// Von Server, TV- und Controller-View gemeinsam genutzte Typen, Regeln und Konstanten.
// Wichtig: Wortliste und zod werden hier NICHT importiert – beide gehören nur ins Server-Bundle.
import type { AvatarId, PlayerId } from "@couchplay/protocol";

// ------------------------------------------------------------------ Konstanten

export const TIMING = {
  introMs: 9000,
  roundEndMs: 15000,
  finalMs: 14000,
} as const;

/** Größtes Raster 6×6 → Zellindizes 0..35. */
export const MAX_CELLS = 36;
export const MAX_WORD_LEN = 16;
/** Obergrenze für die vom Handy gemeldeten Erfahrungspunkte (Schutz vor Unsinn). */
export const MAX_XP = 10_000_000;

export type Mode = "klassisch" | "blitz" | "langwort";
export const MODES: readonly Mode[] = ["klassisch", "blitz", "langwort"];
export type GridSetting = "auto" | "4" | "5" | "6";
export type GridSize = 4 | 5 | 6;

// --------------------------------------------------------------------- Eingaben

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts (zod bleibt so aus den Views heraus). */
export type WgInput =
  /** Gespeicherte Garten-Erfahrung des Handys (localStorage), nur im Intro. */
  | { type: "hello"; xp: number }
  /** Gewischter Pfad über benachbarte Zellen (waagrecht, senkrecht und schräg). */
  | { type: "word"; path: number[] }
  | { type: "tip" };

export interface WgSettings {
  mode: Mode;
  gridSize: GridSetting;
  rounds: number;
  roundSeconds: number;
}

// --------------------------------------------------------------- Freischaltungen

export type Unlock = "tips" | "grid5" | "gold" | "blitz" | "grid6" | "langwort" | "tips2";

/** Gartenstufen: ab `xp` Erfahrung ist `unlock` verfügbar. Stufe 1 = Start (4×4, Klassisch). */
export const LEVELS: ReadonlyArray<{ level: number; xp: number; unlock: Unlock | null }> = [
  { level: 1, xp: 0, unlock: null },
  { level: 2, xp: 40, unlock: "tips" },
  { level: 3, xp: 120, unlock: "grid5" },
  { level: 4, xp: 250, unlock: "gold" },
  { level: 5, xp: 420, unlock: "blitz" },
  { level: 6, xp: 650, unlock: "grid6" },
  { level: 7, xp: 950, unlock: "langwort" },
  { level: 8, xp: 1300, unlock: "tips2" },
];

export interface LevelInfo {
  level: number;
  xp: number;
  /** Schwelle der aktuellen Stufe. */
  levelXp: number;
  /** Schwelle der nächsten Stufe (null = höchste Stufe erreicht). */
  nextXp: number | null;
  nextUnlock: Unlock | null;
}

export function levelInfo(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]!.xp) i++;
  const cur = LEVELS[i]!;
  const next = LEVELS[i + 1] ?? null;
  return { level: cur.level, xp, levelXp: cur.xp, nextXp: next?.xp ?? null, nextUnlock: next?.unlock ?? null };
}

export function unlocksUpTo(level: number): Set<Unlock> {
  return new Set(LEVELS.filter((l) => l.level <= level && l.unlock !== null).map((l) => l.unlock!));
}

/** Freischaltungen, die zwischen zwei Stufen hinzukommen. */
export function newUnlocks(before: number, after: number): Unlock[] {
  return LEVELS.filter((l) => l.level > before && l.level <= after && l.unlock !== null).map((l) => l.unlock!);
}

export const MODE_UNLOCK: Record<Mode, Unlock | null> = { klassisch: null, blitz: "blitz", langwort: "langwort" };

/** Tatsächlich gespielte Konfiguration (nach Abgleich mit der Gartenstufe). */
export interface RoundConfig {
  size: GridSize;
  mode: Mode;
  tipsPerRound: number;
  gold: boolean;
  roundMs: number;
  minLen: number;
  /** Zeitfenster für die Combo-Serie. */
  comboWindowMs: number;
}

export interface LockedChoice {
  /** Gewünschter, aber noch gesperrter Modus (null = nichts gesperrt). */
  mode: Mode | null;
  /** Gewünschte, aber noch gesperrte Rastergröße. */
  size: GridSize | null;
}

export function resolveConfig(settings: WgSettings, level: number): { config: RoundConfig; locked: LockedChoice } {
  const u = unlocksUpTo(level);
  const maxSize: GridSize = u.has("grid6") ? 6 : u.has("grid5") ? 5 : 4;
  const wanted: GridSize | null = settings.gridSize === "auto" ? null : (Number(settings.gridSize) as GridSize);
  const size: GridSize = wanted === null ? maxSize : (Math.min(wanted, maxSize) as GridSize);
  const modeUnlock = MODE_UNLOCK[settings.mode];
  const mode: Mode = modeUnlock === null || u.has(modeUnlock) ? settings.mode : "klassisch";
  const baseMs = settings.roundSeconds * 1000;
  return {
    config: {
      size,
      mode,
      tipsPerRound: u.has("tips2") ? 2 : u.has("tips") ? 1 : 0,
      gold: u.has("gold"),
      roundMs: mode === "blitz" ? Math.max(45_000, Math.round(baseMs / 2)) : baseMs,
      minLen: mode === "langwort" ? 5 : 3,
      comboWindowMs: mode === "blitz" ? 5000 : 8000,
    },
    locked: {
      mode: mode !== settings.mode ? settings.mode : null,
      size: wanted !== null && wanted > size ? wanted : null,
    },
  };
}

// --------------------------------------------------------------------- Wertung

/** Seltene Buchstaben geben je +1. */
export const RARE_LETTERS = new Set(["Ä", "Ö", "Ü", "J", "V", "X", "Y"]);

/** Grundpunkte nach Wortlänge – lange Wörter lohnen sich deutlich mehr. */
export function basePoints(length: number): number {
  if (length <= 3) return 1;
  if (length === 4) return 2;
  if (length === 5) return 4;
  if (length === 6) return 6;
  if (length === 7) return 9;
  if (length === 8) return 12;
  return 12 + 4 * (length - 8);
}

/** Combo-Multiplikator für das n-te schnelle Wort in Folge (n ≥ 1). */
export function comboMultiplier(streak: number, mode: Mode): number {
  if (mode === "blitz") return streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
  return streak >= 6 ? 2 : streak >= 3 ? 1.5 : 1;
}

export interface WordScore {
  points: number;
  /** Gesamt-Multiplikator (Gold × Combo × Modus), ohne Einzigartig-Bonus. */
  multiplier: number;
  rare: number;
}

/** Punkte eines gültigen Worts während der Runde (der Einzigartig-Bonus ×2 kommt am Rundenende). */
export function scoreWord(word: string, opts: { gold: boolean; streak: number; mode: Mode }): WordScore {
  const letters = [...word];
  const rare = letters.filter((l) => RARE_LETTERS.has(l)).length;
  const multiplier = (opts.gold ? 2 : 1) * comboMultiplier(opts.streak, opts.mode) * (opts.mode === "langwort" ? 2 : 1);
  return { points: Math.ceil((basePoints(letters.length) + rare) * multiplier), multiplier, rare };
}

/** Zellen a und b sind Nachbarn (8er-Nachbarschaft: auch schräg). */
export function isAdjacent(a: number, b: number, size: number): boolean {
  if (a === b) return false;
  const dr = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  const dc = Math.abs((a % size) - (b % size));
  return dr <= 1 && dc <= 1;
}

/** Gültiger Pfad: im Raster, jede Zelle höchstens einmal, aufeinanderfolgende Zellen benachbart. */
export function isValidPath(path: readonly number[], size: number): boolean {
  const n = size * size;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const c = path[i]!;
    if (c < 0 || c >= n || seen.has(c)) return false;
    if (i > 0 && !isAdjacent(path[i - 1]!, c, size)) return false;
    seen.add(c);
  }
  return true;
}

// ------------------------------------------------------------------ Zustände

export interface Board {
  size: GridSize;
  /** Zeilenweise, je ein Buchstabe (A–Z, ÄÖÜ). */
  letters: string[];
  /** Goldfelder (Wort ×2). */
  gold: number[];
}

export interface WgPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  rank: number;
  /** Punkte der laufenden bzw. zuletzt beendeten Runde. */
  roundPoints: number;
  /** Wortlängen der laufenden Runde (in Fundreihenfolge) – der TV zeichnet daraus Blumen, ohne Wörter zu verraten. */
  blooms: number[];
  left: boolean;
}

export interface RoundWord {
  word: string;
  points: number;
  /** Nur diese Person hat das Wort gefunden (bei ≥ 2 Spielern ×2). */
  unique: boolean;
}

export interface RoundPlayerResult {
  playerId: PlayerId;
  points: number;
  /** Nach Punkten absteigend. */
  words: RoundWord[];
}

interface TvBase {
  rounds: number;
  /** Nach Rang sortiert (bei Gleichstand Startreihenfolge). */
  players: WgPlayerInfo[];
}

export type WgTvState =
  | (TvBase & {
      phase: "intro";
      endsAt: number;
      durationMs: number;
      level: LevelInfo;
      config: RoundConfig;
      locked: LockedChoice;
    })
  | (TvBase & {
      phase: "round";
      /** 0-basiert. */
      round: number;
      board: Board;
      config: RoundConfig;
      endsAt: number;
      durationMs: number;
    })
  | (TvBase & {
      phase: "roundEnd";
      round: number;
      board: Board;
      results: RoundPlayerResult[];
      /** Lange Wörter, die niemand gefunden hat. */
      missed: string[];
      /** Anzahl aller Wörter im Raster. */
      possible: number;
      longest: { word: string; playerIds: PlayerId[] } | null;
      /** Einzigartig-Bonus aktiv (≥ 2 Teilnehmer). */
      uniqueBonus: boolean;
      endsAt: number;
      durationMs: number;
    })
  | (TvBase & {
      phase: "final";
      levelBefore: number;
      level: LevelInfo;
      newUnlocks: Unlock[];
      endsAt: number;
      durationMs: number;
    });

export type FeedbackResult = "ok" | "dup" | "unknown" | "short" | "bad";

export interface Feedback {
  /** Fortlaufend je Spieler – das Handy zeigt jede Rückmeldung genau einmal. */
  seq: number;
  word: string;
  result: FeedbackResult;
  points: number;
  multiplier: number;
}

export interface FoundWord {
  word: string;
  points: number;
}

export interface Tip {
  start: number;
  length: number;
  prefix: string;
}

interface ViewBase {
  rounds: number;
  score: number;
  rank: number;
  playerCount: number;
}

export type WgPlayerView =
  | (ViewBase & {
      phase: "intro";
      endsAt: number;
      helloReceived: boolean;
      level: LevelInfo;
      config: RoundConfig;
      locked: LockedChoice;
    })
  | (ViewBase & {
      phase: "round";
      round: number;
      board: Board;
      config: RoundConfig;
      endsAt: number;
      durationMs: number;
      /** Neueste zuerst. */
      found: FoundWord[];
      last: Feedback | null;
      tipsLeft: number;
      tip: Tip | null;
      /** Länge der aktuellen Serie schneller Wörter und wann sie verfällt. */
      streak: number;
      streakEndsAt: number;
    })
  | (ViewBase & {
      phase: "roundEnd";
      round: number;
      roundPoints: number;
      words: RoundWord[];
      possible: number;
      uniqueBonus: boolean;
    })
  | (ViewBase & {
      phase: "final";
      xpBefore: number;
      xpAfter: number;
      level: LevelInfo;
      newUnlocks: Unlock[];
      wordCount: number;
      longest: string | null;
    });

/** Ergebnisdaten für ctx.end({ data }); `xp` wird über ctx.previous in die nächste Partie übernommen. */
export interface WgResultData {
  xp: Record<PlayerId, number>;
  level: number;
  players: Array<Pick<WgPlayerInfo, "id" | "name" | "score" | "rank" | "left"> & { words: number; longest: string | null }>;
}

/** Schlüssel im localStorage des Handys. */
export const XP_STORAGE_KEY = "couchplay.wortgarten.xp";
