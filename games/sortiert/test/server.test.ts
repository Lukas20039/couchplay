// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { ALL_SETS, SETS_BY_CATEGORY } from "../src/data/index.js";
import { solutionOf } from "../src/scoring.js";
import game from "../src/server/index.js";
import { TIMING, revealDurationMs, type SoPlayerView, type SoResultData, type SoTvState } from "../src/shared.js";

type H = GameHarness<SoTvState, SoPlayerView>;
const SETTINGS: SettingsValues = { categories: ["geld", "groesse"], rounds: 5, itemsPerRound: 4, answerSeconds: 20 };
const ANSWER_MS = 20_000;
const setup = (players = 3, settings: SettingsValues = SETTINGS, seed = 7): H =>
  createTestHarness<SoTvState, SoPlayerView>(game, { players, settings, seed });
const tv = (h: H) => h.lastTv()!;
const phase = (h: H) => tv(h).phase;
const sortTv = (h: H) => {
  const s = tv(h);
  if (s.phase !== "sort") throw new Error(`Phase ${s.phase}`);
  return s;
};
const revealTv = (h: H) => {
  const s = tv(h);
  if (s.phase !== "reveal") throw new Error(`Phase ${s.phase}`);
  return s;
};
const sortView = (h: H, id = "p1") => {
  const v = h.lastView(id)!;
  if (v.phase !== "sort") throw new Error(`Phase ${v.phase}`);
  return v;
};
/** Set der laufenden Runde und richtige Reihenfolge (nur Tests kennen sie vorab). */
const current = (h: H, id = "p1") => {
  const v = sortView(h, id);
  const set = ALL_SETS.find((s) => s.id === v.setId)!;
  const values = v.cards.map((c) => set.items.find((i) => i.label === c.label)!.value);
  return { set, values, solution: solutionOf(values, set.unit) };
};
const send = (h: H, id: string, order: number[], final = true) => h.input(id, { type: "order", order, final });
/** Lösung mit vertauschten Plätzen a und b. */
const swap = (order: number[], a: number, b: number): number[] => {
  const o = [...order];
  [o[a], o[b]] = [o[b]!, o[a]!];
  return o;
};
/** Nach der Auflösung zur nächsten Runde (oder ins Finale). */
const next = (h: H) => {
  const s = revealTv(h);
  h.advance(revealDurationMs(s.items.length));
  if (phase(h) === "standings") h.advance(TIMING.standingsMs);
};
const score = (h: H, id: string) => tv(h).players.find((p) => p.id === id)!.score;
const result = (h: H, id: string) => revealTv(h).results.find((r) => r.playerId === id)!;

describe("Ablauf", () => {
  it("Intro → Sortieren → Auflösung → Zwischenstand … → Finale → Ergebnis mit Set-IDs", () => {
    const h = setup(2);
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    for (let i = 0; i < 5; i++) {
      const s = sortTv(h);
      expect(s.round).toBe(i);
      expect(s.total).toBe(5);
      expect(s.cards).toHaveLength(4);
      h.advance(ANSWER_MS);
      const r = revealTv(h);
      expect(r.results.every((x) => x.points === 0 && x.marks.every((m) => m === "none"))).toBe(true);
      h.advance(revealDurationMs(4));
      expect(phase(h)).toBe(i < 4 ? "standings" : "final");
      if (i < 4) h.advance(TIMING.standingsMs);
    }
    h.advance(TIMING.finalMs);
    const data = h.results!.data as SoResultData;
    expect(data.setIds).toHaveLength(5);
    expect(new Set(data.setIds).size).toBe(5);
    expect(h.results!.ranking).toHaveLength(2);
  });

  it("zieht itemsPerRound verschiedene Karten aus dem Set, gemischt (nie schon richtig sortiert)", () => {
    for (const k of [4, 5, 6]) {
      for (let seed = 1; seed <= 15; seed++) {
        const h = setup(1, { ...SETTINGS, itemsPerRound: k }, seed);
        h.advance(TIMING.introMs);
        const v = sortView(h);
        const { set, solution } = current(h);
        expect(v.cards).toHaveLength(k);
        expect(new Set(v.cards.map((c) => c.label)).size).toBe(k);
        for (const c of v.cards) expect(set.items.some((i) => i.label === c.label)).toBe(true);
        expect(solution).not.toEqual([...Array(k).keys()]);
      }
    }
  });

  it("Runden höchstens so viele wie verfügbare Sets", () => {
    const h = setup(1, { categories: ["tempo"], rounds: 15, itemsPerRound: 4, answerSeconds: 20 });
    expect(tv(h).total).toBe(Math.min(15, SETS_BY_CATEGORY.tempo.length));
  });
});

