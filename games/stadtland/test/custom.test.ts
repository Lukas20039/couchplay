// Eigene Kategorien: Bereinigung, Abbildung auf eingebaute Kategorien, Gedächtnis am Host-Handy.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, CUSTOM_NAME_MAX } from "../src/constants.js";
import { CUSTOM_STORAGE_KEY, cleanCategoryList, loadCustom, matchCategory, saveCustom } from "../src/custom.js";
import { CATEGORY_LABELS, CUSTOM_DEFAULTS } from "../src/i18n/de.js";

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

describe("Eigene Kategorien", () => {
  it("bereinigt: Leerraum, Leere/Satzzeichen raus, Doppelte (Vergleichsschlüssel) raus, höchstens 6, gekürzt", () => {
    expect(cleanCategoryList(["  Automarken ", "", "!!", "automarken", "Die Automarken", "Tiere"])).toEqual(["Automarken", "Tiere"]);
    expect(cleanCategoryList(["a1", "a2", "a3", "a4", "a5", "a6", "a7"])).toHaveLength(6);
    expect([...cleanCategoryList(["x".repeat(60)])[0]!]).toHaveLength(CUSTOM_NAME_MAX);
  });

  it("bildet eingebaute Namen und naheliegende Aliase ab, alles andere ist nicht prüfbar", () => {
    const cases: Array<[string, string | null]> = [
      ["Stadt", "stadt"],
      ["Städte", "stadt"],
      ["Land", "land"],
      ["Länder", "land"],
      ["Fluss", "fluss"],
      ["Flüsse", "fluss"],
      ["Name", "name"],
      ["Vorname", "name"],
      ["Beruf", "beruf"],
      ["Tier", "tier"],
      ["Die Tiere", "tier"],
      ["Obst", "obstgemuese"],
      ["Gemüse", "obstgemuese"],
      ["Getränk", "getraenk"],
      ["Getränke", "getraenk"],
      ["Marken", "marke"],
      ["Band oder Musiker:in", "musik"],
      ["Automarke", null],
      ["Dinge im Bad", null],
    ];
    for (const [name, id] of cases) expect(matchCategory(name), name).toBe(id);
    // Jeder eingebaute Anzeigename bildet auf seine Kategorie ab.
    for (const id of CATEGORY_IDS) expect(matchCategory(CATEGORY_LABELS[id]), id).toBe(id);
  });

  it("Gedächtnis: speichern, laden, defekt/zu kurz → null", () => {
    const s = memory();
    expect(loadCustom(s, 3)).toBeNull();
    saveCustom(s, ["Automarken", " Tiere ", "tiere", "Dinge im Bad"]);
    expect(JSON.parse(s.data.get(CUSTOM_STORAGE_KEY)!)).toEqual(["Automarken", "Tiere", "Dinge im Bad"]);
    expect(loadCustom(s, 3)).toEqual(["Automarken", "Tiere", "Dinge im Bad"]);
    expect(loadCustom(memory({ [CUSTOM_STORAGE_KEY]: "{kaputt" }), 3)).toBeNull();
    expect(loadCustom(memory({ [CUSTOM_STORAGE_KEY]: JSON.stringify(["A1", 7, "B2"]) }), 3)).toBeNull();
    expect(loadCustom(null, 3)).toBeNull();
    expect(CUSTOM_DEFAULTS.map(matchCategory)).toEqual(["stadt", "land", "fluss", "name", "beruf", "tier"]);
  });
});
