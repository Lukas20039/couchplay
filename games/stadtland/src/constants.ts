// Konstanten von „Stadt, Land, Fluss“ ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).
// Die Anzeigenamen der Kategorien stehen in i18n/de.ts.

export const SET_IDS = ["klassisch", "essen", "popkultur", "quatsch", "gemischt"] as const;
export type SetId = (typeof SET_IDS)[number];

/** Alle Kategorien (IDs). Reihenfolge = Anzeigereihenfolge innerhalb einer Runde. */
export const CATEGORY_IDS = [
  // Klassisch
  "stadt",
  "land",
  "fluss",
  "name",
  "beruf",
  "tier",
  // Essen & Trinken
  "gericht",
  "obstgemuese",
  "getraenk",
  "suesses",
  "gewuerz",
  "kuechengeraet",
  "pizzabelag",
  "fruehstueck",
  "imbiss",
  // Popkultur
  "film",
  "serie",
  "musik",
  "promi",
  "figur",
  "spiel",
  "marke",
  "song",
  "buch",
  // Quatsch
  "ausrede",
  "hosentasche",
  "haustiername",
  "superkraft",
  "urlaub",
  "geschenk",
  "kuehlschrank",
  "aufstehen",
  "bandname",
  "nachbar",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Kategorien je Set. „Gemischt“ zieht aus allen. */
export const SETS: Record<SetId, readonly CategoryId[]> = {
  klassisch: ["stadt", "land", "fluss", "name", "beruf", "tier"],
  essen: ["gericht", "obstgemuese", "getraenk", "suesses", "gewuerz", "kuechengeraet", "pizzabelag", "fruehstueck", "imbiss"],
  popkultur: ["film", "serie", "musik", "promi", "figur", "spiel", "marke", "song", "buch"],
  quatsch: ["ausrede", "hosentasche", "haustiername", "superkraft", "urlaub", "geschenk", "kuehlschrank", "aufstehen", "bandname", "nachbar"],
  gemischt: CATEGORY_IDS,
};

/**
 * Spielbare Buchstaben. Ausgeschlossen sind die seltenen C, J, Q, V, X, Y (und Umlaute):
 * für die gibt es in vielen Kategorien kaum Antworten.
 */
export const LETTERS = ["A", "B", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "W", "Z"] as const;
export type Letter = (typeof LETTERS)[number];

/** Höchstlänge einer Antwort in Zeichen (Codepoints). */
export const ANSWER_MAX = 30;

/** So viele Kategorien hat eine Runde höchstens (Grenze für Eingaben). */
export const MAX_CATEGORIES = 6;

/** Punkte je Kategorie (klassisch). */
export const POINTS = {
  /** Einzige gültige Antwort in der Kategorie. */
  solo: 20,
  /** Gültige Antwort, die sonst niemand (normalisiert gleich) hat. */
  unique: 10,
  /** Gültige Antwort, die auch andere haben. */
  shared: 5,
} as const;
