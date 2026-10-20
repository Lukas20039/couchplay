// Reine Brett- und KI-Logik: Gewinnerkennung und Computer-Stärken.
import { createRng } from "@couchplay/game-sdk";
import { describe, expect, it } from "vitest";
import {
  LINES,
  bestMoves,
  chooseBotMove,
  emptyBoard,
  findWinner,
  freeCells,
  isFull,
  other,
  winningMoves,
} from "../src/server/board.js";
import type { Cell, Mark } from "../src/shared.js";

const parse = (s: string): Cell[] => [...s.replace(/\s/g, "")].map((c) => (c === "X" || c === "O" ? c : null));

describe("Gewinnerkennung", () => {
  it.each(LINES.map((l) => [l.join("-"), l] as const))("erkennt Linie %s", (_name, line) => {
    for (const mark of ["X", "O"] as const) {
      const b = emptyBoard();
      for (const i of line) b[i] = mark;
      expect(findWinner(b)).toEqual({ mark, line: [...line] });
    }
  });

  it("erkennt kein Ergebnis bei unvollständigen Linien", () => {
    expect(findWinner(parse("XX. OO. ..."))).toBeNull();
  });

  it("erkennt Unentschieden (volles Brett ohne Linie)", () => {
    const b = parse("XOX XOO OXX");
    expect(findWinner(b)).toBeNull();
    expect(isFull(b)).toBe(true);
  });

  it("findet Sofortsiege", () => {
    expect(winningMoves(parse("XX. OO. ..."), "X")).toEqual([2]);
    expect(winningMoves(parse("XX. OO. ..."), "O")).toEqual([5]);
  });
});

/** Alle erreichbaren, noch offenen Stellungen, in denen `toMove` am Zug ist (X beginnt oder O beginnt). */
function reachablePositions(first: Mark, toMove: Mark): Cell[][] {
  const seen = new Set<string>();
  const out: Cell[][] = [];
  const walk = (b: Cell[], turn: Mark): void => {
    const key = b.map((c) => c ?? ".").join("") + turn;
    if (seen.has(key)) return;
    seen.add(key);
    if (findWinner(b) || isFull(b)) return;
    if (turn === toMove) out.push([...b]);
    for (const c of freeCells(b)) {
      b[c] = turn;
      walk(b, other(turn));
      b[c] = null;
    }
  };
  walk(emptyBoard(), first);
  return out;
}

describe("Computer „unbesiegbar“", () => {
  /**
   * Erschöpfend: Gegner probiert JEDEN Zug, der Computer jeden seiner optimalen Züge
   * (alle Varianten, die ctx.rng wählen könnte). Kein einziger Verlauf darf verloren gehen.
   */
  function exhaust(botMark: Mark, botStarts: boolean): { games: number; botWins: number; draws: number; losses: number } {
    const stats = { games: 0, botWins: 0, draws: 0, losses: 0 };
    const walk = (b: Cell[], turn: Mark): void => {
      const w = findWinner(b);
      if (w || isFull(b)) {
        stats.games++;
        if (!w) stats.draws++;
        else if (w.mark === botMark) stats.botWins++;
        else stats.losses++;
        return;
      }
      const moves = turn === botMark ? bestMoves(b, botMark) : freeCells(b);
      for (const c of moves) {
        b[c] = turn;
        walk(b, other(turn));
        b[c] = null;
      }
    };
    const first: Mark = botStarts ? botMark : other(botMark);
    walk(emptyBoard(), first);
    return stats;
  }

  it.each([
    ["X", true],
    ["X", false],
    ["O", true],
    ["O", false],
  ] as const)("verliert nie (Computer %s, beginnt: %s)", (botMark, botStarts) => {
    const s = exhaust(botMark, botStarts);
    expect(s.losses).toBe(0);
    expect(s.games).toBeGreaterThan(botStarts ? 100 : 500);
    expect(s.botWins).toBeGreaterThan(0);
  });

  it("bevorzugt den schnellen Sieg", () => {
    // O kann sofort gewinnen (Feld 5) – statt eines späteren Sieges.
    expect(bestMoves(parse("XX. OO. X.."), "O")).toEqual([5]);
  });

  it("blockt, wenn der Gegner droht", () => {
    expect(bestMoves(parse("XX. .O. ..."), "O")).toEqual([2]);
  });
});

describe("Computer „mittel“", () => {
  it.each([1, 7, 99])("gewinnt immer sofort, sonst blockt er immer (Seed %i)", (seed) => {
    const rng = createRng(seed);
    for (const [first, botMark] of [
      ["X", "O"],
      ["O", "O"],
      ["X", "X"],
    ] as const) {
      for (const b of reachablePositions(first, botMark)) {
        const move = chooseBotMove(b, botMark, "mittel", rng);
        expect(b[move]).toBeNull();
        const wins = winningMoves(b, botMark);
        const threats = winningMoves(b, other(botMark));
        if (wins.length > 0) expect(wins).toContain(move);
        else if (threats.length > 0) expect(threats).toContain(move);
      }
    }
  });
});

describe("Computer „leicht“", () => {
  it("nimmt einen Sofortsieg nur manchmal (~50 %)", () => {
    const b = parse("OO. XX. X..");
    const rng = createRng(5);
    let taken = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (chooseBotMove(b, "O", "leicht", rng) === 2) taken++;
    // 50 % gezielt + 50 % · 1/4 zufällig getroffen ≈ 62,5 %
    expect(taken / n).toBeGreaterThan(0.5);
    expect(taken / n).toBeLessThan(0.75);
  });

  it("blockt nicht zuverlässig (ist schlagbar)", () => {
    const b = parse("XX. .O. ...");
    const rng = createRng(3);
    const moves = new Set(Array.from({ length: 200 }, () => chooseBotMove(b, "O", "leicht", rng)));
    expect(moves.size).toBeGreaterThan(1);
  });

  it("zieht immer auf ein freies Feld", () => {
    const rng = createRng(11);
    for (const b of reachablePositions("X", "O")) expect(b[chooseBotMove(b, "O", "leicht", rng)]).toBeNull();
  });
});
