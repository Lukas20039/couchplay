// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { GameResults } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import game, { BOT_DELAY_MS, BOT_SETUP_MS, END_DELAY_MS } from "../src/server/index.js";
import { SUNK, fleetProblem, FLEETS, shipCells, type SchiffePlayerView, type SchiffeResultData, type SchiffeTvState } from "../src/shared.js";

type H = GameHarness<SchiffeTvState, SchiffePlayerView>;
type Opts = { previous?: GameResults | null; seed?: number; settings?: Record<string, string | boolean> };

const pvp = (opts: Opts = {}): H => createTestHarness<SchiffeTvState, SchiffePlayerView>(game, { players: 2, ...opts });
const vsBot = (opts: Opts = {}): H => createTestHarness<SchiffeTvState, SchiffePlayerView>(game, { players: 1, ...opts });

const tv = (h: H): SchiffeTvState => h.lastTv()!;
const view = (h: H, p: string): SchiffePlayerView => h.lastView(p)!;
const bothReady = (h: H): void => {
  expect(h.input("p1", { type: "ready" })).toEqual({ ok: true });
  expect(h.input("p2", { type: "ready" })).toEqual({ ok: true });
};
/** Felder der gegnerischen Flotte aus Sicht von `p` (über die Aufstellung des Gegners). */
const enemyCells = (h: H, p: string): number[] => view(h, p === "p1" ? "p2" : "p1").fleet.flatMap((s) => shipCells(s));
const water = (h: H, p: string): number => {
  const ships = new Set(enemyCells(h, p));
  const target = view(h, p).target.cells;
  return [...target].findIndex((c, i) => c === "." && !ships.has(i));
};

describe("Manifest & Aufstellung", () => {
  it("hat ein gültiges Manifest", () => {
    expect(game.manifest.id).toBe("schiffe");
    expect([game.manifest.minPlayers, game.manifest.maxPlayers]).toEqual([1, 2]);
    expect(game.manifest.settings.map((s) => s.key)).toEqual(["difficulty", "fleet", "extraShot", "touching"]);
  });

  it("startet in der Aufstellung mit gültigen Zufallsflotten; der TV kennt keine Schiffe", () => {
    const h = pvp();
    expect(tv(h)).toMatchObject({ phase: "setup", ready: [false, false], revealed: null });
    for (const p of ["p1", "p2"]) expect(fleetProblem(view(h, p).fleet, FLEETS.klassisch, false)).toBeNull();
    expect(JSON.stringify(tv(h))).not.toContain('"fleet"');
  });

  it("verschieben, drehen und neu würfeln; ungültige Lagen werden verworfen", () => {
    const h = pvp({ settings: { touching: true } });
    h.input("p1", { type: "shuffle" });
    const before = view(h, "p1").fleet;
    // Kleinstes Schiff (Länge 2) in die linke obere Ecke – falls belegt, erst alles andere wegwürfeln.
    const small = before.at(-1)!;
    const free = [...Array(100).keys()].find((c) => {
      const cand = { ...small, x: c % 10, y: Math.floor(c / 10), dir: "h" as const };
      return fleetProblem(before.map((s) => (s.id === small.id ? cand : s)), FLEETS.klassisch, true) === null;
    })!;
    h.input("p1", { type: "move", ship: small.id, x: free % 10, y: Math.floor(free / 10), dir: "h" });
    expect(view(h, "p1").fleet.at(-1)).toMatchObject({ x: free % 10, y: Math.floor(free / 10), dir: "h" });
    const big = view(h, "p1").fleet[0]!;
    h.input("p1", { type: "move", ship: 0, x: 9, y: 0, dir: "h" }); // ragt über den Rand
    expect(view(h, "p1").fleet[0]).toEqual(big);
  });

  it("Kampf beginnt erst, wenn beide bereit sind; „unready“ erlaubt Änderungen", () => {
    const h = pvp();
    h.input("p1", { type: "ready" });
    expect(view(h, "p2").opponentReady).toBe(true);
    h.input("p1", { type: "shuffle" }); // bereit → ignoriert
    h.input("p1", { type: "unready" });
    expect(tv(h).ready).toEqual([false, false]);
    bothReady(h);
    expect(tv(h).phase).toBe("battle");
    expect(view(h, "p1").myTurn).toBe(true);
    h.input("p1", { type: "shuffle" });
    expect(tv(h).phase).toBe("battle");
  });
});

