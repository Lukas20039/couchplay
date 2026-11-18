import { describe, expect, it } from "vitest";
import { cashValue, lossValue } from "../src/constants.js";
import { loadSeen, packSeen, rememberSeen, unpackSeen, SEEN_STORAGE_KEY } from "../src/seen.js";
import { rankScores } from "../src/server/ranking.js";
import { CYCLE, MIN_STEPS, buildSpinPath, spinStepAt } from "../src/spin.js";

describe("Lauflicht-Weg", () => {
  it("endet auf dem Ziel, läuft im Kreis über die verbleibenden Antworten und ist lang genug", () => {
    for (const remaining of [[0, 1, 2, 3], [0, 2, 3], [1, 3], [0, 1]]) {
      for (const target of remaining) {
        for (let start = 0; start < remaining.length; start++) {
          for (const extra of [0, 1]) {
            const path = buildSpinPath(remaining, target, start, extra);
            expect(path.at(-1)).toBe(target);
            expect(path.length).toBeGreaterThanOrEqual(MIN_STEPS + 1);
            for (const i of path) expect(remaining).toContain(i);
            // Nachbarn folgen der Umlaufreihenfolge.
            const ring = CYCLE.filter((i) => remaining.includes(i));
            for (let k = 1; k < path.length; k++) {
              const prev = ring.indexOf(path[k - 1]!);
              expect(path[k]).toBe(ring[(prev + 1) % ring.length]);
            }
          }
        }
      }
    }
  });

  it("Ziel außerhalb der verbleibenden Antworten → nur das Ziel", () => {
    expect(buildSpinPath([0, 1], 3, 0, 0)).toEqual([3]);
  });

  it("rollt aus: Start bei 0, Ende genau bei runMs, monoton und davor das längste Zögern", () => {
    const n = 14;
    const run = 5000;
    expect(spinStepAt(-100, n, run)).toBe(0);
    expect(spinStepAt(0, n, run)).toBe(0);
    expect(spinStepAt(run - 1, n, run)).toBe(n - 2);
    expect(spinStepAt(run, n, run)).toBe(n - 1);
    expect(spinStepAt(run * 3, n, run)).toBe(n - 1);
    let last = 0;
    const changes: number[] = [];
    for (let ms = 0; ms <= run; ms += 5) {
      const step = spinStepAt(ms, n, run);
      expect(step).toBeGreaterThanOrEqual(last);
      if (step !== last) changes.push(ms);
      last = step;
    }
    const gaps = changes.slice(1).map((ms, i) => ms - changes[i]!);
    expect(Math.max(...gaps)).toBe(gaps.at(-1));
    expect(spinStepAt(10, 1, run)).toBe(0);
  });
});

describe("Punkte", () => {
  it("Aussteigen nach Elimination k bringt +k, Rausfliegen in Elimination k kostet k", () => {
    expect([1, 2, 3].map(cashValue)).toEqual([1, 2, 3]);
    expect([1, 2, 3].map(lossValue)).toEqual([-1, -2, -3]);
  });

  it("Rangliste mit Gleichstand und negativen Punkten", () => {
    const ranked = rankScores([
      { id: "a", score: -2, order: 0 },
      { id: "b", score: 3, order: 1 },
      { id: "c", score: 3, order: 2 },
      { id: "d", score: 0, order: 3 },
    ]);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["b", 1],
      ["c", 1],
      ["d", 3],
      ["a", 4],
    ]);
  });
});

describe("Gedächtnis gesehener Fragen", () => {
  const mem = (): Storage => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as Storage;
  };

  it("packt und entpackt dreistellige IDs", () => {
    const packed = packSeen(["geo-001", "rs-120", "geo-017", "kaputt"]);
    expect(packed).toEqual({ geo: [1, 17], rs: [120] });
    expect(unpackSeen(packed).sort()).toEqual(["geo-001", "geo-017", "rs-120"]);
  });

  it("merkt sich Fragen ohne Doppelte, defekte Daten ergeben eine leere Liste", () => {
    const s = mem();
    rememberSeen(s, "geo-001");
    rememberSeen(s, "rs-002");
    rememberSeen(s, "geo-001");
    rememberSeen(s, "falsch");
    expect(loadSeen(s)).toEqual(["rs-002", "geo-001"]);
    s.setItem(SEEN_STORAGE_KEY, "{kaputt");
    expect(loadSeen(s)).toEqual([]);
    expect(loadSeen(null)).toEqual([]);
  });
});
