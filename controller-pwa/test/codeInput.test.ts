import { describe, expect, it } from "vitest";
import { activeCell, codeCells, isCodeComplete, nextCode, normalizeCodeInput } from "../src/lib/codeInput.js";

describe("Code-Eingabe", () => {
  it("lässt nur Ziffern zu und kappt auf 6", () => {
    expect(normalizeCodeInput("12a3")).toBe("123");
    expect(normalizeCodeInput("1234567")).toBe("123456");
    expect(normalizeCodeInput("")).toBe("");
  });

  it("übernimmt eingefügte Codes mit Leerzeichen/Bindestrich", () => {
    expect(normalizeCodeInput("042 137")).toBe("042137");
    expect(normalizeCodeInput(" 042-137 ")).toBe("042137");
  });

  it("holt den Code aus einem eingefügten Join-Link (ohne Port-Ziffern)", () => {
    expect(normalizeCodeInput("http://192.168.1.20:8080/j/042137")).toBe("042137");
    expect(normalizeCodeInput("https://play.example.org/j/000123/")).toBe("000123");
  });

  it("behält führende Nullen", () => {
    expect(normalizeCodeInput("000001")).toBe("000001");
    expect(isCodeComplete("000001")).toBe(true);
  });

  it("meldet 'completed' nur beim Übergang auf 6 Ziffern", () => {
    expect(nextCode("12345", "123456")).toEqual({ code: "123456", completed: true });
    expect(nextCode("123456", "123456")).toEqual({ code: "123456", completed: false });
    expect(nextCode("", "042137")).toEqual({ code: "042137", completed: true }); // Einfügen/Autofill
    expect(nextCode("123456", "12345")).toEqual({ code: "12345", completed: false }); // Löschen
  });

  it("liefert Zellen und Cursorposition", () => {
    expect(codeCells("12")).toEqual(["1", "2", "", "", "", ""]);
    expect(activeCell("")).toBe(0);
    expect(activeCell("12")).toBe(2);
    expect(activeCell("123456")).toBe(5);
  });
});
