import { describe, expect, it } from "vitest";
import { avatarEmoji, displayUrl, fallbackJoinUrl, fill, formatRoomCode, gameIcon, playerColorVar, splitRoomCode, urlHost } from "../src/lib/format.js";

describe("Code-Formatierung", () => {
  it("gruppiert 3+3 und behält führende Nullen", () => {
    expect(splitRoomCode("042137")).toEqual(["042", "137"]);
    expect(formatRoomCode("000001")).toBe("000 001");
  });
  it("ignoriert Nicht-Ziffern", () => {
    expect(formatRoomCode("12 34-56")).toBe("123 456");
  });
  it("kurze Eingaben bleiben ungruppiert", () => {
    expect(formatRoomCode("12")).toBe("12");
  });
});

describe("URLs", () => {
  it("kürzt die Join-URL für die Anzeige", () => {
    expect(displayUrl("https://play.example.org/j/042137/")).toBe("play.example.org/j/042137");
    expect(displayUrl("http://192.168.1.5:8080/j/042137")).toBe("192.168.1.5:8080/j/042137");
  });
  it("liefert den Host inkl. Port", () => {
    expect(urlHost("http://192.168.1.5:8080/j/042137")).toBe("192.168.1.5:8080");
  });
  it("baut eine Fallback-Join-URL aus origin", () => {
    expect(fallbackJoinUrl("http://tv.local:8080/", "000123")).toBe("http://tv.local:8080/j/000123");
  });
});

describe("Darstellung", () => {
  it("Avatare und Spiel-Icons mit Fallback", () => {
    expect(avatarEmoji("fuchs")).toBe("🦊");
    expect(avatarEmoji("unbekannt")).toBe("🙂");
    expect(gameIcon({ icon: "🧠" })).toBe("🧠");
    expect(gameIcon({})).toBe("🎮");
    expect(gameIcon(null)).toBe("🎮");
  });
  it("Spielerfarbe wird auf 0..7 begrenzt", () => {
    expect(playerColorVar(3)).toBe("var(--p3)");
    expect(playerColorVar(12)).toBe("var(--p7)");
    expect(playerColorVar(-1)).toBe("var(--p0)");
  });
  it("füllt Platzhalter", () => {
    expect(fill("{n} von {max}", { n: 2, max: 8 })).toBe("2 von 8");
    expect(fill("{x}", {})).toBe("{x}");
  });
});

describe("plural", () => {
  it("wählt Singular nur für genau 1", async () => {
    const { plural, t } = await import("../src/i18n/index.js");
    expect(plural(t.startButton.hintReady, 1)).toBe("1 Spieler ist bereit.");
    expect(plural(t.startButton.hintReady, 3)).toBe("3 Spieler sind bereit.");
    expect(plural(t.results.points, 1)).toBe("1 Punkt");
    expect(plural(t.results.points, 0)).toBe("0 Punkte");
  });
});
