// Computer-Gegner. Sieht nur die öffentliche Sicht auf das gegnerische Gewässer (wie ein Mensch).
//   leicht: zufällig, nach einem Treffer nur manchmal gezielt daneben
//   mittel: Suchen im Schachbrettmuster, nach einem Treffer gezielt das Schiff abfahren
//   schwer: Wahrscheinlichkeitskarte über alle noch möglichen Schiffslagen
import type { Rng } from "@couchplay/game-sdk";
import {
  CELLS,
  HIT,
  SIZE,
  UNKNOWN,
  cellOf,
  shipCells,
  shipHalo,
  xOf,
  yOf,
  type Difficulty,
  type Rules,
  type Ship,
  type WatersView,
} from "../shared.js";

const orthogonal = (cell: number): number[] => {
  const x = xOf(cell);
  const y = yOf(cell);
  const out: number[] = [];
  if (x > 0) out.push(cell - 1);
  if (x < SIZE - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - SIZE);
  if (y < SIZE - 1) out.push(cell + SIZE);
  return out;
};

const unknownCells = (w: WatersView): number[] => [...w.cells].flatMap((c, i) => (c === UNKNOWN ? [i] : []));
const hitCells = (w: WatersView): number[] => [...w.cells].flatMap((c, i) => (c === HIT ? [i] : []));

export function chooseBotShot(waters: WatersView, rules: Rules, difficulty: Difficulty, rng: Rng): number {
  const free = unknownCells(waters);
  if (free.length === 0) throw new Error("Kein Feld mehr frei");
  switch (difficulty) {
    case "leicht": {
      const near = targetCells(waters);
      return near.length > 0 && rng.chance(0.25) ? rng.pick(near) : rng.pick(free);
    }
    case "mittel": {
      const near = targetCells(waters);
      if (near.length > 0) return rng.pick(near);
      // Kleinstes Schiff hat Länge 2 → jedes zweite Feld reicht zum Finden.
      const parity = free.filter((c) => (xOf(c) + yOf(c)) % 2 === 0);
      return rng.pick(parity.length > 0 ? parity : free);
    }
    case "schwer":
      return bestByDensity(waters, rules, rng) ?? rng.pick(free);
  }
}

/** Zielfelder rund um Treffer noch nicht versenkter Schiffe; bei zwei Treffern in einer Linie nur deren Enden. */
function targetCells(waters: WatersView): number[] {
  const hits = hitCells(waters);
  if (hits.length === 0) return [];
  const hitSet = new Set(hits);
  const free = (c: number) => waters.cells[c] === UNKNOWN;
  const ends: number[] = [];
  for (const h of hits) {
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const nx = xOf(h) + dx;
      const ny = yOf(h) + dy;
      if (nx >= SIZE || ny >= SIZE || !hitSet.has(cellOf(nx, ny))) continue;
      // Linie in Richtung (dx, dy) bis zu ihren Enden ablaufen.
      let ax = xOf(h);
      let ay = yOf(h);
      while (ax - dx >= 0 && ay - dy >= 0 && hitSet.has(cellOf(ax - dx, ay - dy))) {
        ax -= dx;
        ay -= dy;
      }
      let bx = xOf(h);
      let by = yOf(h);
      while (bx + dx < SIZE && by + dy < SIZE && hitSet.has(cellOf(bx + dx, by + dy))) {
        bx += dx;
        by += dy;
      }
      if (ax - dx >= 0 && ay - dy >= 0 && free(cellOf(ax - dx, ay - dy))) ends.push(cellOf(ax - dx, ay - dy));
      if (bx + dx < SIZE && by + dy < SIZE && free(cellOf(bx + dx, by + dy))) ends.push(cellOf(bx + dx, by + dy));
    }
  }
  if (ends.length > 0) return [...new Set(ends)];
  return [...new Set(hits.flatMap(orthogonal).filter(free))];
}

/** Feld, das in den meisten noch möglichen Schiffslagen vorkommt; Lagen über Treffer zählen stark. */
function bestByDensity(waters: WatersView, rules: Rules, rng: Rng): number | null {
  const score = new Array<number>(CELLS).fill(0);
  const hits = hitCells(waters);
  const lengths = [...new Set(waters.afloat)];
  for (const len of lengths) {
    const copies = waters.afloat.filter((l) => l === len).length;
    for (const dir of ["h", "v"] as const) {
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const ship: Ship = { id: 0, len, x, y, dir };
          const cells = shipCells(ship);
          if (cells.includes(-1)) continue;
          if (!cells.every((c) => waters.cells[c] === UNKNOWN || waters.cells[c] === HIT)) continue;
          // Berührungsverbot: kein fremder Treffer direkt daneben.
          if (!rules.touching && shipHalo(ship).some((c) => waters.cells[c] === HIT || waters.cells[c] === "#")) continue;
          const covered = cells.filter((c) => waters.cells[c] === HIT).length;
          if (hits.length > 0 && covered === 0) continue; // erst die angeschossenen Schiffe fertig machen
          const weight = copies * (covered > 0 ? 50 ** covered : 1);
          for (const c of cells) if (waters.cells[c] === UNKNOWN) score[c]! += weight;
        }
      }
    }
  }
  let best = 0;
  let picks: number[] = [];
  for (let c = 0; c < CELLS; c++) {
    const s = score[c]!;
    if (s > best) {
      best = s;
      picks = [c];
    } else if (s === best && s > 0) picks.push(c);
  }
  return picks.length > 0 ? rng.pick(picks) : null;
}