describe("Wertung und Sortierrichtung", () => {
  it("Jahre: oben = am ältesten (aufsteigend)", () => {
    const h = setup(1, { ...SETTINGS, categories: ["zeit"], itemsPerRound: 6 });
    h.advance(TIMING.introMs);
    const { set, values, solution } = current(h);
    expect(set.unit).toBe("Jahr");
    const sorted = solution.map((i) => values[i]!);
    expect(sorted).toEqual([...sorted].sort((a, b) => a - b));
    send(h, "p1", solution);
    const r = revealTv(h);
    expect(r.items.map((x) => x.value)).toEqual(sorted);
    expect(r.top).toBe(set.top);
  });

  it("Werte: oben = größter Wert (absteigend)", () => {
    const h = setup(1, { ...SETTINGS, categories: ["verkauf"], itemsPerRound: 6 });
    h.advance(TIMING.introMs);
    const { values, solution } = current(h);
    const sorted = solution.map((i) => values[i]!);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
    send(h, "p1", solution);
    expect(revealTv(h).items.map((x) => x.value)).toEqual(sorted);
  });

  it("richtig +100 je Karte, eine daneben +50, perfekt +200 Bonus, ohne Abgabe 0", () => {
    const h = setup(4, { ...SETTINGS, itemsPerRound: 5 });
    h.advance(TIMING.introMs);
    const { solution } = current(h);
    send(h, "p1", solution); // perfekt: 5×100 + 200
    send(h, "p2", swap(solution, 0, 1)); // 2× eins daneben, 3× richtig
    send(h, "p3", [...solution].reverse()); // Mitte richtig, Rest weit weg
    h.advance(ANSWER_MS); // p4 tut nichts
    expect(result(h, "p1")).toMatchObject({ points: 700, perfect: true, submitted: true, marks: Array(5).fill("exact") });
    expect(result(h, "p2")).toMatchObject({ points: 400, perfect: false, marks: ["near", "near", "exact", "exact", "exact"] });
    expect(result(h, "p3")).toMatchObject({ points: 100, marks: ["miss", "miss", "exact", "miss", "miss"] });
    expect(result(h, "p4")).toMatchObject({ points: 0, submitted: false, marks: Array(5).fill("none") });
    expect(score(h, "p1")).toBe(700);
    const r = revealTv(h);
    expect(r.correctBy[0]).toEqual(["p1"]);
    expect(r.correctBy[2]).toEqual(["p1", "p2", "p3"]);
    expect(tv(h).players[0]).toMatchObject({ id: "p1", rank: 1, perfects: 1, roundPoints: 700 });
    const v = h.lastView("p2")!;
    if (v.phase !== "reveal") throw new Error("reveal erwartet");
    expect(v.points).toBe(400);
    expect(v.mine.map((m) => m.mark)).toEqual(["near", "near", "exact", "exact", "exact"]);
    expect(v.mine[0]!.label).toBe(v.items[1]!.label);
  });

  it("Teilabgabe bei Zeitablauf: der letzte Zwischenstand zählt, ohne Perfekt-Bonus bei Lücken", () => {
    const h = setup(3, { ...SETTINGS, itemsPerRound: 6 });
    h.advance(TIMING.introMs);
    const { solution } = current(h);
    expect(send(h, "p1", solution.slice(0, 3), false).ok).toBe(true);
    expect(send(h, "p2", [solution[1]!, solution[0]!], false).ok).toBe(true);
    // Zwischenstand später verbessert: nur der letzte zählt.
    send(h, "p2", [solution[0]!, solution[1]!, solution[3]!], false);
    // Fünf von sechs gelegt: die letzte Karte steht fest und wird ergänzt → komplett richtig = perfekt.
    send(h, "p3", solution.slice(0, 5), false);
    expect(phase(h)).toBe("sort");
    h.advance(ANSWER_MS);
    expect(result(h, "p1")).toMatchObject({ points: 300, perfect: false, submitted: false, marks: ["exact", "exact", "exact", "none", "none", "none"] });
    expect(result(h, "p2")).toMatchObject({ points: 250, marks: ["exact", "exact", "near", "none", "none", "none"] });
    expect(result(h, "p3")).toMatchObject({ points: 800, perfect: true, submitted: false });
  });

  it("Abgabe nur vollständig; danach fix. Ungültige Reihenfolgen werden abgelehnt", () => {
    const h = setup(2, { ...SETTINGS, itemsPerRound: 4 });
    h.advance(TIMING.introMs);
    const { solution } = current(h);
    expect(send(h, "p1", solution.slice(0, 3), true).ok).toBe(true); // unvollständig → ignoriert
    expect(sortTv(h).done).toEqual([]);
    expect(send(h, "p1", [0, 0, 1, 2]).ok).toBe(false); // doppelt
    expect(send(h, "p1", [0, 1, 2, 7]).ok).toBe(false); // > ITEMS_MAX
    expect(send(h, "p1", [0, 1.5]).ok).toBe(false);
    expect(h.input("p1", { type: "order", order: [0, 1, 2, 3, 4, 5, 0] , final: false }).ok).toBe(false);
    expect(send(h, "p1", [0, 1, 2, 5], false).ok).toBe(true); // Schema ok, aber Karte 5 gibt es nicht → ignoriert
    expect(sortView(h).order).toEqual([]);
    expect(send(h, "p1", swap(solution, 0, 3)).ok).toBe(true);
    expect(sortTv(h).done).toEqual(["p1"]);
    send(h, "p1", solution); // nach „Fertig“ fix
    send(h, "p1", solution, false);
    expect(sortView(h).order).toEqual(swap(solution, 0, 3));
    expect(sortView(h).submitted).toBe(true);
  });
});