describe("Kampf", () => {
  it("Wasser wechselt den Zug, Treffer erlaubt nochmal zu schießen", () => {
    const h = pvp();
    bothReady(h);
    const ship = enemyCells(h, "p1")[0]!;
    h.input("p1", { type: "fire", cell: ship });
    expect(tv(h).lastShot).toMatchObject({ by: 0, cell: ship, result: "hit" });
    expect(view(h, "p1").myTurn).toBe(true);
    h.input("p1", { type: "fire", cell: water(h, "p1") });
    expect(view(h, "p1").myTurn).toBe(false);
    expect(view(h, "p2").myTurn).toBe(true);
    expect(tv(h).stats[0]).toEqual({ shots: 2, hits: 1 });
    expect(view(h, "p2").own.cells).toBe(tv(h).waters[1].cells);
  });

  it("ohne Zusatzschuss wechselt auch ein Treffer den Zug", () => {
    const h = pvp({ settings: { extraShot: false } });
    bothReady(h);
    h.input("p1", { type: "fire", cell: enemyCells(h, "p1")[0]! });
    expect(tv(h).turn).toBe(1);
  });

  it("falscher Spieler, doppeltes Feld und Schüsse in der Aufstellung werden ignoriert", () => {
    const h = pvp();
    h.input("p1", { type: "fire", cell: 0 });
    expect(tv(h).stats[0].shots).toBe(0);
    bothReady(h);
    h.input("p2", { type: "fire", cell: 0 });
    expect(tv(h).stats[1].shots).toBe(0);
    const w = water(h, "p1");
    h.input("p1", { type: "fire", cell: w });
    h.input("p2", { type: "fire", cell: water(h, "p2") });
    h.input("p1", { type: "fire", cell: w });
    expect(tv(h).stats[0].shots).toBe(1);
  });

  it("alle Schiffe versenkt → Sieg, Flotten werden aufgedeckt, Runde endet", () => {
    const h = pvp();
    bothReady(h);
    for (const c of enemyCells(h, "p1")) h.input("p1", { type: "fire", cell: c });
    const s = tv(h);
    expect(s.phase).toBe("over");
    expect(s.outcome).toEqual({ winner: 0, forfeit: false });
    expect(s.waters[1].cells.replace(/[^#]/g, "")).toHaveLength(17);
    expect(s.revealed?.[1]).toHaveLength(5);
    expect(view(h, "p1")).toMatchObject({ result: "win", score: { me: 1, opponent: 0 } });
    expect(view(h, "p2").revealed).toHaveLength(5);
    expect(view(h, "p2").result).toBe("lose");
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([
      { playerId: "p1", score: 1, rank: 1 },
      { playerId: "p2", score: 0, rank: 2 },
    ]);
    expect((h.results?.data as SchiffeResultData).winnerId).toBe("p1");
  });

  it("versenkte Schiffe: Umgebung als sicheres Wasser, kein Schuss darauf", () => {
    const h = pvp();
    bothReady(h);
    const target = view(h, "p2").fleet.at(-1)!; // Länge 2
    for (const c of shipCells(target)) h.input("p1", { type: "fire", cell: c });
    const cells = view(h, "p1").target.cells;
    expect(shipCells(target).every((c) => cells[c] === SUNK)).toBe(true);
    const clear = cells.indexOf("~");
    expect(clear).toBeGreaterThanOrEqual(0);
    h.input("p1", { type: "fire", cell: clear });
    expect(tv(h).stats[0].shots).toBe(2);
    expect(tv(h).lastShot).toMatchObject({ result: "sunk", sunkLen: 2 });
  });
});

describe("Revanche & Verbindung", () => {
  it("Revanche: Startspieler wechselt, Serie läuft weiter", () => {
    const g1 = pvp();
    bothReady(g1);
    for (const c of enemyCells(g1, "p1")) g1.input("p1", { type: "fire", cell: c });
    g1.advance(END_DELAY_MS);
    const g2 = pvp({ previous: g1.results });
    bothReady(g2);
    expect(tv(g2).turn).toBe(1);
    expect(tv(g2).series).toMatchObject({ games: 1, wins: { p1: 1 } });
  });

  it("Disconnect im Kampf pausiert, Rejoin setzt fort", () => {
    const h = pvp();
    bothReady(h);
    h.setConnected("p2", false);
    expect(tv(h)).toMatchObject({ phase: "paused", waitingFor: ["p2"] });
    h.input("p1", { type: "fire", cell: 0 });
    expect(tv(h).stats[0].shots).toBe(0);
    h.setConnected("p2", true);
    expect(tv(h).phase).toBe("battle");
  });

  it("Leave → der andere gewinnt kampflos", () => {
    const h = pvp();
    h.leave("p1");
    expect(tv(h).outcome).toEqual({ winner: 1, forfeit: true });
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([
      { playerId: "p1", score: 0, rank: 2 },
      { playerId: "p2", score: 1, rank: 1 },
    ]);
  });
});

describe("Gegen den Computer", () => {
  it("Computer stellt nach kurzer Zeit auf und schießt nach Verzögerung", () => {
    const h = vsBot({ settings: { difficulty: "schwer" } });
    expect(tv(h).seats[1]).toEqual({ kind: "bot", difficulty: "schwer" });
    expect(tv(h).ready).toEqual([false, false]);
    h.advance(BOT_SETUP_MS);
    expect(tv(h).ready).toEqual([false, true]);
    h.input("p1", { type: "ready" });
    expect(tv(h).phase).toBe("battle");
    // Mensch beginnt die erste Partie, verfehlt absichtlich.
    const bot = tv(h);
    expect(bot.turn).toBe(0);
    const miss = [...Array(100).keys()].find((c) => {
      h.input("p1", { type: "fire", cell: c });
      return tv(h).turn === 1;
    });
    expect(miss).toBeDefined();
    expect(tv(h).botThinking).toBe(true);
    h.advance(BOT_DELAY_MS);
    expect(tv(h).stats[1].shots).toBeGreaterThanOrEqual(1);
  });

  it("spielt bis zum Ende; Niederlage: Computer gewinnt, Mensch Platz 2", () => {
    const h = vsBot({ settings: { difficulty: "schwer" } });
    h.advance(BOT_SETUP_MS);
    h.input("p1", { type: "ready" });
    // Der Mensch schießt immer daneben bzw. auf das erste freie Feld, der Computer spielt.
    for (let i = 0; i < 400 && tv(h).phase !== "over"; i++) {
      if (tv(h).turn === 0) {
        const free = view(h, "p1").target.cells.indexOf(".");
        h.input("p1", { type: "fire", cell: free });
      } else h.advance(BOT_DELAY_MS);
    }
    expect(tv(h).phase).toBe("over");
    h.advance(END_DELAY_MS);
    const data = h.results?.data as SchiffeResultData;
    expect(data.bot).toEqual({ difficulty: "schwer" });
    expect(h.results?.ranking).toHaveLength(1);
    expect(h.results?.ranking[0]?.rank).toBe(data.winnerId === "bot" ? 2 : 1);
  });

  it("Leave gegen den Computer beendet die Runde", () => {
    const h = vsBot();
    h.leave("p1");
    expect(tv(h).outcome).toEqual({ winner: 1, forfeit: true });
  });
});
