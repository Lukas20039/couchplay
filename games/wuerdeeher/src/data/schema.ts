// Schema und Grenzen des Aussagen-Katalogs. Die Aussagen liegen kompakt als Tupel in ./prompts/*.ts.
import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_PREFIX, type CategoryId } from "../constants.js";

export const LIMITS = {
  textMin: 10,
  textMax: 90,
} as const;

/**
 * Rohformat: [id, Fortsetzung von „Wer würde eher …“].
 * Klein beginnend, auf „?“ endend, z. B. ["all-001", "eine Nacht im Baumarkt verbringen?"].
 */
export type RawPrompt = readonly [id: string, text: string];

/** Normalisierter Text für den Doppelten-Vergleich. */
export const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const PromptSchema = z
  .object({
    id: z.string().regex(/^[a-z]{3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    text: z
      .string()
      .min(LIMITS.textMin)
      .max(LIMITS.textMax)
      .regex(/^\p{Ll}/u, "Muss klein beginnen (Fortsetzung von „Wer würde eher …“)")
      .regex(/[^\s?]\?$/u, "Muss direkt auf „?“ enden")
      .refine((s) => s === s.trim() && !/\s{2}/.test(s), "Keine überflüssigen Leerzeichen")
      .refine((s) => (s.match(/\?/g) ?? []).length === 1, "Genau ein „?“")
      .refine((s) => !s.includes('"'), "Keine geraden Anführungszeichen")
      // „Wer würde eher sich …“ klingt schief – reflexive Verben anders formulieren.
      .refine((s) => !/^(sich|mich|dich)\s/.test(s), "Nicht mit Reflexivpronomen beginnen"),
  })
  .refine((p) => p.id.startsWith(`${CATEGORY_PREFIX[p.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" });

export type Prompt = z.infer<typeof PromptSchema>;

export function toPrompts(category: CategoryId, raw: readonly RawPrompt[]): Prompt[] {
  return raw.map(([id, text]) => PromptSchema.parse({ id, category, text }));
}
