// Raster erzeugen und lösen. Buchstaben werden nach deutscher Häufigkeit gezogen; von mehreren
// Kandidaten gewinnt der erste, der genug Wörter enthält (sonst der ergiebigste) – so gibt es
// keine frustrierenden Runden mit kaum Wörtern.
import type { Rng } from "@couchplay/game-sdk";
import type { Board, GridSize } from "../shared.js";
import type { Dictionary } from "./dictionary.js";

/** Relative Häufigkeiten (an Wortspiele angepasst: kein Q, wenig C/X/Y). */
const LETTER_WEIGHTS: ReadonlyArray<readonly [string, number]> = [
  ["E", 15], ["N", 9], ["I", 7], ["S", 7], ["R", 7], ["A", 6.5], ["T", 6], ["D", 4.5], ["H", 4.5],
  ["U", 4], ["L", 3.5], ["G", 3], ["M", 2.6], ["O", 2.6], ["C", 2.2], ["B", 2], ["W", 1.6], ["F", 1.6],
  ["K", 1.6], ["Z", 1.1], ["P", 1], ["Ü", 0.7], ["Ä", 0.6], ["V", 0.6], ["Ö", 0.4], ["J", 0.25],
  ["X", 0.08], ["Y", 0.05],
];
const TOTAL_WEIGHT = LETTER_WEIGHTS.reduce((s, [, w]) => s + w, 0);
const VOWELS = new Set(["A", "E", "I", "O", "U", "Ä", "Ö", "Ü"]);

/** Ziel-Wortanzahl je Rastergröße (bei Mindestlänge 3). */
const TARGET_WORDS: Record<GridSize, number> = { 4: 70, 5: 160, 6: 260 };
const GOLD_CELLS: Record<GridSize, number> = { 4: 1, 5: 2, 6: 3 };
const MAX_ATTEMPTS = 40;

export interface Solution {
  /** Wort → ein möglicher Pfad. */
  words: Map<string, number[]>;
}

function drawLetter(rng: Rng): string {
  let r = rng.next() * TOTAL_WEIGHT;
  for (const [letter, w] of LETTER_WEIGHTS) {
    r -= w;
    if (r < 0) return letter;
  }
  return "E";
}

/** Zufällige Buchstaben mit ausgewogenem Vokalanteil und begrenzten Wiederholungen. */
export function randomLetters(size: GridSize, rng: Rng): string[] {
  const n = size * size;
  const maxSame = Math.ceil(n / 6);
  for (;;) {
    const letters: string[] = [];
    const counts = new Map<string, number>();
    while (letters.length < n) {
      const l = drawLetter(rng);
      const c = counts.get(l) ?? 0;
      if (c >= (l === "E" ? maxSame + 1 : maxSame)) continue;
      counts.set(l, c + 1);
      letters.push(l);
    }
    const vowels = letters.filter((l) => VOWELS.has(l)).length / n;
    if (vowels >= 0.3 && vowels <= 0.5) return letters;
  }
}

/** Nachbarn jeder Zelle (8er-Nachbarschaft). */
export function neighbours(size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    const list: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) list.push(rr * size + cc);
      }
    }
    out.push(list);
  }
  return out;
}

/** Alle Wörter (≥ minLen) im Raster per Tiefensuche mit Präfix-Abbruch. */
export function solve(letters: readonly string[], size: number, dict: Dictionary, minLen: number): Solution {
  const adj = neighbours(size);
  const words = new Map<string, number[]>();
  const used = new Array<boolean>(letters.length).fill(false);
  const path: number[] = [];
  const visit = (cell: number, prefix: string): void => {
    const word = prefix + letters[cell];
    if (!dict.hasPrefix(word)) return;
    used[cell] = true;
    path.push(cell);
    if (word.length >= minLen && !words.has(word) && dict.has(word)) words.set(word, [...path]);
    for (const next of adj[cell]!) if (!used[next]) visit(next, word);
    path.pop();
    used[cell] = false;
  };
  for (let i = 0; i < letters.length; i++) visit(i, "");
  return { words };
}

export function generateBoard(
  size: GridSize,
  rng: Rng,
  dict: Dictionary,
  opts: { minLen: number; gold: boolean },
): { board: Board; solution: Solution } {
  // Langwort-Modus: weniger, dafür lange Wörter – Ziel entsprechend senken.
  const target = opts.minLen > 3 ? Math.round(TARGET_WORDS[size] / 3) : TARGET_WORDS[size];
  let best: { letters: string[]; solution: Solution } | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const letters = randomLetters(size, rng);
    const solution = solve(letters, size, dict, opts.minLen);
    if (!best || solution.words.size > best.solution.words.size) best = { letters, solution };
    if (solution.words.size >= target) break;
  }
  const { letters, solution } = best!;
  const gold = opts.gold ? rng.shuffle(letters.map((_, i) => i)).slice(0, GOLD_CELLS[size]).sort((a, b) => a - b) : [];
  return { board: { size, letters, gold }, solution };
}
