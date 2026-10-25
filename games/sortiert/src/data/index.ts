// Set-Katalog: nur von der Serverlogik importiert. Beim Laden mit zod validiert.
import type { CategoryId } from "../constants.js";
import { toSets, type SortSet } from "./schema.js";
import { GELD } from "./sets/geld.js";
import { GROESSE } from "./sets/groesse.js";
import { MENGEN } from "./sets/mengen.js";
import { TEMPO } from "./sets/tempo.js";
import { VERKAUF } from "./sets/verkauf.js";
import { ZEIT } from "./sets/zeit.js";

export const SETS_BY_CATEGORY: Readonly<Record<CategoryId, readonly SortSet[]>> = {
  zeit: toSets("zeit", ZEIT),
  geld: toSets("geld", GELD),
  verkauf: toSets("verkauf", VERKAUF),
  groesse: toSets("groesse", GROESSE),
  mengen: toSets("mengen", MENGEN),
  tempo: toSets("tempo", TEMPO),
};

export const ALL_SETS: readonly SortSet[] = Object.values(SETS_BY_CATEGORY).flat();
export type { SortItem, SortSet } from "./schema.js";
