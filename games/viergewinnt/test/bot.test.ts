// Computer-Gegner: Gewinnzug, Blocken, Determinismus, Laufzeit, Spielstärke.
import { createRng } from "@couchplay/game-sdk";
import { describe, expect, it } from "vitest";
import { chooseBotMove, searchBest, winningColumns } from "../src/server/bot.js";
import { BOARD_SIZES, DIFFICULTIES, dropInto, emptyGrid, isFull, legalColumns, winLinesAt, type Difficulty, type Dims, type Grid, type SeatIndex } from "../src/shared.js";

const D: Dims = BOARD_SIZES["7x6"];
const board = (...rows: string[]): Grid => rows.join("");

function play(cols: number[], d: Dims = D): Grid {
  let grid = emptyGrid(d);
  cols.forEach((col, i) => (grid = dropInto(grid, d, col, (i % 2) as SeatIndex)!.grid));
  return grid;
}

// Platz 1 kann mit Spalte 3 waagrecht gewinnen, Platz 0 droht senkrecht in Spalte 6.
const WIN_FOR_1 = board(
  ".......",
  ".......",
  ".......",
  "......0",
  "......0",
  "111.0.0",
);
// Platz 0 droht waagrecht (Spalte 3), Platz 1 hat keinen eigenen Gewinnzug.
const THREAT_BY_0 = board(
  ".......",
  ".......",
  ".......",
  ".......",
  "1.....1",
  "000...1",
);

describe("Computer", () => {
  it("findet den Gewinnzug auf jeder Stufe (statt nur zu blocken)", () => {
    expect(winningColumns(WIN_FOR_1, D, 1)).toEqual([3]);
    for (const d of DIFFICULTIES) {
      expect(chooseBotMove(WIN_FOR_1, D, 1, d, createRng(1)), d).toBe(3);
    }
  });

  it("blockt einen Gewinnzug des Gegners auf jeder Stufe", () => {
    for (const d of DIFFICULTIES) {
      for (const seed of [1, 2, 3]) expect(chooseBotMove(THREAT_BY_0, D, 1, d, createRng(seed)), `${d}/${seed}`).toBe(3);
    }
  });

  it("schwer erkennt eine Zwickmühle und verhindert sie", () => {
    // Platz 0 hat unten ".00...." – mit Spalte 3 entstehen zwei offene Enden: nicht mehr zu halten.
    const grid = board(".......", ".......", ".......", ".......", "......1", ".00...1");
    const attack = searchBest(grid, D, 0, 7);
    expect(attack.best).toContain(3);
    expect(attack.score).toBeGreaterThan(900_000);
    // Als Platz 1 muss er das verhindern: danach hat Platz 0 keinen erzwungenen Sieg mehr.
    for (const seed of [1, 2, 3]) {
      const col = chooseBotMove(grid, D, 1, "schwer", createRng(seed));
      const after = dropInto(grid, D, col, 1)!.grid;
      expect(searchBest(after, D, 0, 7).score, `Spalte ${col}`).toBeLessThan(900_000);
    }
  });

  it("ist bei festem Seed deterministisch und wählt nur gültige Spalten", () => {
    const grid = play([3, 3, 3, 3, 3, 3]); // Mittelspalte voll
    for (const d of DIFFICULTIES) {
      const a = chooseBotMove(grid, D, 0, d, createRng(9));
      const b = chooseBotMove(grid, D, 0, d, createRng(9));
      expect(a).toBe(b);
      expect(legalColumns(grid, D)).toContain(a);
    }
  });

  it("schwer eröffnet in der Mitte", () => {
    expect(searchBest(emptyGrid(D), D, 0, 7).best).toEqual([3]);
  });

  it.each([
    ["7x6", BOARD_SIZES["7x6"]],
    ["9x7", BOARD_SIZES["9x7"]],
  ] as const)("schwer rechnet schnell genug (%s, leeres und halbvolles Brett)", (_name, d) => {
    const positions = [emptyGrid(d), play([3, 4, 3, 2, 4, 4, 2, 5, 1], d), play([0, 1, 2, 3, d.cols - 1, d.cols - 2], d)];
    let worst = 0;
    for (const grid of positions) {
      const start = performance.now();
      chooseBotMove(grid, d, 1, "schwer", createRng(3));
      worst = Math.max(worst, performance.now() - start);
    }
    // Ziel < 100 ms auf dem Server; großzügig wegen paralleler Testläufe.
    expect(worst).toBeLessThan(400);
  });

  it("Spielstärke: schwer schlägt mittel, mittel schlägt leicht (gemischte Startspieler)", () => {
    const duel = (a: Difficulty, b: Difficulty, games: number): number => {
      let aWins = 0;
      for (let g = 0; g < games; g++) {
        const rng = createRng(100 + g);
        let grid = emptyGrid(D);
        // a spielt abwechselnd Platz 0 und 1.
        const levels: [Difficulty, Difficulty] = g % 2 === 0 ? [a, b] : [b, a];
        for (let turn: SeatIndex = 0; !isFull(grid); turn = turn === 0 ? 1 : 0) {
          const col = chooseBotMove(grid, D, turn, levels[turn], rng);
          const next = dropInto(grid, D, col, turn)!;
          grid = next.grid;
          if (winLinesAt(grid, D, next.cell).length > 0) {
            if (levels[turn] === a && levels[0] !== levels[1]) aWins++;
            break;
          }
        }
      }
      return aWins;
    };
    expect(duel("mittel", "leicht", 6)).toBeGreaterThanOrEqual(5);
    expect(duel("schwer", "mittel", 4)).toBeGreaterThanOrEqual(3);
  });
});
