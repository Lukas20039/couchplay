import { createRng } from "@couchplay/game-sdk";
import { describe, expect, it } from "vitest";
import {
  LEVELS,
  basePoints,
  comboMultiplier,
  isAdjacent,
  isValidPath,
  levelInfo,
  newUnlocks,
  resolveConfig,
  scoreWord,
  type WgSettings,
} from "../src/shared.js";
import { createDictionary, decodeWordlist, germanDictionary } from "../src/server/dictionary.js";
import { generateBoard, neighbours, randomLetters, solve } from "../src/server/grid.js";

const settings = (s: Partial<WgSettings> = {}): WgSettings => ({ mode: "klassisch", gridSize: "auto", rounds: 3, roundSeconds: 120, ...s });

describe("Wertung", () => {
  it("lange Wörter zählen überproportional", () => {
    expect([3, 4, 5, 6, 7, 8, 9, 10].map(basePoints)).toEqual([1, 2, 4, 6, 9, 12, 16, 20]);
  });

  it("Goldfeld, Combo, seltene Buchstaben und Langwort-Modus", () => {
    expect(scoreWord("HAUS", { gold: false, streak: 1, mode: "klassisch" })).toEqual({ points: 2, multiplier: 1, rare: 0 });
    expect(scoreWord("HAUS", { gold: true, streak: 1, mode: "klassisch" }).points).toBe(4);
    // Ü und J sind selten: (2 + 2) × 1
    expect(scoreWord("JÜTE", { gold: false, streak: 1, mode: "klassisch" })).toMatchObject({ points: 4, rare: 2 });
    // 3. Wort in Serie ×1,5 (aufgerundet), 6. ×2
    expect(scoreWord("HAUS", { gold: false, streak: 3, mode: "klassisch" })).toMatchObject({ points: 3, multiplier: 1.5 });
    expect(scoreWord("HAUS", { gold: true, streak: 6, mode: "klassisch" })).toMatchObject({ points: 8, multiplier: 4 });
    expect(scoreWord("GARTEN", { gold: false, streak: 1, mode: "langwort" }).points).toBe(12);
    expect(comboMultiplier(3, "blitz")).toBe(2);
    expect(comboMultiplier(6, "blitz")).toBe(3);
  });
});

describe("Pfade – auch schräg", () => {
  it("8er-Nachbarschaft", () => {
    // 4×4: Zelle 5 = Zeile 1, Spalte 1
    expect([0, 1, 2, 4, 6, 8, 9, 10].every((n) => isAdjacent(5, n, 4))).toBe(true);
    expect(isAdjacent(5, 5, 4)).toBe(false);
    expect(isAdjacent(3, 4, 4)).toBe(false); // Zeilenumbruch ist keine Nachbarschaft
    expect(neighbours(4)[0]).toEqual([1, 4, 5]);
  });

  it("gültig: diagonal; ungültig: Sprung, Wiederholung, außerhalb", () => {
    expect(isValidPath([0, 5, 10, 15], 4)).toBe(true);
    expect(isValidPath([3, 6, 9, 12], 4)).toBe(true);
    expect(isValidPath([0, 2], 4)).toBe(false);
    expect(isValidPath([0, 1, 0], 4)).toBe(false);
    expect(isValidPath([15, 16], 4)).toBe(false);
  });
});

describe("Gartenstufen", () => {
  it("Schwellen und Freischaltungen", () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, nextXp: 40, nextUnlock: "tips" });
    expect(levelInfo(40).level).toBe(2);
    expect(levelInfo(119).level).toBe(2);
    expect(levelInfo(1_000_000)).toMatchObject({ level: LEVELS.length, nextXp: null, nextUnlock: null });
    expect(newUnlocks(1, 3)).toEqual(["tips", "grid5"]);
  });

  it("Raster und Modus werden auf das Freigeschaltete begrenzt", () => {
    expect(resolveConfig(settings(), 1)).toMatchObject({ config: { size: 4, mode: "klassisch", tipsPerRound: 0, gold: false } });
    expect(resolveConfig(settings({ gridSize: "6" }), 3)).toMatchObject({ config: { size: 5 }, locked: { size: 6 } });
    expect(resolveConfig(settings({ gridSize: "4" }), 8)).toMatchObject({ config: { size: 4 }, locked: { size: null } });
    expect(resolveConfig(settings(), 6).config.size).toBe(6);
    expect(resolveConfig(settings({ mode: "blitz" }), 4)).toMatchObject({ config: { mode: "klassisch" }, locked: { mode: "blitz" } });
    const blitz = resolveConfig(settings({ mode: "blitz", roundSeconds: 120 }), 5).config;
    expect(blitz).toMatchObject({ mode: "blitz", roundMs: 60_000, comboWindowMs: 5000 });
    expect(resolveConfig(settings({ mode: "blitz", roundSeconds: 60 }), 5).config.roundMs).toBe(45_000);
    expect(resolveConfig(settings({ mode: "langwort" }), 7).config).toMatchObject({ mode: "langwort", minLen: 5 });
    expect(resolveConfig(settings(), 8).config.tipsPerRound).toBe(2);
  });
});

