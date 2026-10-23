// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { CELLS, SIZE, type SchiffeInput } from "../shared.js";

const coord = z.number().int().min(0).max(SIZE - 1);

export const SchiffeInputSchema: z.ZodType<SchiffeInput> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("shuffle") }),
  z.object({ type: z.literal("move"), ship: z.number().int().min(0).max(15), x: coord, y: coord, dir: z.enum(["h", "v"]) }),
  z.object({ type: z.literal("ready") }),
  z.object({ type: z.literal("unready") }),
  z.object({ type: z.literal("fire"), cell: z.number().int().min(0).max(CELLS - 1) }),
]);
