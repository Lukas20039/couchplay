// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { describe, expect, it } from "vitest";
import { winningColumns } from "../src/server/bot.js";
import { BOT_DELAY_MS, END_DELAY_MS, ROUND_DELAY_MS } from "../src/server/index.js";
import { BOARD_SIZES, cellOf, emptyGrid, legalColumns, type VierGewinntResultData } from "../src/shared.js";
import { drawSequence, drops, pvp, quickWin, tv, view, vsBot } from "./helpers.js";

const D = BOARD_SIZES["7x6"];

describe("Partie", () => {
  it("startet mit leerem Brett, Platz 0 beginnt; Steine fallen nach unten, der Zug wechselt", () => {
    const h = pvp({ settings: { bestOf: "1" } });
    expect(tv(h)).toMatchObject({ phase: "playing", grid: emptyGrid(D), turn: 0, starter: 0, lastMove: null, turnEndsAt: null });
    expect(view(h, "p1").myTurn).toBe(true);
    expect(view(h, "p2").myTurn).toBe(false);
    h.input("p1", { type: "drop", col: 3 });
    expect(tv(h).lastMove).toEqual({ by: 0, col: 3, row: 5, cell: cellOf(D, 3, 5), auto: false });
    expect(tv(h).grid[cellOf(D, 3, 5)]).toBe("0");
    expect(tv(h).turn).toBe(1);
    h.input("p2", { type: "drop", col: 3 });
    expect(tv(h).grid[cellOf(D, 3, 4)]).toBe("1");
    expect(view(h, "p1").grid).toBe(tv(h).grid);
  });

  it("falscher Spieler und volle Spalte werden ignoriert, das Handy bekommt den echten Stand", () => {
    const h = pvp();
    const before = h.views.get("p2")!.length;
    h.input("p2", { type: "drop", col: 0 });
    expect(tv(h).grid).toBe(emptyGrid(D));
    expect(h.views.get("p2")!.length).toBe(before + 1); // Resync
    drops(h, [0, 0, 0, 1, 0, 0, 0]); // Spalte 0 voll, ohne vier in einer Reihe
    expect(legalColumns(tv(h).grid, D)).not.toContain(0);
    const turn = tv(h).turn;
    const grid = tv(h).grid;
    h.input(turn === 0 ? "p1" : "p2", { type: "drop", col: 0 });
    expect(tv(h)).toMatchObject({ grid, turn });
    // Spalten außerhalb des Bretts lehnt schon das Schema ab.
    expect(h.input("p1", { type: "drop", col: 9 })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(h.input("p1", { type: "drop", col: -1 })).toMatchObject({ ok: false });
  });

  it("Vorschau-Spalte: nur wer dran ist, volle Spalte zählt nicht, Einwerfen setzt sie zurück", () => {
    const h = pvp();
    h.input("p1", { type: "aim", col: 4 });
    expect(tv(h).aims).toEqual([4, null]);
    expect(view(h, "p1").aim).toBe(4);
    h.input("p2", { type: "aim", col: 2 });
    expect(tv(h).aims).toEqual([4, null]);
    h.input("p1", { type: "drop", col: 4 });
    expect(tv(h).aims).toEqual([null, null]);
    drops(h, [0, 0, 0, 0, 1, 0, 0]); // p2, p1, … – Spalte 0 voll
    const mover = tv(h).turn === 0 ? "p1" : "p2";
    h.input(mover, { type: "aim", col: 0 });
    expect(tv(h).aims).toEqual([null, null]);
  });

  it("Sieg beendet ein Match über eine Partie: Gewinnreihe, Ergebnis, Ranking", () => {
    const h = pvp({ settings: { bestOf: "1" } });
    quickWin(h, 2, 3);
    const s = tv(h);
    expect(s.phase).toBe("over");
    expect(s.winLines).toEqual([[cellOf(D, 2, 2), cellOf(D, 2, 3), cellOf(D, 2, 4), cellOf(D, 2, 5)]]);
    expect(s.outcome).toEqual({ winner: 0, forfeit: false });
    expect(view(h, "p1")).toMatchObject({ result: "win", roundResult: "win", myTurn: false });
    expect(view(h, "p2").result).toBe("lose");
    h.input("p2", { type: "drop", col: 4 }); // nach Spielende ignoriert
    expect(tv(h).grid).toBe(s.grid);
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([
      { playerId: "p1", score: 1, rank: 1 },
      { playerId: "p2", score: 0, rank: 2 },
    ]);
    const data = h.results?.data as VierGewinntResultData;
    expect(data).toMatchObject({ winnerId: "p1", bot: null, bestOf: 1, board: "7x6", wins: [1, 0], history: [0] });
    expect(data.series).toMatchObject({ games: 1, wins: { p1: 1 } });
  });

  it("volles Brett ohne Reihe = Unentschieden", () => {
    const h = pvp({ settings: { bestOf: "1" } });
    drops(h, drawSequence(D));
    expect(tv(h).grid).not.toContain(".");
    expect(tv(h)).toMatchObject({ phase: "over", winLines: [], outcome: { winner: null, forfeit: false } });
    expect(view(h, "p1").result).toBe("draw");
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking.map((r) => r.rank)).toEqual([1, 1]);
    expect((h.results?.data as VierGewinntResultData).winnerId).toBeNull();
    expect((h.results?.data as VierGewinntResultData).series.draws).toBe(1);
  });

  it("großes Brett 9 × 7", () => {
    const h = pvp({ settings: { board: "9x7", bestOf: "1" } });
    expect(tv(h).dims).toEqual({ cols: 9, rows: 7 });
    drops(h, [8, 0, 7, 0, 6, 0, 5]);
    expect(tv(h).outcome?.winner).toBe(0);
    expect(tv(h).winLines[0]).toHaveLength(4);
  });
});

