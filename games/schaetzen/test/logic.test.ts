// Reine Logik: Eingabe am Ziffernfeld, deutsche Formatierung, Wertung, Skala.
import { describe, expect, it } from "vitest";
import { applyKey, distanceText, formatCompact, formatEntry, formatNumber, formatValue, parseEntry, type PadKey } from "../src/format.js";
import { buildScale, place, stackLanes } from "../src/scale.js";
import { isBullseye, scoreGuesses, soloPoints } from "../src/scoring.js";
import { packSeen, unpackSeen } from "../src/seen.js";

const type = (keys: string, year = false): string =>
  [...keys].reduce((raw, k) => applyKey(raw, (k === "<" ? "del" : k) as PadKey, year), "");

describe("Ziffernfeld", () => {
  it("baut Zahlen mit Komma, ohne führende Nullen", () => {
    expect(type("8000000")).toBe("8000000");
    expect(type("007")).toBe("7");
    expect(type(",5")).toBe("0,5");
    expect(type("12,,3")).toBe("12,3");
    expect(type("12,345")).toBe("12,34");
    expect(type("123<<")).toBe("1");
    expect(type("<")).toBe("");
  });

  it("begrenzt auf 15 Ziffern und bei Jahreszahlen auf 4 ohne Komma", () => {
    expect(type("1234567890123456789")).toBe("123456789012345");
    expect(type("1234567890123,456")).toBe("1234567890123,45");
    expect(type("19899", true)).toBe("1989");
    expect(type("19,8", true)).toBe("198");
  });

  it("parst die Roheingabe", () => {
    expect(parseEntry("")).toBeNull();
    expect(parseEntry("12,")).toBe(12);
    expect(parseEntry("0,5")).toBe(0.5);
    expect(parseEntry("8000000,25")).toBe(8000000.25);
    expect(parseEntry("123456789012345")).toBe(123456789012345);
  });

  it("zeigt Tausenderpunkte live an", () => {
    expect(formatEntry("8000000")).toBe("8.000.000");
    expect(formatEntry("1234,5")).toBe("1.234,5");
    expect(formatEntry("12,")).toBe("12,");
    expect(formatEntry("1989", true)).toBe("1989");
  });
});

describe("Formatierung", () => {
  it("formatiert deutsch, Jahre ohne Punkt", () => {
    expect(formatNumber(8_000_000)).toBe("8.000.000");
    expect(formatNumber(1234.5)).toBe("1.234,5");
    expect(formatNumber(0.1 + 0.2)).toBe("0,3");
    expect(formatNumber(999_999_999_999_999)).toBe("999.999.999.999.999");
    expect(formatValue(1989, "Jahr")).toBe("1989");
    expect(formatValue(330, "m")).toBe("330 m");
    expect(formatValue(36.8, "°C")).toBe("36,8 °C");
    expect(formatValue(206, "")).toBe("206");
    expect(formatCompact(1_500_000)).toBe("1,5 Mio.");
    expect(formatCompact(2_000_000_000)).toBe("2 Mrd.");
    expect(distanceText(1, "Jahr")).toBe("1 Jahr");
    expect(distanceText(12, "Jahr")).toBe("12 Jahre");
  });
});

