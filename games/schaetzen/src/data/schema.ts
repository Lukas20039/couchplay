// Schema und Grenzen des Schätzfragen-Katalogs. Die Fragen liegen kompakt als Tupel in ./questions/*.ts.
import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_PREFIX, YEAR_UNIT, type CategoryId } from "../constants.js";

export const LIMITS = {
  questionMin: 10,
  questionMax: 110,
  unitMax: 8,
  factMax: 140,
  yearMin: 1,
  yearMax: 2100,
} as const;

/**
 * Rohformat: [id, Frage, Lösung, Einheit, Fakt?].
 * Einheit "" = reine Anzahl, "Jahr" = Jahreszahl (ganzzahlig 1–2100).
 */
export type RawEstimate = readonly [id: string, question: string, answer: number, unit: string, fact?: string];

/** Höchstens 2 Nachkommastellen (robust gegen Gleitkomma-Rauschen). */
export const hasMaxTwoDecimals = (n: number): boolean => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

/** Normalisierter Text für den Doppelten-Vergleich. */
export const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const EstimateSchema = z
  .object({
    id: z.string().regex(/^[a-z]{3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    question: z.string().trim().min(LIMITS.questionMin).max(LIMITS.questionMax).endsWith("?"),
    // zod 4: z.number() lehnt NaN/Infinity bereits ab.
    answer: z.number().min(0).refine(hasMaxTwoDecimals, { message: "Höchstens 2 Nachkommastellen" }),
    unit: z.string().max(LIMITS.unitMax),
    fact: z.string().trim().min(1).max(LIMITS.factMax).optional(),
  })
  .refine((q) => q.id.startsWith(`${CATEGORY_PREFIX[q.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" })
  .refine((q) => q.unit !== YEAR_UNIT || (Number.isInteger(q.answer) && q.answer >= LIMITS.yearMin && q.answer <= LIMITS.yearMax), {
    message: "Jahreszahl muss ganzzahlig zwischen 1 und 2100 liegen",
  });

export type Estimate = z.infer<typeof EstimateSchema>;

export function toEstimates(category: CategoryId, raw: readonly RawEstimate[]): Estimate[] {
  return raw.map(([id, question, answer, unit, fact]) =>
    EstimateSchema.parse({ id, category, question, answer, unit, ...(fact !== undefined ? { fact } : {}) }),
  );
}
