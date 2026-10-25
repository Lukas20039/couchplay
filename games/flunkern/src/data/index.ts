// Fragenkatalog: nur von der Serverlogik importiert. Beim Laden mit zod validiert.
import type { CategoryId } from "../constants.js";
import { ESSEN } from "./questions/essen.js";
import { GESCHICHTE } from "./questions/geschichte.js";
import { KURIOSES } from "./questions/kurioses.js";
import { TIERE } from "./questions/tiere.js";
import { WELT } from "./questions/welt.js";
import { WOERTER } from "./questions/woerter.js";
import { toBluffs, type Bluff } from "./schema.js";

export const QUESTIONS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Bluff[]>> = {
  kurioses: toBluffs("kurioses", KURIOSES),
  tiere: toBluffs("tiere", TIERE),
  woerter: toBluffs("woerter", WOERTER),
  geschichte: toBluffs("geschichte", GESCHICHTE),
  welt: toBluffs("welt", WELT),
  essen: toBluffs("essen", ESSEN),
};

export const ALL_QUESTIONS: readonly Bluff[] = Object.values(QUESTIONS_BY_CATEGORY).flat();
export type { Bluff } from "./schema.js";
