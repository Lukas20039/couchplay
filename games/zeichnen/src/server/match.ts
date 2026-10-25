// Vergleich von Tipps mit dem gesuchten Begriff (normalisiert, mit Tippfehler-Toleranz für „Knapp daneben!“)
// und die Wortlücken mit aufgedeckten Buchstaben.
import { normalizeGuess, type Word } from "../data/schema.js";
import type { Hint } from "../shared.js";

export type GuessResult = "correct" | "close" | "wrong";

/** Levenshtein-Abstand (zwei Zeilen, O(n·m)); bricht ab, sobald er sicher > max ist. */
export function levenshtein(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** Erlaubte Tippfehler für einen normalisierten Begriff: 1 ab 5 Zeichen, 2 ab 9 Zeichen. */
export const typoTolerance = (key: string): number => (key.length >= 9 ? 2 : key.length >= 5 ? 1 : 0);

/** Normalisierte Formen, die als richtig gelten (Begriff + Alternativen). */
export const acceptedKeys = (word: Pick<Word, "word" | "alternatives">): string[] => [word.word, ...word.alternatives].map(normalizeGuess);

export function judgeGuess(text: string, keys: readonly string[]): GuessResult {
  const guess = normalizeGuess(text);
  if (guess.length === 0) return "wrong";
  if (keys.includes(guess)) return "correct";
  for (const key of keys) {
    const tol = typoTolerance(key);
    if (tol > 0 && levenshtein(guess, key, tol) <= tol) return "close";
  }
  return "wrong";
}

const isLetter = (ch: string): boolean => /[\p{L}\p{N}]/u.test(ch);

/** Lücken: Buchstaben verdeckt (außer `revealed`-Positionen), alles andere sichtbar. */
export function buildHint(word: string, revealed: ReadonlySet<number>): Hint {
  return [...word].map((ch, i) => (isLetter(ch) && !revealed.has(i) ? null : ch));
}

/** Positionen verdeckter Buchstaben. */
export const hiddenLetters = (word: string, revealed: ReadonlySet<number>): number[] =>
  [...word].flatMap((ch, i) => (isLetter(ch) && !revealed.has(i) ? [i] : []));

/**
 * Wie viele Buchstaben höchstens aufgedeckt werden: nie mehr als zwei, und es bleibt immer mehr als die
 * Hälfte verdeckt (bei „Eis“ einer, bei „Ei“ keiner).
 */
export const maxReveals = (word: string): number => Math.min(2, Math.max(0, Math.floor((hiddenLetters(word, new Set()).length - 1) / 2)));

/** Eingabetext für die Anzeige säubern: Steuer-/Bidi-Zeichen weg, Leerraum zusammenfassen. */
export const cleanGuess = (text: string): string =>
  text
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
