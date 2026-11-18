// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { MAX_COLS, type VierGewinntInput } from "../shared.js";

const col = z.number().int().min(0).max(MAX_COLS - 1);

export const VierGewinntInputSchema: z.ZodType<VierGewinntInput> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("drop"), col }),
  z.object({ type: z.literal("aim"), col: col.nullable() }),
]);
