// Von Server, TV- und Controller-View gemeinsam genutzte Typen des Spiels.
// PLATZHALTER (Phase 1) – wird vom Spiele-Agent ersetzt.
import { z } from "zod";

/** Eingaben vom Handy (game.input.data). */
export const TicTacToeInputSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("finish") })]);
export type TicTacToeInput = z.infer<typeof TicTacToeInputSchema>;

/** Zustand für den TV (ctx.broadcastTv). */
export interface TicTacToeTvState {
  phase: "placeholder";
  playerIds: string[];
}

/** Private Ansicht pro Spieler (ctx.sendToPlayer). */
export interface TicTacToePlayerView {
  phase: "placeholder";
}
