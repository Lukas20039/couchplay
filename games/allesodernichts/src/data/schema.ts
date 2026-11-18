// Schema und Grenzen des Fragenkatalogs. Die Fragen liegen kompakt als Tupel in
// ./questions/*.ts (richtige Antwort immer zuerst, gemischt wird erst im Spiel).
import { z } from "zod";
import { CATEGORY_IDS, type CategoryId } from "../constants.js";

/** Längenlimits, damit Fragen auf dem TV (2–3 Zeilen) und Antworten auf dem Handy-Button passen. */
export const LIMITS = {
  questionMin: 10,
  questionMax: 130,
  answerMax: 40,
} as const;

/** Rohformat: [id, Frage, richtige Antwort, falsch, falsch, falsch]. */
export type RawQuestion = readonly [id: string, text: string, correct: string, wrong1: string, wrong2: string, wrong3: string];

const AnswerSchema = z.string().trim().min(1).max(LIMITS.answerMax);

/** ID-Präfix je Kategorie. */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  rechtschreibung: "rs",
  woerter: "wb",
  geografie: "geo",
  geschichte: "ges",
  natur: "nat",
  kultur: "kul",
  sport: "spo",
  alltag: "all",
};

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z]{2,3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    text: z.string().trim().min(LIMITS.questionMin).max(LIMITS.questionMax),
    /** answers[0] ist die richtige Antwort. */
    answers: z.tuple([AnswerSchema, AnswerSchema, AnswerSchema, AnswerSchema]),
  })
  // Groß-/Kleinschreibung zählt: Bei Rechtschreibfragen kann genau sie den Unterschied machen.
  .refine((q) => new Set(q.answers).size === 4, { message: "Antworten müssen unterschiedlich sein" })
  .refine((q) => q.id.startsWith(`${CATEGORY_PREFIX[q.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" });

export type Question = z.infer<typeof QuestionSchema>;

export function toQuestions(category: CategoryId, raw: readonly RawQuestion[]): Question[] {
  return raw.map(([id, text, ...answers]) => QuestionSchema.parse({ id, category, text, answers }));
}