describe("Vorzeitiges Ende, Abgang, Reconnect", () => {
  it("löst auf, sobald alle verbundenen Spieler fertig sind – getrennte zählen nicht", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    send(h, "p1", [0, 1, 2, 3]);
    h.setConnected("p3", false);
    expect(phase(h)).toBe("sort");
    send(h, "p2", [3, 2, 1, 0]);
    expect(phase(h)).toBe("reveal");
  });

  it("Zwischenstände beenden die Runde nicht vorzeitig; sind alle getrennt, läuft die Zeit ab", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    send(h, "p1", [0, 1, 2, 3], false);
    send(h, "p2", [0, 1, 2, 3], false);
    expect(phase(h)).toBe("sort");
    h.setConnected("p1", false);
    h.setConnected("p2", false);
    expect(phase(h)).toBe("sort");
    h.advance(ANSWER_MS);
    expect(phase(h)).toBe("reveal");
  });

  it("Reconnect: Spieler bekommt seinen Zwischenstand bzw. seine Abgabe zurück", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    send(h, "p1", [2, 0], false);
    // Die gecachte Ansicht ist schon aktuell (wichtig fürs Neuladen) …
    expect(sortView(h, "p1").order).toEqual([2, 0]);
    h.setConnected("p1", false);
    const before = h.views.get("p1")!.length;
    h.setConnected("p1", true);
    // … und nach dem Reconnect kommt sie noch einmal.
    expect(h.views.get("p1")!.length).toBe(before + 1);
    expect(sortView(h, "p1")).toMatchObject({ order: [2, 0], submitted: false });
    send(h, "p2", [1, 0, 3, 2]);
    h.setConnected("p2", false);
    h.setConnected("p2", true);
    expect(sortView(h, "p2")).toMatchObject({ order: [1, 0, 3, 2], submitted: true });
  });

  it("Abgang: die übrigen spielen weiter; gehen alle, kommt das Finale", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    send(h, "p1", [0, 1, 2, 3]);
    send(h, "p2", [0, 1, 2, 3]);
    h.leave("p3");
    expect(phase(h)).toBe("reveal");
    expect(revealTv(h).results.map((r) => r.playerId)).toEqual(["p1", "p2"]);
    expect(tv(h).players.find((p) => p.id === "p3")!.left).toBe(true);
    next(h);
    h.leave("p1");
    expect(phase(h)).toBe("sort");
    h.leave("p2");
    expect(phase(h)).toBe("final");
    h.advance(TIMING.finalMs);
    expect(h.results).not.toBeNull();
  });
});

