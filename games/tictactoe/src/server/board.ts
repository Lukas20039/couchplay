// Reine Brettlogik ohne Seiteneffekte: Linien, Sieg/Unentschieden, Computer-Gegner.
import type { Rng } from "@couchplay/game-sdk";
import type { Cell, Difficulty, Mark } from "../shared.js";

/** Alle 8 Gewinnlinien: 3 Zeilen, 3 Spalten, 2 Diagonalen. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const other = (m: Mark): Mark => (m === "X" ? "O" : "X");

export const emptyBoard = (): Cell[] => Array.from({ length: 9 }, () => null);

export function freeCells(board: readonly Cell[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === null) out.push(i);
  return out;
}

/** Gewinner + Gewinnlinie, sonst null. */
export function findWinner(board: readonly Cell[]): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    const m = board[a];
    if (m && m === board[b] && m === board[c]) return { mark: m, line: [...line] };
  }
  return null;
}

export const isFull = (board: readonly Cell[]): boolean => board.every((c) => c !== null);

/** Felder, mit denen `mark` sofort gewinnt. */
export function winningMoves(board: readonly Cell[], mark: Mark): number[] {
  const out: number[] = [];
  for (const cell of freeCells(board)) {
    const next = [...board];
    next[cell] = mark;
    if (findWinner(next)) out.push(cell);
  }
  return out;
}

/** Transpositionstabelle: Stellung + Zugrecht → Wert mit Schrankentyp (Brett hat nur ~5 500 Stellungen). */
type Bound = 0 | 1 | 2; // 0 = exakt, 1 = Untergrenze, 2 = Obergrenze
const table = new Map<string, { value: number; bound: Bound }>();
const keyOf = (board: readonly Cell[], mark: Mark): string => board.map((c) => c ?? ".").join("") + mark;

/**
 * Negamax mit Alpha-Beta. Wert aus Sicht von `mark` (am Zug):
 * Sieg = 1 + freie Felder (schneller Sieg besser), Niederlage = −(1 + freie Felder)
 * (späte Niederlage besser), 0 = remis. Der Wert hängt nur von der Stellung ab → cachebar.
 */
function negamax(board: Cell[], mark: Mark, alpha: number, beta: number): number {
  const free = freeCells(board);
  const w = findWinner(board);
  if (w) return w.mark === mark ? 1 + free.length : -(1 + free.length);
  if (free.length === 0) return 0;

  const key = keyOf(board, mark);
  const hit = table.get(key);
  const alphaOrig = alpha;
  if (hit) {
    if (hit.bound === 0) return hit.value;
    if (hit.bound === 1) alpha = Math.max(alpha, hit.value);
    else beta = Math.min(beta, hit.value);
    if (alpha >= beta) return hit.value;
  }

  let best = -Infinity;
  for (const cell of free) {
    board[cell] = mark;
    const v = -negamax(board, other(mark), -beta, -alpha);
    board[cell] = null;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  table.set(key, { value: best, bound: best <= alphaOrig ? 2 : best >= beta ? 1 : 0 });
  return best;
}

/** Exakte Minimax-Werte aller freien Felder für `mark` (am Zug). */
export function moveScores(board: readonly Cell[], mark: Mark): Map<number, number> {
  const work = [...board];
  const scores = new Map<number, number>();
  for (const cell of freeCells(work)) {
    work[cell] = mark;
    // Volles Fenster je Wurzelzug → exakter Wert (Alpha-Beta nur innerhalb des Teilbaums).
    scores.set(cell, -negamax(work, other(mark), -Infinity, Infinity));
    work[cell] = null;
  }
  return scores;
}

/** Alle optimalen Züge (gleich gute Züge, für Abwechslung per RNG gewählt). */
export function bestMoves(board: readonly Cell[], mark: Mark): number[] {
  const scores = moveScores(board, mark);
  let best = -Infinity;
  for (const v of scores.values()) if (v > best) best = v;
  return [...scores].filter(([, v]) => v === best).map(([c]) => c);
}

/** Wahrscheinlichkeit, dass „leicht“ einen möglichen Sofortsieg auch nimmt. */
export const EASY_WIN_CHANCE = 0.5;
/** Wahrscheinlichkeit, dass „mittel“ ohne Sieg/Block den optimalen Zug spielt (sonst zufällig). */
export const MEDIUM_OPTIMAL_CHANCE = 0.6;

/** Zug des Computers. Wirft, wenn kein Feld frei ist. */
export function chooseBotMove(board: readonly Cell[], mark: Mark, difficulty: Difficulty, rng: Rng): number {
  const free = freeCells(board);
  if (free.length === 0) throw new Error("chooseBotMove: Brett ist voll");
  switch (difficulty) {
    case "leicht": {
      const wins = winningMoves(board, mark);
      if (wins.length > 0 && rng.chance(EASY_WIN_CHANCE)) return rng.pick(wins);
      return rng.pick(free);
    }
    case "mittel": {
      const wins = winningMoves(board, mark);
      if (wins.length > 0) return rng.pick(wins);
      const blocks = winningMoves(board, other(mark));
      if (blocks.length > 0) return rng.pick(blocks);
      return rng.chance(MEDIUM_OPTIMAL_CHANCE) ? rng.pick(bestMoves(board, mark)) : rng.pick(free);
    }
    case "unbesiegbar":
      return rng.pick(bestMoves(board, mark));
  }
}
