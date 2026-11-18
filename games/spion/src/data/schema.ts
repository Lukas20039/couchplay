// Schema und Grenzen des Wortkatalogs. Die Wörter liegen kompakt als Tupel in ./words/*.ts.
import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_PREFIX, type CategoryId } from "../constants.js";
import { normalizeWord } from "../normalize.js";

export const LIMITS = {
  wordMax: 24,
  undercoverMin: 1,
  undercoverMax: 2,
} as const;

/**
 * Rohformat: [id, geheimes Wort, ähnliche „Undercover“-Wörter (1–2)].
 * Beispiel: ["ort-001", "Strand", ["Schwimmbad", "Badesee"]].
 */
export type RawWord = readonly [id: string, word: string, undercover: readonly string[]];

const wordText = z
  .string()
  .min(1)
  .refine((s) => s === s.trim() && !/\s{2}/.test(s), { message: "Keine überflüssigen Leerzeichen" })
  .refine((s) => [...s].length <= LIMITS.wordMax, { message: `Höchstens ${LIMITS.wordMax} Zeichen` })
  .refine((s) => /^\p{Lu}/u.test(s), { message: "Muss groß beginnen" })
  .refine((s) => normalizeWord(s) !== "", { message: "Wort braucht Buchstaben" });

export const WordSchema = z
  .object({
    id: z.string().regex(/^[a-z]{3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    word: wordText,
    undercover: z.array(wordText).min(LIMITS.undercoverMin).max(LIMITS.undercoverMax),
  })
  .refine((w) => w.id.startsWith(`${CATEGORY_PREFIX[w.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" })
  .refine(
    (w) => {
      const keys = [w.word, ...w.undercover].map(normalizeWord);
      return new Set(keys).size === keys.length;
    },
    { message: "Undercover-Wörter müssen untereinander und zum Wort (normalisiert) verschieden sein" },
  );

export type Word = z.infer<typeof WordSchema>;

export function toWords(category: CategoryId, raw: readonly RawWord[]): Word[] {
  return raw.map(([id, word, undercover]) => WordSchema.parse({ id, category, word, undercover: [...undercover] }));
}
