// Text-Helfer: Bereinigen, „ein Wort“, Vergleich und verbotene Hinweise.
import { describe, expect, it } from "vitest";
import { cleanText, clueLength, hasSpace, isForbiddenClue, isValidClue, normalizeWord } from "../src/normalize.js";

describe("cleanText / isValidClue", () => {
  it("bereinigt Steuerzeichen und Leerraum", () => {
    expect(cleanText("  Sand​\n ")).toBe("Sand");
    expect(cleanText("Sonnen  Creme")).toBe("Sonnen Creme");
  });

  it("verlangt genau ein Wort mit 1–24 Zeichen und Buchstaben/Ziffern", () => {
    expect(isValidClue("Sand")).toBe(true);
    expect(isValidClue("Sonnen-Creme")).toBe(true);
    expect(isValidClue("007")).toBe(true);
    expect(isValidClue("")).toBe(false);
    expect(isValidClue("?!")).toBe(false);
    expect(isValidClue("Sonnen Creme")).toBe(false);
    expect(isValidClue("x".repeat(24))).toBe(true);
    expect(isValidClue("x".repeat(25))).toBe(false);
    expect(hasSpace("a b")).toBe(true);
    expect(clueLength("🏖️a")).toBe(3);
  });
});

describe("normalizeWord", () => {
  it("ignoriert Groß/klein, Umlaute, Akzente, Satzzeichen und Artikel", () => {
    expect(normalizeWord("Der Löwe!")).toBe("loewe");
    expect(normalizeWord("LOEWE")).toBe("loewe");
    expect(normalizeWord("Bungee-Jumping")).toBe("bungeejumping");
    expect(normalizeWord("Café")).toBe("cafe");
    expect(normalizeWord("Die")).toBe("die");
  });
});

describe("isForbiddenClue", () => {
  it("lehnt das Wort selbst und Schreibvarianten ab", () => {
    expect(isForbiddenClue("strand", "Strand")).toBe(true);
    expect(isForbiddenClue("STRAND!", "Strand")).toBe(true);
    expect(isForbiddenClue("Loewe", "Löwe")).toBe(true);
  });

  it("lehnt Zusammensetzungen mit dem Wort ab", () => {
    expect(isForbiddenClue("Strandkorb", "Strand")).toBe(true);
    expect(isForbiddenClue("Sandstrandliege", "Strand")).toBe(true);
    expect(isForbiddenClue("Haifisch", "Hai")).toBe(true);
    expect(isForbiddenClue("Milchkuh", "Kuh")).toBe(true);
    expect(isForbiddenClue("Hunde", "Hund")).toBe(true);
  });

  it("lehnt Teile mehrteiliger Wörter ab", () => {
    expect(isForbiddenClue("Potter", "Harry Potter")).toBe(true);
    expect(isForbiddenClue("harry", "Harry Potter")).toBe(true);
    expect(isForbiddenClue("Zauberer", "Harry Potter")).toBe(false);
  });

  it("erlaubt normale Hinweise – auch mit kurzem Wort in der Mitte", () => {
    expect(isForbiddenClue("Sand", "Strand")).toBe(false);
    expect(isForbiddenClue("Reise", "Eis")).toBe(false);
    expect(isForbiddenClue("Meer", "Strand")).toBe(false);
    expect(isForbiddenClue("Bad", "Schwimmbad")).toBe(false);
  });
});
