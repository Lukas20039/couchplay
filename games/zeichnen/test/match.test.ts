// Normalisierung, Fuzzy-Vergleich und Wortlücken.
import { describe, expect, it } from "vitest";
import { normalizeGuess } from "../src/data/schema.js";
import { acceptedKeys, buildHint, cleanGuess, judgeGuess, levenshtein, maxReveals, typoTolerance } from "../src/server/match.js";

describe("normalizeGuess", () => {
  it.each([
    ["Käse", "kaese"],
    ["KAESE", "kaese"],
    ["Der Eiffel-Turm!", "eiffelturm"],
    ["ein  Fußball", "fussball"],
    ["Über-Raschungs Ei", "ueberraschungsei"],
    ["Crème brûlée", "cremebrulee"],
    ["die", "die"],
  ])("%s → %s", (input, out) => {
    expect(normalizeGuess(input)).toBe(out);
  });
});

describe("judgeGuess", () => {
  const keys = acceptedKeys({ word: "Schmetterling", alternatives: ["Falter"] });

  it("Wort und Alternativen sind richtig, egal wie geschrieben", () => {
    expect(judgeGuess("schmetterling", keys)).toBe("correct");
    expect(judgeGuess("Ein Falter.", keys)).toBe("correct");
    expect(judgeGuess("Kaese", acceptedKeys({ word: "Käse", alternatives: [] }))).toBe("correct");
  });

  it("Tippfehlergrenze: 1 ab 5 Zeichen, 2 ab 9 Zeichen, darunter keine", () => {
    expect(typoTolerance("hund")).toBe(0);
    expect(typoTolerance("katze")).toBe(1);
    expect(typoTolerance("schmetter")).toBe(2);
    const hund = acceptedKeys({ word: "Hund", alternatives: [] });
    expect(judgeGuess("Hunt", hund)).toBe("wrong");
    const katze = acceptedKeys({ word: "Katze", alternatives: [] });
    expect(judgeGuess("Kaze", katze)).toBe("close");
    expect(judgeGuess("Katzen", katze)).toBe("close");
    expect(judgeGuess("Kazen", katze)).toBe("wrong");
    expect(judgeGuess("Schmeterlink", keys)).toBe("close");
    expect(judgeGuess("Schmeterlinxx!", keys)).toBe("wrong");
    // Alternative „Falter“ (6) erlaubt 1 Fehler.
    expect(judgeGuess("Falder", keys)).toBe("close");
  });

  it("leere Tipps sind falsch", () => {
    expect(judgeGuess(" !? ", keys)).toBe("wrong");
  });
});

describe("Hilfsfunktionen", () => {
  it("levenshtein", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("abcdef", "uvwxyz", 1)).toBe(2);
  });

  it("Lücken: Leerzeichen und Bindestriche sichtbar, Buchstaben verdeckt", () => {
    expect(buildHint("Eis-Bär 2", new Set([1]))).toEqual([null, "i", null, "-", null, null, null, " ", null]);
  });

  it("aufdeckbare Buchstaben", () => {
    expect(maxReveals("Ei")).toBe(0);
    expect(maxReveals("Eis")).toBe(1);
    expect(maxReveals("Hund")).toBe(1);
    expect(maxReveals("Katze")).toBe(2);
  });

  it("cleanGuess entfernt Steuerzeichen und fasst Leerraum zusammen", () => {
    expect(cleanGuess("  a‮b\n  c\u0000 ")).toBe("ab c");
  });
});
