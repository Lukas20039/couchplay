// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { SEEN_MAX } from "../seen.js";
import type { WeInput } from "../shared.js";

export const WeInputSchema: z.ZodType<WeInput> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("vote"), target: z.string().min(1).max(64) }),
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
