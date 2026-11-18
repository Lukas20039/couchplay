// Konstanten von „Wer ist der Spion?“ ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).

export const CATEGORY_IDS = ["orte", "berufe", "tiere", "essen", "gegenstaende", "sport", "figuren", "feste"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** ID-Präfix je Kategorie (IDs wie „ort-017“). */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  orte: "ort",
  berufe: "ber",
  tiere: "tie",
  essen: "ess",
  gegenstaende: "geg",
  sport: "spo",
  figuren: "fig",
  feste: "fes",
};

/** Werte des Settings „mode“. */
export const MODES = ["klassisch", "undercover"] as const;
export type SpMode = (typeof MODES)[number];

/** Erlaubte Rundenzahlen (Setting „rounds“, als String im Manifest). */
export const ROUND_OPTIONS = [3, 5, 8] as const;

/** Höchstlänge eines Hinweiswortes in Zeichen (Codepoints). */
export const CLUE_MAX = 24;

/** So viele Wörter stehen dem enttarnten Spion zum Raten zur Wahl (inkl. des richtigen). */
export const GUESS_OPTIONS = 8;

/** Mindestens so viele Spieler müssen dabei sein, sonst endet das Spiel. */
export const MIN_ACTIVE = 3;

/** Punkte je Runde. */
export const POINTS = {
  /** Spion enttarnt (und Wort nicht erraten): jeder Nicht-Spion. */
  groupWin: 100,
  /** Bonus für jeden Nicht-Spion, der in der entscheidenden Abstimmung auf den Spion getippt hat. */
  correctVote: 50,
  /** Spion bleibt unentdeckt (falscher Verdacht, Gleichstand in der Stichwahl, keine Stimmen). */
  spyEscape: 300,
  /** Spion enttarnt, errät aber das Wort. */
  spyGuess: 250,
} as const;
