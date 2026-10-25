// Konstanten von „Schätzen!“ ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).

export const CATEGORY_IDS = ["geografie", "geschichte", "natur", "mensch", "technik", "sport", "weltall", "alltag"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** ID-Präfix je Kategorie (IDs wie „geo-017“). */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  geografie: "geo",
  geschichte: "ges",
  natur: "nat",
  mensch: "men",
  technik: "tec",
  sport: "spo",
  weltall: "wel",
  alltag: "all",
};

/** Spezialwert der Einheit: Antwort ist eine Jahreszahl (ohne Tausenderpunkt, Volltreffer nur exakt). */
export const YEAR_UNIT = "Jahr";
export const isYearUnit = (unit: string): boolean => unit === YEAR_UNIT;

/** Eingabegrenzen am Handy (Server prüft dieselben Grenzen). */
export const INPUT_LIMITS = {
  /** Ziffern insgesamt (vor + nach dem Komma). */
  maxDigits: 15,
  maxDecimals: 2,
  /** Jahreszahlen: höchstens 4 Ziffern, ohne Komma. */
  maxYearDigits: 4,
} as const;

/** Größter erlaubter Tipp (15 Ziffern). */
export const MAX_GUESS = 999_999_999_999_999;
