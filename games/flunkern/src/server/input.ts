// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { cleanText, isValidLie } from "../normalize.js";
import { SEEN_MAX } from "../seen.js";
import type { FlInput } from "../shared.js";

export const FlInputSchema: z.ZodType<FlInput> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("lie"),
    // Rohtext großzügig begrenzen; entscheidend ist die bereinigte Länge (1–40 Codepoints).
    text: z.string().max(200).refine((s) => isValidLie(cleanText(s)), "Lüge muss 1–40 Zeichen lang sein"),
  }),
  z.object({ type: z.literal("choose"), index: z.number().int().min(0).max(31) }),
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
