// Konstanten des Quiz ohne Abhängigkeiten (auch von TV/Handy importierbar, ohne zod mitzuziehen).

export const CATEGORY_IDS = [
  "geografie",
  "geschichte",
  "wissenschaft",
  "sport",
  "kultur",
  "unterhaltung",
  "essen",
  "technik",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Anzahl Antwortmöglichkeiten (rot ▲, blau ◆, gelb ●, grün ■). */
export const ANSWER_COUNT = 4;

/** Maximalpunkte für eine sofortige richtige Antwort. */
export const MAX_POINTS = 1000;

/** Dauer der Phasen ohne Spielereingabe (ms). */
export const TIMING = {
  introMs: 5_000,
  revealMs: 7_000,
  standingsMs: 6_000,
  /** Podium bleibt so lange stehen (TV zeigt Fortschrittsbalken), danach ctx.end() → Raumphase "results". */
  finalMs: 5_000,
} as const;

/**
 * Punkte für eine richtige Antwort: 1000 × (0,5 + 0,5 × Restzeitanteil), gerundet.
 * Falsche oder fehlende Antworten bekommen 0 (das prüft der Aufrufer).
 */
export function pointsForCorrect(remainingMs: number, durationMs: number): number {
  const share = durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0;
  return Math.round(MAX_POINTS * (0.5 + 0.5 * share));
}
