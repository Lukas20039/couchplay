// Reine Logik: deutsche Formatierung, Sortierrichtung, Wertung, Gedächtnis.
import { describe, expect, it } from "vitest";
import { formatNumber, formatValue } from "../src/format.js";
import { completeOrder, isValidOrder, maxPoints, scoreOrder, solutionOf } from "../src/scoring.js";
import { loadSeen, packSeen, rememberSeen, SEEN_STORAGE_KEY, unpackSeen } from "../src/seen.js";

describe("Formatierung", () => {
  it("Tausenderpunkt, Dezimalkomma, höchstens 2 Nachkommastellen", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1234)).toBe("1.234");
    expect(formatNumber(150000)).toBe("150.000");
    expect(formatNumber(1234567.5)).toBe("1.234.567,5");
    expect(formatNumber(499.99)).toBe("499,99");
    expect(formatNumber(0.66)).toBe("0,66");
    expect(formatNumber(13.6)).toBe("13,6");
  });

  it("Werte mit Einheit, Jahre ohne Punkt", () => {
    expect(formatValue(155, "Mio.")).toBe("155 Mio.");
    expect(formatValue(1983, "Jahr")).toBe("1983");
    expect(formatValue(80, "Jahr")).toBe("80");
    expect(formatValue(499, "$")).toBe("499 $");
    expect(formatValue(142984, "km")).toBe("142.984 km");
    expect(formatValue(88, "")).toBe("88");
    expect(formatValue(44.7, "km/h")).toBe("44,7 km/h");
  });
});

describe("Sortierrichtung", () => {
  it("Jahre aufsteigend (oben = am ältesten)", () => {
    expect(solutionOf([1999, 1977, 2020, 1989], "Jahr")).toEqual([1, 3, 0, 2]);
  });
  it("alle anderen Einheiten absteigend (oben = größter Wert)", () => {
    expect(solutionOf([50, 300, 0.5, 120], "Mio.")).toEqual([1, 3, 0, 2]);
    expect(solutionOf([6, 88, 21], "")).toEqual([1, 2, 0]);
  });
});

describe("Wertung", () => {
  const sol = [2, 0, 3, 1];

  it("perfekt: 100 je Karte + 200", () => {
    expect(scoreOrder(sol, sol)).toEqual({ marks: ["exact", "exact", "exact", "exact"], points: 600, perfect: true, exact: 4 });
    expect(maxPoints(4)).toBe(600);
    expect(maxPoints(6)).toBe(800);
  });

  it("eine Position daneben: 50", () => {
    expect(scoreOrder([0, 2, 3, 1], sol)).toMatchObject({ marks: ["near", "near", "exact", "exact"], points: 300, perfect: false });
  });

  it("weit daneben: 0", () => {
    expect(scoreOrder([3, 1, 2, 0], sol)).toMatchObject({ marks: ["miss", "miss", "miss", "miss"], points: 0 });
  });

  it("Teilabgabe: leere Plätze zählen nichts; fehlt genau eine Karte, wird sie ergänzt", () => {
    expect(scoreOrder([], sol)).toMatchObject({ marks: ["none", "none", "none", "none"], points: 0, perfect: false });
    expect(scoreOrder([2, 3], sol)).toMatchObject({ marks: ["exact", "near", "none", "none"], points: 150 });
    expect(scoreOrder([2, 0, 3], sol)).toMatchObject({ points: 600, perfect: true });
    expect(completeOrder([2, 0, 3], 4)).toEqual([2, 0, 3, 1]);
    expect(completeOrder([2, 0], 4)).toEqual([2, 0]);
    expect(completeOrder([], 1)).toEqual([0]);
  });

  it("prüft Reihenfolgen", () => {
    expect(isValidOrder([0, 1, 2, 3], 4)).toBe(true);
    expect(isValidOrder([], 4)).toBe(true);
    expect(isValidOrder([0, 0], 4)).toBe(false);
    expect(isValidOrder([4], 4)).toBe(false);
    expect(isValidOrder([0, 1, 2, 3, 4], 4)).toBe(false);
  });
});

describe("Gedächtnis", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  };

  it("packt und entpackt Set-IDs", () => {
    const ids = ["zei-001", "zei-017", "gel-003"];
    expect(packSeen(ids)).toEqual({ zei: [1, 17], gel: [3] });
    expect(unpackSeen(packSeen(ids)).sort()).toEqual([...ids].sort());
  });

  it("merkt sich Sets ohne Doppelte, defekter Speicher → leer", () => {
    const s = store();
    rememberSeen(s, "zei-001");
    rememberSeen(s, "gel-002");
    rememberSeen(s, "zei-001");
    rememberSeen(s, "kaputt");
    expect(loadSeen(s)).toEqual(["gel-002", "zei-001"]);
    s.m.set(SEEN_STORAGE_KEY, "{nope");
    expect(loadSeen(s)).toEqual([]);
  });
});
