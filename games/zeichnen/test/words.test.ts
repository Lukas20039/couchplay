// Begriffskatalog: Umfang, Schema, eindeutige IDs, genug Begriffe je Schwierigkeit.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS } from "../src/constants.js";
import { ALL_WORDS, WORDS_BY_CATEGORY } from "../src/data/index.js";
import { normalizeGuess, WordSchema } from "../src/data/schema.js";

const MIN_PER_CATEGORY = 60;

describe("Begriffskatalog", () => {
  it(`hat je Kategorie mindestens ${MIN_PER_CATEGORY} Begriffe`, () => {
    for (const cat of CATEGORY_IDS) expect(WORDS_BY_CATEGORY[cat].length, cat).toBeGreaterThanOrEqual(MIN_PER_CATEGORY);
  });

  it("alle Einträge bestehen die Schema-Validierung (Präfix passt zur Kategorie)", () => {
    for (const w of ALL_WORDS) expect(WordSchema.safeParse(w).success, w.id).toBe(true);
    expect(WordSchema.safeParse({ id: "ess-001", category: "tiere", difficulty: 1, word: "Hund", alternatives: [] }).success).toBe(false);
    expect(WordSchema.safeParse({ id: "tie-001", category: "tiere", difficulty: 1, word: "Hund", alternatives: ["hund!"] }).success).toBe(false);
    expect(WordSchema.safeParse({ id: "tie-001", category: "tiere", difficulty: 4, word: "Hund", alternatives: [] }).success).toBe(false);
    expect(WordSchema.safeParse({ id: "tie-001", category: "tiere", difficulty: 1, word: "x".repeat(25), alternatives: [] }).success).toBe(false);
  });

  it("IDs sind global eindeutig, Begriffe innerhalb einer Kategorie auch", () => {
    const ids = new Set<string>();
    for (const w of ALL_WORDS) {
      expect(ids.has(w.id), w.id).toBe(false);
      ids.add(w.id);
    }
    for (const cat of CATEGORY_IDS) {
      const seen = new Map<string, string>();
      for (const w of WORDS_BY_CATEGORY[cat]) {
        const key = normalizeGuess(w.word);
        expect(seen.get(key), `${w.id} doppelt zu ${seen.get(key)}`).toBeUndefined();
        seen.set(key, w.id);
      }
    }
  });

  it("je Kategorie genug Begriffe für „leicht“ und „schwer“", () => {
    for (const cat of CATEGORY_IDS) {
      const words = WORDS_BY_CATEGORY[cat];
      expect(words.filter((w) => w.difficulty === 1).length, `${cat} leicht`).toBeGreaterThanOrEqual(15);
      expect(words.filter((w) => w.difficulty >= 2).length, `${cat} schwer`).toBeGreaterThanOrEqual(15);
    }
  });
});
