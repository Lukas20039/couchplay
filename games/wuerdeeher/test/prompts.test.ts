// Aussagen-Katalog: Umfang, Schema, eindeutige IDs, keine doppelten Texte, Form „Wer würde eher …?“.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, CATEGORY_PREFIX } from "../src/constants.js";
import { ALL_PROMPTS, PROMPTS_BY_CATEGORY } from "../src/data/index.js";
import { PromptSchema, norm, toPrompts } from "../src/data/schema.js";

const MIN_PER_CATEGORY = 50;

describe("Aussagen-Katalog", () => {
  it(`hat je Kategorie mindestens ${MIN_PER_CATEGORY} Aussagen`, () => {
    for (const cat of CATEGORY_IDS) expect(PROMPTS_BY_CATEGORY[cat].length, cat).toBeGreaterThanOrEqual(MIN_PER_CATEGORY);
  });

  it("alle Einträge bestehen die Schema-Validierung; Präfix passt, IDs fortlaufend", () => {
    for (const cat of CATEGORY_IDS) {
      PROMPTS_BY_CATEGORY[cat].forEach((p, i) => {
        expect(PromptSchema.safeParse(p).success, p.id).toBe(true);
        expect(p.id, cat).toBe(`${CATEGORY_PREFIX[cat]}-${String(i + 1).padStart(3, "0")}`);
      });
    }
  });

  it("hat global eindeutige IDs und keine doppelten Texte", () => {
    const ids = new Set<string>();
    const texts = new Map<string, string>();
    for (const p of ALL_PROMPTS) {
      expect(ids.has(p.id), p.id).toBe(false);
      ids.add(p.id);
      const key = norm(p.text);
      expect(texts.get(key), `${p.id} doppelt zu ${texts.get(key)}`).toBeUndefined();
      texts.set(key, p.id);
    }
  });

  it("Schema lehnt ungültige Einträge ab", () => {
    const bad: [string, string][] = [
      ["all-1", "eine Nacht im Baumarkt verbringen?"],
      ["abe-001", "eine Nacht im Baumarkt verbringen?"], // falsches Präfix
      ["all-001", "Eine Nacht im Baumarkt verbringen?"], // groß
      ["all-001", "eine Nacht im Baumarkt verbringen"], // kein „?“
      ["all-001", "eine Nacht im Baumarkt verbringen ?"],
      ["all-001", "schlafen?"], // zu kurz
      ["all-001", `${"x".repeat(90)}?`], // zu lang
      ["all-001", "sich im Möbelhaus verlaufen?"],
      ["all-001", "was? wie? wo? warum?"],
      ["all-001", ' eine Nacht im "Baumarkt" verbringen?'],
    ];
    for (const raw of bad) expect(() => toPrompts("alltag", [raw]), raw.join("|")).toThrow();
    expect(toPrompts("alltag", [["all-001", "eine Nacht im Baumarkt verbringen?"]])[0]!.text).toBe("eine Nacht im Baumarkt verbringen?");
  });
});
