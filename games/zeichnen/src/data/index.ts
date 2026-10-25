// Begriffskatalog: nur von der Serverlogik importiert. Beim Laden mit zod validiert.
import type { CategoryId } from "../constants.js";
import { toWords, type Word } from "./schema.js";
import { BERUFE } from "./words/berufe.js";
import { ESSEN } from "./words/essen.js";
import { FANTASIE } from "./words/fantasie.js";
import { HAUSHALT } from "./words/haushalt.js";
import { NATUR } from "./words/natur.js";
import { ORTE } from "./words/orte.js";
import { SPORT } from "./words/sport.js";
import { TIERE } from "./words/tiere.js";

export const WORDS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Word[]>> = {
  tiere: toWords("tiere", TIERE),
  essen: toWords("essen", ESSEN),
  haushalt: toWords("haushalt", HAUSHALT),
  berufe: toWords("berufe", BERUFE),
  sport: toWords("sport", SPORT),
  orte: toWords("orte", ORTE),
  natur: toWords("natur", NATUR),
  fantasie: toWords("fantasie", FANTASIE),
};

export const ALL_WORDS: readonly Word[] = Object.values(WORDS_BY_CATEGORY).flat();
export type { Word } from "./schema.js";
