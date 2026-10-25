// Wertung einer Schätzfrage (rein funktional, vom Server und in Tests genutzt).
//
// Mehrere Spieler: Rangfolge nach absolutem Abstand zur Lösung. Platz 1 → 100, 2 → 70, 3 → 50,
// 4 → 30, alle weiteren mit Tipp → 10. Gleicher Abstand = gleicher Platz = gleiche Punkte
// (Wettkampf-Rangfolge: 1, 1, 3 …). Volltreffer +50: Jahreszahl exakt, sonst Abweichung ≤ 2 %.
// Allein: Punkte nach Genauigkeit (SOLO_TIERS), ein Volltreffer ist dort schon eingerechnet.
// Ohne Tipp gibt es immer 0.
import { isYearUnit } from "./constants.js";
import { distanceOf } from "./format.js";

/** Punkte je Platz (Index 0 = Platz 1); ab Platz 5 PLACE_REST. */
export const PLACE_POINTS = [100, 70, 50, 30] as const;
export const PLACE_REST = 10;
export const BULLSEYE_BONUS = 50;
/** Erlaubte relative Abweichung für einen Volltreffer (keine Jahreszahl). */
export const BULLSEYE_SHARE = 0.02;

/** Ein-Spieler-Wertung: höchstens `max` relative Abweichung → Punkte (erste passende Stufe zählt). */
export const SOLO_TIERS: readonly { max: number; points: number }[] = [
  { max: 0.02, points: 150 },
  { max: 0.1, points: 100 },
  { max: 0.25, points: 60 },
  { max: 0.5, points: 30 },
];
/** Ein-Spieler-Wertung bei Jahreszahlen: höchstens so viele Jahre daneben → Punkte. */
export const SOLO_YEAR_TIERS: readonly { max: number; points: number }[] = [
  { max: 0, points: 150 },
  { max: 2, points: 100 },
  { max: 10, points: 60 },
  { max: 25, points: 30 },
];

/** Relative Abweichung (Lösung 0: exakt → 0, sonst unendlich). */
export function relativeError(guess: number, answer: number): number {
  const d = distanceOf(guess, answer);
  if (answer === 0) return d === 0 ? 0 : Infinity;
  return d / answer;
}

export function isBullseye(guess: number, answer: number, unit: string): boolean {
  if (isYearUnit(unit)) return distanceOf(guess, answer) === 0;
  return relativeError(guess, answer) <= BULLSEYE_SHARE + 1e-9;
}

export const pointsForPlace = (place: number): number => PLACE_POINTS[place - 1] ?? PLACE_REST;

export function soloPoints(guess: number, answer: number, unit: string): number {
  const year = isYearUnit(unit);
  const err = year ? distanceOf(guess, answer) : relativeError(guess, answer);
  const tiers = year ? SOLO_YEAR_TIERS : SOLO_TIERS;
  return tiers.find((t) => err <= t.max + 1e-9)?.points ?? 0;
}

export interface GuessInput {
  playerId: string;
  value: number | null;
}

export interface ScoredGuess {
  playerId: string;
  value: number | null;
  /** Abstand zur Lösung (null ohne Tipp). */
  distance: number | null;
  /** Platz bei dieser Frage (Gleichstand = gleicher Platz), null ohne Tipp. */
  place: number | null;
  bullseye: boolean;
  /** Punkte dieser Frage inkl. Volltreffer-Bonus. */
  points: number;
}

/** Wertet alle Tipps einer Frage. `solo` = Ein-Spieler-Wertung nach Genauigkeit. Reihenfolge wie übergeben. */
export function scoreGuesses(guesses: readonly GuessInput[], answer: number, unit: string, solo: boolean): ScoredGuess[] {
  const distances = guesses.map((g) => (g.value === null ? null : distanceOf(g.value, answer)));
  const given = distances.filter((d): d is number => d !== null);
  return guesses.map((g, i) => {
    const distance = distances[i]!;
    if (g.value === null || distance === null) return { playerId: g.playerId, value: null, distance: null, place: null, bullseye: false, points: 0 };
    const place = 1 + given.filter((d) => d < distance).length;
    const bullseye = isBullseye(g.value, answer, unit);
    const points = solo ? soloPoints(g.value, answer, unit) : pointsForPlace(place) + (bullseye ? BULLSEYE_BONUS : 0);
    return { playerId: g.playerId, value: g.value, distance, place, bullseye, points };
  });
}
