// Wortkatalog: nur von der Serverlogik importiert (Handys und TV kennen ihn nicht). Beim Laden mit zod validiert.
import type { CategoryId } from "../constants.js";
import { toWords, type Word } from "./schema.js";
import { BERUFE } from "./words/berufe.js";
import { ESSEN } from "./words/essen.js";
import { FESTE } from "./words/feste.js";
import { FIGUREN } from "./words/figuren.js";
import { GEGENSTAENDE } from "./words/gegenstaende.js";
import { ORTE } from "./words/orte.js";
import { SPORT } from "./words/sport.js";
import { TIERE } from "./words/tiere.js";

export const WORDS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Word[]>> = {
  orte: toWords("orte", ORTE),
  berufe: toWords("berufe", BERUFE),
  tiere: toWords("tiere", TIERE),
  essen: toWords("essen", ESSEN),
  gegenstaende: toWords("gegenstaende", GEGENSTAENDE),
  sport: toWords("sport", SPORT),
  figuren: toWords("figuren", FIGUREN),
  feste: toWords("feste", FESTE),
};

export const ALL_WORDS: readonly Word[] = Object.values(WORDS_BY_CATEGORY).flat();
export type { Word } from "./schema.js";
