// Schema und Grenzen des Fragenkatalogs. Die Fragen liegen kompakt als Tupel in ./questions/*.ts.
import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_PREFIX, NAME, type CategoryId } from "../constants.js";

/** Längenlimits: Frage auf dem TV (mit Namen bis 20 Zeichen), Antworten auf dem Handy-Button. */
export const LIMITS = {
  questionMin: 10,
  /** Ohne Platzhalter; der eingesetzte Name kommt noch dazu. */
  questionMax: 100,
  answerMax: 32,
} as const;

/**
 * Rohformat: [id, Frage über die Hauptperson (3. Person mit {name}), dieselbe Frage an sie (du-Form), Antworten…].
 * 2–4 Antworten; „entweder“ hat genau 2.
 */
export type RawQuestion = readonly [id: string, about: string, toYou: string, ...answers: string[]];

const Answer = z.string().trim().min(1).max(LIMITS.answerMax);
const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z]{3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    about: z.string().trim(),
    toYou: z.string().trim().min(LIMITS.questionMin).max(LIMITS.questionMax),
    answers: z.array(Answer).min(2).max(4),
  })
  .refine((q) => q.about.includes(NAME), { message: "3.-Person-Frage braucht {name}" })
  .refine((q) => !q.toYou.includes("{"), { message: "du-Frage ohne Platzhalter" })
  .refine((q) => {
    const len = q.about.replace(NAME, "").length;
    return len >= LIMITS.questionMin && len <= LIMITS.questionMax;
  }, { message: "Länge der 3.-Person-Frage" })
  .refine((q) => new Set(q.answers.map(norm)).size === q.answers.length, { message: "Antworten müssen unterschiedlich sein" })
  .refine((q) => q.id.startsWith(`${CATEGORY_PREFIX[q.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" })
  .refine((q) => q.category !== "entweder" || q.answers.length === 2, { message: "Entweder-oder hat genau 2 Antworten" });

export type Question = z.infer<typeof QuestionSchema>;

export function toQuestions(category: CategoryId, raw: readonly RawQuestion[]): Question[] {
  return raw.map(([id, about, toYou, ...answers]) => QuestionSchema.parse({ id, category, about, toYou, answers }));
}

export { norm };
