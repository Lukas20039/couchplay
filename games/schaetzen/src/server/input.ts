// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { MAX_GUESS } from "../constants.js";
import { hasMaxTwoDecimals } from "../data/schema.js";
import { SEEN_MAX } from "../seen.js";
import type { EsInput } from "../shared.js";

export const EsInputSchema: z.ZodType<EsInput> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("guess"),
    value: z.number().min(0).max(MAX_GUESS).refine(hasMaxTwoDecimals, "Höchstens 2 Nachkommastellen"),
  }),
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
