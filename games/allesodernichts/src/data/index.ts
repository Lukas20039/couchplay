// Fragenkatalog: nur von der Serverlogik importiert (TV/Handy bekommen nie den ganzen Katalog).
// Wird beim Laden mit zod validiert – ein kaputter Datensatz fällt sofort beim Serverstart auf.
import type { CategoryId } from "../constants.js";
import { ALLTAG } from "./questions/alltag.js";
import { GEOGRAFIE } from "./questions/geografie.js";
import { GESCHICHTE } from "./questions/geschichte.js";
import { KULTUR } from "./questions/kultur.js";
import { NATUR } from "./questions/natur.js";
import { RECHTSCHREIBUNG } from "./questions/rechtschreibung.js";
import { SPORT } from "./questions/sport.js";
import { WOERTER } from "./questions/woerter.js";
import { toQuestions, type Question } from "./schema.js";

export const QUESTIONS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Question[]>> = {
  rechtschreibung: toQuestions("rechtschreibung", RECHTSCHREIBUNG),
  woerter: toQuestions("woerter", WOERTER),
  geografie: toQuestions("geografie", GEOGRAFIE),
  geschichte: toQuestions("geschichte", GESCHICHTE),
  natur: toQuestions("natur", NATUR),
  kultur: toQuestions("kultur", KULTUR),
  sport: toQuestions("sport", SPORT),
  alltag: toQuestions("alltag", ALLTAG),
};

export const ALL_QUESTIONS: readonly Question[] = Object.values(QUESTIONS_BY_CATEGORY).flat();

export type { Question } from "./schema.js";
