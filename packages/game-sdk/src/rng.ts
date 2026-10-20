// Deterministischer Zufallsgenerator (mulberry32). Spiele dürfen KEIN Math.random
// verwenden, sondern nur ctx.rng – so sind Tests mit festem Seed reproduzierbar.

export interface Rng {
  /** Seed, mit dem dieser Generator erzeugt wurde (für Logs/Repro). */
  readonly seed: number;
  /** Gleichverteilt in [0, 1). */
  next(): number;
  /** Ganzzahl in [min, max] (beide inklusive). */
  int(min: number, max: number): number;
  /** Zufälliges Element; wirft bei leerem Array. */
  pick<T>(items: readonly T[]): T;
  /** Neue, gemischte Kopie (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[];
  /** true mit Wahrscheinlichkeit p. */
  chance(p: number): boolean;
  /** Unabhängiger Kind-Generator (z. B. für Bots), deterministisch abgeleitet. */
  fork(): Rng;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed: seed >>> 0,
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new RangeError(`rng.int: ungültiger Bereich [${min}, ${max}]`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new RangeError("rng.pick: leeres Array");
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j] as (typeof out)[number], out[i] as (typeof out)[number]];
      }
      return out;
    },
    chance(p) {
      return next() < p;
    },
    fork() {
      return createRng(Math.floor(next() * 4294967296));
    },
  };
  return rng;
}

/** Zufälliger Seed für den Produktivbetrieb. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
