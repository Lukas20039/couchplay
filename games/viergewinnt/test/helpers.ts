// Gemeinsame Test-Helfer: Harness-Fabriken und Zugfolgen.
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { GameResults } from "@couchplay/protocol";
import game from "../src/server/index.js";
import { dropInto, emptyGrid, legalColumns, winLinesAt, type Dims, type Grid, type SeatIndex, type VierGewinntPlayerView, type VierGewinntTvState } from "../src/shared.js";

export type H = GameHarness<VierGewinntTvState, VierGewinntPlayerView>;
export type Opts = { previous?: GameResults | null; seed?: number; settings?: Record<string, string | boolean> };

export const pvp = (opts: Opts = {}): H => createTestHarness<VierGewinntTvState, VierGewinntPlayerView>(game, { players: 2, ...opts });
export const vsBot = (opts: Opts = {}): H => createTestHarness<VierGewinntTvState, VierGewinntPlayerView>(game, { players: 1, ...opts });

export const tv = (h: H): VierGewinntTvState => h.lastTv()!;
export const view = (h: H, p: string): VierGewinntPlayerView => h.lastView(p)!;
export const playerOf = (seat: SeatIndex): string => (seat === 0 ? "p1" : "p2");

/** Spalten nacheinander einwerfen; wer dran ist, entscheidet der Server (Partie läuft). */
export function drops(h: H, cols: number[]): void {
  for (const col of cols) {
    const s = tv(h);
    const res = h.input(playerOf(s.turn), { type: "drop", col });
    if (!res.ok) throw new Error(`Eingabe abgelehnt: ${JSON.stringify(res)}`);
  }
}

/** Der Spieler am Zug gewinnt senkrecht in Spalte `col`, der andere wirft in `other`. */
export function quickWin(h: H, col = 0, other = 1): void {
  drops(h, [col, other, col, other, col, other, col]);
}

/**
 * Zugfolge, die das Brett ohne vier in einer Reihe füllt (Tiefensuche mit Rücksetzen,
 * Platz 0 beginnt). Für Unentschieden-Tests.
 */
export function drawSequence(d: Dims, first: SeatIndex = 0): number[] {
  const seq: number[] = [];
  const total = d.cols * d.rows;
  const dfs = (grid: Grid, seat: SeatIndex): boolean => {
    if (seq.length === total) return true;
    for (const col of legalColumns(grid, d)) {
      const next = dropInto(grid, d, col, seat)!;
      if (winLinesAt(next.grid, d, next.cell).length > 0) continue;
      seq.push(col);
      if (dfs(next.grid, seat === 0 ? 1 : 0)) return true;
      seq.pop();
    }
    return false;
  };
  if (!dfs(emptyGrid(d), first)) throw new Error("keine Remis-Folge gefunden");
  return seq;
}
