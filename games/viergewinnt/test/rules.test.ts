// Brettregeln: Einwerfen, volle Spalten, Gewinnreihen in alle Richtungen und am Rand.
import { describe, expect, it } from "vitest";
import game, { parseVierGewinntSettings } from "../src/server/index.js";
import { BOARD_SIZES, cellOf, dropInto, emptyGrid, isFull, landingRow, legalColumns, winLinesAt, type Dims, type Grid, type SeatIndex } from "../src/shared.js";

const D: Dims = BOARD_SIZES["7x6"];

/** Brett aus Zeilen (oben zuerst): "." leer, "0"/"1" Steine. */
const board = (...rows: string[]): Grid => rows.join("");

/** Steine nacheinander in die Spalten werfen, abwechselnd beginnend mit Platz 0. */
function play(cols: number[], d: Dims = D): { grid: Grid; cell: number } {
  let grid = emptyGrid(d);
  let cell = -1;
  cols.forEach((col, i) => {
    const next = dropInto(grid, d, col, (i % 2) as SeatIndex)!;
    grid = next.grid;
    cell = next.cell;
  });
  return { grid, cell };
}

describe("Einwerfen", () => {
  it("Steine fallen nach unten und stapeln sich", () => {
    let grid = emptyGrid(D);
    expect(landingRow(grid, D, 3)).toBe(5);
    grid = dropInto(grid, D, 3, 0)!.grid;
    expect(grid[cellOf(D, 3, 5)]).toBe("0");
    const second = dropInto(grid, D, 3, 1)!;
    expect(second).toMatchObject({ row: 4, cell: cellOf(D, 3, 4) });
  });

  it("volle Spalte nimmt nichts mehr an; ungültige Spalten auch nicht", () => {
    const { grid } = play([2, 2, 2, 2, 2, 2]);
    expect(landingRow(grid, D, 2)).toBe(-1);
    expect(dropInto(grid, D, 2, 0)).toBeNull();
    expect(legalColumns(grid, D)).toEqual([0, 1, 3, 4, 5, 6]);
    expect(landingRow(grid, D, 7)).toBe(-1);
    expect(landingRow(grid, D, -1)).toBe(-1);
  });

  it("volles Brett", () => {
    expect(isFull(emptyGrid(D))).toBe(false);
    expect(isFull("01".repeat(21))).toBe(true);
  });
});

describe("Gewinnreihen", () => {
  it("waagrecht", () => {
    const { grid, cell } = play([0, 0, 1, 1, 2, 2, 3]);
    expect(winLinesAt(grid, D, cell)).toEqual([[35, 36, 37, 38]]);
  });

  it("senkrecht", () => {
    const { grid, cell } = play([4, 5, 4, 5, 4, 5, 4]);
    expect(winLinesAt(grid, D, cell)).toEqual([[cellOf(D, 4, 2), cellOf(D, 4, 3), cellOf(D, 4, 4), cellOf(D, 4, 5)]]);
  });

  it("Diagonale ↗ (von links unten nach rechts oben)", () => {
    const grid = board(
      ".......",
      ".......",
      "...0...",
      "..01...",
      ".011...",
      "0111...",
    );
    expect(winLinesAt(grid, D, cellOf(D, 3, 2))).toEqual([[cellOf(D, 0, 5), cellOf(D, 1, 4), cellOf(D, 2, 3), cellOf(D, 3, 2)]]);
  });

  it("Diagonale ↘ (von links oben nach rechts unten), auch vom mittleren Stein aus", () => {
    const grid = board(
      ".......",
      ".......",
      "...1...",
      "...01..",
      "...001.",
      "...0101",
    );
    const line = [cellOf(D, 3, 2), cellOf(D, 4, 3), cellOf(D, 5, 4), cellOf(D, 6, 5)];
    expect(winLinesAt(grid, D, cellOf(D, 3, 2))).toEqual([line]);
    expect(winLinesAt(grid, D, cellOf(D, 5, 4))).toEqual([line]);
  });

  it("am Rand: rechte Spalte, oberste Zeile, keine Reihe über den Rand hinweg", () => {
    const right = play([6, 5, 6, 5, 6, 5, 6]);
    expect(winLinesAt(right.grid, D, right.cell)).toHaveLength(1);
    const top = board("1111...", "0000...", "1111...", "0000...", "1111...", "0000...");
    expect(winLinesAt(top, D, 0)).toEqual([[0, 1, 2, 3]]);
    // Drei rechts in Zeile 0 und eins links in Zeile 1 sind KEINE Reihe (Umbruch).
    const wrap = board("....000", "0......", ".......", ".......", ".......", ".......");
    expect(winLinesAt(wrap, D, 6)).toEqual([]);
    expect(winLinesAt(wrap, D, 7)).toEqual([]);
  });

  it("drei sind zu wenig; fünf in einer Reihe und zwei Reihen gleichzeitig werden komplett gemeldet", () => {
    const three = play([0, 0, 1, 1, 2]);
    expect(winLinesAt(three.grid, D, three.cell)).toEqual([]);
    const five = board(".......", ".......", ".......", ".......", ".......", "00.00..");
    const filled = dropInto(five, D, 2, 0)!;
    expect(winLinesAt(filled.grid, D, filled.cell)).toEqual([[35, 36, 37, 38, 39]]);
    // Stein in der Ecke vollendet waagrecht und senkrecht.
    const cross = board(".......", ".......", "0......", "0......", "0......", ".000...");
    const corner = dropInto(cross, D, 0, 0)!;
    expect(winLinesAt(corner.grid, D, corner.cell)).toHaveLength(2);
  });

  it("großes Brett 9 × 7", () => {
    const d = BOARD_SIZES["9x7"];
    const { grid, cell } = play([8, 0, 7, 0, 6, 0, 5], d);
    expect(winLinesAt(grid, d, cell)).toEqual([[cellOf(d, 5, 6), cellOf(d, 6, 6), cellOf(d, 7, 6), cellOf(d, 8, 6)]]);
  });
});

describe("Manifest & Settings", () => {
  it("hat ein gültiges Manifest", () => {
    expect(game.manifest.id).toBe("viergewinnt");
    expect([game.manifest.minPlayers, game.manifest.maxPlayers]).toEqual([1, 2]);
    expect(game.manifest.settings.map((s) => s.key)).toEqual(["difficulty", "bestOf", "turnTime", "board"]);
  });

  it("parseSettings wandelt Strings und fällt bei Unsinn auf Defaults zurück", () => {
    expect(parseVierGewinntSettings({ difficulty: "schwer", bestOf: "5", turnTime: "15", board: "9x7" })).toEqual({
      difficulty: "schwer",
      bestOf: 5,
      turnTime: 15,
      board: "9x7",
    });
    expect(parseVierGewinntSettings({ difficulty: "x", bestOf: "2", turnTime: "7", board: "toString" })).toEqual({
      difficulty: "mittel",
      bestOf: 3,
      turnTime: 0,
      board: "7x6",
    });
  });
});
