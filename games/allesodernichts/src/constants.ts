// Konstanten von „Alles oder nichts“ ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).

export const CATEGORY_IDS = [
  "rechtschreibung",
  "woerter",
  "geografie",
  "geschichte",
  "natur",
  "kultur",
  "sport",
  "alltag",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Anzahl Antwortmöglichkeiten (rot ▲, blau ◆, gelb ●, grün ■). */
export const ANSWER_COUNT = 4;

/** Eliminationsrunden je Frage (alle falschen Antworten fliegen nacheinander raus). */
export const STAGES = ANSWER_COUNT - 1;

/** Bonus, wenn genau ein Spieler bis zur letzten Elimination drinbleibt und richtig liegt. */
export const SOLO_BONUS = 1;

/** Dauer der Phasen (ms). */
export const TIMING = {
  introMs: 6_000,
  /** Lauflicht über die Antworten bis zum Stillstand (TV-Animation). */
  spinRunMs: 5_200,
  /** Gesamtdauer der Phase "spin": Lauflicht + kurzes Innehalten auf der gestrichenen Antwort. */
  spinMs: 6_400,
  /** Entscheidung „Aussteigen oder weiter“. */
  decideMs: 15_000,
  revealMs: 8_000,
  standingsMs: 6_000,
  /** Podium bleibt so lange stehen (TV zeigt Fortschrittsbalken), danach ctx.end() → Raumphase "results". */
  finalMs: 6_000,
} as const;

/** Punkte fürs Aussteigen nach überstandener Elimination `stage` (1-basiert) bzw. fürs Durchhalten bis zum Ende. */
export const cashValue = (stage: number): number => stage;

/** Punktabzug, wenn die eigene Antwort in Elimination `stage` (1-basiert) gestrichen wird. */
export const lossValue = (stage: number): number => -stage;
