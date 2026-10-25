// Konstanten von „Flunkern“ ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).

export const CATEGORY_IDS = ["kurioses", "tiere", "woerter", "geschichte", "welt", "essen"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** ID-Präfix je Kategorie (IDs wie „kur-017“). */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  kurioses: "kur",
  tiere: "tie",
  woerter: "woe",
  geschichte: "ges",
  welt: "wel",
  essen: "ess",
};

/** Höchstlänge einer Lüge (und jeder Antwort) in Zeichen (Codepoints). */
export const LIE_MAX = 40;

/** So viele Antworten (inkl. Wahrheit) stehen mindestens zur Wahl; der Server füllt mit Hauslügen auf. */
export const MIN_CHOICES = 4;

/** Punkte (in der letzten Runde doppelt). */
export const POINTS = {
  /** Wahrheit gefunden. */
  truth: 500,
  /** Je Mitspieler, der auf die eigene Lüge reinfällt (jeder Autor einer geteilten Lüge). */
  fooled: 250,
} as const;
