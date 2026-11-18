// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
import { z } from "zod";
import { cleanText, isValidClue } from "../normalize.js";
import { SEEN_MAX } from "../seen.js";
import type { SpInput } from "../shared.js";

export const SpInputSchema: z.ZodType<SpInput> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready") }),
  z.object({
    type: z.literal("clue"),
    // Rohtext großzügig begrenzen; entscheidend ist die bereinigte Form (ein Wort, 1–24 Codepoints).
    text: z.string().max(100).refine((s) => isValidClue(cleanText(s)), "Hinweis muss genau ein Wort mit 1–24 Zeichen sein"),
  }),
  z.object({ type: z.literal("pass") }),
  z.object({ type: z.literal("vote"), target: z.string().min(1).max(64) }),
  z.object({ type: z.literal("guess"), index: z.number().int().min(0).max(31) }),
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
