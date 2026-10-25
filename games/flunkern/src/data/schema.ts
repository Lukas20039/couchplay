// Schema und Grenzen des Bluff-Fragenkatalogs. Die Fragen liegen kompakt als Tupel in ./questions/*.ts.
import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_PREFIX, LIE_MAX, type CategoryId } from "../constants.js";
import { normalizeAnswer } from "../normalize.js";

export const LIMITS = {
  questionMin: 15,
  questionMax: 140,
  answerMax: LIE_MAX,
  liesMin: 3,
  liesMax: 5,
  factMax: 160,
} as const;

/**
 * Rohformat: [id, Frage, Wahrheit, Hauslügen (3–5), Fakt?, weitere Schreibweisen der Wahrheit?].
 * Alle Antworten 1–40 Zeichen; Hauslügen untereinander und zur Wahrheit (normalisiert) verschieden.
 */
export type RawBluff = readonly [
  id: string,
  question: string,
  answer: string,
  lies: readonly string[],
  fact?: string,
  alternatives?: readonly string[],
];

/** Normalisierter Text für den Doppelte-Fragen-Vergleich. */
export const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const answerText = z
  .string()
  .trim()
  .min(1)
  .refine((s) => [...s].length <= LIMITS.answerMax, { message: `Höchstens ${LIMITS.answerMax} Zeichen` })
  .refine((s) => normalizeAnswer(s) !== "", { message: "Antwort braucht Buchstaben oder Ziffern" });

export const BluffSchema = z
  .object({
    id: z.string().regex(/^[a-z]{3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    question: z.string().trim().min(LIMITS.questionMin).max(LIMITS.questionMax).endsWith("?"),
    answer: answerText,
    lies: z.array(answerText).min(LIMITS.liesMin).max(LIMITS.liesMax),
    fact: z.string().trim().min(1).max(LIMITS.factMax).optional(),
    alternatives: z.array(answerText).max(10),
  })
  .refine((q) => q.id.startsWith(`${CATEGORY_PREFIX[q.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" })
  .refine(
    (q) => {
      const truth = new Set([q.answer, ...q.alternatives].map(normalizeAnswer));
      const lies = q.lies.map(normalizeAnswer);
      return new Set(lies).size === lies.length && lies.every((l) => !truth.has(l));
    },
    { message: "Hauslügen müssen untereinander und zur Wahrheit (inkl. Alternativen) verschieden sein" },
  );

export type Bluff = z.infer<typeof BluffSchema>;

export function toBluffs(category: CategoryId, raw: readonly RawBluff[]): Bluff[] {
  return raw.map(([id, question, answer, lies, fact, alternatives]) =>
    BluffSchema.parse({
      id,
      category,
      question,
      answer,
      lies: [...lies],
      alternatives: [...(alternatives ?? [])],
      // Leerer Fakt = kein Fakt (Platzhalter, wenn nur Alternativen angegeben werden).
      ...(fact !== undefined && fact !== "" ? { fact } : {}),
    }),
  );
}
