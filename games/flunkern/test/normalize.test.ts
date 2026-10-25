// Normalisierung von Lügen/Antworten und Bereinigung der Eingabe.
import { describe, expect, it } from "vitest";
import { cleanText, isValidLie, lieLength, normalizeAnswer } from "../src/normalize.js";

describe("normalizeAnswer", () => {
  it("ignoriert Groß/klein, Leerzeichen und Satzzeichen", () => {
    expect(normalizeAnswer("Kaugummi")).toBe("kaugummi");
    expect(normalizeAnswer("  KAU-gummi!!  ")).toBe("kaugummi");
    expect(normalizeAnswer("Kau Gummi.")).toBe("kaugummi");
    expect(normalizeAnswer("„Kaugummi“?")).toBe("kaugummi");
  });

  it("Umlaute und ß: ä = ae, ß = ss; Akzente fallen weg", () => {
    expect(normalizeAnswer("Bär")).toBe(normalizeAnswer("Baer"));
    expect(normalizeAnswer("Füße")).toBe(normalizeAnswer("Fuesse"));
    expect(normalizeAnswer("GRÜßE")).toBe("gruesse");
    expect(normalizeAnswer("Crème brûlée")).toBe("cremebrulee");
  });

  it("entfernt einen Artikel am Anfang, aber nicht das einzige Wort", () => {
    for (const s of ["Der Bär", "die Bär", "das Bär", "ein Bär", "Eine Bär", "einen Bär", "DEM Bär"]) expect(normalizeAnswer(s), s).toBe("baer");
    expect(normalizeAnswer("Die")).toBe("die");
    expect(normalizeAnswer("Die Die")).toBe("die");
    // nur ein Artikel und nur am Anfang
    expect(normalizeAnswer("Der Bär der Berge")).toBe("baerderberge");
    expect(normalizeAnswer("Derwisch")).toBe("derwisch");
  });

  it("Ziffern bleiben erhalten, nur Satzzeichen → leer", () => {
    expect(normalizeAnswer("38 Minuten")).toBe("38minuten");
    expect(normalizeAnswer("?!… ")).toBe("");
  });
});

describe("cleanText / isValidLie", () => {
  it("bereinigt Steuer- und Bidi-Zeichen und Leerraum", () => {
    expect(cleanText("  Gar​ten‮  zwerg \n ")).toBe("Garten zwerg");
  });

  it("1–40 Zeichen (Codepoints), mindestens ein Buchstabe oder eine Ziffer", () => {
    expect(isValidLie("x")).toBe(true);
    expect(isValidLie("a".repeat(40))).toBe(true);
    expect(isValidLie("a".repeat(41))).toBe(false);
    expect(isValidLie("")).toBe(false);
    expect(isValidLie("!!!")).toBe(false);
    expect(lieLength("🤥".repeat(3))).toBe(3);
    expect(isValidLie(`${"🤥".repeat(39)}a`)).toBe(true);
  });
});
