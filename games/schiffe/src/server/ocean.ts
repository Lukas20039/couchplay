// Flotten zufällig aufstellen und Schüsse auf ein Gewässer auswerten.
import type { Rng } from "@couchplay/game-sdk";
import {
  CELLS,
  CLEAR,
  HIT,
  MISS,
  SIZE,
  SUNK,
  UNKNOWN,
  fleetProblem,
  shipCells,
  shipHalo,
  type Dir,
  type ShotResult,
  type Ship,
  type WatersView,
} from "../shared.js";

/** Zufällige gültige Aufstellung (Neustart, falls sich ein Schiff nicht mehr unterbringen lässt). */
export function randomFleet(lengths: readonly number[], touching: boolean, rng: Rng): Ship[] {
  for (let attempt = 0; attempt < 500; attempt++) {
    const ships: Ship[] = [];
    let ok = true;
    for (const [id, len] of lengths.entries()) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const dir: Dir = rng.chance(0.5) ? "h" : "v";
        const x = rng.int(0, dir === "h" ? SIZE - len : SIZE - 1);
        const y = rng.int(0, dir === "v" ? SIZE - len : SIZE - 1);
        const ship: Ship = { id, len, x, y, dir };
        if (fleetProblem([...ships, ship], lengths.slice(0, id + 1), touching) === null) {
          ships.push(ship);
          placed = true;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return ships;
  }
  throw new Error("Keine gültige Aufstellung gefunden");
}

/** Gewässer eines Platzes im Kampf: Flotte + Schüsse des Gegners. */
export class Ocean {
  private readonly marks: string[] = Array<string>(CELLS).fill(UNKNOWN);
  private readonly owner = new Map<number, Ship>();
  private readonly hits = new Map<number, number>();
  private readonly sunk: Ship[] = [];

  constructor(
    readonly ships: readonly Ship[],
    private readonly touching: boolean,
  ) {
    for (const s of ships) for (const c of shipCells(s)) this.owner.set(c, s);
  }

  /** Darf auf dieses Feld noch geschossen werden? */
  canFire(cell: number): boolean {
    return this.marks[cell] === UNKNOWN;
  }

  fire(cell: number): { result: ShotResult; ship: Ship | null } {
    const ship = this.owner.get(cell);
    if (!ship) {
      this.marks[cell] = MISS;
      return { result: "miss", ship: null };
    }
    this.marks[cell] = HIT;
    const n = (this.hits.get(ship.id) ?? 0) + 1;
    this.hits.set(ship.id, n);
    if (n < ship.len) return { result: "hit", ship };
    this.sunk.push(ship);
    for (const c of shipCells(ship)) this.marks[c] = SUNK;
    // Schiffe berühren sich nicht → rundherum kann nur Wasser sein.
    if (!this.touching) for (const c of shipHalo(ship)) if (this.marks[c] === UNKNOWN) this.marks[c] = CLEAR;
    return { result: "sunk", ship };
  }

  get allSunk(): boolean {
    return this.sunk.length === this.ships.length;
  }

  view(): WatersView {
    const sunkIds = new Set(this.sunk.map((s) => s.id));
    return {
      cells: this.marks.join(""),
      sunk: this.sunk.map((s) => ({ ...s })),
      afloat: this.ships.filter((s) => !sunkIds.has(s.id)).map((s) => s.len),
    };
  }
}
