// Fragenkatalog: nur von der Serverlogik importiert. Beim Laden mit zod validiert.
import type { CategoryId } from "../constants.js";
import { ALLTAG } from "./questions/alltag.js";
import { ENTWEDER } from "./questions/entweder.js";
import { ERINNERUNGEN } from "./questions/erinnerungen.js";
import { ESSEN } from "./questions/essen.js";
import { FREIZEIT } from "./questions/freizeit.js";
import { PERSOENLICHKEIT } from "./questions/persoenlichkeit.js";
import { REISEN } from "./questions/reisen.js";
import { WASWAEREWENN } from "./questions/waswaerewenn.js";
import { toQuestions, type Question } from "./schema.js";

export const QUESTIONS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Question[]>> = {
  alltag: toQuestions("alltag", ALLTAG),
  essen: toQuestions("essen", ESSEN),
  freizeit: toQuestions("freizeit", FREIZEIT),
  reisen: toQuestions("reisen", REISEN),
  persoenlichkeit: toQuestions("persoenlichkeit", PERSOENLICHKEIT),
  waswaerewenn: toQuestions("waswaerewenn", WASWAEREWENN),
  erinnerungen: toQuestions("erinnerungen", ERINNERUNGEN),
  entweder: toQuestions("entweder", ENTWEDER),
};

export const ALL_QUESTIONS: readonly Question[] = Object.values(QUESTIONS_BY_CATEGORY).flat();
export type { Question } from "./schema.js";