describe("Wertung", () => {
  const g = (playerId: string, value: number | null) => ({ playerId, value });

  it("vergibt 100/70/50/30/10 nach Abstand, ohne Tipp 0", () => {
    const r = scoreGuesses([g("a", 300), g("b", 200), g("c", 500), g("d", 100), g("e", 1000), g("f", 5000), g("x", null)], 330, "m", false);
    expect(r.map((s) => [s.playerId, s.place, s.points])).toEqual([
      ["a", 1, 100],
      ["b", 2, 70],
      ["c", 3, 50],
      ["d", 4, 30],
      ["e", 5, 10],
      ["f", 6, 10],
      ["x", null, 0],
    ]);
  });

  it("Gleichstand: gleicher Abstand = gleicher Platz und gleiche Punkte (auch über/unter der Lösung)", () => {
    const r = scoreGuesses([g("a", 300), g("b", 360), g("c", 400), g("d", 0.1 + 0.2)], 330, "m", false);
    expect(r.map((s) => s.place)).toEqual([1, 1, 3, 4]);
    expect(r.map((s) => s.points)).toEqual([100, 100, 50, 30]);
  });

  it("Volltreffer +50: Zahl bis 2 %, Jahreszahl nur exakt", () => {
    expect(isBullseye(336, 330, "m")).toBe(true);
    expect(isBullseye(337, 330, "m")).toBe(false);
    expect(isBullseye(1989, 1989, "Jahr")).toBe(true);
    expect(isBullseye(1990, 1989, "Jahr")).toBe(false);
    expect(isBullseye(0, 0, "")).toBe(true);
    const num = scoreGuesses([g("a", 335), g("b", 340)], 330, "m", false);
    expect(num.map((s) => [s.bullseye, s.points])).toEqual([
      [true, 150],
      [false, 70],
    ]);
    const year = scoreGuesses([g("a", 1989), g("b", 1990)], 1989, "Jahr", false);
    expect(year.map((s) => [s.bullseye, s.points])).toEqual([
      [true, 150],
      [false, 70],
    ]);
  });

  it("1 Spieler: Punkte nach Genauigkeit", () => {
    expect(soloPoints(330, 330, "m")).toBe(150);
    expect(soloPoints(300, 330, "m")).toBe(100); // 9 %
    expect(soloPoints(400, 330, "m")).toBe(60); // 21 %
    expect(soloPoints(450, 330, "m")).toBe(30); // 36 %
    expect(soloPoints(1000, 330, "m")).toBe(0);
    expect(soloPoints(1989, 1989, "Jahr")).toBe(150);
    expect(soloPoints(1987, 1989, "Jahr")).toBe(100);
    expect(soloPoints(1980, 1989, "Jahr")).toBe(60);
    expect(soloPoints(1970, 1989, "Jahr")).toBe(30);
    expect(soloPoints(1900, 1989, "Jahr")).toBe(0);
    expect(scoreGuesses([g("a", 300)], 330, "m", true)[0]!.points).toBe(100);
    expect(scoreGuesses([g("a", null)], 330, "m", true)[0]!.points).toBe(0);
  });
});

describe("Skala", () => {
  it("linear, wenn die Tipps nah beieinander liegen; alles passt drauf", () => {
    const s = buildScale(330, [300, 280, 400], false);
    expect(s.kind).toBe("lin");
    for (const v of [330, 300, 280, 400]) expect(place(s, v).clamped).toBe(0);
    expect(s.ticks.length).toBeGreaterThanOrEqual(3);
  });

  it("logarithmisch, wenn die Tipps um Größenordnungen streuen", () => {
    const s = buildScale(8_000_000, [100_000, 5_000_000, 20_000_000, 900_000_000], false);
    expect(s.kind).toBe("log");
    for (const v of [100_000, 8_000_000, 900_000_000]) expect(place(s, v).clamped).toBe(0);
    expect(s.ticks).toContain(1_000_000);
  });

  it("klemmt Ausreißer an den Rand, Jahreszahlen immer linear", () => {
    const s = buildScale(1989, [1985, 1990, 1980, 1995, 1, 2100], true);
    expect(s.kind).toBe("lin");
    expect(place(s, 1).clamped).toBe(-1);
    expect(place(s, 2100).clamped).toBe(1);
    expect(place(s, 1985).clamped).toBe(0);
    expect(s.ticks.every(Number.isInteger)).toBe(true);
  });

  it("0-Tipp auf Log-Skala landet links am Rand", () => {
    const s = buildScale(5000, [10, 100_000, 0], false);
    expect(s.kind).toBe("log");
    expect(place(s, 0)).toEqual({ x: 0, clamped: -1 });
  });

  it("verteilt nahe Pins auf Ebenen", () => {
    expect(stackLanes([0.5, 0.52, 0.1, 0.51], 0.05)).toEqual([0, 2, 0, 1]);
  });
});

describe("Gedächtnis", () => {
  it("packt und entpackt IDs", () => {
    const ids = ["geo-001", "geo-017", "ges-120", "kaputt"];
    expect(packSeen(ids)).toEqual({ geo: [1, 17], ges: [120] });
    expect(unpackSeen(packSeen(ids))).toEqual(["geo-001", "geo-017", "ges-120"]);
  });
});
