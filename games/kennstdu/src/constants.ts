// Konstanten von „Wie gut kennst du mich?“ ohne Abhängigkeiten (auch von TV/Handy importierbar).

export const CATEGORY_IDS = [
  "alltag",
  "essen",
  "freizeit",
  "reisen",
  "persoenlichkeit",
  "waswaerewenn",
  "erinnerungen",
  "entweder",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** ID-Präfix je Kategorie. */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  alltag: "all",
  essen: "ess",
  freizeit: "frz",
  reisen: "rei",
  persoenlichkeit: "per",
  waswaerewenn: "wwe",
  erinnerungen: "ern",
  entweder: "ent",
};

/** Platzhalter für den Namen der Hauptperson in der Frage (3. Person). */
export const NAME = "{name}";
