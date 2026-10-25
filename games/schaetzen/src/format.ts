// Zahlen-Eingabe am eigenen Ziffernfeld und deutsche Zahlenformatierung.
// Rein funktional (nur Konstanten und Texte) (Server, TV und Handy nutzen sie gemeinsam).
import { INPUT_LIMITS, isYearUnit } from "./constants.js";
import { t } from "./i18n/de.js";

/** Taste des Ziffernfelds. */
export type PadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "," | "del";

/** Nicht umbrechendes Leerzeichen zwischen Zahl und Einheit. */
const NBSP = " ";

const countDigits = (raw: string): number => raw.replace(",", "").length;

/**
 * Wendet einen Tastendruck auf die Roheingabe an (Ziffern + höchstens ein Komma, z. B. "8000000,5").
 * Grenzen: max. 15 Ziffern, max. 2 Nachkommastellen, keine führenden Nullen; Jahreszahl: max. 4 Ziffern, kein Komma.
 * Ungültige Tasten lassen die Eingabe unverändert.
 */
export function applyKey(raw: string, key: PadKey, year = false): string {
  if (key === "del") return raw.slice(0, -1);
  if (key === ",") {
    if (year || raw.includes(",")) return raw;
    return raw === "" ? "0," : `${raw},`;
  }
  const [, decimals] = raw.split(",");
  if (decimals !== undefined && decimals.length >= INPUT_LIMITS.maxDecimals) return raw;
  if (countDigits(raw) >= (year ? INPUT_LIMITS.maxYearDigits : INPUT_LIMITS.maxDigits)) return raw;
  // Führende Null ersetzen ("0" + "5" → "5"); "0," bleibt.
  if (raw === "0") return key;
  return raw + key;
}

/** Roheingabe → Zahl (leer/„,“ → null). Ein Komma am Ende wird ignoriert. */
export function parseEntry(raw: string): number | null {
  if (!/^\d+(,\d{0,2})?$/.test(raw)) return null;
  const [int, dec = ""] = raw.split(",");
  const value = Number(`${int}.${dec || "0"}`);
  return Number.isFinite(value) ? value : null;
}

/** Tausenderpunkte für eine Ziffernfolge ("8000000" → "8.000.000"). */
const group = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Live-Anzeige der Roheingabe mit Tausenderpunkten (Komma und Nachkommastellen wie getippt). */
export function formatEntry(raw: string, year = false): string {
  if (raw === "") return "";
  const [int = "", dec] = raw.split(",");
  const head = year ? int : group(int);
  return dec === undefined ? head : `${head},${dec}`;
}

/** Zahl deutsch formatieren: Tausenderpunkt, Dezimalkomma, höchstens 2 Nachkommastellen; Jahre ohne Punkt. */
export function formatNumber(n: number, year = false): string {
  const negative = n < 0;
  const abs = Math.abs(n);
  // Ab 10^13 reicht die Genauigkeit nicht mehr für Cent-Rechnung – dann ganzzahlig (mehr als 15 Ziffern gibt es nicht).
  let int: string;
  let dec = "";
  if (abs < 1e13) {
    const cents = Math.round(abs * 100);
    int = Math.floor(cents / 100).toString();
    dec = (cents % 100).toString().padStart(2, "0").replace(/0+$/, "");
  } else {
    int = Math.round(abs).toString();
  }
  const head = year ? int : group(int);
  return `${negative ? "-" : ""}${head}${dec ? `,${dec}` : ""}`;
}

/** Zahl mit Einheit („330 m“, „1989“, „8.000.000“). */
export function formatValue(n: number, unit: string): string {
  if (isYearUnit(unit)) return formatNumber(n, true);
  const num = formatNumber(n);
  return unit ? `${num}${NBSP}${unit}` : num;
}

/** Kurzform für Achsenbeschriftungen: ab einer Million „1,5 Mio.“ bzw. „2 Mrd.“. */
export function formatCompact(n: number, year = false): string {
  if (year) return formatNumber(n, true);
  const abs = Math.abs(n);
  const short = (v: number): string => formatNumber(Math.round(v * 10) / 10);
  if (abs >= 1e12) return `${short(n / 1e12)}${NBSP}${t.numbers.trillion}`;
  if (abs >= 1e9) return `${short(n / 1e9)}${NBSP}${t.numbers.billion}`;
  if (abs >= 1e6) return `${short(n / 1e6)}${NBSP}${t.numbers.million}`;
  return formatNumber(n);
}

/** Abstand zur Lösung, gerundet auf 2 Nachkommastellen (gegen Gleitkomma-Rauschen bei Gleichstand). */
export const distanceOf = (guess: number, answer: number): number => Math.round(Math.abs(guess - answer) * 100) / 100;

/** Abstand als Text: bei Jahreszahlen „3 Jahre“, sonst wie ein Wert mit Einheit. */
export function distanceText(distance: number, unit: string): string {
  if (!isYearUnit(unit)) return formatValue(distance, unit);
  return `${formatNumber(distance)}${NBSP}${distance === 1 ? t.numbers.year : t.numbers.years}`;
}
