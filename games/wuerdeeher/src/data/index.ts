// Aussagen-Katalog: nur von der Serverlogik importiert. Beim Laden mit zod validiert.
import type { CategoryId } from "../constants.js";
import { ABENTEUER } from "./prompts/abenteuer.js";
import { ALLTAG } from "./prompts/alltag.js";
import { CHAOS } from "./prompts/chaos.js";
import { ESSEN } from "./prompts/essen.js";
import { PEINLICH } from "./prompts/peinlich.js";
import { ZUKUNFT } from "./prompts/zukunft.js";
import { toPrompts, type Prompt } from "./schema.js";

export const PROMPTS_BY_CATEGORY: Readonly<Record<CategoryId, readonly Prompt[]>> = {
  alltag: toPrompts("alltag", ALLTAG),
  abenteuer: toPrompts("abenteuer", ABENTEUER),
  peinlich: toPrompts("peinlich", PEINLICH),
  zukunft: toPrompts("zukunft", ZUKUNFT),
  essen: toPrompts("essen", ESSEN),
  chaos: toPrompts("chaos", CHAOS),
};

export const ALL_PROMPTS: readonly Prompt[] = Object.values(PROMPTS_BY_CATEGORY).flat();
export type { Prompt } from "./schema.js";
