// Von Server, TV- und Controller-View gemeinsam genutzte Typen des Spiels.
// PLATZHALTER (Phase 1) – wird vom Spiele-Agent ersetzt.
import { z } from "zod";

/** Eingaben vom Handy (game.input.data). */
export const QuizInputSchema = z.discriminatedUnion("type", [z.object({ type: z.literal("finish") })]);
export type QuizInput = z.infer<typeof QuizInputSchema>;

/** Zustand für den TV (ctx.broadcastTv). */
export interface QuizTvState {
  phase: "placeholder";
  playerIds: string[];
}

/** Private Ansicht pro Spieler (ctx.sendToPlayer). */
export interface QuizPlayerView {
  phase: "placeholder";
}
