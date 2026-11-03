// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { DRAW_LIMITS, PALETTE, SIZES } from "../src/constants.js";
import { WORDS_BY_CATEGORY } from "../src/data/index.js";
import game from "../src/server/index.js";
import { TIMING, type ZgPlayerView, type ZgResultData, type ZgTvState } from "../src/shared.js";

type H = GameHarness<ZgTvState, ZgPlayerView>;
const SETTINGS: SettingsValues = { categories: ["tiere", "essen", "sport"], drawSeconds: 60, turns: 1 };
const setup = (players = 3, settings: SettingsValues = SETTINGS, seed = 7): H =>
  createTestHarness<ZgTvState, ZgPlayerView>(game, { players, settings, seed });
const tv = (h: H) => h.lastTv()!;
const phaseOf = (h: H) => tv(h).phase;
const drawerOf = (h: H): string => {
  const s = tv(h);
  if (s.phase !== "choose" && s.phase !== "draw" && s.phase !== "reveal") throw new Error(`Phase ${s.phase}`);
  return s.drawer.id;
};
const guessersOf = (h: H) => h.players.map((p) => p.id).filter((id) => id !== drawerOf(h));
/** Intro überspringen, Zeichner wählt Begriff `index`; liefert den Begriff. */
const startDrawing = (h: H, index = 0): string => {
  if (phaseOf(h) === "intro") h.advance(TIMING.introMs);
  expect(phaseOf(h)).toBe("choose");
  h.input(drawerOf(h), { type: "choose", index });
  const v = h.lastView(drawerOf(h))!;
  if (v.phase !== "draw" || v.role !== "draw") throw new Error("Zeichneransicht erwartet");
  return v.word;
};
const drawView = (h: H, id: string) => {
  const v = h.lastView(id)!;
  if (v.phase !== "draw") throw new Error(`Phase ${v.phase}`);
  return v;
};
const stroke = (id: number, points: number[], color = 0, size = 1) => ({ type: "stroke", id, color, size, points });

describe("Ablauf", () => {
  it("Intro → Wortwahl → Zeichnen → Auflösung → Zwischenstand, jede Person zeichnet einmal, dann Finale und Ergebnis", () => {
    const h = setup(3);
    expect(phaseOf(h)).toBe("intro");
    h.advance(TIMING.introMs);
    const drawers: string[] = [];
    for (let i = 0; i < 3; i++) {
      const s = tv(h);
      if (s.phase !== "choose") throw new Error("choose erwartet");
      expect(s.total).toBe(3);
      drawers.push(s.drawer.id);
      const dv = h.lastView(s.drawer.id)!;
      if (dv.phase !== "choose" || dv.role !== "draw") throw new Error("Zeichner wählt");
      expect(dv.options).toHaveLength(3);
      // Drei Kategorien gewählt → drei verschiedene Kategorien.
      expect(new Set(dv.options.map((o) => o.category)).size).toBe(3);
      const gv = h.lastView(guessersOf(h)[0]!)!;
      expect(gv.phase === "choose" && gv.role).toBe("guess");
      const word = startDrawing(h, 1);
      expect(word).toBe(dv.options[1]!.word);
      // Weder TV noch Rater kennen den Begriff.
      expect(JSON.stringify(tv(h))).not.toContain(word);
      expect(JSON.stringify(h.lastView(guessersOf(h)[0]!))).not.toContain(word);
      for (const g of guessersOf(h)) {
        h.advance(1000);
        h.input(g, { type: "guess", text: word });
      }
      const r = tv(h);
      expect(r.phase === "reveal" && r.reason).toBe("all");
      expect(r.phase === "reveal" && r.word).toBe(word);
      h.advance(TIMING.revealMs);
      if (i < 2) {
        expect(phaseOf(h)).toBe("standings");
        h.advance(TIMING.standingsMs);
      }
    }
    expect(new Set(drawers).size).toBe(3);
    expect(phaseOf(h)).toBe("final");
    h.advance(TIMING.finalMs);
    const data = h.results!.data as ZgResultData;
    expect(data.wordIds).toHaveLength(3);
    expect(data.players.every((p) => p.guessed === 2)).toBe(true);
    // Jeder: 2× als Erster/Zweiter geraten + 100 als Zeichner → Summe 100+80+100 je nach Reihenfolge.
    expect(h.results!.ranking.reduce((n, r) => n + r.score, 0)).toBe(3 * (100 + 80 + 100));
  });

  it("ohne Wahl nimmt der Server nach 10 s einen zufälligen Begriff; Zeitablauf löst auf", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    h.advance(TIMING.chooseMs);
    expect(phaseOf(h)).toBe("draw");
    const s = tv(h);
    expect(s.phase === "draw" && s.endsAt - h.clock.now()).toBe(60_000);
    h.advance(60_000);
    const r = tv(h);
    expect(r.phase === "reveal" && r.reason).toBe("time");
    expect(r.players.every((p) => p.score === 0)).toBe(true);
  });

  it("turns = 2: jede Person zeichnet zweimal", () => {
    const h = setup(2, { ...SETTINGS, turns: 2 });
    h.advance(TIMING.introMs);
    expect(tv(h).total).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(phaseOf(h)).toBe("choose");
      h.advance(TIMING.chooseMs + 60_000 + TIMING.revealMs);
      if (phaseOf(h) === "standings") h.advance(TIMING.standingsMs);
    }
    expect(phaseOf(h)).toBe("final");
  });
});

