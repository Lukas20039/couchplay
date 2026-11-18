// Lauflicht der Elimination: Der Server legt den Weg fest (deterministisch per ctx.rng), der TV
// spielt ihn zeitbasiert ab – erst schnell, dann immer zögerlicher bis zum Stillstand.
// Ohne Abhängigkeiten, damit TV und Server dieselbe Logik nutzen.

/** Umlaufreihenfolge im 2×2-Raster: oben links → oben rechts → unten rechts → unten links. */
export const CYCLE: readonly number[] = [0, 1, 3, 2];

/** Mindestanzahl Schritte, damit es auch bei nur zwei Antworten spannend bleibt. */
export const MIN_STEPS = 11;

/**
 * Weg des Lauflichts über die verbleibenden Antworten, endet auf `target`.
 * `startOffset` (0 … remaining-1) und `extraLoops` (0/1) kommen vom Zufall des Servers.
 */
export function buildSpinPath(remaining: readonly number[], target: number, startOffset: number, extraLoops: number): number[] {
  const ring = CYCLE.filter((i) => remaining.includes(i));
  const n = ring.length;
  if (n === 0 || !ring.includes(target)) return [target];
  const path: number[] = [];
  let pos = ((startOffset % n) + n) % n;
  const min = MIN_STEPS + extraLoops * n;
  while (path.length < min || ring[pos] !== target) {
    path.push(ring[pos]!);
    pos = (pos + 1) % n;
  }
  path.push(target);
  return path;
}

/**
 * Index im Weg zum Zeitpunkt `elapsedMs` (0 … runMs): quadratisches Ausrollen, der letzte Schritt
 * fällt genau auf runMs (davor das längste Zögern). Davor und danach geklemmt.
 */
export function spinStepAt(elapsedMs: number, pathLength: number, runMs: number): number {
  if (pathLength <= 1) return 0;
  const x = runMs > 0 ? Math.min(1, Math.max(0, elapsedMs / runMs)) : 1;
  const eased = 1 - (1 - x) ** 2;
  return Math.min(pathLength - 1, Math.floor(eased * (pathLength - 1) + 1e-9));
}
