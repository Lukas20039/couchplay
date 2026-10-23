// Von Server, TV- und Controller-View gemeinsam genutzte Typen und reine Brettlogik.
// Wichtig: zod wird hier NICHT importiert – es gehört nur ins Server-Bundle (server/input.ts).

/** Spielfeld 8 × 8, Feldindex = y * SIZE + x. */
export const SIZE = 8;
export const CELLS = SIZE * SIZE;
/** Teile pro Hand; sind alle gelegt, gibt es die nächsten drei. */
export const HAND = 3;

/**
 * Brett als Zeichenkette, ein Zeichen pro Feld:
 * "." leer, "0"–"6" Block in Farbe n, "#" Stein (vom Gegner geschickt).
 */
export type Board = string;
export const EMPTY = ".";
export const STONE = "#";
export const emptyBoard = (): Board => EMPTY.repeat(CELLS);

/** Form eines Teils: belegte Zellen relativ zur linken oberen Ecke. */
export interface Shape {
  id: number;
  cells: readonly (readonly [number, number])[];
  w: number;
  h: number;
  /** Farbindex 0–6. */
  color: number;
  /** Relative Häufigkeit beim Ziehen. */
  weight: number;
}

/** Formen als ASCII-Raster (X = belegt), daraus werden die Shapes erzeugt. */
const SHAPE_ROWS: ReadonlyArray<{ rows: string[]; color: number; weight: number }> = [
  { rows: ["X"], color: 0, weight: 2 },
  { rows: ["XX"], color: 1, weight: 3 },
  { rows: ["X", "X"], color: 1, weight: 3 },
  { rows: ["XXX"], color: 2, weight: 3 },
  { rows: ["X", "X", "X"], color: 2, weight: 3 },
  { rows: ["XXXX"], color: 3, weight: 2 },
  { rows: ["X", "X", "X", "X"], color: 3, weight: 2 },
  { rows: ["XXXXX"], color: 4, weight: 1 },
  { rows: ["X", "X", "X", "X", "X"], color: 4, weight: 1 },
  { rows: ["XX", "XX"], color: 5, weight: 4 },
  { rows: ["XXX", "XXX", "XXX"], color: 6, weight: 1 },
  { rows: ["XXX", "XXX"], color: 6, weight: 1 },
  { rows: ["XX", "XX", "XX"], color: 6, weight: 1 },
  // kleine Ecken (3 Felder)
  { rows: ["XX", "X."], color: 0, weight: 2 },
  { rows: ["XX", ".X"], color: 0, weight: 2 },
  { rows: ["X.", "XX"], color: 0, weight: 2 },
  { rows: [".X", "XX"], color: 0, weight: 2 },
  // große Ecken (5 Felder)
  { rows: ["XXX", "X..", "X.."], color: 3, weight: 1 },
  { rows: ["XXX", "..X", "..X"], color: 3, weight: 1 },
  { rows: ["X..", "X..", "XXX"], color: 3, weight: 1 },
  { rows: ["..X", "..X", "XXX"], color: 3, weight: 1 },
  // L (4 Felder)
  { rows: ["X.", "X.", "XX"], color: 2, weight: 1 },
  { rows: [".X", ".X", "XX"], color: 2, weight: 1 },
  { rows: ["XXX", "X.."], color: 2, weight: 1 },
  { rows: ["XXX", "..X"], color: 2, weight: 1 },
  // T
  { rows: ["XXX", ".X."], color: 4, weight: 1 },
  { rows: [".X.", "XXX"], color: 4, weight: 1 },
  { rows: ["X.", "XX", "X."], color: 4, weight: 1 },
  { rows: [".X", "XX", ".X"], color: 4, weight: 1 },
  // S/Z
  { rows: [".XX", "XX."], color: 1, weight: 1 },
  { rows: ["XX.", ".XX"], color: 1, weight: 1 },
  { rows: ["X.", "XX", ".X"], color: 1, weight: 1 },
  { rows: [".X", "XX", "X."], color: 1, weight: 1 },
];

export const SHAPES: readonly Shape[] = SHAPE_ROWS.map(({ rows, color, weight }, id) => {
  const cells: [number, number][] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === "X" && cells.push([x, y])));
  return { id, cells, w: Math.max(...rows.map((r) => r.length)), h: rows.length, color, weight };
});

// ------------------------------------------------------------------ Brettlogik

