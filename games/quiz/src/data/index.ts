// Fragenkatalog: nur von der Serverlogik importiert (TV/Handy bekommen nie den ganzen Katalog).
// Wird beim Laden mit zod validiert – ein kaputter Datensatz fällt sofort beim Serverstart auf.
import type { CategoryId } from "../shared.js";
import { ESSEN } from "./questions/essen.js";
import { GEOGRAFIE } from "./questions/geografie.js";
import { GESCHICHTE } from "./questions/geschichte.js";
import { KULTUR } from "./questions/kultur.js";
import { SPORT } from "./questions/sport.js";
import { TECHNIK } from "./questions/technik.js";
import { UNTERHALTUNG } from "./questions/unterhaltung.js";
import { WISSENSCHAFT } from "./questions/wissenschaft.js";
import { toQuestions, type Question } from "./schema.js";

export const QUESTIONS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Question[]>> = {
  geografie: toQuestions("geografie", GEOGRAFIE),
  geschichte: toQuestions("geschichte", GESCHICHTE),
  wissenschaft: toQuestions("wissenschaft", WISSENSCHAFT),
  sport: toQuestions("sport", SPORT),
  kultur: toQuestions("kultur", KULTUR),
  unterhaltung: toQuestions("unterhaltung", UNTERHALTUNG),
  essen: toQuestions("essen", ESSEN),
  technik: toQuestions("technik", TECHNIK),
};

export const ALL_QUESTIONS: readonly Question[] = Object.values(QUESTIONS_BY_CATEGORY).flat();

export type { Question } from "./schema.js";
