// Deutsche Zahlenformatierung (Tausenderpunkt, Dezimalkomma, Jahre ohne Punkt).
// Rein funktional, ohne Texte – Server, TV und Handy nutzen sie gemeinsam.
import { isYearUnit } from "./constants.js";

/** Nicht umbrechendes Leerzeichen zwischen Zahl und Einheit. */
const NBSP = " ";

/** Tausenderpunkte für eine Ziffernfolge ("8000000" → "8.000.000"). */
const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Zahl deutsch formatieren: Tausenderpunkt, Dezimalkomma, höchstens 2 Nachkommastellen; Jahre ohne Punkt. */
export function formatNumber(n: number, year = false): string {
  const negative = n < 0;
  const cents = Math.round(Math.abs(n) * 100);
  const int = Math.floor(cents / 100).toString();
  const dec = (cents % 100).toString().padStart(2, "0").replace(/0+$/, "");
  const head = year ? int : group(int);
  return `${negative ? "-" : ""}${head}${dec ? `,${dec}` : ""}`;
}

/** Wert mit Einheit („155 Mio.“, „1983“, „499,99 $“, „88“). */
export function formatValue(n: number, unit: string): string {
  if (isYearUnit(unit)) return formatNumber(n, true);
  const num = formatNumber(n);
  return unit ? `${num}${NBSP}${unit}` : num;
}
