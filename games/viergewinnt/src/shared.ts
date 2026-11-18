// Von Server, TV- und Controller-View gemeinsam genutzte Typen und Brettregeln.
// Wichtig: zod wird hier NICHT importiert – es gehört nur ins Server-Bundle (server/input.ts).

export type Difficulty = "leicht" | "mittel" | "schwer";
export const DIFFICULTIES: readonly Difficulty[] = ["leicht", "mittel", "schwer"];

export type BoardSize = "7x6" | "8x7" | "9x7";
export interface Dims {
  cols: number;
  rows: number;
}
export const BOARD_SIZES: Record<BoardSize, Dims> = {
  "7x6": { cols: 7, rows: 6 },
  "8x7": { cols: 8, rows: 7 },
  "9x7": { cols: 9, rows: 7 },
};
/** Größtes Brett – Obergrenze für Spaltennummern im Eingabeschema. */
export const MAX_COLS = 9;

export const BEST_OF = [1, 3, 5] as const;
export type BestOf = (typeof BEST_OF)[number];
export const TURN_TIMES = [0, 15, 30] as const;
export type TurnTime = (typeof TURN_TIMES)[number];

export interface VierGewinntSettings {
  difficulty: Difficulty;
  bestOf: BestOf;
  /** Sekunden pro Zug, 0 = unbegrenzt. */
  turnTime: TurnTime;
  board: BoardSize;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type VierGewinntInput =
  /** Stein in Spalte `col` einwerfen. */
  | { type: "drop"; col: number }
  /** Vorschau: Spalte gewählt (TV zeigt den Stein darüber), null = keine. */
  | { type: "aim"; col: number | null };

// ------------------------------------------------------------------ Brett

/**
 * Brett als Zeichenkette, ein Zeichen pro Feld, zeilenweise von links oben
 * (Feld = row * cols + col, Zeile 0 = oben): "." leer, "0"/"1" Stein von Platz 0/1.
 */
export type Grid = string;
export const EMPTY = ".";

export type SeatIndex = 0 | 1;
export const otherSeat = (s: SeatIndex): SeatIndex => (s === 0 ? 1 : 0);
export const seatChar = (s: SeatIndex): string => (s === 0 ? "0" : "1");

export const emptyGrid = (d: Dims): Grid => EMPTY.repeat(d.cols * d.rows);
export const cellOf = (d: Dims, col: number, row: number): number => row * d.cols + col;

/** Zeile, in der ein Stein in Spalte `col` landet, oder -1 (Spalte voll / ungültig). */
export function landingRow(grid: Grid, d: Dims, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= d.cols) return -1;
  for (let row = d.rows - 1; row >= 0; row--) if (grid[cellOf(d, col, row)] === EMPTY) return row;
  return -1;
}

/** Spalten, in die noch ein Stein passt (aufsteigend). */
export function legalColumns(grid: Grid, d: Dims): number[] {
  const out: number[] = [];
  for (let col = 0; col < d.cols; col++) if (grid[col] === EMPTY) out.push(col);
  return out;
}

export const isFull = (grid: Grid): boolean => !grid.includes(EMPTY);

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0], // waagrecht
  [0, 1], // senkrecht
  [1, 1], // Diagonale ↘
  [1, -1], // Diagonale ↗
];

/**
 * Alle Gewinnreihen (≥ 4 gleiche Steine) durch Feld `cell`, jede als Feldliste in
 * Leserichtung. Leer, wenn der Stein keine Reihe vollendet.
 */
export function winLinesAt(grid: Grid, d: Dims, cell: number): number[][] {
  const mark = grid[cell];
  if (mark === undefined || mark === EMPTY) return [];
  const col = cell % d.cols;
  const row = Math.floor(cell / d.cols);
  const lines: number[][] = [];
  for (const [dc, dr] of DIRECTIONS) {
    const line = [cell];
    for (const sign of [-1, 1]) {
      let c = col + sign * dc;
      let r = row + sign * dr;
      while (c >= 0 && c < d.cols && r >= 0 && r < d.rows && grid[cellOf(d, c, r)] === mark) {
        if (sign < 0) line.unshift(cellOf(d, c, r));
        else line.push(cellOf(d, c, r));
        c += sign * dc;
        r += sign * dr;
      }
    }
    if (line.length >= 4) lines.push(line);
  }
  return lines;
}