describe("Punkte", () => {
  it("Rater 100/80/70/60/50/50 nach Reihenfolge, Zeichner 50 je Rater, gedeckelt auf 200", () => {
    const h = setup(7);
    const word = startDrawing(h);
    const order = guessersOf(h);
    const drawer = drawerOf(h);
    for (const g of order) h.input(g, { type: "guess", text: word });
    const r = tv(h);
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    const score = (id: string) => r.players.find((p) => p.id === id)!.score;
    expect(order.map(score)).toEqual([100, 80, 70, 60, 50, 50]);
    expect(score(drawer)).toBe(200);
  });

  it("Runde endet erst, wenn alle verbundenen Rater es haben", () => {
    const h = setup(4);
    const word = startDrawing(h);
    const [a, b, c] = guessersOf(h);
    h.input(a!, { type: "guess", text: word });
    h.input(b!, { type: "guess", text: word });
    expect(phaseOf(h)).toBe("draw");
    const s = tv(h);
    expect(s.phase === "draw" && s.players.find((p) => p.id === drawerOf(h))!.roundPoints).toBe(100);
    // c ist getrennt → zählt nicht mehr, Auflösung sofort.
    h.setConnected(c!, false);
    expect(phaseOf(h)).toBe("reveal");
  });
});

describe("Raten", () => {
  it("Treffer erscheint am TV nur als „hat's“, Fehltipps als Sprechblase, „Knapp daneben“ nur privat", () => {
    const h = setup(3, { ...SETTINGS, categories: ["tiere"] }, 3);
    h.advance(TIMING.introMs);
    const dv = h.lastView(drawerOf(h))!;
    if (dv.phase !== "choose" || dv.role !== "draw") throw new Error("Zeichner wählt");
    // Einen Begriff mit mindestens 5 Buchstaben wählen, damit „knapp“ möglich ist.
    const index = dv.options.findIndex((o) => /^[A-Za-z]{5,}$/.test(o.word));
    const word = startDrawing(h, Math.max(0, index));
    const [a, b] = guessersOf(h);
    h.input(a!, { type: "guess", text: "Zahnbürste" });
    let s = tv(h);
    expect(s.phase === "draw" && s.bubbles.map((x) => [x.playerId, x.text, x.correct])).toEqual([[a, "Zahnbürste", false]]);
    if (index >= 0) {
      h.advance(1000);
      const typo = `${word.slice(0, -1)}${word.endsWith("x") ? "y" : "x"}`;
      h.input(a!, { type: "guess", text: typo });
      const av = drawView(h, a!);
      expect(av.role === "guess" && av.guesses[0]).toEqual({ text: typo, close: true });
      s = tv(h);
      expect(s.phase === "draw" && s.bubbles).toHaveLength(1);
    }
    h.advance(1000);
    h.input(b!, { type: "guess", text: `  ${word.toUpperCase()}!  ` });
    s = tv(h);
    if (s.phase !== "draw") throw new Error("draw erwartet");
    expect(s.bubbles.at(-1)).toMatchObject({ playerId: b, text: "", correct: true });
    expect(JSON.stringify(s)).not.toContain(word);
    expect(s.players.find((p) => p.id === b)!.guessed).toBe(true);
    const bv = drawView(h, b!);
    expect(bv.role === "guess" && bv.correct).toBe(true);
  });

  it("Rate-Limit 1/s, max. 40 Zeichen, nach Treffer und als Zeichner kein Tipp", () => {
    const h = setup(3);
    const word = startDrawing(h);
    const [a] = guessersOf(h);
    h.input(a!, { type: "guess", text: "eins" });
    h.advance(500);
    h.input(a!, { type: "guess", text: "zwei" });
    let v = drawView(h, a!);
    expect(v.role === "guess" && v.guesses.map((g) => g.text)).toEqual(["eins"]);
    h.advance(500);
    h.input(a!, { type: "guess", text: "drei" });
    v = drawView(h, a!);
    expect(v.role === "guess" && v.guesses.map((g) => g.text)).toEqual(["drei", "eins"]);
    expect(h.input(a!, { type: "guess", text: "x".repeat(41) }).ok).toBe(false);
    // Zeichner darf nicht raten.
    h.input(drawerOf(h), { type: "guess", text: word });
    expect(tv(h).players.every((p) => !p.guessed)).toBe(true);
    h.advance(1000);
    h.input(a!, { type: "guess", text: word });
    const score = tv(h).players.find((p) => p.id === a)!.score;
    h.advance(1000);
    h.input(a!, { type: "guess", text: word });
    expect(tv(h).players.find((p) => p.id === a)!.score).toBe(score);
  });

  it("Hinweise: nach 50 % und 75 % der Zeit je ein Buchstabe; abschaltbar", () => {
    const hidden = (h: H) => {
      const s = tv(h);
      if (s.phase !== "draw") throw new Error("draw erwartet");
      return s.hint.filter((c) => c === null).length;
    };
    const h = setup(2, { ...SETTINGS, categories: ["berufe"] });
    h.advance(TIMING.introMs);
    const dv = h.lastView(drawerOf(h))!;
    if (dv.phase !== "choose" || dv.role !== "draw") throw new Error("Zeichner wählt");
    const lengths = dv.options.map((o) => o.word.length);
    startDrawing(h, lengths.indexOf(Math.max(...lengths)));
    const start = hidden(h);
    expect(start).toBeGreaterThanOrEqual(5);
    h.advance(29_999);
    expect(hidden(h)).toBe(start);
    h.advance(1);
    expect(hidden(h)).toBe(start - 1);
    const gv = drawView(h, guessersOf(h)[0]!);
    expect(gv.role === "guess" && gv.hint.filter((c) => c === null).length).toBe(start - 1);
    h.advance(15_000);
    expect(hidden(h)).toBe(start - 2);

    const off = setup(2, { ...SETTINGS, categories: ["berufe"], hints: false });
    startDrawing(off);
    const n = hidden(off);
    off.advance(59_000);
    expect(hidden(off)).toBe(n);
  });
});