describe("Wörterbuch", () => {
  it("Front-Coding entpacken (normal und Grundform)", () => {
    // HAUS (Grundform), HAUSE (normal, Präfix 4), HAUT (Grundform, Präfix 3)
    const { words, base } = decodeWordlist("hHAUS4EkT");
    expect(words).toEqual(["HAUS", "HAUSE", "HAUT"]);
    expect([...base]).toEqual(["HAUS", "HAUT"]);
    expect(() => decodeWordlist("!X")).toThrow();
  });

  it("eingebaute Liste: Grundformen, Beugungen, Umlaute; keine Eigennamen-Abkürzungen", () => {
    const d = germanDictionary();
    expect(d.size).toBeGreaterThan(300_000);
    for (const w of ["HAUS", "KATZEN", "GING", "MÄDCHEN", "STRASSE", "SCHNEE", "WÖRTER", "BLUME"]) expect(d.has(w), w).toBe(true);
    for (const w of ["XYZ", "HAUSX", "", "haus"]) expect(d.has(w), w).toBe(false);
    expect(d.hasPrefix("GART")).toBe(true);
    expect(d.hasPrefix("QXZ")).toBe(false);
    expect(d.isBase("HAUS")).toBe(true);
    expect(d.isBase("KATZEN")).toBe(false);
  });

  it("unsortierte Eingabe wird sortiert", () => {
    const d = createDictionary(["TEE", "ABC", "MAUS"]);
    expect(d.has("MAUS") && d.has("ABC") && d.hasPrefix("TE")).toBe(true);
  });
});

describe("Raster", () => {
  it("findet waagrechte, senkrechte und schräge Wörter", () => {
    // H A x x
    // x U S x     HAUS: waagrecht, senkrecht, waagrecht; HAUSE: S → E senkrecht
    // x x E x     SET: E → T schräg; UHU gibt es nicht (H nur einmal)
    // x x x T
    const dict = createDictionary(["HAUS", "HAUSE", "AUS", "SET", "UHU"]);
    const letters = ["H", "A", "X", "X", "X", "U", "S", "X", "X", "X", "E", "X", "X", "X", "X", "T"];
    const sol = solve(letters, 4, dict, 3);
    expect([...sol.words.keys()].sort()).toEqual(["AUS", "HAUS", "HAUSE", "SET"]);
    expect(sol.words.get("HAUSE")).toEqual([0, 1, 5, 6, 10]);
    expect(sol.words.get("SET")).toEqual([6, 10, 15]); // E → T schräg
  });

  it("rein schräge Wörter in beide Richtungen", () => {
    // O x x R
    // x P A x     OPA: O(0) ↘ P(5) → A(6); RAT: R(3) ↙ A(6) ↙ T(9), TAR rückwärts
    // x T x x
    // x x x x
    const dict = createDictionary(["OPA", "RAT", "TAR"]);
    const letters = ["O", "X", "X", "R", "X", "P", "A", "X", "X", "T", "X", "X", "X", "X", "X", "X"];
    const sol = solve(letters, 4, dict, 3);
    expect(sol.words.get("OPA")).toEqual([0, 5, 6]);
    expect(sol.words.get("RAT")).toEqual([3, 6, 9]);
    expect(sol.words.get("TAR")).toEqual([9, 6, 3]);
  });

  it("Buchstaben: ausgewogener Vokalanteil, kein Q", () => {
    const rng = createRng(5);
    for (let i = 0; i < 50; i++) {
      const l = randomLetters(5, rng);
      expect(l).toHaveLength(25);
      expect(l).not.toContain("Q");
      const vowels = l.filter((x) => "AEIOUÄÖÜ".includes(x)).length;
      expect(vowels).toBeGreaterThanOrEqual(8);
    }
  });

  it("deterministisch je Seed und mit genug Wörtern", () => {
    const d = germanDictionary();
    const a = generateBoard(4, createRng(9), d, { minLen: 3, gold: true });
    const b = generateBoard(4, createRng(9), d, { minLen: 3, gold: true });
    expect(a.board).toEqual(b.board);
    expect(a.board.gold).toHaveLength(1);
    expect(a.solution.words.size).toBeGreaterThanOrEqual(40);
    const big = generateBoard(6, createRng(3), d, { minLen: 3, gold: false });
    expect(big.board.letters).toHaveLength(36);
    expect(big.board.gold).toEqual([]);
    expect(big.solution.words.size).toBeGreaterThanOrEqual(150);
  });
});
