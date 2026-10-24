import { describe, expect, it } from "vitest";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import { LIMITS, QuestionSchema } from "../src/data/schema.js";
import manifest from "../manifest.json" with { type: "json" };
import { CATEGORY_IDS } from "../src/shared.js";

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

describe("Fragenkatalog", () => {
  it("hat mindestens 1500 Fragen und je Kategorie mindestens 190", () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThanOrEqual(1500);
    for (const cat of CATEGORY_IDS) expect(QUESTIONS_BY_CATEGORY[cat].length, cat).toBeGreaterThanOrEqual(190);
  });

  it("deckt genau die Kategorien des Manifests ab", () => {
    const field = manifest.settings.find((s) => s.key === "categories");
    const values = (field as { options: { value: string }[] }).options.map((o) => o.value);
    expect([...values].sort()).toEqual([...CATEGORY_IDS].sort());
  });

  it("alle Fragen bestehen die Schema-Validierung", () => {
    for (const q of ALL_QUESTIONS) expect(QuestionSchema.safeParse(q).success, q.id).toBe(true);
  });

  it("hat eindeutige IDs", () => {
    const ids = ALL_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hat keine doppelten Fragen", () => {
    const seen = new Map<string, string>();
    for (const q of ALL_QUESTIONS) {
      const key = norm(q.text);
      expect(seen.get(key), `${q.id} doppelt zu ${seen.get(key)}`).toBeUndefined();
      seen.set(key, q.id);
    }
  });

  it("hat vier unterschiedliche Antworten je Frage", () => {
    for (const q of ALL_QUESTIONS) expect(new Set(q.answers.map(norm)).size, q.id).toBe(4);
  });

  it("hält die Längenlimits für TV und Handy ein", () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.text.length, q.id).toBeLessThanOrEqual(LIMITS.questionMax);
      for (const a of q.answers) expect(a.length, `${q.id}: ${a}`).toBeLessThanOrEqual(LIMITS.answerMax);
    }
  });

  it("verrät die Antwort nicht in der Frage", () => {
    for (const q of ALL_QUESTIONS) {
      const correct = norm(q.answers[0]);
      // Kurze Antworten (Zahlen, Symbole) können zufällig vorkommen – nur längere prüfen.
      if (correct.length >= 4) expect(norm(q.text).includes(correct), q.id).toBe(false);
    }
  });

  it("mischt die Schwierigkeitsgrade in jeder Kategorie", () => {
    for (const cat of CATEGORY_IDS) {
      const levels = new Set(QUESTIONS_BY_CATEGORY[cat].map((q) => q.difficulty));
      expect([...levels].sort(), cat).toEqual([1, 2, 3]);
    }
  });

  it("lehnt fehlerhafte Fragen ab", () => {
    const ok = { id: "geo-99", category: "geografie", difficulty: 2, text: "Eine gültige Frage?", answers: ["a", "b", "c", "d"] };
    expect(QuestionSchema.safeParse(ok).success).toBe(true);
    expect(QuestionSchema.safeParse({ ...ok, answers: ["a", "b", "c", "A"] }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...ok, answers: ["a", "b", "c"] }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...ok, difficulty: 4 }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...ok, id: "spo-99" }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...ok, text: "x".repeat(LIMITS.questionMax + 1) }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...ok, answers: ["a", "b", "c", "x".repeat(LIMITS.answerMax + 1)] }).success).toBe(false);
  });
});
