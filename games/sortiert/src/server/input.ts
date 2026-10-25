// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { ITEMS_MAX } from "../constants.js";
import { SEEN_MAX } from "../seen.js";
import type { SoInput } from "../shared.js";

export const SoInputSchema: z.ZodType<SoInput> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("order"),
    order: z
      .array(
        z
          .number()
          .int()
          .min(0)
          .max(ITEMS_MAX - 1),
      )
      .max(ITEMS_MAX)
      .refine((o) => new Set(o).size === o.length, "Karte doppelt"),
    final: z.boolean(),
  }),
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