/** Stein einwerfen (rein funktional): neues Brett + Feld, oder null bei voller Spalte. */
export function dropInto(grid: Grid, d: Dims, col: number, seat: SeatIndex): { grid: Grid; cell: number; row: number } | null {
  const row = landingRow(grid, d, col);
  if (row < 0) return null;
  const cell = cellOf(d, col, row);
  return { grid: grid.slice(0, cell) + seatChar(seat) + grid.slice(cell + 1), cell, row };
}

// ------------------------------------------------------------------ Zustände

/** Ein Platz: Mensch oder Computer. */
export type Seat =
  | { kind: "human"; playerId: string; name: string; avatar: string; color: number }
  | { kind: "bot"; difficulty: Difficulty };

/** Serienstand über Revanchen hinweg (results.data.series); gezählt werden ganze Matches. */
export interface Series {
  key: string;
  /** Abgeschlossene Matches. */
  games: number;
  draws: number;
  /** Match-Siege je Teilnehmer-ID bzw. "bot". */
  wins: Record<string, number>;
}

/**
 * playing: jemand ist am Zug · paused: ein Teilnehmer ist getrennt ·
 * roundOver: Partie entschieden, nächste folgt · over: Match entschieden.
 */
export type GamePhase = "playing" | "paused" | "roundOver" | "over";

export interface LastMove {
  by: SeatIndex;
  col: number;
  row: number;
  cell: number;
  /** Von der Zugzeit gesetzt (Zeit abgelaufen). */
  auto: boolean;
}

/** Ausgang einer Partie bzw. des Matches; winner null = unentschieden. */
export interface Outcome {
  winner: SeatIndex | null;
  forfeit: boolean;
}

export interface MatchState {
  bestOf: BestOf;
  /** Siege, die zum Match-Gewinn nötig sind. */
  needed: number;
  /** Laufende Partie (1-basiert). */
  round: number;
  /** Partie-Siege je Platz. */
  wins: [number, number];
  draws: number;
  /** Ergebnisse der beendeten Partien (Sieger-Platz, null = unentschieden). */
  history: (SeatIndex | null)[];
}

/** Zustand für den TV (öffentlich, nichts ist geheim). */
export interface VierGewinntTvState {
  phase: GamePhase;
  dims: Dims;
  grid: Grid;
  seats: [Seat, Seat];
  turn: SeatIndex;
  /** Wer die laufende Partie begonnen hat. */
  starter: SeatIndex;
  lastMove: LastMove | null;
  /** Gewinnreihen der Partie (leer, solange nicht entschieden). */
  winLines: number[][];
  /** Ausgang der laufenden Partie (roundOver/over). */
  roundOutcome: Outcome | null;
  /** Ausgang des Matches (over). */
  outcome: Outcome | null;
  match: MatchState;
  series: Series;
  /** Vorschau-Spalte je Platz (nur für den, der am Zug ist, gesetzt). */
  aims: [number | null, number | null];
  /** Zugzeit in Sekunden (0 = aus) und Ablauf (Serverzeit) des laufenden Zugs. */
  turnTime: number;
  turnEndsAt: number | null;
  waitingFor: string[];
  botThinking: boolean;
}

/** Private Ansicht für einen Spieler. */
export interface VierGewinntPlayerView {
  phase: GamePhase;
  dims: Dims;
  grid: Grid;
  mySeat: SeatIndex;
  myColor: number;
  opponent: Seat;
  myTurn: boolean;
  lastMove: LastMove | null;
  winLines: number[][];
  /** Eigene Vorschau-Spalte (für Reconnects). */
  aim: number | null;
  /** Partie aus eigener Sicht. */
  roundResult: "win" | "lose" | "draw" | null;
  /** Match aus eigener Sicht. */
  result: "win" | "lose" | "draw" | null;
  forfeit: boolean;
  match: { bestOf: BestOf; needed: number; round: number; me: number; opponent: number; draws: number };
  turnTime: number;
  turnEndsAt: number | null;
  waitingFor: string[];
  botThinking: boolean;
}

/** Ergebnisdaten (ctx.end → results.data); Form wie bei TicTacToe (Podium „Computer gewinnt“). */
export interface VierGewinntResultData {
  series: Series;
  outcome: Outcome;
  /** Teilnehmer-ID des Siegers, "bot" für den Computer, null bei Unentschieden. */
  winnerId: string | null;
  players: { playerId: string; name: string; seat: SeatIndex; left: boolean }[];
  bot: { difficulty: Difficulty } | null;
  bestOf: BestOf;
  board: BoardSize;
  /** Partie-Siege je Platz und Partie-Ergebnisse in Reihenfolge. */
  wins: [number, number];
  history: (SeatIndex | null)[];
}