describe("Zeichnen", () => {
  it("Folge-Chunks hängen an, undo/clear erhöhen rev; nur der Zeichner zeichnet", () => {
    const h = setup(3);
    startDrawing(h);
    const d = drawerOf(h);
    h.input(d, stroke(5, [10, 10, 20, 20]));
    h.input(d, stroke(5, [30, 30]));
    h.input(d, stroke(6, [500, 500], 3, 2));
    h.input(guessersOf(h)[0]!, stroke(7, [1, 1]));
    h.advance(200);
    let s = tv(h);
    if (s.phase !== "draw") throw new Error("draw erwartet");
    expect(s.strokes).toEqual([
      { id: 5, color: 0, size: 1, points: [10, 10, 20, 20, 30, 30] },
      { id: 6, color: 3, size: 2, points: [500, 500] },
    ]);
    expect(s.rev).toBe(0);
    h.input(d, { type: "undo" });
    // Später Chunk des rückgängig gemachten Strichs wird ignoriert.
    h.input(d, stroke(6, [600, 600]));
    h.advance(200);
    s = tv(h);
    expect(s.phase === "draw" && s.strokes.map((x) => x.id)).toEqual([5]);
    expect(s.phase === "draw" && s.rev).toBe(1);
    h.input(d, { type: "clear" });
    h.advance(200);
    s = tv(h);
    expect(s.phase === "draw" && [s.strokes.length, s.rev]).toEqual([0, 2]);
  });

  it("ungültige Zeichnungsdaten werden abgelehnt", () => {
    const h = setup(2);
    startDrawing(h);
    const d = drawerOf(h);
    expect(h.input(d, stroke(1, [1, 2, 3])).ok).toBe(false);
    expect(h.input(d, stroke(1, [1001, 0])).ok).toBe(false);
    expect(h.input(d, stroke(1, [1.5, 0])).ok).toBe(false);
    expect(h.input(d, stroke(1, [1, 1], PALETTE.length)).ok).toBe(false);
    expect(h.input(d, stroke(1, [1, 1], 0, SIZES.length)).ok).toBe(false);
    expect(h.input(d, { type: "fill", id: 2, color: PALETTE.length, x: 1, y: 1 }).ok).toBe(false);
    expect(h.input(d, { type: "fill", id: 2, color: 0, x: 1001, y: 1 }).ok).toBe(false);
    expect(h.input(d, stroke(1, Array.from({ length: (DRAW_LIMITS.chunkPoints + 1) * 2 }, () => 1))).ok).toBe(false);
    expect(h.input(d, stroke(1, Array.from({ length: DRAW_LIMITS.chunkPoints * 2 }, () => 1))).ok).toBe(true);
  });

  it("Füllungen: als Strich mit fill, begrenzt, undo gibt Platz frei; Chunks hängen nie an eine Füllung", () => {
    const h = setup(2);
    startDrawing(h);
    const d = drawerOf(h);
    h.input(d, stroke(1, [10, 10, 20, 20]));
    h.input(d, { type: "fill", id: 2, color: 0, x: 500, y: 500 });
    // Gleiche ID wie die Füllung: wird nicht angehängt (ID schon vergeben).
    h.input(d, stroke(2, [30, 30]));
    h.advance(200);
    let s = tv(h);
    expect(s.phase === "draw" && s.strokes).toEqual([
      { id: 1, color: 0, size: 1, points: [10, 10, 20, 20] },
      { id: 2, color: 0, size: 0, points: [500, 500], fill: true },
    ]);
    for (let i = 0; i < DRAW_LIMITS.fills + 5; i++) h.input(d, { type: "fill", id: 10 + i, color: i % 2, x: 1, y: 1 });
    h.advance(200);
    s = tv(h);
    expect(s.phase === "draw" && s.strokes.filter((x) => x.fill).length).toBe(DRAW_LIMITS.fills);
    h.input(d, { type: "undo" });
    h.input(d, { type: "fill", id: 100, color: 3, x: 1, y: 1 });
    h.advance(200);
    s = tv(h);
    expect(s.phase === "draw" && s.strokes.at(-1)).toMatchObject({ id: 100, fill: true });
  });

  it("TV-Zustand gedrosselt (≤ 1 je 120 ms), der letzte Stand kommt an", () => {
    const h = setup(2);
    startDrawing(h);
    const d = drawerOf(h);
    const before = h.tvStates.length;
    for (let i = 0; i < 20; i++) {
      h.input(d, stroke(1, [i, i]));
      h.advance(10);
    }
    // 200 ms mit 20 Chunks → höchstens 2 Zustände bisher.
    expect(h.tvStates.length - before).toBeLessThanOrEqual(2);
    h.advance(200);
    const sent = h.tvStates.length - before;
    expect(sent).toBeLessThanOrEqual(3);
    const s = tv(h);
    expect(s.phase === "draw" && s.strokes[0]!.points.length).toBe(40);
    // Ohne neue Daten kommt nichts mehr.
    h.advance(1000);
    expect(h.tvStates.length - before).toBe(sent);
  });

  it("Füllungen zählen gegen das Punktelimit", () => {
    const h = setup(2);
    startDrawing(h);
    const d = drawerOf(h);
    const chunk = Array.from({ length: DRAW_LIMITS.chunkPoints * 2 }, (_, i) => i % 1000);
    const chunks = DRAW_LIMITS.drawingPoints / DRAW_LIMITS.chunkPoints;
    for (let i = 0; i < chunks - 1; i++) h.input(d, stroke(i, chunk));
    h.input(d, stroke(500, chunk.slice(0, (DRAW_LIMITS.chunkPoints - DRAW_LIMITS.fillCost + 1) * 2)));
    h.input(d, { type: "fill", id: 600, color: 2, x: 1, y: 1 });
    h.advance(200);
    const s = tv(h);
    expect(s.phase === "draw" && s.strokes.some((x) => x.fill)).toBe(false);
  });

  it("über 6000 Punkte je Zeichnung werden Striche ignoriert; undo schafft Platz", () => {
    const h = setup(2);
    startDrawing(h);
    const d = drawerOf(h);
    const chunk = Array.from({ length: DRAW_LIMITS.chunkPoints * 2 }, (_, i) => i % 1000);
    const chunks = DRAW_LIMITS.drawingPoints / DRAW_LIMITS.chunkPoints;
    for (let i = 0; i < chunks + 3; i++) h.input(d, stroke(i, chunk));
    h.advance(200);
    const count = () => {
      const s = tv(h);
      return s.phase === "draw" ? s.strokes.reduce((n, x) => n + x.points.length / 2, 0) : -1;
    };
    expect(count()).toBe(DRAW_LIMITS.drawingPoints);
    h.input(d, { type: "undo" });
    h.input(d, stroke(100, [1, 1, 2, 2]));
    h.advance(200);
    expect(count()).toBe(DRAW_LIMITS.drawingPoints - DRAW_LIMITS.chunkPoints + 2);
  });

  it("Reconnect: Zeichner bekommt seine Striche zurück; die Sicherung im Cache läuft gedrosselt mit", () => {
    const h = setup(3);
    startDrawing(h);
    const d = drawerOf(h);
    h.input(d, stroke(3, [1, 2, 3, 4]));
    h.advance(TIMING.drawerBackupMs);
    let v = drawView(h, d);
    expect(v.role === "draw" && v.strokes).toHaveLength(1);
    h.input(d, stroke(4, [9, 9]));
    h.setConnected(d, false);
    h.setConnected(d, true);
    v = drawView(h, d);
    if (v.role !== "draw") throw new Error("Zeichner erwartet");
    expect(v.strokes.map((s) => s.id)).toEqual([3, 4]);
    expect(v.nextStrokeId).toBe(5);
    // Rater bekommen beim Reconnect ihre Ansicht inkl. eigener Tipps.
    const g = guessersOf(h)[0]!;
    h.input(g, { type: "guess", text: "Quatsch" });
    h.setConnected(g, false);
    h.setConnected(g, true);
    const gv = drawView(h, g);
    expect(gv.role === "guess" && gv.guesses.map((x) => x.text)).toEqual(["Quatsch"]);
  });
});

