// Von Server, TV- und Controller-View gemeinsam genutzte Typen und Regeln.
// Wichtig: zod wird hier NICHT importiert – es gehört nur ins Server-Bundle (server/input.ts).

/** Spielfeld 10 × 10, Feldindex = y * SIZE + x (zeilenweise von links oben). */
export const SIZE = 10;
export const CELLS = SIZE * SIZE;

export type Dir = "h" | "v";
export type Difficulty = "leicht" | "mittel" | "schwer";
export const DIFFICULTIES: readonly Difficulty[] = ["leicht", "mittel", "schwer"];
export type FleetKind = "klassisch" | "gross";
export const FLEET_KINDS: readonly FleetKind[] = ["klassisch", "gross"];

/** Schiffslängen je Flotte (größtes zuerst). */
export const FLEETS: Record<FleetKind, readonly number[]> = {
  klassisch: [5, 4, 3, 3, 2],
  gross: [5, 4, 4, 3, 3, 3, 2, 2, 2, 2],
};

/** Ein Schiff: Bug bei (x, y), erstreckt sich nach rechts (h) bzw. unten (v). */
export interface Ship {
  /** Index in der Flotte (0 = größtes). */
  id: number;
  len: number;
  x: number;
  y: number;
  dir: Dir;
}

export interface Rules {
  extraShot: boolean;
  touching: boolean;
}

export interface SchiffeSettings extends Rules {
  difficulty: Difficulty;
  fleet: FleetKind;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type SchiffeInput =
  /** Aufstellung neu würfeln. */
  | { type: "shuffle" }
  /** Schiff `ship` mit dem Bug nach (x, y) verschieben und/oder drehen. */
  | { type: "move"; ship: number; x: number; y: number; dir: Dir }
  /** Aufstellung fertig (Kampf beginnt, sobald beide bereit sind). */
  | { type: "ready" }
  /** Aufstellung doch noch ändern (nur solange der Kampf nicht begonnen hat). */
  | { type: "unready" }
  | { type: "fire"; cell: number };

// ------------------------------------------------------------------ Geometrie

export const cellOf = (x: number, y: number): number => y * SIZE + x;
export const xOf = (cell: number): number => cell % SIZE;
export const yOf = (cell: number): number => Math.floor(cell / SIZE);

/** Felder eines Schiffs (auch außerhalb des Bretts, dann als -1). */
export function shipCells(ship: Pick<Ship, "len" | "x" | "y" | "dir">): number[] {
  const out: number[] = [];
  for (let i = 0; i < ship.len; i++) {
    const x = ship.dir === "h" ? ship.x + i : ship.x;
    const y = ship.dir === "v" ? ship.y + i : ship.y;
    out.push(x >= 0 && x < SIZE && y >= 0 && y < SIZE ? cellOf(x, y) : -1);
  }
  return out;
}

/** Nachbarfelder (8er-Nachbarschaft) einer Zelle. */
export function neighbours(cell: number): number[] {
  const x = xOf(cell);
  const y = yOf(cell);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) out.push(cellOf(nx, ny));
    }
  }
  return out;
}

/** Felder rund um ein Schiff (ohne das Schiff selbst). */
export function shipHalo(ship: Ship): number[] {
  const own = new Set(shipCells(ship));
  const out = new Set<number>();
  for (const c of own) for (const n of neighbours(c)) if (!own.has(n)) out.add(n);
  return [...out];
}

/** Warum eine Aufstellung ungültig ist (null = gültig). */
export type FleetProblem = "count" | "length" | "bounds" | "overlap" | "touching";

/** Prüft eine komplette Flotte gegen die Schiffslängen und Regeln. */
export function fleetProblem(ships: readonly Ship[], lengths: readonly number[], touching: boolean): FleetProblem | null {
  if (ships.length !== lengths.length) return "count";
  const occupied = new Map<number, number>();
  for (const [i, ship] of ships.entries()) {
    if (ship.id !== i || ship.len !== lengths[i]) return "length";
    const cells = shipCells(ship);
    if (cells.includes(-1)) return "bounds";
    for (const c of cells) {
      if (occupied.has(c)) return "overlap";
      occupied.set(c, i);
    }
  }
  if (!touching) {
    for (const ship of ships) {
      for (const c of shipHalo(ship)) {
        const other = occupied.get(c);
        if (other !== undefined && other !== ship.id) return "touching";
      }
    }
  }
  return null;
}

