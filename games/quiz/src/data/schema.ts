// Schema und Grenzen des Fragenkatalogs. Die Fragen liegen kompakt als Tupel in
// ./questions/*.ts (richtige Antwort immer zuerst, gemischt wird erst im Spiel).
import { z } from "zod";
import { CATEGORY_IDS, type CategoryId } from "../shared.js";

/** Längenlimits, damit Fragen auf dem TV (2–3 Zeilen) und Antworten auf dem Handy-Button passen. */
export const LIMITS = {
  questionMin: 10,
  questionMax: 120,
  answerMax: 40,
} as const;

/** Rohformat: [id, Schwierigkeit 1–3, Frage, richtige Antwort, falsch, falsch, falsch]. */
export type RawQuestion = readonly [
  id: string,
  difficulty: 1 | 2 | 3,
  text: string,
  correct: string,
  wrong1: string,
  wrong2: string,
  wrong3: string,
];

const AnswerSchema = z.string().trim().min(1).max(LIMITS.answerMax);

export const QuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z]+-\d{2,3}$/),
    category: z.enum(CATEGORY_IDS),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string().trim().min(LIMITS.questionMin).max(LIMITS.questionMax),
    /** answers[0] ist die richtige Antwort. */
    answers: z.tuple([AnswerSchema, AnswerSchema, AnswerSchema, AnswerSchema]),
  })
  .refine((q) => new Set(q.answers.map((a) => a.toLowerCase())).size === 4, {
    message: "Antworten müssen unterschiedlich sein",
  })
  .refine((q) => q.id.startsWith(`${CATEGORY_PREFIX[q.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" });

export type Question = z.infer<typeof QuestionSchema>;

/** ID-Präfix je Kategorie. */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  geografie: "geo",
  geschichte: "ges",
  wissenschaft: "wis",
  sport: "spo",
  kultur: "kul",
  unterhaltung: "unt",
  essen: "ess",
  technik: "tec",
};

export function toQuestions(category: CategoryId, raw: readonly RawQuestion[]): Question[] {
  return raw.map(([id, difficulty, text, ...answers]) =>
    QuestionSchema.parse({ id, category, difficulty, text, answers }),
  );
}