describe("Abgänge und Überspringen", () => {
  it("geht der Zeichner beim Zeichnen, wird sofort ohne Wertung aufgelöst", () => {
    const h = setup(3);
    startDrawing(h);
    const d = drawerOf(h);
    h.leave(d);
    const r = tv(h);
    expect(r.phase === "reveal" && r.reason).toBe("left");
    expect(r.players.every((p) => p.score === 0)).toBe(true);
  });

  it("geht der Zeichner bei der Wortwahl, ist gleich der Nächste dran; < 2 Spieler → Finale", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const first = drawerOf(h);
    h.leave(first);
    expect(phaseOf(h)).toBe("choose");
    expect(drawerOf(h)).not.toBe(first);
    expect(tv(h).round).toBe(0);
    expect(tv(h).total).toBe(2);
    h.leave(guessersOf(h).find((id) => id !== first)!);
    expect(phaseOf(h)).toBe("final");
    h.advance(TIMING.finalMs);
    expect(h.results).not.toBeNull();
  });

  it("Auflösung, Zwischenstand und Finale sind überspringbar; Intro (seen-Meldungen), Wortwahl und Zeichenzeit nicht", () => {
    const h = setup(2);
    expect(h.skip()).toBe(false);
    expect(phaseOf(h)).toBe("intro");
    h.advance(TIMING.introMs);
    expect(phaseOf(h)).toBe("choose");
    expect(h.skip()).toBe(false);
    h.input(drawerOf(h), { type: "choose", index: 0 });
    expect(h.skip()).toBe(false);
    expect(phaseOf(h)).toBe("draw");
    h.advance(60_000);
    expect(phaseOf(h)).toBe("reveal");
    expect(h.skip()).toBe(true);
    expect(phaseOf(h)).toBe("standings");
    expect(h.skip()).toBe(true);
    expect(phaseOf(h)).toBe("choose");
    h.advance(TIMING.chooseMs + 60_000);
    expect(phaseOf(h)).toBe("reveal");
    expect(h.skip()).toBe(true);
    expect(phaseOf(h)).toBe("final");
    expect(h.skip()).toBe(true);
    expect(h.results).not.toBeNull();
  });
});