// ------------------------------------------------------------------ Zustände

/**
 * Öffentliche Sicht auf ein Gewässer, ein Zeichen pro Feld:
 * "." unbekannt, "o" Wasser (Fehlschuss), "x" Treffer, "#" versenkt,
 * "~" sicher Wasser (Nachbarfeld eines versenkten Schiffs, wenn Schiffe sich nicht berühren dürfen).
 */
export type Waters = string;
export const UNKNOWN = ".";
export const MISS = "o";
export const HIT = "x";
export const SUNK = "#";
export const CLEAR = "~";

export type ShotResult = "miss" | "hit" | "sunk";

export interface WatersView {
  cells: Waters;
  /** Versenkte Schiffe (aufgedeckt). */
  sunk: Ship[];
  /** Längen der noch schwimmenden Schiffe. */
  afloat: number[];
}

/** Ein Platz: Mensch oder Computer. */
export type Seat =
  | { kind: "human"; playerId: string; name: string; avatar: string; color: number }
  | { kind: "bot"; difficulty: Difficulty };

export type SeatIndex = 0 | 1;

/** Serienstand über Revanchen hinweg (results.data.series). */
export interface Series {
  key: string;
  games: number;
  /** Siege je Teilnehmer-ID bzw. "bot". */
  wins: Record<string, number>;
}

export type GamePhase = "setup" | "battle" | "paused" | "over";

export interface LastShot {
  /** Wer geschossen hat. */
  by: SeatIndex;
  cell: number;
  result: ShotResult;
  /** Länge des versenkten Schiffs (nur bei "sunk"). */
  sunkLen: number | null;
}

export interface Outcome {
  winner: SeatIndex;
  forfeit: boolean;
}

export interface SeatStats {
  shots: number;
  hits: number;
}

/** Zustand für den TV. Die Schiffspositionen kennt er erst bei Spielende (revealed). */
export interface SchiffeTvState {
  phase: GamePhase;
  seats: [Seat, Seat];
  ready: [boolean, boolean];
  /** Wer am Zug ist (Kampf und Pause). */
  turn: SeatIndex;
  /** waters[i] = Gewässer von Platz i (Schüsse des Gegners darauf). */
  waters: [WatersView, WatersView];
  lastShot: LastShot | null;
  outcome: Outcome | null;
  /** Alle Schiffe beider Plätze, erst wenn das Spiel entschieden ist. */
  revealed: [Ship[], Ship[]] | null;
  stats: [SeatStats, SeatStats];
  series: Series;
  rules: Rules;
  waitingFor: string[];
  botThinking: boolean;
}

/** Private Ansicht für einen Spieler. */
export interface SchiffePlayerView {
  phase: GamePhase;
  mySeat: SeatIndex;
  myColor: number;
  opponent: Seat;
  /** Eigene Flotte (in der Aufstellung der aktuelle Entwurf). */
  fleet: Ship[];
  ready: boolean;
  opponentReady: boolean;
  /** Eigene Gewässer mit den Schüssen des Gegners. */
  own: WatersView;
  /** Gewässer des Gegners mit den eigenen Schüssen. */
  target: WatersView;
  myTurn: boolean;
  lastShot: LastShot | null;
  result: "win" | "lose" | null;
  forfeit: boolean;
  /** Gegnerische Schiffe, erst bei Spielende. */
  revealed: Ship[] | null;
  score: { me: number; opponent: number };
  rules: Rules;
  waitingFor: string[];
  botThinking: boolean;
}

/** Ergebnisdaten (ctx.end → results.data); Form wie bei TicTacToe (Podium „Computer gewinnt“). */
export interface SchiffeResultData {
  series: Series;
  outcome: Outcome;
  /** Teilnehmer-ID des Siegers, "bot" für den Computer. */
  winnerId: string;
  players: { playerId: string; name: string; seat: SeatIndex; left: boolean }[];
  bot: { difficulty: Difficulty } | null;
  stats: [SeatStats, SeatStats];
}

export const otherSeat = (s: SeatIndex): SeatIndex => (s === 0 ? 1 : 0);
