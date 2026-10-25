// Konstanten von „Sortiert!“ ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).

export const CATEGORY_IDS = ["zeit", "geld", "verkauf", "groesse", "mengen", "tempo"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** ID-Präfix je Kategorie (Set-IDs wie „zei-017“). */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  zeit: "zei",
  geld: "gel",
  verkauf: "ver",
  groesse: "gro",
  mengen: "men",
  tempo: "tem",
};

/** Spezialwert der Einheit: Werte sind Jahreszahlen (ohne Tausenderpunkt). */
export const YEAR_UNIT = "Jahr";
export const isYearUnit = (unit: string): boolean => unit === YEAR_UNIT;

/**
 * Sortierrichtung (eine Regel für alle Sets, kein eigenes Feld):
 * Jahreszahlen aufsteigend (oben = am ältesten), alle anderen Einheiten absteigend (oben = größter Wert).
 */
export const isAscending = (unit: string): boolean => isYearUnit(unit);

/** Karten pro Runde (Setting itemsPerRound). */
export const ITEMS_MIN = 4;
export const ITEMS_MAX = 6;