describe("Begriffsauswahl", () => {
  it("Schwierigkeit filtert die Vorschläge", () => {
    for (const [difficulty, allowed] of [
      ["leicht", [1]],
      ["schwer", [2, 3]],
    ] as const) {
      const h = setup(2, { ...SETTINGS, difficulty });
      h.advance(TIMING.introMs);
      const v = h.lastView(drawerOf(h))!;
      if (v.phase !== "choose" || v.role !== "draw") throw new Error("Zeichner wählt");
      const all = Object.values(WORDS_BY_CATEGORY).flat();
      for (const o of v.options) expect(allowed).toContain(all.find((w) => w.word === o.word)!.difficulty);
    }
  });

  it("vermeidet Begriffe aus der Vorrunde und solche, die ein Handy schon kennt", () => {
    const easy = WORDS_BY_CATEGORY.tiere.filter((w) => w.difficulty === 1);
    const fresh = easy.slice(-6);
    const previous = easy.slice(0, -6);
    const half = Math.floor(previous.length / 2);
    const known = { tie: previous.slice(0, half).map((w) => Number(w.id.split("-")[1])) };
    const h = createTestHarness<ZgTvState, ZgPlayerView>(game, {
      players: 2,
      settings: { categories: ["tiere"], difficulty: "leicht", drawSeconds: 60, turns: 1 },
      seed: 5,
      previous: { gameId: "zeichnen", ranking: [], data: { wordIds: previous.slice(half).map((w) => w.id) } },
    });
    h.input("p1", { type: "seen", ids: known });
    h.input("p2", { type: "seen", ids: known });
    for (let turn = 0; turn < 2; turn++) {
      if (phaseOf(h) !== "choose") h.advance(TIMING.introMs);
      const v = h.lastView(drawerOf(h))!;
      if (v.phase !== "choose" || v.role !== "draw") throw new Error("Zeichner wählt");
      for (const o of v.options) expect(fresh.map((w) => w.word)).toContain(o.word);
      h.input(drawerOf(h), { type: "choose", index: 0 });
      h.advance(60_000 + TIMING.revealMs);
      if (phaseOf(h) === "standings") h.advance(TIMING.standingsMs);
    }
  });
});
