// Deutsches Wörterbuch für die Serverlogik. Die Liste (≈ 410 000 Wortformen) wird beim
// ersten Zugriff einmal entpackt und bleibt als sortiertes Array im Speicher: Lookup und
// Präfix-Test per binärer Suche, ohne Trie-Overhead.
import { WORDLIST_DATA } from "./wordlist.data.js";

const NORMAL = "0123456789abcdefg";
const BASE = "hijklmnopqrstuvwx";

export interface Dictionary {
  readonly size: number;
  has(word: string): boolean;
  /** Mindestens ein Wort beginnt mit `prefix` (inkl. des Präfixes selbst). */
  hasPrefix(prefix: string): boolean;
  /** Grundform (Lemma) – für Tipps und die Anzeige verpasster Wörter bevorzugt. */
  isBase(word: string): boolean;
}

/** Entpackt das Front-Coding aus tools/build-wordlist.mjs. */
export function decodeWordlist(data: string): { words: string[]; base: Set<string> } {
  const words: string[] = [];
  const base = new Set<string>();
  let prev = "";
  let i = 0;
  while (i < data.length) {
    const c = data[i++]!;
    let shared = NORMAL.indexOf(c);
    let isBase = false;
    if (shared < 0) {
      shared = BASE.indexOf(c);
      isBase = true;
    }
    if (shared < 0) throw new Error(`Wortliste beschädigt bei Position ${i - 1}`);
    let j = i;
    while (j < data.length && !isMarker(data.charCodeAt(j))) j++;
    const word = prev.slice(0, shared) + data.slice(i, j);
    words.push(word);
    if (isBase) base.add(word);
    prev = word;
    i = j;
  }
  return { words, base };
}

/** Markerzeichen sind Ziffern und Kleinbuchstaben; Wörter bestehen nur aus Großbuchstaben. */
function isMarker(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 97 && code <= 122);
}

export function createDictionary(words: readonly string[], base: ReadonlySet<string> = new Set()): Dictionary {
  // Die eingebaute Liste ist bereits sortiert – dann das teure Sortieren sparen.
  const sorted = words.every((w, i) => i === 0 || compare(words[i - 1]!, w) < 0) ? words : [...words].sort(compare);
  const lowerBound = (key: string): number => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (compare(sorted[mid]!, key) < 0) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return {
    size: sorted.length,
    has: (word) => sorted[lowerBound(word)] === word,
    hasPrefix: (prefix) => sorted[lowerBound(prefix)]?.startsWith(prefix) ?? false,
    isBase: (word) => base.has(word),
  };
}

/** Codepunkt-Vergleich (wie die Sortierung im Generator), unabhängig von der Locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

let shared: Dictionary | null = null;

/** Das eingebaute Wörterbuch (lazy, einmal pro Prozess). */
export function germanDictionary(): Dictionary {
  if (!shared) {
    const { words, base } = decodeWordlist(WORDLIST_DATA);
    shared = createDictionary(words, base);
  }
  return shared;
}
