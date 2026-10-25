// Skala des Zahlenstrahls in der Auflösung (rein funktional, vom TV genutzt und getestet).
//
// - Ausreißer: Tipps, die mehr als das Dreifache des (oberen) Median-Abstands von der Lösung entfernt
//   liegen, bestimmen die Skala nicht. Sie werden an den Rand geklemmt und dort mit Pfeil markiert.
// - Streuen die übrigen Werte um mehr als Faktor 30, wird logarithmisch skaliert (nie bei Jahreszahlen).
//   Auf der Log-Skala zählen Werte bis Faktor 1000 um die Lösung; 0 liegt immer am linken Rand.
// - Lösung und alle übrigen Tipps passen mit etwas Rand immer drauf.

export interface Scale {
  kind: "lin" | "log";
  lo: number;
  hi: number;
  /** Beschriftete Werte innerhalb [lo, hi]. */
  ticks: number[];
}

export interface Placement {
  /** 0 = linker Rand, 1 = rechter Rand. */
  x: number;
  /** -1 = links abgeschnitten, 1 = rechts abgeschnitten, 0 = auf der Skala. */
  clamped: -1 | 0 | 1;
}

const LOG_RATIO = 30;
const LOG_WINDOW = 1000;
const OUTLIER_FACTOR = 3;

/** „Schöne“ Schrittweite (1, 2, 5 × 10^k) für etwa `rough`. */
function niceStep(rough: number): number {
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const f = rough / base;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * base;
}

function linearTicks(lo: number, hi: number, year: boolean): number[] {
  const step = Math.max(year ? 1 : 0, niceStep((hi - lo) / 5)) || 1;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  // Gleitkomma glätten (0.30000000000000004 → 0.3).
  return out.map((v) => Number(v.toPrecision(12)));
}

function logTicks(lo: number, hi: number): number[] {
  const from = Math.ceil(Math.log10(lo) - 1e-9);
  const to = Math.floor(Math.log10(hi) + 1e-9);
  const decades: number[] = [];
  for (let e = from - 1; e <= to; e++) decades.push(e);
  const fine = to - from <= 1;
  const out: number[] = [];
  for (const e of decades) for (const m of fine ? [1, 2, 5] : [1]) out.push(Number((m * 10 ** e).toPrecision(12)));
  return out.filter((v) => v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9));
}

export function buildScale(answer: number, guesses: readonly number[], year: boolean): Scale {
  const dists = guesses.map((g) => Math.abs(g - answer)).sort((a, b) => a - b);
  const minHalf = year ? 5 : answer > 0 ? answer * 0.1 : 1;
  const median = dists.length > 0 ? dists[Math.floor(dists.length / 2)]! : 0;
  const cap = Math.max(minHalf, OUTLIER_FACTOR * median);
  const core = [answer, ...guesses.filter((g) => Math.abs(g - answer) <= cap)];

  const positives = core.filter((v) => v > 0);
  const useLog = !year && answer > 0 && positives.length >= 2 && Math.max(...positives) / Math.min(...positives) > LOG_RATIO;
  if (useLog) {
    const inWindow = [answer, ...guesses].filter((v) => v >= answer / LOG_WINDOW && v <= answer * LOG_WINDOW);
    let lo = Math.log10(Math.min(...inWindow));
    let hi = Math.log10(Math.max(...inWindow));
    const pad = Math.max(0.08 * (hi - lo), 0.15);
    lo -= pad;
    hi += pad;
    return { kind: "log", lo: 10 ** lo, hi: 10 ** hi, ticks: logTicks(10 ** lo, 10 ** hi) };
  }

  let lo = Math.min(...core);
  let hi = Math.max(...core);
  if (hi - lo < 2 * minHalf) {
    lo = Math.min(lo, answer - minHalf);
    hi = Math.max(hi, answer + minHalf);
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  if (!year && lo < 0 && Math.min(answer, ...guesses) >= 0) lo = 0;
  if (year) {
    lo = Math.floor(lo);
    hi = Math.ceil(hi);
  }
  return { kind: "lin", lo, hi, ticks: linearTicks(lo, hi, year) };
}

/** Position eines Werts auf der Skala (geklemmt auf [0, 1]). */
export function place(scale: Scale, value: number): Placement {
  let x: number;
  if (scale.kind === "log") x = value <= 0 ? -1 : (Math.log10(value) - Math.log10(scale.lo)) / (Math.log10(scale.hi) - Math.log10(scale.lo));
  else x = (value - scale.lo) / (scale.hi - scale.lo || 1);
  if (x < 0) return { x: 0, clamped: -1 };
  if (x > 1) return { x: 1, clamped: 1 };
  return { x, clamped: 0 };
}

/**
 * Verteilt Pins auf Ebenen, damit sich nahe Tipps nicht überdecken: ein Pin geht eine Ebene höher,
 * solange auf seiner Ebene ein Pin näher als `minGap` liegt. Liefert die Ebene je Eingabeindex.
 */
export function stackLanes(xs: readonly number[], minGap: number): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const lanes: number[][] = [];
  const out = new Array<number>(xs.length).fill(0);
  for (const [x, i] of order) {
    let lane = 0;
    while (lanes[lane]?.some((other) => Math.abs(other - x) < minGap)) lane++;
    (lanes[lane] ??= []).push(x);
    out[i] = lane;
  }
  return out;
}
