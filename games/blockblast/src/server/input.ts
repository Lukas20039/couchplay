// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { HAND, SIZE, type BlockblastInput } from "../shared.js";

export const BlockblastInputSchema: z.ZodType<BlockblastInput> = z.object({
  type: z.literal("place"),
  slot: z.number().int().min(0).max(HAND - 1),
  x: z.number().int().min(0).max(SIZE - 1),
  y: z.number().int().min(0).max(SIZE - 1),
});