/** Passt Form `shape` mit linker oberer Ecke (x, y) aufs Brett? */
export function fits(board: Board, shape: Shape, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x + shape.w > SIZE || y + shape.h > SIZE) return false;
  return shape.cells.every(([dx, dy]) => board[(y + dy) * SIZE + x + dx] === EMPTY);
}

/** Passt die Form irgendwo hin? */
export function fitsAnywhere(board: Board, shape: Shape): boolean {
  for (let y = 0; y <= SIZE - shape.h; y++) for (let x = 0; x <= SIZE - shape.w; x++) if (fits(board, shape, x, y)) return true;
  return false;
}

export interface PlaceResult {
  board: Board;
  /** Geräumte Zeilen/Spalten (Index 0–7). */
  rows: number[];
  cols: number[];
  /** Felder, die geräumt wurden (für Animationen). */
  cleared: number[];
}

/** Legt die Form (vorher mit fits prüfen) und räumt volle Zeilen und Spalten gleichzeitig. */
export function place(board: Board, shape: Shape, x: number, y: number): PlaceResult {
  const cells = [...board];
  for (const [dx, dy] of shape.cells) cells[(y + dy) * SIZE + x + dx] = String(shape.color);
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    if (cells.slice(i * SIZE, i * SIZE + SIZE).every((c) => c !== EMPTY)) rows.push(i);
    let full = true;
    for (let j = 0; j < SIZE; j++) if (cells[j * SIZE + i] === EMPTY) full = false;
    if (full) cols.push(i);
  }
  const cleared = new Set<number>();
  for (const r of rows) for (let i = 0; i < SIZE; i++) cleared.add(r * SIZE + i);
  for (const c of cols) for (let i = 0; i < SIZE; i++) cleared.add(i * SIZE + c);
  for (const c of cleared) cells[c] = EMPTY;
  return { board: cells.join(""), rows, cols, cleared: [...cleared].sort((a, b) => a - b) };
}

// ------------------------------------------------------------------ Wertung

/** Punkte für gleichzeitig geräumte Linien (Reihen + Spalten). */
export function linePoints(lines: number): number {
  return lines <= 0 ? 0 : 10 * lines * lines;
}

/** Combo-Multiplikator: jede weitere Räumung in Folge +1 (höchstens ×5). */
export const comboMultiplier = (streak: number): number => Math.min(5, Math.max(1, streak));

/** Steine, die eine Räumung dem Gegner schickt: ab 2 Linien bzw. ab Combo 3. */
export function attackStones(lines: number, streak: number): number {
  if (lines === 0) return 0;
  return 2 * Math.max(0, lines - 1) + (streak >= 3 ? 2 : 0);
}

// ------------------------------------------------------------------ Zustände

export interface BlockblastSettings {
  durationMs: number;
  attacks: boolean;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type BlockblastInput = { type: "place"; slot: number; x: number; y: number };

export type GamePhase = "countdown" | "playing" | "over";

/** Letzte Aktion eines Spielers (für Animationen); `seq` steigt je Spieler. */
export interface LastMove {
  seq: number;
  /** Gelegte Felder. */
  placed: number[];
  cleared: number[];
  lines: number;
  points: number;
  streak: number;
  /** Geschickte Steine und Ziel (Spieler-ID) oder null. */
  attack: { to: string; stones: number } | null;
}

/** Eingehende Steine (für Warnung/Animation beim Ziel). */
export interface Incoming {
  seq: number;
  from: string;
  cells: number[];
}

export interface BoardInfo {
  id: string;
  name: string;
  avatar: string;
  color: number;
  board: Board;
  score: number;
  rank: number;
  streak: number;
  /** false = keine Züge mehr (raus) oder gegangen. */
  alive: boolean;
  left: boolean;
  moves: number;
  lines: number;
  last: LastMove | null;
  incoming: Incoming | null;
}

export interface BlockblastTvState {
  phase: GamePhase;
  /** Countdown bis Start bzw. Spielende (Spieluhr). */
  endsAt: number;
  durationMs: number;
  players: BoardInfo[];
  attacks: boolean;
}

export interface BlockblastPlayerView {
  phase: GamePhase;
  endsAt: number;
  durationMs: number;
  me: BoardInfo;
  /** Formen der Hand (null = schon gelegt). */
  hand: (number | null)[];
  /** Gegner kompakt (für die Rangliste am Handy). */
  rivals: { id: string; name: string; color: number; score: number; alive: boolean }[];
  playerCount: number;
  attacks: boolean;
}

export interface BlockblastResultData {
  players: { playerId: string; name: string; score: number; lines: number; moves: number; alive: boolean; left: boolean }[];
}