describe("Best-of", () => {
  it("Best of 3: Startspieler wechselt, Zwischenstand, Match endet bei zwei Siegen", () => {
    const h = pvp({ settings: { bestOf: "3" } });
    expect(tv(h).match).toMatchObject({ bestOf: 3, needed: 2, round: 1, wins: [0, 0] });
    quickWin(h); // p1 beginnt und gewinnt
    expect(tv(h)).toMatchObject({ phase: "roundOver", roundOutcome: { winner: 0 }, outcome: null });
    expect(view(h, "p2")).toMatchObject({ roundResult: "lose", result: null, match: { me: 0, opponent: 1 } });
    expect(h.results).toBeNull();
    h.advance(ROUND_DELAY_MS);
    // Partie 2: leeres Brett, Platz 1 beginnt.
    expect(tv(h)).toMatchObject({ phase: "playing", grid: emptyGrid(D), turn: 1, starter: 1, winLines: [], roundOutcome: null });
    expect(tv(h).match.round).toBe(2);
    quickWin(h); // p2 beginnt und gewinnt
    expect(tv(h).match.wins).toEqual([1, 1]);
    h.advance(ROUND_DELAY_MS);
    expect(tv(h)).toMatchObject({ starter: 0, turn: 0 });
    quickWin(h);
    expect(tv(h)).toMatchObject({ phase: "over", outcome: { winner: 0, forfeit: false } });
    h.advance(END_DELAY_MS);
    const data = h.results?.data as VierGewinntResultData;
    expect(data).toMatchObject({ wins: [2, 1], history: [0, 1, 0], winnerId: "p1" });
    expect(h.results?.ranking).toEqual([
      { playerId: "p1", score: 2, rank: 1 },
      { playerId: "p2", score: 1, rank: 2 },
    ]);
  });

  it("Best of 3 endet vorzeitig bei 2 : 0; Unentschieden zählen als gespielte Partie", () => {
    const early = pvp({ settings: { bestOf: "3" } });
    quickWin(early); // p1
    early.advance(ROUND_DELAY_MS);
    drops(early, [1, 0, 1, 0, 1, 0, 2, 0]); // p2 beginnt, p1 gewinnt senkrecht in Spalte 0
    expect(tv(early)).toMatchObject({ phase: "over", match: { wins: [2, 0], history: [0, 0] } });

    const draws = pvp({ settings: { bestOf: "3" } });
    drops(draws, drawSequence(D));
    expect(tv(draws)).toMatchObject({ phase: "roundOver", match: { draws: 1, history: [null] } });
    draws.advance(ROUND_DELAY_MS);
    drops(draws, drawSequence(D));
    draws.advance(ROUND_DELAY_MS);
    quickWin(draws); // Platz 0 beginnt Partie 3 und gewinnt 1 : 0
    expect(tv(draws)).toMatchObject({ phase: "over", outcome: { winner: 0 }, match: { wins: [1, 0], draws: 2 } });
  });

  it("Best of 5 braucht drei Siege; Gleichstand nach allen Partien = Match unentschieden", () => {
    const h = pvp({ settings: { bestOf: "5" } });
    expect(tv(h).match.needed).toBe(3);
    const play = (): void => {
      quickWin(h); // wer beginnt, gewinnt
      h.advance(ROUND_DELAY_MS);
    };
    play(); // 1:0
    play(); // 1:1
    drops(h, drawSequence(D)); // Partie 3 remis
    h.advance(ROUND_DELAY_MS);
    play(); // Partie 4: Platz 1 beginnt → 1:2
    expect(tv(h).match.wins).toEqual([1, 2]);
    quickWin(h); // Partie 5: Platz 0 → 2:2
    expect(tv(h)).toMatchObject({ phase: "over", outcome: { winner: null }, match: { wins: [2, 2], draws: 1 } });
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("Revanche: Serie läuft weiter, die erste Partie beginnt der andere", () => {
    const g1 = pvp({ settings: { bestOf: "1" } });
    quickWin(g1);
    g1.advance(END_DELAY_MS);
    const g2 = pvp({ settings: { bestOf: "1" }, previous: g1.results });
    expect(tv(g2)).toMatchObject({ turn: 1, starter: 1, series: { games: 1, wins: { p1: 1 } } });
    // Andere Paarung (gegen den Computer) → neue Serie.
    const g3 = vsBot({ previous: g1.results });
    expect(tv(g3).series).toMatchObject({ games: 0, wins: {} });
  });
});

describe("Wartezeiten & Zugzeit", () => {
  it("Spielzüge sind nie überspringbar, Zwischenstand und Ergebnis schon", () => {
    const h = pvp({ settings: { bestOf: "3", turnTime: "15" } });
    expect(h.session.skipId).toBeNull();
    expect(h.skip()).toBe(false);
    quickWin(h);
    expect(tv(h).phase).toBe("roundOver");
    expect(h.skip()).toBe(true);
    expect(tv(h)).toMatchObject({ phase: "playing", match: { round: 2 } });
    quickWin(h);
    h.advance(ROUND_DELAY_MS);
    quickWin(h);
    expect(tv(h).phase).toBe("over");
    expect(h.skip()).toBe(true);
    expect(h.results).not.toBeNull();
  });

  it("Zeitlimit: Ablauf wirft einen zufälligen gültigen Stein, deterministisch je Seed", () => {
    const run = (seed: number) => {
      const h = pvp({ settings: { turnTime: "15" }, seed });
      expect(tv(h).turnEndsAt).toBe(h.clock.now() + 15_000);
      h.advance(14_999);
      expect(tv(h).lastMove).toBeNull();
      h.advance(1);
      const s = tv(h);
      expect(s.lastMove).toMatchObject({ by: 0, auto: true });
      expect(s.turn).toBe(1);
      expect(s.turnEndsAt).toBe(h.clock.now() + 15_000);
      expect(view(h, "p1").lastMove?.auto).toBe(true);
      return s.lastMove!.col;
    };
    expect(run(7)).toBe(run(7));
    // Volle Spalten werden nie gewählt.
    const h = pvp({ settings: { turnTime: "30" } });
    drops(h, [3, 3, 3, 3, 3, 3]);
    for (let i = 0; i < 6; i++) h.advance(30_000);
    expect(h.tvStates.filter((s) => s.lastMove?.auto).every((s) => s.lastMove!.col !== 3)).toBe(true);
  });

  it("ein rechtzeitiger Zug startet die Uhr für den anderen neu", () => {
    const h = pvp({ settings: { turnTime: "15" } });
    h.advance(10_000);
    h.input("p1", { type: "drop", col: 0 });
    expect(tv(h).turnEndsAt).toBe(h.clock.now() + 15_000);
    h.advance(10_000);
    expect(tv(h).lastMove?.auto).toBe(false);
  });

  it("ohne Zeitlimit läuft keine Uhr", () => {
    const h = pvp();
    h.advance(600_000);
    expect(tv(h)).toMatchObject({ turnEndsAt: null, lastMove: null, turn: 0 });
  });
});

describe("Verbindung", () => {
  it("Disconnect pausiert (auch die Zugzeit), Reconnect setzt mit frischer Uhr fort", () => {
    const h = pvp({ settings: { turnTime: "15" } });
    h.input("p1", { type: "drop", col: 3 });
    h.setConnected("p2", false);
    expect(tv(h)).toMatchObject({ phase: "paused", waitingFor: ["p2"], turnEndsAt: null });
    h.advance(60_000);
    expect(tv(h).turn).toBe(1); // kein Zufallsstein während der Pause
    h.input("p1", { type: "drop", col: 2 });
    expect(tv(h).grid[cellOf(D, 2, 5)]).toBe(".");
    h.setConnected("p2", true);
    expect(tv(h)).toMatchObject({ phase: "playing", waitingFor: [], turnEndsAt: h.clock.now() + 15_000 });
    // Die gecachte letzte Ansicht ist vollständig – das Handy kann sofort weiterspielen.
    expect(view(h, "p2")).toMatchObject({ myTurn: true, grid: tv(h).grid, lastMove: tv(h).lastMove });
    h.input("p2", { type: "drop", col: 3 });
    expect(tv(h).grid[cellOf(D, 3, 4)]).toBe("1");
  });

  it("wer schon beim Start fehlt, pausiert das Spiel von Anfang an", () => {
    const h = pvp();
    h.setConnected("p1", false);
    expect(tv(h).phase).toBe("paused");
  });

  it("Leave → der andere gewinnt das Match kampflos, auch im Zwischenstand", () => {
    const h = pvp({ settings: { bestOf: "3" } });
    quickWin(h);
    expect(tv(h).phase).toBe("roundOver");
    h.leave("p1");
    expect(tv(h)).toMatchObject({ phase: "over", outcome: { winner: 1, forfeit: true } });
    h.advance(ROUND_DELAY_MS); // alter Zwischenstand-Timer startet keine neue Partie
    expect(tv(h).phase).toBe("over");
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([
      { playerId: "p1", score: 1, rank: 2 },
      { playerId: "p2", score: 0, rank: 1 },
    ]);
    expect((h.results?.data as VierGewinntResultData).players.find((p) => p.playerId === "p1")?.left).toBe(true);
  });
});

describe("Gegen den Computer", () => {
  it("Computer zieht nach kurzer Bedenkzeit", () => {
    const h = vsBot({ settings: { difficulty: "schwer" } });
    expect(tv(h).seats[1]).toEqual({ kind: "bot", difficulty: "schwer" });
    h.input("p1", { type: "drop", col: 3 });
    expect(tv(h)).toMatchObject({ turn: 1, botThinking: true, turnEndsAt: null });
    expect(view(h, "p1").botThinking).toBe(true);
    h.advance(BOT_DELAY_MS - 1);
    expect(tv(h).turn).toBe(1);
    h.advance(1);
    expect(tv(h)).toMatchObject({ turn: 0, botThinking: false, lastMove: { by: 1 } });
  });

  it("Computer nimmt Gewinnzüge und blockt Drohungen (auch auf „leicht“)", () => {
    let blocks = 0;
    for (const seed of [1, 2, 3, 4]) {
      const h = vsBot({ settings: { difficulty: "leicht", bestOf: "1" }, seed });
      for (let i = 0; i < 60 && tv(h).phase === "playing"; i++) {
        // Mensch stapelt in Spalte 0 bzw. der ersten freien Spalte → senkrechte Drohungen.
        h.input("p1", { type: "drop", col: legalColumns(tv(h).grid, D)[0]! });
        if (tv(h).phase !== "playing") break;
        const grid = tv(h).grid;
        const mine = winningColumns(grid, D, 1);
        const threats = winningColumns(grid, D, 0);
        h.advance(BOT_DELAY_MS);
        const col = tv(h).lastMove!.col;
        if (mine.length > 0) expect(mine).toContain(col);
        else if (threats.length > 0) {
          expect(threats).toContain(col);
          blocks++;
        }
      }
    }
    expect(blocks).toBeGreaterThan(0);
  });

  it("spielt bis zum Ende; Computer beginnt Partie 2 und überlegt sofort", () => {
    const h = vsBot({ settings: { difficulty: "mittel", bestOf: "3" } });
    for (let i = 0; i < 200 && tv(h).phase !== "roundOver" && tv(h).phase !== "over"; i++) {
      if (tv(h).turn === 0) h.input("p1", { type: "drop", col: legalColumns(tv(h).grid, D)[0]! });
      else h.advance(BOT_DELAY_MS);
    }
    expect(tv(h).roundOutcome?.winner).toBe(1); // stur Spalte 0 verliert gegen „mittel“
    h.advance(ROUND_DELAY_MS);
    expect(tv(h)).toMatchObject({ phase: "playing", turn: 1, botThinking: true });
    for (let i = 0; i < 200 && tv(h).phase !== "over"; i++) {
      if (tv(h).phase === "roundOver") h.advance(ROUND_DELAY_MS);
      else if (tv(h).turn === 0) h.input("p1", { type: "drop", col: legalColumns(tv(h).grid, D)[0]! });
      else h.advance(BOT_DELAY_MS);
    }
    h.advance(END_DELAY_MS);
    const data = h.results?.data as VierGewinntResultData;
    expect(data).toMatchObject({ winnerId: "bot", bot: { difficulty: "mittel" } });
    expect(h.results?.ranking).toEqual([{ playerId: "p1", score: 0, rank: 2 }]);
  });

  it("Zeitlimit gilt nur für Menschen; Disconnect pausiert auch den Computer", () => {
    const h = vsBot({ settings: { turnTime: "15" } });
    h.input("p1", { type: "drop", col: 3 });
    h.setConnected("p1", false);
    h.advance(BOT_DELAY_MS * 3);
    expect(tv(h)).toMatchObject({ phase: "paused", turn: 1, botThinking: false });
    h.setConnected("p1", true);
    h.advance(BOT_DELAY_MS);
    expect(tv(h)).toMatchObject({ turn: 0, lastMove: { by: 1 } });
    expect(tv(h).turnEndsAt).toBe(h.clock.now() + 15_000);
  });

  it("Leave gegen den Computer beendet die Runde", () => {
    const h = vsBot();
    h.leave("p1");
    expect(tv(h).outcome).toEqual({ winner: 1, forfeit: true });
    h.advance(END_DELAY_MS);
    expect((h.results?.data as VierGewinntResultData).winnerId).toBe("bot");
  });
});
