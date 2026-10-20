import { describe, expect, it } from "vitest";
import { findNext, keyToNav, type NavItem } from "../src/nav/spatial.js";

const box = (id: string, group: string, left: number, top: number, width = 100, height = 50): NavItem => ({
  id,
  group,
  rect: { left, top, width, height },
});

// Layout wie die Lobby: Kachelreihe oben, darunter Einstellungen (rechts) und Start (unten links).
const tiles = [box("t1", "games", 500, 100, 200, 120), box("t2", "games", 740, 100, 200, 120), box("t3", "games", 980, 100, 200, 120)];
const settings = [box("s1", "settings", 1000, 300, 400, 60), box("s2", "settings", 1000, 380, 400, 60), box("s3", "settings", 1000, 460, 400, 60)];
const start = [box("go", "start", 500, 800, 400, 100)];
const all = [...tiles, ...settings, ...start];

describe("findNext", () => {
  it("bewegt sich innerhalb der Reihe", () => {
    expect(findNext("t1", all, "right")).toBe("t2");
    expect(findNext("t2", all, "left")).toBe("t1");
  });
  it("liefert null am Rand", () => {
    expect(findNext("t1", all, "left")).toBeNull();
    expect(findNext("t1", all, "up")).toBeNull();
  });
  it("bleibt bevorzugt in der eigenen Gruppe", () => {
    expect(findNext("s1", all, "down")).toBe("s2");
    expect(findNext("s3", all, "up")).toBe("s2");
  });
  it("wechselt die Gruppe, wenn die eigene in der Richtung endet", () => {
    expect(findNext("s1", all, "up")).toBe("t3");
    expect(findNext("t1", all, "down")).toBe("go");
  });
  it("bevorzugt Elemente mit Überlappung gegenüber diagonalen", () => {
    expect(findNext("t3", all, "down")).toBe("s1");
  });
  it("stellt das zuletzt fokussierte Element der Zielgruppe wieder her", () => {
    expect(findNext("t3", all, "down", { settings: "s3" })).toBe("s3");
    // Gedächtnis gilt nicht innerhalb der eigenen Gruppe
    expect(findNext("s1", all, "down", { settings: "s3" })).toBe("s2");
  });
  it("ignoriert veraltetes Gedächtnis", () => {
    expect(findNext("t3", all, "down", { settings: "weg" })).toBe("s1");
  });
  it("startet beim ersten Element ohne aktuellen Fokus", () => {
    expect(findNext(null, all, "down")).toBe("t1");
    expect(findNext(null, [], "down")).toBeNull();
  });
  it("Elemente auf gleicher Höhe zählen nicht als oben/unten", () => {
    const row = [box("a", "g", 0, 0), box("b", "g", 200, 0)];
    expect(findNext("a", row, "down")).toBeNull();
  });
});

describe("keyToNav", () => {
  it("bildet Tasten und Keycodes ab", () => {
    expect(keyToNav({ key: "ArrowUp" })).toBe("up");
    expect(keyToNav({ key: "Enter" })).toBe("ok");
    expect(keyToNav({ key: "Escape" })).toBe("back");
    expect(keyToNav({ key: "GoBack" })).toBe("back");
    expect(keyToNav({ key: "Unidentified", keyCode: 23 })).toBe("ok");
    expect(keyToNav({ key: "Unidentified", keyCode: 39 })).toBe("right");
    expect(keyToNav({ key: "ContextMenu" })).toBe("menu");
    expect(keyToNav({ key: "a", keyCode: 65 })).toBeNull();
  });
});
