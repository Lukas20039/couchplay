import { describe, expect, it } from "vitest";
import type { SettingField } from "@couchplay/protocol";
import { numberOptions, toggleMulti, valueText } from "../src/ui/Settings.js";
import { quiz, ttt } from "./fixtures.js";

const [categories, rounds, bonus] = quiz.settings as [
  Extract<SettingField, { type: "multiselect" }>,
  Extract<SettingField, { type: "number" }>,
  SettingField,
];

describe("Einstellungen", () => {
  it("Zahlenwerte aus min/max/step", () => {
    expect(numberOptions(rounds)).toEqual([5, 10, 15, 20, 25, 30]);
    expect(numberOptions({ ...rounds, min: 0, max: 1000, step: undefined })).toHaveLength(100);
  });
  it("Anzeigetexte je Feldtyp (Defaults, wenn Wert fehlt)", () => {
    expect(valueText(rounds, {})).toBe("10");
    expect(valueText(bonus, {})).toBe("An");
    expect(valueText(bonus, { bonus: false })).toBe("Aus");
    expect(valueText(ttt.settings[0]!, {})).toBe("Mittel");
    expect(valueText(categories, {})).toBe("Alle");
    expect(valueText(categories, { categories: ["c", "a"] })).toBe("A, C");
  });
  it("Multiselect respektiert minSelected und Optionsreihenfolge", () => {
    expect(toggleMulti(categories, ["a"], "a")).toBeNull();
    expect(toggleMulti(categories, ["c"], "a")).toEqual(["a", "c"]);
    expect(toggleMulti({ ...categories, maxSelected: 1 }, ["c"], "a")).toBeNull();
    expect(toggleMulti(categories, ["a", "b"], "b")).toEqual(["a"]);
  });
  it("lange Mehrfachauswahl wird als Anzahl gezeigt (Pille kürzt nie)", () => {
    const long = { ...categories, options: [{ value: "a", label: "Wissenschaft & Natur" }, { value: "b", label: "Kunst & Literatur" }, { value: "c", label: "C" }] };
    expect(valueText(long, { categories: ["a", "b"] })).toBe("2 von 3");
    expect(valueText(long, { categories: ["a"] })).toBe("1 von 3");
    expect(valueText(long, { categories: ["c"] })).toBe("C");
  });
});
