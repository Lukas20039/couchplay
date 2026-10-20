// Von Server, TV- und Controller-View gemeinsam genutzte Typen des Spiels.
import { z } from "zod";

export type Mark = "X" | "O";
export type Cell = Mark | null;
export type Difficulty = "leicht" | "mittel" | "unbesiegbar";

export const DIFFICULTIES: readonly Difficulty[] = ["leicht", "mittel", "unbesiegbar"];

/** Eingaben vom Handy (game.input.data): Feld 0–8, zeilenweise von links oben. */
export const TicTacToeInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("place"), cell: z.number().int().min(0).max(8) }),
]);
export type TicTacToeInput = z.infer<typeof TicTacToeInputSchema>;

/** Settings nach parseSettings. */
export interface TicTacToeSettings {
  difficulty: Difficulty;
}

/** Ein Platz am Brett: Mensch oder Computer. */
export type Seat =
  | { kind: "human"; mark: Mark; playerId: string; name: string; avatar: string; color: number }
  | { kind: "bot"; mark: Mark; difficulty: Difficulty };

/** Serienstand über Revanchen hinweg (wird in results.data.series weitergereicht). */
export interface Series {
  /** Identifiziert die Paarung; ändert sie sich, beginnt eine neue Serie. */
  key: string;
  /** Abgeschlossene Partien inkl. der aktuellen, sobald sie entschieden ist. */
  games: number;
  draws: number;
  /** Siege je Teilnehmer-ID bzw. "bot". */
  wins: Record<string, number>;
}

export type Outcome =
  | { kind: "win"; mark: Mark; forfeit: boolean }
  | { kind: "draw" };

export type GamePhase = "playing" | "paused" | "over";

/** Zustand für den TV (ctx.broadcastTv). */
export interface TicTacToeTvState {
  phase: GamePhase;
  board: Cell[];
  /** Platz 0 = X, Platz 1 = O. */
  seats: [Seat, Seat];
  /** Wer am Zug ist (auch während der Pause). */
  turn: Mark;
  /** Wer diese Partie begonnen hat. */
  starter: Mark;
  lastMove: { cell: number; mark: Mark } | null;
  winLine: number[] | null;
  outcome: Outcome | null;
  series: Series;
  /** Getrennte Teilnehmer (Spiel pausiert). */
  waitingFor: string[];
  botThinking: boolean;
}

/** Private Ansicht pro Spieler (ctx.sendToPlayer). */
export interface TicTacToePlayerView {
  phase: GamePhase;
  board: Cell[];
  myMark: Mark;
  myColor: number;
  myTurn: boolean;
  opponent: Seat;
  /** Letzte Züge des Gegners (neuester zuletzt, höchstens zwei). */
  opponentMoves: number[];
  winLine: number[] | null;
  /** Aus eigener Sicht. */
  result: "win" | "lose" | "draw" | null;
  forfeit: boolean;
  /** Eigene Siege, Siege des Gegners, Unentschieden. */
  score: { me: number; opponent: number; draws: number };
  waitingFor: string[];
  botThinking: boolean;
}

/** Spielspezifische Ergebnisdaten (ctx.end → results.data). */
export interface TicTacToeResultData {
  series: Series;
  outcome: Outcome;
  winnerId: string | null;
}
