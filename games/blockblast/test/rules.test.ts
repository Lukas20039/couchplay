// Reine Brettlogik: Formen, Passen, Legen, Räumen, Wertung.
import { createRng } from "@couchplay/game-sdk";
import { describe, expect, it } from "vitest";
import { PieceSequence } from "../src/server/index.js";
import { EMPTY, SHAPES, SIZE, STONE, attackStones, comboMultiplier, emptyBoard, fits, fitsAnywhere, linePoints, place } from "../src/shared.js";

const shape = (rows: string[]) => {
  const s = SHAPES.find((x) => {
    const grid = Array.from({ length: x.h }, () => Array<string>(x.w).fill("."));
    for (const [dx, dy] of x.cells) grid[dy]![dx] = "X";
    return grid.map((r) => r.join("")).join("|") === rows.join("|");
  });
  if (!s) throw new Error(`Form fehlt: ${rows.join("|")}`);
  return s;
};

/** Brett aus 8 Zeilen ("." leer, sonst belegt). */
const board = (rows: string[]): string =>
  Array.from({ length: SIZE }, (_, y) => (rows[y] ?? "").padEnd(SIZE, ".")).join("");

describe("Formen", () => {
  it("haben korrekte Maße, eindeutige Raster und passen aufs leere Brett", () => {
    const keys = new Set<string>();
    for (const s of SHAPES) {
      expect(s.cells.length).toBeGreaterThan(0);
      for (const [x, y] of s.cells) expect(x < s.w && y < s.h).toBe(true);
      expect(fitsAnywhere(emptyBoard(), s)).toBe(true);
      keys.add(JSON.stringify(s.cells));
    }
    expect(keys.size).toBe(SHAPES.length);
  });

  it("Reihenfolge ist für denselben Seed gleich", () => {
    const a = new PieceSequence(createRng(5));
    const b = new PieceSequence(createRng(5));
    const seq = (p: PieceSequence) => Array.from({ length: 30 }, (_, i) => p.at(i));
    expect(seq(a)).toEqual(seq(b));
    expect(new Set(seq(a)).size).toBeGreaterThan(5);
  });
});

describe("Legen und Räumen", () => {
  it("passt nur auf freie Felder innerhalb des Bretts", () => {
    const sq = shape(["XX", "XX"]);
    expect(fits(emptyBoard(), sq, 6, 6)).toBe(true);
    expect(fits(emptyBoard(), sq, 7, 0)).toBe(false);
    const b = board(["#"]);
    expect(fits(b, sq, 0, 0)).toBe(false);
    expect(fits(b, sq, 1, 0)).toBe(true);
  });

  it("räumt volle Reihe und Spalte gleichzeitig (Kreuzungsfeld einmal)", () => {
    // Reihe 0 bis auf Feld 7 voll, Spalte 7 bis auf Feld 0 voll.
    const rows = ["0000000.", ...Array.from({ length: 7 }, () => ".......#")];
    const res = place(board(rows), shape(["X"]), 7, 0);
    expect(res.rows).toEqual([0]);
    expect(res.cols).toEqual([7]);
    expect(res.cleared).toHaveLength(15);
    expect([...res.board].every((c) => c === EMPTY)).toBe(true);
  });

  it("Steine werden mitgeräumt", () => {
    const res = place(board(["#######."]), shape(["X"]), 7, 0);
    expect(res.rows).toEqual([0]);
    expect(res.board.includes(STONE)).toBe(false);
  });

  it("fitsAnywhere erkennt ein volles Brett", () => {
    const full = board(Array.from({ length: 8 }, (_, y) => (y % 2 === 0 ? "0.0.0.0." : ".0.0.0.0")));
    expect(fitsAnywhere(full, shape(["X"]))).toBe(true);
    expect(fitsAnywhere(full, shape(["XX"]))).toBe(false);
  });
});

describe("Wertung", () => {
  it("Linien quadratisch, Combo bis ×5, Angriff ab 2 Linien oder Combo 3", () => {
    expect([0, 1, 2, 3].map(linePoints)).toEqual([0, 10, 40, 90]);
    expect([0, 1, 4, 9].map(comboMultiplier)).toEqual([1, 1, 4, 5]);
    expect(attackStones(1, 1)).toBe(0);
    expect(attackStones(2, 1)).toBe(2);
    expect(attackStones(1, 3)).toBe(2);
    expect(attackStones(3, 4)).toBe(6);
    expect(attackStones(0, 5)).toBe(0);
  });
});
