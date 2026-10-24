// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { SEEN_MAX } from "../seen.js";
import type { KdInput } from "../shared.js";

export const KdInputSchema: z.ZodType<KdInput> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), index: z.number().int().min(0).max(3) }),
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
