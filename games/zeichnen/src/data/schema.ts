// Schema und Grenzen der Begriffslisten sowie die Normalisierung, mit der der Server Tipps vergleicht.
// Die Begriffe liegen kompakt als Tupel in ./words/<kategorie>.ts.
import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_PREFIX, type CategoryId } from "../constants.js";

export const LIMITS = {
  wordMin: 2,
  wordMax: 24,
  alternativeMax: 24,
} as const;

/** Rohformat: [id, Schwierigkeit 1–3, Begriff, ...zulässige Alternativen]. */
export type RawWord = readonly [id: string, difficulty: 1 | 2 | 3, word: string, ...alternatives: string[]];

/** Artikel, die beim Vergleich wegfallen („ein Hund“ = „Hund“). */
const ARTICLES = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]);

/**
 * Normalisiert Begriff bzw. Tipp für den Vergleich: Kleinbuchstaben, ä→ae/ö→oe/ü→ue/ß→ss, übrige Akzente weg,
 * Satzzeichen und Artikel weg, Leerzeichen weg. „Der Eiffel-Turm!“ → „eiffelturm“.
 */
export function normalizeGuess(text: string): string {
  const lower = text
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "");
  const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter((s) => s.length > 0);
  const content = tokens.filter((s) => !ARTICLES.has(s));
  // Besteht der Text nur aus Artikeln, bleibt er stehen (sonst wäre er leer).
  return (content.length > 0 ? content : tokens).join("");
}

const Text = (max: number, min = 1) => z.string().trim().min(min).max(max);

export const WordSchema = z
  .object({
    id: z.string().regex(/^[a-z]{3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    word: Text(LIMITS.wordMax, LIMITS.wordMin),
    alternatives: z.array(Text(LIMITS.alternativeMax)).max(12),
  })
  .refine((w) => w.id.startsWith(`${CATEGORY_PREFIX[w.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" })
  .refine((w) => [w.word, ...w.alternatives].every((s) => normalizeGuess(s).length >= 2), { message: "Normalisiert zu kurz" })
  .refine((w) => {
    const keys = [w.word, ...w.alternatives].map(normalizeGuess);
    return new Set(keys).size === keys.length;
  }, { message: "Begriff und Alternativen müssen normalisiert unterschiedlich sein" });

export type Word = z.infer<typeof WordSchema>;

export function toWords(category: CategoryId, raw: readonly RawWord[]): Word[] {
  return raw.map(([id, difficulty, word, ...alternatives]) => WordSchema.parse({ id, category, difficulty, word, alternatives }));
}
