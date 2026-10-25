// Fragenkatalog: nur von der Serverlogik importiert. Beim Laden mit zod validiert.
import type { CategoryId } from "../constants.js";
import { ALLTAG } from "./questions/alltag.js";
import { GEOGRAFIE } from "./questions/geografie.js";
import { GESCHICHTE } from "./questions/geschichte.js";
import { MENSCH } from "./questions/mensch.js";
import { NATUR } from "./questions/natur.js";
import { SPORT } from "./questions/sport.js";
import { TECHNIK } from "./questions/technik.js";
import { WELTALL } from "./questions/weltall.js";
import { toEstimates, type Estimate } from "./schema.js";

export const QUESTIONS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Estimate[]>> = {
  geografie: toEstimates("geografie", GEOGRAFIE),
  geschichte: toEstimates("geschichte", GESCHICHTE),
  natur: toEstimates("natur", NATUR),
  mensch: toEstimates("mensch", MENSCH),
  technik: toEstimates("technik", TECHNIK),
  sport: toEstimates("sport", SPORT),
  weltall: toEstimates("weltall", WELTALL),
  alltag: toEstimates("alltag", ALLTAG),
};

export const ALL_QUESTIONS: readonly Estimate[] = Object.values(QUESTIONS_BY_CATEGORY).flat();
export type { Estimate } from "./schema.js";
