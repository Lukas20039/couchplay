// Konstanten von „Wer würde eher …?“ ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).

export const CATEGORY_IDS = ["alltag", "abenteuer", "peinlich", "zukunft", "essen", "chaos"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** ID-Präfix je Kategorie (IDs wie „all-017“). */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  alltag: "all",
  abenteuer: "abe",
  peinlich: "pei",
  zukunft: "zuk",
  essen: "ess",
  chaos: "cha",
};

/** Werte des Settings „anonymous“. */
export const VOTE_MODES = ["offen", "anonym"] as const;
export type VoteMode = (typeof VOTE_MODES)[number];
