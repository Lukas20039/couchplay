// Set-Katalog: Umfang, Schema, eindeutige IDs, Werte-Abstände, keine doppelten Prompts.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, CATEGORY_PREFIX, ITEMS_MAX, isYearUnit } from "../src/constants.js";
import { ALL_SETS, SETS_BY_CATEGORY } from "../src/data/index.js";
import { LIMITS, SortSetSchema, minGap, norm, toSets, type RawItem, type RawSet } from "../src/data/schema.js";

/** Mindestanzahl Sets je Kategorie (wird erhöht, sobald die echten Daten da sind). */
const MIN_SETS_PER_CATEGORY = 25;

describe("Set-Katalog", () => {
  it(`hat je Kategorie mindestens ${MIN_SETS_PER_CATEGORY} Sets`, () => {
    for (const cat of CATEGORY_IDS) expect(SETS_BY_CATEGORY[cat].length, cat).toBeGreaterThanOrEqual(MIN_SETS_PER_CATEGORY);
  });

  it("alle Sets bestehen die Schema-Validierung, Präfix passt zur Kategorie", () => {
    for (const cat of CATEGORY_IDS) {
      for (const s of SETS_BY_CATEGORY[cat]) {
        expect(SortSetSchema.safeParse(s).success, s.id).toBe(true);
        expect(s.id.startsWith(`${CATEGORY_PREFIX[cat]}-`), s.id).toBe(true);
      }
    }
  });

  it("hat global eindeutige IDs und keine doppelten Prompts", () => {
    const ids = new Set<string>();
    const prompts = new Map<string, string>();
    for (const s of ALL_SETS) {
      expect(ids.has(s.id), s.id).toBe(false);
      ids.add(s.id);
      const key = norm(s.prompt);
      expect(prompts.get(key), `${s.id} doppelt zu ${prompts.get(key)}`).toBeUndefined();
      prompts.set(key, s.id);
    }
  });

  it("Werte paarweise deutlich verschieden (Jahre verschieden, sonst ≥ 3 %), genug Karten für jede Runde", () => {
    for (const s of ALL_SETS) {
      const values = s.items.map((i) => i.value);
      const year = isYearUnit(s.unit);
      expect(minGap(values, year), s.id).toBeGreaterThanOrEqual(year ? 1 : LIMITS.minGap - 1e-9);
      expect(s.items.length, s.id).toBeGreaterThanOrEqual(ITEMS_MAX);
    }
  });
});

describe("Schema", () => {
  const items = (values: number[]): RawItem[] => values.map((v, i) => [`Ding ${i + 1}`, v]);
  const ok: RawSet = ["zei-001", "Wann kamen diese Konsolen?", "Jahr", "am ältesten", "am neuesten", items([1977, 1989, 1996, 2000, 2005, 2006])];

  it("akzeptiert ein gültiges Set", () => {
    expect(toSets("zeit", [ok])[0]!.items).toHaveLength(6);
    expect(toSets("geld", [["gel-001", "Was kostet das jeweils?", "€", "am teuersten", "am günstigsten", items([100, 97, 50, 20, 10, 0])]])).toHaveLength(1);
  });

  it("lehnt ungültige Sets ab", () => {
    const bad: Array<[string, RawSet]> = [
      ["ID", ["zei-1", ok[1], ok[2], ok[3], ok[4], ok[5]]],
      ["Präfix", ["gel-001", ok[1], ok[2], ok[3], ok[4], ok[5]]],
      ["Prompt kurz", ["zei-001", "Wann?", ok[2], ok[3], ok[4], ok[5]]],
      ["Prompt lang", ["zei-001", "x".repeat(91), ok[2], ok[3], ok[4], ok[5]]],
      ["Einheit lang", ["zei-001", ok[1], "Kilometer/h", ok[3], ok[4], ok[5]]],
      ["top lang", ["zei-001", ok[1], ok[2], "x".repeat(25), ok[4], ok[5]]],
      ["bottom leer", ["zei-001", ok[1], ok[2], ok[3], "", ok[5]]],
      ["zu wenige", ["zei-001", ok[1], ok[2], ok[3], ok[4], items([1977, 1989, 1996, 2000, 2005])]],
      ["zu viele", ["zei-001", ok[1], ok[2], ok[3], ok[4], items([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])]],
      ["Jahr doppelt", ["zei-001", ok[1], ok[2], ok[3], ok[4], items([1977, 1989, 1996, 2000, 2005, 2005])]],
      ["Jahr krumm", ["zei-001", ok[1], ok[2], ok[3], ok[4], items([1977, 1989, 1996, 2000, 2005, 2006.5])]],
      ["Jahr zu groß", ["zei-001", ok[1], ok[2], ok[3], ok[4], items([1977, 1989, 1996, 2000, 2005, 2200])]],
      ["Label doppelt", ["zei-001", ok[1], ok[2], ok[3], ok[4], [...items([1977, 1989, 1996, 2000, 2005]), ["Ding 1", 2010]]]],
      ["Label lang", ["zei-001", ok[1], ok[2], ok[3], ok[4], [...items([1977, 1989, 1996, 2000, 2005]), ["x".repeat(33), 2010]]]],
      ["Notiz lang", ["zei-001", ok[1], ok[2], ok[3], ok[4], [...items([1977, 1989, 1996, 2000, 2005]), ["X", 2010, "x".repeat(31)]]]],
    ];
    for (const [why, raw] of bad) expect(() => toSets("zeit", [raw]), why).toThrow();
    const geld = (values: number[]): RawSet => ["gel-001", "Was kostet das jeweils?", "€", "am teuersten", "am günstigsten", items(values)];
    expect(() => toSets("geld", [geld([100, 98, 50, 20, 10, 5])]), "Abstand < 3 %").toThrow();
    expect(() => toSets("geld", [geld([100, 90, 50, 20, 10, -1])]), "negativ").toThrow();
    expect(() => toSets("geld", [geld([100, 90, 50, 20, 10, 1.234])]), "3 Nachkommastellen").toThrow();
    expect(() => toSets("geld", [geld([100, 90, 50, 20, 0, 0])]), "zweimal 0").toThrow();
  });
});
