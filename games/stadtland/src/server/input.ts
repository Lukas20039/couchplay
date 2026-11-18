// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { MAX_CATEGORIES } from "../constants.js";
import type { SlInput } from "../shared.js";

const round = z.number().int().min(0).max(99);
const category = z.number().int().min(0).max(MAX_CATEGORIES - 1);

export const SlInputSchema: z.ZodType<SlInput> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("answers"),
    round,
    // Rohtext großzügig begrenzen; der Server bereinigt und kürzt auf ANSWER_MAX.
    answers: z.array(z.string().max(120)).max(MAX_CATEGORIES),
  }),
  z.object({ type: z.literal("stop"), round }),
  z.object({ type: z.literal("challenge"), round, category, key: z.string().min(1).max(120), on: z.boolean() }),
  z.object({ type: z.literal("ready"), round, category }),
]);
