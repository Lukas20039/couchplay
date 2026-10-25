// Fragenkatalog: Umfang, Schema, eindeutige IDs, keine doppelten Fragen, Hauslügen ≠ Wahrheit.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, CATEGORY_PREFIX } from "../src/constants.js";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import { BluffSchema, norm, toBluffs, type RawBluff } from "../src/data/schema.js";
import { normalizeAnswer } from "../src/normalize.js";

const MIN_PER_CATEGORY = Number(process.env.FL_MIN ?? 25);

describe("Fragenkatalog", () => {
  it(`hat je Kategorie mindestens ${MIN_PER_CATEGORY} Fragen`, () => {
    for (const cat of CATEGORY_IDS) expect(QUESTIONS_BY_CATEGORY[cat].length, cat).toBeGreaterThanOrEqual(MIN_PER_CATEGORY);
  });

  it("alle Fragen bestehen die Schema-Validierung, Präfix passt zur Kategorie", () => {
    for (const cat of CATEGORY_IDS) {
      for (const q of QUESTIONS_BY_CATEGORY[cat]) {
        expect(BluffSchema.safeParse(q).success, q.id).toBe(true);
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

  it("Hauslügen sind untereinander, zur Wahrheit und zu den Alternativen verschieden (normalisiert)", () => {
    for (const q of ALL_QUESTIONS) {
      const truth = new Set([q.answer, ...q.alternatives].map(normalizeAnswer));
      const lies = q.lies.map(normalizeAnswer);
      expect(new Set(lies).size, q.id).toBe(lies.length);
      for (const l of lies) expect(truth.has(l), `${q.id}: ${l}`).toBe(false);
      expect(q.lies.length, q.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("Schema lehnt ungültige Einträge ab", () => {
    const ok: RawBluff = ["kur-001", "Was ist in Singapur verboten zu verkaufen?", "Kaugummi", ["Zigarren", "Luftballons", "Wasserpistolen"]];
    expect(toBluffs("kurioses", [ok])[0]!.answer).toBe("Kaugummi");
    expect(toBluffs("kurioses", [[ok[0], ok[1], ok[2], ok[3], "", ["Kaugummis"]]])[0]!.alternatives).toEqual(["Kaugummis"]);
    const bad: RawBluff[] = [
      ["kur-1", ok[1], ok[2], ok[3]],
      ["tie-001", ok[1], ok[2], ok[3]], // falsches Präfix
      ["kur-001", "Was ist in Singapur verboten", ok[2], ok[3]], // kein „?“
      ["kur-001", "Was ist das?", ok[2], ok[3]], // zu kurz
      ["kur-001", `${"x".repeat(140)}?`, ok[2], ok[3]], // zu lang
      ["kur-001", ok[1], "", ok[3]],
      ["kur-001", ok[1], "x".repeat(41), ok[3]],
      ["kur-001", ok[1], ok[2], ["Zigarren", "Luftballons"]], // zu wenige Hauslügen
      ["kur-001", ok[1], ok[2], ["A1", "B2", "C3", "D4", "E5", "F6"]], // zu viele
      ["kur-001", ok[1], ok[2], ["Zigarren", "zigarren!", "Luftballons"]], // doppelt
      ["kur-001", ok[1], ok[2], ["Der Kaugummi", "Zigarren", "Luftballons"]], // = Wahrheit
      ["kur-001", ok[1], ok[2], ["Kaugummis", "Zigarren", "Luftballons"], undefined, ["Kaugummis"]], // = Alternative
      ["kur-001", ok[1], ok[2], ok[3], "x".repeat(161)],
      ["kur-001", ok[1], ok[2], ok[3], undefined, ["y".repeat(41)]],
    ];
    for (const raw of bad) expect(() => toBluffs("kurioses", [raw]), raw.join("|")).toThrow();
  });
});