describe("Privatsphäre", () => {
  it("vor der Auflösung kennen TV und Handys weder Werte noch fremde Reihenfolgen", () => {
    const h = setup(3, { ...SETTINGS, itemsPerRound: 6 });
    h.advance(TIMING.introMs);
    const { set } = current(h);
    send(h, "p1", [5, 4, 3, 2, 1, 0], false);
    send(h, "p2", [3, 1, 4, 0, 5, 2]);
    const states = [...h.tvStates.filter((s) => s.phase === "sort"), ...h.players.flatMap((p) => h.views.get(p.id)!.filter((v) => v.phase === "sort"))];
    for (const s of states) {
      const json = JSON.stringify(s);
      expect(json).not.toContain('"value"');
      expect(json).not.toContain('"note"');
      expect(json).not.toContain('"unit"');
      for (const item of set.items) if (item.note) expect(json).not.toContain(item.note);
    }
    // TV: nur wer fertig ist, keine Reihenfolge.
    for (const s of h.tvStates) expect(JSON.stringify(s)).not.toContain('"order"');
    expect(sortTv(h).done).toEqual(["p2"]);
    // Handys: nur die eigene Reihenfolge.
    expect(sortView(h, "p1").order).toEqual([5, 4, 3, 2, 1, 0]);
    expect(sortView(h, "p3").order).toEqual([]);
    expect(JSON.stringify(h.views.get("p3"))).not.toContain("[3,1,4,0,5,2]");
    expect(JSON.stringify(h.views.get("p3"))).not.toContain("[5,4,3,2,1,0]");
  });
});

describe("Überspringbare Wartezeiten", () => {
  it("Auflösung, Zwischenstand und Finale – nie Intro oder Sortierzeit", () => {
    const h = setup(2);
    expect(h.skip()).toBe(false); // Intro: Handys melden gerade ihre gespielten Sets
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    expect(phase(h)).toBe("sort");
    expect(h.skip()).toBe(false);
    send(h, "p1", [0, 1, 2, 3]);
    send(h, "p2", [0, 1, 2, 3]);
    expect(phase(h)).toBe("reveal");
    expect(h.skip()).toBe(true); // die ganze Auflösung, auch mitten im Aufbau
    expect(phase(h)).toBe("standings");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("sort");
    for (let i = 1; i < 5; i++) {
      expect(h.skip()).toBe(false);
      h.advance(ANSWER_MS);
      expect(h.skip()).toBe(true);
      if (phase(h) === "standings") expect(h.skip()).toBe(true);
    }
    expect(phase(h)).toBe("final");
    expect(h.skip()).toBe(true);
    expect(h.results).not.toBeNull();
    expect(h.session.skipId).toBeNull();
  });
});

describe("Gedächtnis", () => {
  it("bevorzugt Sets, die keiner der Teilnehmer schon hatte", () => {
    const all = SETS_BY_CATEGORY.zeit.map((s) => s.id);
    const fresh = all.at(-1)!;
    const known = { zei: all.slice(0, -1).map((id) => Number(id.split("-")[1])) };
    for (let seed = 1; seed <= 5; seed++) {
      const h = setup(2, { ...SETTINGS, categories: ["zeit"] }, seed);
      h.input("p2", { type: "seen", ids: known });
      h.advance(TIMING.introMs);
      expect(sortView(h).setId).toBe(fresh);
    }
  });

  it("meidet Sets der Vorrunde (ctx.previous)", () => {
    const all = SETS_BY_CATEGORY.geld.map((s) => s.id);
    const previous = { gameId: "sortiert", ranking: [], data: { setIds: all.slice(0, -1), total: 0, players: [] } };
    for (let seed = 1; seed <= 5; seed++) {
      const h = createTestHarness<SoTvState, SoPlayerView>(game, { players: 1, settings: { ...SETTINGS, categories: ["geld"] }, previous, seed });
      h.advance(TIMING.introMs);
      expect(sortView(h).setId).toBe(all.at(-1));
    }
  });
});
