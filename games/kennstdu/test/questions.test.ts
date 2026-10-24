// Fragenkatalog: Umfang, Schema, keine Doppelten, Platzhalter.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS } from "../src/constants.js";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import { QuestionSchema, norm } from "../src/data/schema.js";

const MIN_PER_CATEGORY = Number(process.env.KD_MIN ?? 75);

describe("Fragenkatalog", () => {
  it(`hat je Kategorie mindestens ${MIN_PER_CATEGORY} Fragen`, () => {
    for (const cat of CATEGORY_IDS) expect(QUESTIONS_BY_CATEGORY[cat].length, cat).toBeGreaterThanOrEqual(MIN_PER_CATEGORY);
  });

  it("alle Fragen bestehen die Schema-Validierung", () => {
    for (const q of ALL_QUESTIONS) expect(QuestionSchema.safeParse(q).success, q.id).toBe(true);
  });

  it("hat eindeutige IDs und keine doppelten Fragen (auch nicht kategorieübergreifend)", () => {
    const ids = new Set<string>();
    const texts = new Map<string, string>();
    for (const q of ALL_QUESTIONS) {
      expect(ids.has(q.id), q.id).toBe(false);
      ids.add(q.id);
      const key = norm(q.toYou);
      expect(texts.get(key), `${q.id} doppelt zu ${texts.get(key)}`).toBeUndefined();
      texts.set(key, q.id);
    }
  });

  it("Platzhalter genau einmal, keine geraden Anführungszeichen", () => {
    for (const q of ALL_QUESTIONS) {
      expect(q.about.split("{name}").length - 1, q.id).toBe(1);
      for (const s of [q.about, q.toYou, ...q.answers]) expect(s.includes('"'), q.id).toBe(false);
    }
  });
});
