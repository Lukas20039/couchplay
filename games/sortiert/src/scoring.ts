// Richtige Reihenfolge und Wertung einer Runde (rein funktional, vom Server und in Tests genutzt).
//
// Karten werden über ihren Index in der gemischten Auslage (cards) angesprochen.
// solution[platz] = Kartenindex, der auf diesen Platz gehört (Platz 0 = oben).
// order[platz]    = Kartenindex, den der Spieler auf diesen Platz gelegt hat (Platz 0 = oben).
//
// Wertung je Platz: Karte genau richtig +100, genau eine Position daneben +50, sonst 0.
// Alle Karten richtig („Perfekt!“): +200 Bonus. Leere Plätze zählen nichts.
// Teilabgaben (Zeit abgelaufen, nicht „Fertig“): die bis dahin platzierten Plätze werden gewertet.
// Fehlt genau eine Karte, steht ihr Platz fest – sie wird wie am Handy automatisch ans Ende gelegt.
import { isAscending } from "./constants.js";

export const POINTS_EXACT = 100;
export const POINTS_NEAR = 50;
export const PERFECT_BONUS = 200;

/** Bewertung eines Platzes: genau richtig, eine daneben, falsch, leer. */
export type Mark = "exact" | "near" | "miss" | "none";

/** Indizes der Werte in richtiger Reihenfolge (Jahre aufsteigend, sonst absteigend). */
export function solutionOf(values: readonly number[], unit: string): number[] {
  const asc = isAscending(unit);
  return values.map((_, i) => i).sort((a, b) => (asc ? values[a]! - values[b]! : values[b]! - values[a]!));
}

/** Gültige Reihenfolge: ganze Kartenindizes < n, eindeutig, höchstens n lang. */
export function isValidOrder(order: readonly number[], n: number): boolean {
  return order.length <= n && new Set(order).size === order.length && order.every((i) => Number.isInteger(i) && i >= 0 && i < n);
}

/** Fehlt genau eine Karte, kommt sie ans Ende (wie am Handy); sonst unverändert. */
export function completeOrder(order: readonly number[], n: number): number[] {
  if (order.length !== n - 1) return [...order];
  const placed = new Set(order);
  const missing = Array.from({ length: n }, (_, i) => i).find((i) => !placed.has(i));
  return missing === undefined ? [...order] : [...order, missing];
}

export interface OrderScore {
  /** Bewertung je Platz (Länge n). */
  marks: Mark[];
  points: number;
  perfect: boolean;
  /** Anzahl genau richtiger Karten. */
  exact: number;
}

/** Wertet eine (ggf. unvollständige) Reihenfolge gegen die Lösung. */
export function scoreOrder(order: readonly number[], solution: readonly number[]): OrderScore {
  const n = solution.length;
  const full = completeOrder(order, n);
  const target = new Map(solution.map((card, pos) => [card, pos]));
  const marks: Mark[] = solution.map((_, pos) => {
    const card = full[pos];
    if (card === undefined) return "none";
    const diff = Math.abs((target.get(card) ?? Infinity) - pos);
    return diff === 0 ? "exact" : diff === 1 ? "near" : "miss";
  });
  const exact = marks.filter((m) => m === "exact").length;
  const near = marks.filter((m) => m === "near").length;
  const perfect = n > 0 && exact === n;
  return { marks, points: exact * POINTS_EXACT + near * POINTS_NEAR + (perfect ? PERFECT_BONUS : 0), perfect, exact };
}

/** Höchstmögliche Punkte einer Runde mit n Karten. */
export const maxPoints = (n: number): number => n * POINTS_EXACT + PERFECT_BONUS;
