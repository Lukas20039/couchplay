import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { GameResults, SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import game, { parseWgSettings } from "../src/server/index.js";
import { germanDictionary } from "../src/server/dictionary.js";
import { solve } from "../src/server/grid.js";
import { TIMING, type WgPlayerView, type WgResultData, type WgTvState } from "../src/shared.js";

type H = GameHarness<WgTvState, WgPlayerView>;
type RoundTv = Extract<WgTvState, { phase: "round" }>;

const setup = (players: number, settings: SettingsValues = {}, previous: GameResults | null = null, seed = 7): H =>
  createTestHarness<WgTvState, WgPlayerView>(game, { players, settings, seed, previous });

const tv = (h: H): WgTvState => h.lastTv()!;
const view = (h: H, id: string): WgPlayerView => h.lastView(id)!;

function roundTv(h: H): RoundTv {
  const s = tv(h);
  if (s.phase !== "round") throw new Error(`keine Runde aktiv (${s.phase})`);
  return s;
}

/** Alle Wörter des aktuellen Rasters mit Pfad, kurze zuerst (die sind sicher keine Tipp-Wörter). */
function wordsOnBoard(h: H, minLen = 3): Array<[string, number[]]> {
  const { board } = roundTv(h);
  return [...solve(board.letters, board.size, germanDictionary(), minLen).words].sort((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1));
}

const submit = (h: H, id: string, path: number[]) => h.input(id, { type: "word", path });
const last = (h: H, id: string) => {
  const v = view(h, id);
  if (v.phase !== "round") throw new Error(v.phase);
  return v.last!;
};

function toRound(h: H): void {
  expect(tv(h).phase).toBe("intro");
  h.advance(TIMING.introMs);
  expect(tv(h).phase).toBe("round");
}

describe("Wortgarten – Ablauf", () => {
  it("Intro → Runden → Ernte → Finale → Ergebnis mit Erfahrung", () => {
    const h = setup(1, { rounds: 2, roundSeconds: 60 });
    expect(tv(h)).toMatchObject({ phase: "intro", rounds: 2, level: { level: 1 }, config: { size: 4, mode: "klassisch" } });
    toRound(h);
    const [w] = wordsOnBoard(h);
    expect(submit(h, "p1", w![1])).toEqual({ ok: true });
    expect(last(h, "p1")).toMatchObject({ seq: 1, word: w![0], result: "ok" });
    const pts = last(h, "p1").points;
    expect(view(h, "p1")).toMatchObject({ score: pts, found: [{ word: w![0], points: pts }] });
    // TV zeigt Blumen (Wortlänge), aber keine Wörter
    expect(roundTv(h).players[0]!.blooms).toEqual([w![0].length]);
    expect(JSON.stringify(tv(h))).not.toContain(`"${w![0]}"`);

    h.advance(60_000);
    expect(tv(h)).toMatchObject({ phase: "roundEnd", round: 0, uniqueBonus: false });
    // Allein: kein Einzigartig-Bonus
    expect(view(h, "p1")).toMatchObject({ phase: "roundEnd", roundPoints: pts, words: [{ word: w![0], unique: false }] });
    h.advance(TIMING.roundEndMs);
    expect(roundTv(h).round).toBe(1);
    h.advance(60_000 + TIMING.roundEndMs);
    expect(tv(h).phase).toBe("final");
    expect(view(h, "p1")).toMatchObject({ phase: "final", xpBefore: 0, xpAfter: pts, wordCount: 1, longest: w![0] });
    h.advance(TIMING.finalMs);
    expect(h.results).toMatchObject({ gameId: "wortgarten", ranking: [{ playerId: "p1", score: pts, rank: 1 }] });
    expect((h.results!.data as WgResultData).xp).toEqual({ p1: pts });
  });

  it("Rückmeldungen: doppelt, kein Wort, zu kurz, ungültiger Pfad; Eingaben außerhalb der Runde ignoriert", () => {
    const h = setup(1);
    expect(submit(h, "p1", [0, 1, 2])).toEqual({ ok: true }); // Intro → ignoriert
    expect(view(h, "p1").phase).toBe("intro");
    toRound(h);
    const [[word, path]] = wordsOnBoard(h) as [[string, number[]]];
    submit(h, "p1", path);
    submit(h, "p1", path);
    expect(last(h, "p1")).toMatchObject({ seq: 2, word, result: "dup", points: 0 });
    submit(h, "p1", path.slice(0, 2));
    expect(last(h, "p1")).toMatchObject({ result: "short" });
    submit(h, "p1", [0, 2, 3]);
    expect(last(h, "p1")).toMatchObject({ result: "bad" });
    // Ein Pfad, der kein Wort ergibt (falls die drei Buchstaben zufällig ein Wort sind, ist das Ergebnis ok)
    submit(h, "p1", [0, 1, 2]);
    const r = last(h, "p1");
    const letters = roundTv(h).board.letters;
    expect(r.result).toBe(germanDictionary().has([0, 1, 2].map((c) => letters[c]).join("")) ? "ok" : "unknown");
    // Schema: Zelle außerhalb von 6×6 → INVALID_INPUT, Spiel sieht es nie
    expect(submit(h, "p1", [36]).ok).toBe(false);
  });

  it("Einzigartige Wörter zählen ×2, geteilte normal", () => {
    const h = setup(2, { rounds: 1 });
    toRound(h);
    const ws = wordsOnBoard(h);
    const [shared, onlyA] = [ws[0]!, ws[1]!];
    submit(h, "p1", shared[1]);
    submit(h, "p2", shared[1]);
    submit(h, "p1", onlyA[1]);
    const a = view(h, "p1");
    if (a.phase !== "round") throw new Error();
    const ptsShared = a.found.find((f) => f.word === shared[0])!.points;
    const ptsA = a.found.find((f) => f.word === onlyA[0])!.points;
    h.advance(120_000);
    const end = tv(h);
    if (end.phase !== "roundEnd") throw new Error(end.phase);
    expect(end.uniqueBonus).toBe(true);
    const r1 = end.results.find((r) => r.playerId === "p1")!;
    expect(r1.words).toContainEqual({ word: onlyA[0], points: ptsA * 2, unique: true });
    expect(r1.words).toContainEqual({ word: shared[0], points: ptsShared, unique: false });
    expect(r1.points).toBe(ptsA * 2 + ptsShared);
    expect(end.players.find((p) => p.id === "p1")!.score).toBe(ptsA * 2 + ptsShared);
    expect(end.players[0]!.id).toBe("p1"); // nach Rang sortiert
    expect(end.possible).toBeGreaterThan(0);
    expect(end.missed.length).toBeGreaterThan(0);
    expect(end.missed).not.toContain(shared[0]);
  });

  it("Combo: schnelle Wörter in Folge steigern den Multiplikator, Pause setzt zurück", () => {
    const h = setup(1);
    toRound(h);
    const ws = wordsOnBoard(h);
    for (let i = 0; i < 3; i++) {
      submit(h, "p1", ws[i]![1]);
      h.advance(1000);
    }
    expect(last(h, "p1").multiplier).toBe(1.5);
    expect(view(h, "p1")).toMatchObject({ streak: 3 });
    h.advance(9000);
    submit(h, "p1", ws[3]![1]);
    expect(last(h, "p1").multiplier).toBe(1);
    expect(view(h, "p1")).toMatchObject({ streak: 1 });
  });
});

describe("Wortgarten – Freischaltungen", () => {
  it("hello im Intro bestimmt die Gartenstufe: Tipps, 5×5, Goldfelder", () => {
    const h = setup(2);
    expect(tv(h)).toMatchObject({ config: { size: 4, tipsPerRound: 0 } });
    h.input("p1", { type: "hello", xp: 260 });
    h.input("p2", { type: "hello", xp: 10 });
    expect(tv(h)).toMatchObject({ phase: "intro", level: { level: 4, xp: 260 }, config: { size: 5, tipsPerRound: 1, gold: true } });
    expect(view(h, "p1")).toMatchObject({ phase: "intro", helloReceived: true });
    // Zweites hello wird ignoriert
    h.input("p1", { type: "hello", xp: 5000 });
    expect(tv(h)).toMatchObject({ level: { level: 4 } });
    toRound(h);
    const s = roundTv(h);
    expect(s.board.size).toBe(5);
    expect(s.board.letters).toHaveLength(25);
    expect(s.board.gold).toHaveLength(2);
  });

  it("Tipp: Startfeld, Länge und Anfang eines echten Worts; begrenzt pro Runde", () => {
    const h = setup(1, {}, null, 11);
    h.input("p1", { type: "hello", xp: 50 });
    toRound(h);
    h.input("p1", { type: "tip" });
    const v = view(h, "p1");
    if (v.phase !== "round") throw new Error();
    expect(v.tipsLeft).toBe(0);
    expect(v.tip).not.toBeNull();
    const tip = v.tip!;
    const match = wordsOnBoard(h).find(([w, p]) => p[0] === tip.start && w.length === tip.length && w.startsWith(tip.prefix));
    expect(match).toBeDefined();
    // Kein weiterer Tipp
    h.input("p1", { type: "tip" });
    expect(view(h, "p1")).toMatchObject({ tipsLeft: 0, tip });
  });

  it("gesperrter Modus fällt auf Klassisch zurück und wird angezeigt", () => {
    const h = setup(1, { mode: "langwort", gridSize: "6" });
    expect(tv(h)).toMatchObject({ config: { mode: "klassisch", size: 4, minLen: 3 }, locked: { mode: "langwort", size: 6 } });
  });

  it("Erfahrung wandert über ctx.previous in die nächste Partie (auch ohne Handy-Speicher)", () => {
    const previous: GameResults = { gameId: "wortgarten", ranking: [], data: { xp: { p1: 130, p2: 3 }, level: 3, players: [] } };
    const h = setup(2, {}, previous);
    expect(tv(h)).toMatchObject({ level: { level: 3, xp: 130 }, config: { size: 5 } });
    // Handy meldet weniger → Maximum zählt
    h.input("p1", { type: "hello", xp: 20 });
    expect(tv(h)).toMatchObject({ level: { xp: 130 } });
  });

  it("Finale meldet neue Freischaltungen", () => {
    const h = setup(1, { rounds: 1, roundSeconds: 60 });
    h.input("p1", { type: "hello", xp: 39 });
    toRound(h);
    const [w] = wordsOnBoard(h);
    submit(h, "p1", w![1]);
    h.advance(60_000 + TIMING.roundEndMs);
    expect(tv(h)).toMatchObject({ phase: "final", levelBefore: 1, level: { level: 2 }, newUnlocks: ["tips"] });
    expect(view(h, "p1")).toMatchObject({ phase: "final", xpBefore: 39, newUnlocks: ["tips"] });
  });
});

describe("Wortgarten – Verbindung", () => {
  it("alle verlassen → sofort Ende", () => {
    const h = setup(2);
    toRound(h);
    h.leave("p1");
    expect(h.results).toBeNull();
    expect(roundTv(h).players.find((p) => p.id === "p1")!.left).toBe(true);
    h.leave("p2");
    expect(h.results).not.toBeNull();
    expect(h.crash).toBeNull();
  });

  it("Settings defensiv parsen", () => {
    expect(parseWgSettings({ mode: "x", gridSize: "9", rounds: 99, roundSeconds: -5 })).toEqual({
      mode: "klassisch",
      gridSize: "auto",
      rounds: 5,
      roundSeconds: 30,
    });
  });
});
