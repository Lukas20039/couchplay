// Hilfen für Tests/Vorschau (nicht Teil der Views): einfache Legestrategie.
import { EMPTY, SHAPES, SIZE, fits, place, type Board } from "./shared.js";

export interface Move {
  slot: number;
  x: number;
  y: number;
}

/**
 * Bester Zug nach einfacher Heuristik: möglichst viele Linien, sonst kompakt an Rand und Nachbarn.
 * null, wenn kein Teil der Hand passt.
 */
export function bestMove(board: Board, hand: readonly (number | null)[]): Move | null {
  let best: { move: Move; score: number } | null = null;
  for (const [slot, id] of hand.entries()) {
    if (id === null) continue;
    const shape = SHAPES[id]!;
    for (let y = 0; y <= SIZE - shape.h; y++) {
      for (let x = 0; x <= SIZE - shape.w; x++) {
        if (!fits(board, shape, x, y)) continue;
        const res = place(board, shape, x, y);
        let touch = 0;
        for (const [dx, dy] of shape.cells) {
          for (const [nx, ny] of [[x + dx - 1, y + dy], [x + dx + 1, y + dy], [x + dx, y + dy - 1], [x + dx, y + dy + 1]] as const) {
            if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || board[ny * SIZE + nx] !== EMPTY) touch++;
          }
        }
        const score = (res.rows.length + res.cols.length) * 100 + touch + shape.cells.length;
        if (!best || score > best.score) best = { move: { slot, x, y }, score };
      }
    }
  }
  return best?.move ?? null;
}
