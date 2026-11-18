// Wortkatalog: Umfang, Schema, eindeutige IDs, keine doppelten Wörter, Undercover ≠ Wort, genug Ratewörter.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, CATEGORY_PREFIX, GUESS_OPTIONS } from "../src/constants.js";
import { ALL_WORDS, WORDS_BY_CATEGORY } from "../src/data/index.js";
import { WordSchema, toWords, type RawWord } from "../src/data/schema.js";
import { isForbiddenClue, normalizeWord } from "../src/normalize.js";

const MIN_PER_CATEGORY = 25;

describe("Wortkatalog", () => {
  it("hat mindestens 200 Wörter in 8 Kategorien", () => {
    expect(CATEGORY_IDS).toHaveLength(8);
    expect(ALL_WORDS.length).toBeGreaterThanOrEqual(200);
  });

  it(`hat je Kategorie mindestens ${MIN_PER_CATEGORY} Wörter – genug Ratealternativen (${GUESS_OPTIONS})`, () => {
    for (const cat of CATEGORY_IDS) {
      const words = WORDS_BY_CATEGORY[cat];
      expect(words.length, cat).toBeGreaterThanOrEqual(MIN_PER_CATEGORY);
      expect(new Set(words.map((w) => normalizeWord(w.word))).size, cat).toBeGreaterThanOrEqual(GUESS_OPTIONS);
    }
  });

  it("alle Einträge bestehen die Schema-Validierung; Präfix passt, IDs fortlaufend", () => {
    for (const cat of CATEGORY_IDS) {
      WORDS_BY_CATEGORY[cat].forEach((w, i) => {
        expect(WordSchema.safeParse(w).success, w.id).toBe(true);
        expect(w.id, cat).toBe(`${CATEGORY_PREFIX[cat]}-${String(i + 1).padStart(3, "0")}`);
      });
    }
  });

  it("hat global eindeutige IDs und keine doppelten Wörter (normalisiert)", () => {
    const ids = new Set<string>();
    const words = new Map<string, string>();
    for (const w of ALL_WORDS) {
      expect(ids.has(w.id), w.id).toBe(false);
      ids.add(w.id);
      const key = normalizeWord(w.word);
      expect(words.get(key), `${w.id} doppelt zu ${words.get(key)}`).toBeUndefined();
      words.set(key, w.id);
    }
  });

  it("jedes Wort hat 1–2 Undercover-Wörter, verschieden vom Wort und untereinander", () => {
    for (const w of ALL_WORDS) {
      expect(w.undercover.length, w.id).toBeGreaterThanOrEqual(1);
      expect(w.undercover.length, w.id).toBeLessThanOrEqual(2);
      const keys = [w.word, ...w.undercover].map(normalizeWord);
      expect(new Set(keys).size, w.id).toBe(keys.length);
      // Kein Wort darf das andere einfach enthalten („Schwein“/„Wildschwein“) – das wäre kein eigenes Wort.
      for (const u of w.undercover) {
        expect(isForbiddenClue(u, w.word), `${w.id}: ${u}`).toBe(false);
        expect(isForbiddenClue(w.word, u), `${w.id}: ${u}`).toBe(false);
      }
    }
  });

  it("Schema lehnt ungültige Einträge ab", () => {
    const ok: RawWord = ["ort-001", "Strand", ["Schwimmbad"]];
    expect(toWords("orte", [ok])[0]!.undercover).toEqual(["Schwimmbad"]);
    const bad: RawWord[] = [
      ["ort-1", "Strand", ["Schwimmbad"]],
      ["tie-001", "Strand", ["Schwimmbad"]], // falsches Präfix
      ["ort-001", "strand", ["Schwimmbad"]], // klein
      ["ort-001", " Strand", ["Schwimmbad"]],
      ["ort-001", "Strand", []], // kein Undercover-Wort
      ["ort-001", "Strand", ["Schwimmbad", "Badesee", "Freibad"]], // zu viele
      ["ort-001", "Strand", ["STRAND!"]], // = Wort
      ["ort-001", "Strand", ["Badesee", "Bade-See"]], // doppelt
      ["ort-001", "X".repeat(25), ["Schwimmbad"]], // zu lang
      ["ort-001", "!?", ["Schwimmbad"]],
    ];
    for (const raw of bad) expect(() => toWords("orte", [raw]), raw.join("|")).toThrow();
  });
});
