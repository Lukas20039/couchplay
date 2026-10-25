// Fragenkatalog: Umfang, Schema, eindeutige IDs, keine doppelten Fragen.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, CATEGORY_PREFIX } from "../src/constants.js";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import { EstimateSchema, norm, toEstimates } from "../src/data/schema.js";

const MIN_PER_CATEGORY = Number(process.env.ES_MIN ?? 50);

describe("Fragenkatalog", () => {
  it(`hat je Kategorie mindestens ${MIN_PER_CATEGORY} Fragen`, () => {
    for (const cat of CATEGORY_IDS) expect(QUESTIONS_BY_CATEGORY[cat].length, cat).toBeGreaterThanOrEqual(MIN_PER_CATEGORY);
  });

  it("alle Fragen bestehen die Schema-Validierung, Präfix passt zur Kategorie", () => {
    for (const cat of CATEGORY_IDS) {
      for (const q of QUESTIONS_BY_CATEGORY[cat]) {
        expect(EstimateSchema.safeParse(q).success, q.id).toBe(true);
        expect(q.id.startsWith(`${CATEGORY_PREFIX[cat]}-`), q.id).toBe(true);
      }
    }
  });

  it("hat global eindeutige IDs und keine doppelten Fragetexte", () => {
    const ids = new Set<string>();
    const texts = new Map<string, string>();
    for (const q of ALL_QUESTIONS) {
      expect(ids.has(q.id), q.id).toBe(false);
      ids.add(q.id);
      const key = norm(q.question);
      expect(texts.get(key), `${q.id} doppelt zu ${texts.get(key)}`).toBeUndefined();
      texts.set(key, q.id);
    }
  });

  it("Schema lehnt ungültige Einträge ab", () => {
    const bad: [string, string, number, string, string?][] = [
      ["geo-1", "Wie hoch ist die Zugspitze?", 2962, "m"],
      ["ges-001", "Wie hoch ist die Zugspitze?", 2962, "m"], // falsches Präfix
      ["geo-001", "Wie hoch ist die Zugspitze", 2962, "m"], // kein „?“
      ["geo-001", "Wie hoch?", 2962, "m"], // zu kurz
      ["geo-001", "Wie hoch ist die Zugspitze?", -1, "m"],
      ["geo-001", "Wie hoch ist die Zugspitze?", 1.234, "m"],
      ["geo-001", "Wie hoch ist die Zugspitze?", 2962, "Meter hoch"],
      ["geo-001", "Wie hoch ist die Zugspitze?", 2962, "m", "x".repeat(141)],
    ];
    for (const raw of bad) expect(() => toEstimates("geografie", [raw]), raw.join("|")).toThrow();
    expect(() => toEstimates("geschichte", [["ges-001", "In welchem Jahr fiel die Mauer?", 1989.5, "Jahr"]])).toThrow();
    expect(() => toEstimates("geschichte", [["ges-001", "In welchem Jahr fiel die Mauer?", 2200, "Jahr"]])).toThrow();
    expect(toEstimates("geschichte", [["ges-001", "In welchem Jahr fiel die Mauer?", 1989, "Jahr"]])[0]!.answer).toBe(1989);
  });
});
