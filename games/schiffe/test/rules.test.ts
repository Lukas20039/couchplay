// Regeln: Geometrie, Aufstellung, Schüsse, Computer-Gegner.
import { createRng } from "@couchplay/game-sdk";
import { describe, expect, it } from "vitest";
import { chooseBotShot } from "../src/server/bot.js";
import { Ocean, randomFleet } from "../src/server/ocean.js";
import { CLEAR, FLEETS, SUNK, fleetProblem, neighbours, shipCells, type Difficulty, type Ship } from "../src/shared.js";

const ship = (id: number, len: number, x: number, y: number, dir: "h" | "v" = "h"): Ship => ({ id, len, x, y, dir });

describe("Geometrie", () => {
  it("Felder eines Schiffs, außerhalb = -1", () => {
    expect(shipCells(ship(0, 3, 2, 1))).toEqual([12, 13, 14]);
    expect(shipCells(ship(0, 3, 0, 8, "v"))).toEqual([80, 90, -1]);
  });

  it("Nachbarn am Rand und in der Mitte", () => {
    expect(neighbours(0).sort((a, b) => a - b)).toEqual([1, 10, 11]);
    expect(neighbours(55)).toHaveLength(8);
  });
});

describe("Aufstellung prüfen", () => {
  const lens = [3, 2];
  it("gültig, überlappend, außerhalb, berührend", () => {
    expect(fleetProblem([ship(0, 3, 0, 0), ship(1, 2, 0, 2)], lens, false)).toBeNull();
    expect(fleetProblem([ship(0, 3, 0, 0), ship(1, 2, 1, 0, "v")], lens, true)).toBe("overlap");
    expect(fleetProblem([ship(0, 3, 8, 0), ship(1, 2, 0, 2)], lens, false)).toBe("bounds");
    // diagonal angrenzend
    expect(fleetProblem([ship(0, 3, 0, 0), ship(1, 2, 3, 1)], lens, false)).toBe("touching");
    expect(fleetProblem([ship(0, 3, 0, 0), ship(1, 2, 3, 1)], lens, true)).toBeNull();
    expect(fleetProblem([ship(0, 3, 0, 0)], lens, false)).toBe("count");
    expect(fleetProblem([ship(0, 2, 0, 0), ship(1, 2, 0, 2)], lens, false)).toBe("length");
  });

  it.each([
    ["klassisch", false],
    ["gross", false],
    ["gross", true],
  ] as const)("Zufallsaufstellung %s (berühren: %s) ist immer gültig", (kind, touching) => {
    for (let seed = 1; seed <= 40; seed++) {
      const fleet = randomFleet(FLEETS[kind], touching, createRng(seed));
      expect(fleetProblem(fleet, FLEETS[kind], touching)).toBeNull();
    }
  });
});

describe("Schüsse", () => {
  it("Wasser, Treffer, versenkt; Umgebung wird als Wasser markiert", () => {
    const o = new Ocean([ship(0, 2, 0, 0), ship(1, 2, 5, 5)], false);
    expect(o.fire(99).result).toBe("miss");
    expect(o.canFire(99)).toBe(false);
    expect(o.fire(0).result).toBe("hit");
    expect(o.fire(1)).toMatchObject({ result: "sunk", ship: { id: 0 } });
    const v = o.view();
    expect(v.cells[0]).toBe(SUNK);
    expect(v.cells[2]).toBe(CLEAR);
    expect(v.cells[10]).toBe(CLEAR);
    expect(v.sunk.map((s) => s.id)).toEqual([0]);
    expect(v.afloat).toEqual([2]);
    expect(o.canFire(2)).toBe(false);
    expect(o.allSunk).toBe(false);
    o.fire(55);
    o.fire(56);
    expect(o.allSunk).toBe(true);
  });

  it("dürfen Schiffe sich berühren, bleibt die Umgebung unbekannt", () => {
    const o = new Ocean([ship(0, 2, 0, 0)], true);
    o.fire(0);
    o.fire(1);
    expect(o.view().cells[2]).toBe(".");
  });
});

/** Schüsse, bis die Flotte versenkt ist (Obergrenze 100). */
function shotsToWin(difficulty: Difficulty, seed: number, touching = false): number {
  const rng = createRng(seed);
  const o = new Ocean(randomFleet(FLEETS.klassisch, touching, rng), touching);
  let n = 0;
  while (!o.allSunk) {
    const cell = chooseBotShot(o.view(), { extraShot: true, touching }, difficulty, rng);
    expect(o.canFire(cell)).toBe(true);
    o.fire(cell);
    n++;
  }
  return n;
}

describe("Computer", () => {
  it.each(["leicht", "mittel", "schwer"] as const)("%s schießt nie doppelt und versenkt alles", (d) => {
    for (let seed = 1; seed <= 5; seed++) expect(shotsToWin(d, seed)).toBeLessThanOrEqual(100);
    expect(shotsToWin(d, 7, true)).toBeLessThanOrEqual(100);
  });

  it("stärkere Stufen brauchen im Schnitt weniger Schüsse", () => {
    const avg = (d: Difficulty) => {
      let sum = 0;
      for (let seed = 1; seed <= 20; seed++) sum += shotsToWin(d, seed);
      return sum / 20;
    };
    const [easy, mid, hard] = [avg("leicht"), avg("mittel"), avg("schwer")];
    expect(mid).toBeLessThan(easy);
    expect(hard).toBeLessThan(mid);
  });

  it("mittel: schießt nach einem Treffer daneben und entlang der Linie", () => {
    const o = new Ocean([ship(0, 4, 3, 3), ship(1, 2, 8, 8)], false);
    o.fire(33);
    const rng = createRng(1);
    for (let i = 0; i < 10; i++) expect([23, 32, 34, 43]).toContain(chooseBotShot(o.view(), { extraShot: true, touching: false }, "mittel", rng));
    o.fire(34);
    for (let i = 0; i < 10; i++) expect([32, 35]).toContain(chooseBotShot(o.view(), { extraShot: true, touching: false }, "mittel", rng));
  });
});
