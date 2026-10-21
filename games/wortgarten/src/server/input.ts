// Schema der Handy-Eingaben (game.input.data). Ungültige Eingaben weist das SDK mit INVALID_INPUT ab.
import { z } from "zod";
import { MAX_CELLS, MAX_WORD_LEN, MAX_XP, type WgInput } from "../shared.js";

export const WgInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello"), xp: z.number().int().min(0).max(MAX_XP) }),
  z.object({ type: z.literal("word"), path: z.array(z.number().int().min(0).max(MAX_CELLS - 1)).min(1).max(MAX_WORD_LEN) }),
  z.object({ type: z.literal("tip") }),
]) satisfies z.ZodType<WgInput>;
