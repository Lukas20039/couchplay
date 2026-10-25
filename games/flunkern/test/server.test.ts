// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { MIN_CHOICES } from "../src/constants.js";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY, type Bluff } from "../src/data/index.js";
import { normalizeAnswer } from "../src/normalize.js";
import game, { revealDurationMs } from "../src/server/index.js";
import { TIMING, type FlPlayerView, type FlResultData, type FlTvState } from "../src/shared.js";

type H = GameHarness<FlTvState, FlPlayerView>;
const SETTINGS: SettingsValues = { rounds: 3, writeSeconds: 60, chooseSeconds: 20 };
const WRITE_MS = 60_000;
const CHOOSE_MS = 20_000;
/** Lügen, die mit keiner Wahrheit im Katalog verwechselt werden können. */
const L = ["Quietscheentchen-Pflicht", "Gartenzwerg-Steuer", "Blockflötenverbot", "Socken aus Käse", "Tanzende Kühe", "Mondscheintarif", "Goldene Zahnbürste", "Pudelmütze"];

const setup = (players = 3, settings: SettingsValues = SETTINGS, seed = 7): H =>
  createTestHarness<FlTvState, FlPlayerView>(game, { players, settings, seed });
const tv = (h: H) => h.lastTv()!;
const phase = (h: H) => tv(h).phase;
const view = (h: H, id: string) => h.lastView(id)!;
const as = <P extends FlTvState["phase"]>(h: H, p: P) => {
  const s = tv(h);
  if (s.phase !== p) throw new Error(`Phase ${s.phase} statt ${p}`);
  return s as Extract<FlTvState, { phase: P }>;
};
const viewAs = <P extends FlPlayerView["phase"]>(h: H, id: string, p: P) => {
  const v = view(h, id);
  if (v.phase !== p) throw new Error(`Phase ${v.phase} statt ${p}`);
  return v as Extract<FlPlayerView, { phase: P }>;
};
/** Aktuelle Frage (nur Tests kennen die Wahrheit vorab). */
const current = (h: H): Bluff => {
  const id = h.players.map((p) => h.lastView(p.id)).find((v) => v?.phase === "write");
  if (!id || id.phase !== "write") throw new Error("keine Schreibphase");
  return ALL_QUESTIONS.find((q) => q.id === id.questionId)!;
};
const lie = (h: H, id: string, text: string) => h.input(id, { type: "lie", text });
const choose = (h: H, id: string, index: number) => h.input(id, { type: "choose", index });
const optionIndex = (h: H, text: string) => as(h, "choose").options.indexOf(text);
const truthIndex = (h: H, q: Bluff) => optionIndex(h, q.answer);
const score = (h: H, id: string) => tv(h).players.find((p) => p.id === id)!.score;
/** Alle aktiven Spieler schreiben verschiedene Lügen. */
const writeAll = (h: H) => h.players.forEach((p, i) => lie(h, p.id, L[i]!));
/** Alle Strings eines JSON-Werts (für Privatsphäre-Prüfungen). */
const strings = (x: unknown): string[] =>
  typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];
const mentions = (x: unknown, text: string) => strings(x).some((s) => normalizeAnswer(s) === normalizeAnswer(text));

describe("Ablauf", () => {
  it("Intro → Schreiben → Wählen → Auflösung → Zwischenstand … → Finale → Ergebnis mit Fragen-IDs", () => {
    const h = setup(3);
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    for (let r = 0; r < 3; r++) {
      const w = as(h, "write");
      expect([w.round, w.total, w.double]).toEqual([r, 3, r === 2]);
      expect(viewAs(h, "p1", "write").double).toBe(r === 2);
      h.advance(WRITE_MS);
      expect(phase(h)).toBe("choose");
      h.advance(CHOOSE_MS);
      const rv = as(h, "reveal");
      // Niemand gewählt → nur die Wahrheit.
      expect(rv.stepCount).toBe(1);
      expect(rv.steps[0]!.kind).toBe("truth");
      h.advance(revealDurationMs(1));
      expect(phase(h)).toBe(r < 2 ? "standings" : "final");
      if (r < 2) {
        expect(as(h, "standings").nextDouble).toBe(r === 1);
        h.advance(TIMING.standingsMs);
      }
    }
    expect(as(h, "final").awards).toEqual([]);
    h.advance(TIMING.finalMs);
    const data = h.results!.data as FlResultData;
    expect(data.questionIds).toHaveLength(3);
    expect(new Set(data.questionIds).size).toBe(3);
    expect(h.results!.ranking).toHaveLength(3);
  });

  it("Settings werden geklemmt und Kategorien gefiltert", () => {
    const h = setup(2, { categories: ["tiere"], rounds: 3, writeSeconds: 30, chooseSeconds: 15 });
    h.advance(TIMING.introMs);
    expect(as(h, "write").category).toBe("tiere");
    expect(as(h, "write").durationMs).toBe(30_000);
  });
});

describe("Lügen schreiben", () => {
  it("lehnt die Wahrheit ab (normalisiert, auch Alternativen) – über eigenen Status, ohne Punkte", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const q = current(h);
    const variant = `Der ${q.answer.toUpperCase()}!`;
    expect(lie(h, "p1", variant).ok).toBe(true);
    let v = viewAs(h, "p1", "write");
    expect([v.lie, v.rejected]).toEqual([null, true]);
    expect(as(h, "write").done).toEqual([]);
    // Nur der Absender erfährt es.
    expect(viewAs(h, "p2", "write").rejected).toBe(false);
    for (const alt of q.alternatives) {
      lie(h, "p1", alt);
      expect(viewAs(h, "p1", "write").lie).toBeNull();
    }
    expect(lie(h, "p1", L[0]!).ok).toBe(true);
    v = viewAs(h, "p1", "write");
    expect([v.lie, v.rejected]).toEqual([L[0], false]);
    expect(as(h, "write").done).toEqual(["p1"]);
  });

  it("Lüge ist nach dem Abschicken fix; ungültige Eingaben → INVALID_INPUT", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    expect(lie(h, "p1", "").ok).toBe(false);
    expect(lie(h, "p1", "   ").ok).toBe(false);
    expect(lie(h, "p1", "?!").ok).toBe(false);
    expect(lie(h, "p1", "x".repeat(41)).ok).toBe(false);
    expect(lie(h, "p1", `  ${"y".repeat(40)}  `).ok).toBe(true);
    expect(viewAs(h, "p1", "write").lie).toBe("y".repeat(40));
    lie(h, "p1", "Etwas anderes");
    expect(viewAs(h, "p1", "write").lie).toBe("y".repeat(40));
    expect(choose(h, "p1", 0).ok).toBe(true); // falsche Phase → ignoriert
    expect(phase(h)).toBe("write");
  });

  it("legt gleiche Lügen zusammen: beide sind Autoren und bekommen die Punkte", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    lie(h, "p1", "Gartenzwerg-Steuer");
    lie(h, "p2", "die gartenzwerg steuer!");
    // Der zweite Autor sieht seinen eigenen Text, nicht den des anderen.
    expect(viewAs(h, "p2", "write").lie).toBe("die gartenzwerg steuer!");
    lie(h, "p3", L[2]!);
    const c = as(h, "choose");
    expect(c.options.filter((o) => normalizeAnswer(o) === normalizeAnswer("Gartenzwerg-Steuer"))).toEqual(["Gartenzwerg-Steuer"]);
    const shared = optionIndex(h, "Gartenzwerg-Steuer");
    expect(viewAs(h, "p1", "choose").own).toBe(shared);
    expect(viewAs(h, "p2", "choose").own).toBe(shared);
    choose(h, "p3", shared);
    choose(h, "p1", optionIndex(h, L[2]!));
    choose(h, "p2", optionIndex(h, L[2]!));
    const rv = as(h, "reveal");
    expect(rv.steps[0]).toMatchObject({ kind: "lie", option: shared, fooled: ["p3"], authors: ["p1", "p2"], points: 250 });
    h.skip();
    expect([score(h, "p1"), score(h, "p2"), score(h, "p3")]).toEqual([250, 250, 500]);
  });

  it("wer nichts abschickt, bekommt eine Hauslüge zugeteilt (zählt als seine Lüge)", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const q = current(h);
    lie(h, "p1", L[0]!);
    lie(h, "p2", L[1]!);
    h.advance(WRITE_MS);
    const v3 = viewAs(h, "p3", "choose");
    expect(v3.own).not.toBeNull();
    expect(v3.auto).toBe(true);
    const autoText = v3.options[v3.own!]!;
    expect(q.lies).toContain(autoText);
    expect(viewAs(h, "p1", "choose").auto).toBe(false);
    choose(h, "p1", v3.own!);
    choose(h, "p2", v3.own!);
    choose(h, "p3", optionIndex(h, L[0]!));
    h.advance(TIMING.revealLieMs); // erst L0 (1 Reingefallener), dann die zugeteilte Lüge (2)
    const rv = as(h, "reveal");
    expect(rv.steps.find((s) => s.kind === "lie" && s.option === v3.own)).toMatchObject({ authors: ["p3"], auto: true, points: 500 });
  });

  it("reichen die Hauslügen nicht für alle Untätigen, bleiben die übrigen ohne Lüge", () => {
    const h = setup(8);
    h.advance(TIMING.introMs);
    const q = current(h);
    h.advance(WRITE_MS);
    const c = as(h, "choose");
    const withLie = h.players.filter((p) => viewAs(h, p.id, "choose").own !== null);
    expect(withLie).toHaveLength(Math.min(8, q.lies.length));
    expect(c.options).toHaveLength(1 + withLie.length);
    expect(new Set(c.options).size).toBe(c.options.length);
  });

  it("endet vorzeitig, wenn alle verbundenen Spieler fertig sind", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    lie(h, "p1", L[0]!);
    h.setConnected("p3", false);
    expect(phase(h)).toBe("write");
    lie(h, "p2", L[1]!);
    expect(phase(h)).toBe("choose");
    // Der getrennte p3 bekommt trotzdem eine Hauslüge.
    expect(viewAs(h, "p3", "choose").own).not.toBeNull();
  });

  it("sind alle getrennt, läuft die Schreibzeit normal ab", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    h.setConnected("p1", false);
    h.setConnected("p2", false);
    h.advance(WRITE_MS - 1);
    expect(phase(h)).toBe("write");
    h.advance(1);
    expect(phase(h)).toBe("choose");
  });
});

describe("Antworten zur Wahl", () => {
  it("füllt mit Hauslügen auf mindestens 4 auf (2 Spieler)", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    const q = current(h);
    writeAll(h);
    const c = as(h, "choose");
    expect(c.options).toHaveLength(MIN_CHOICES);
    expect(c.options).toContain(q.answer);
    expect(c.options).toContain(L[0]);
    expect(c.options).toContain(L[1]);
    expect(c.options.filter((o) => q.lies.includes(o))).toHaveLength(1);
  });

  it("Hauslügen kollidieren nicht mit Spielerlügen (normalisiert)", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    const q = current(h);
    // Beide Spieler schreiben (leicht abgewandelt) Hauslügen aus den Daten.
    lie(h, "p1", `${q.lies[0]!.toLowerCase()}!`);
    lie(h, "p2", q.lies[1]!);
    const keys = as(h, "choose").options.map(normalizeAnswer);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(MIN_CHOICES);
  });

  it("keine Hauslügen, wenn genug Spielerlügen da sind; 8 Spieler → 9 Antworten", () => {
    const h3 = setup(3);
    h3.advance(TIMING.introMs);
    writeAll(h3);
    expect(as(h3, "choose").options).toHaveLength(4);
    const h8 = setup(8);
    h8.advance(TIMING.introMs);
    writeAll(h8);
    const c = as(h8, "choose");
    expect(c.options).toHaveLength(9);
    for (const p of h8.players) expect(viewAs(h8, p.id, "choose").options).toEqual(c.options);
  });

  it("mischt mit ctx.rng: anderer Seed → andere Reihenfolge möglich, gleicher Seed → gleich", () => {
    const run = (seed: number) => {
      const h = setup(3, { categories: ["kurioses"], rounds: 3 }, seed);
      h.advance(TIMING.introMs);
      writeAll(h);
      return as(h, "choose").options;
    };
    expect(run(5)).toEqual(run(5));
  });

  it("eigene Lüge ist nicht wählbar, Wahl ist fix, Index außerhalb wird ignoriert", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    writeAll(h);
    const own = viewAs(h, "p1", "choose").own!;
    expect(choose(h, "p1", own).ok).toBe(true);
    expect(viewAs(h, "p1", "choose").choice).toBeNull();
    expect(as(h, "choose").chosen).toEqual([]);
    expect(choose(h, "p1", 20).ok).toBe(true);
    expect(viewAs(h, "p1", "choose").choice).toBeNull();
    expect(choose(h, "p1", -1).ok).toBe(false);
    const other = (own + 1) % 4;
    choose(h, "p1", other);
    choose(h, "p1", (own + 2) % 4);
    expect(viewAs(h, "p1", "choose").choice).toBe(other);
    expect(as(h, "choose").chosen).toEqual(["p1"]);
  });

  it("Wählen endet vorzeitig, wenn alle verbundenen gewählt haben; sonst nach der Wählzeit", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const q = current(h);
    writeAll(h);
    choose(h, "p1", truthIndex(h, q));
    h.setConnected("p2", false);
    expect(phase(h)).toBe("choose");
    choose(h, "p3", truthIndex(h, q));
    expect(phase(h)).toBe("reveal");

    const h2 = setup(2);
    h2.advance(TIMING.introMs);
    writeAll(h2);
    h2.advance(CHOOSE_MS - 1);
    expect(phase(h2)).toBe("choose");
    h2.advance(1);
    expect(phase(h2)).toBe("reveal");
  });
});

describe("Wertung und Auflösung", () => {
  /** p1, p2, p3 schreiben L0–L2; p1 findet die Wahrheit, p2 und p3 fallen auf p1 rein. */
  const scenario = (h: H) => {
    const q = current(h);
    writeAll(h);
    choose(h, "p1", truthIndex(h, q));
    choose(h, "p2", optionIndex(h, L[0]!));
    choose(h, "p3", optionIndex(h, L[0]!));
    return q;
  };

  it("Wahrheit +500, je Reingefallenem +250; Punkte erst beim Aufdecken der Wahrheit", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const q = scenario(h);
    const rv = as(h, "reveal");
    expect(rv.stepCount).toBe(2);
    expect(rv.steps).toEqual([{ kind: "lie", option: optionIndex2(rv.options, L[0]!), text: L[0], fooled: ["p2", "p3"], authors: ["p1"], auto: false, points: 500 }]);
    // Vor der Wahrheit: noch keine Punkte, kein Ergebnis am Handy.
    expect(score(h, "p1")).toBe(0);
    expect(viewAs(h, "p1", "reveal").result).toBeNull();
    expect(viewAs(h, "p1", "reveal").score).toBe(0);
    h.advance(TIMING.revealLieMs);
    const truth = as(h, "reveal");
    expect(truth.steps).toHaveLength(2);
    expect(truth.steps[1]).toMatchObject({ kind: "truth", text: q.answer, finders: ["p1"], points: 500, fact: q.fact ?? null });
    expect(score(h, "p1")).toBe(1000);
    expect(viewAs(h, "p1", "reveal").result).toEqual({
      truth: q.answer,
      choice: q.answer,
      foundTruth: true,
      fooledBy: null,
      lie: L[0],
      fooledNames: ["Spieler 2", "Spieler 3"],
      points: 1000,
    });
    expect(viewAs(h, "p2", "reveal").result).toMatchObject({ foundTruth: false, fooledBy: ["Spieler 1"], choice: L[0], lie: L[1], fooledNames: [], points: 0 });
    h.advance(TIMING.revealTruthMs);
    const st = as(h, "standings");
    expect(st.players.map((p) => [p.id, p.score, p.rank, p.roundPoints])).toEqual([
      ["p1", 1000, 1, 1000],
      ["p2", 0, 2, 0],
      ["p3", 0, 2, 0],
    ]);
    expect(st.players[0]).toMatchObject({ fooled: 2, truths: 1 });
  });

  it("Reihenfolge der Auflösung: wenigste Reingefallene zuerst, Wahrheit zuletzt; ungewählte Lügen kommen nicht dran", () => {
    const h = setup(5);
    h.advance(TIMING.introMs);
    const q = current(h);
    writeAll(h);
    choose(h, "p1", optionIndex(h, L[1]!));
    choose(h, "p2", optionIndex(h, L[0]!));
    choose(h, "p3", optionIndex(h, L[0]!));
    choose(h, "p4", optionIndex(h, L[0]!));
    choose(h, "p5", truthIndex(h, q));
    h.advance(TIMING.revealLieMs * 2);
    const rv = as(h, "reveal");
    expect(rv.steps.map((s) => s.text)).toEqual([L[1], L[0], q.answer]);
    expect(rv.stepCount).toBe(3);
  });

  it("auf eine Hauslüge reinfallen bringt niemandem Punkte", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    const q = current(h);
    writeAll(h);
    const house = as(h, "choose").options.findIndex((o) => q.lies.includes(o));
    choose(h, "p1", house);
    choose(h, "p2", house);
    const rv = as(h, "reveal");
    expect(rv.steps[0]).toMatchObject({ kind: "lie", option: house, authors: [], fooled: ["p1", "p2"], points: 0 });
    h.skip();
    expect([score(h, "p1"), score(h, "p2")]).toEqual([0, 0]);
    expect(as(h, "standings").players.every((p) => p.fooled === 0)).toBe(true);
  });

  it("letzte Runde zählt doppelt", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    for (let r = 0; r < 2; r++) {
      h.advance(WRITE_MS + CHOOSE_MS);
      expect(h.skip()).toBe(true);
      expect(h.skip()).toBe(true);
    }
    expect(as(h, "write").double).toBe(true);
    scenario(h);
    expect(as(h, "reveal").double).toBe(true);
    expect(as(h, "reveal").steps[0]).toMatchObject({ points: 1000 });
    h.skip();
    expect(phase(h)).toBe("final");
    expect([score(h, "p1"), score(h, "p2"), score(h, "p3")]).toEqual([2000, 0, 0]);
  });

  it("Finale mit Auszeichnungen und Ergebnisdaten", () => {
    const h = setup(3, { rounds: 3 });
    h.advance(TIMING.introMs);
    scenario(h);
    h.skip();
    h.skip();
    // Runde 2: p2 findet die Wahrheit, p1 und p3 fallen auf p2 rein.
    const q = current(h);
    writeAll(h);
    choose(h, "p2", truthIndex(h, q));
    choose(h, "p1", optionIndex(h, L[1]!));
    choose(h, "p3", optionIndex(h, L[1]!));
    h.skip();
    h.skip();
    h.advance(WRITE_MS + CHOOSE_MS);
    h.skip();
    const f = as(h, "final");
    expect(f.awards).toEqual([
      { kind: "baron", playerIds: ["p1", "p2"], count: 2 },
      { kind: "finder", playerIds: ["p1", "p2"], count: 1 },
      { kind: "gullible", playerIds: ["p3"], count: 2 },
    ]);
    expect(viewAs(h, "p3", "final").awards).toEqual(["gullible"]);
    expect(viewAs(h, "p1", "final")).toMatchObject({ fooled: 2, truths: 1, awards: ["baron", "finder"] });
    h.skip();
    const data = h.results!.data as FlResultData;
    expect(data.awards).toEqual(f.awards);
    expect(h.results!.ranking.map((r) => [r.playerId, r.score, r.rank])).toEqual([
      ["p1", 1000, 1],
      ["p2", 1000, 1],
      ["p3", 0, 3],
    ]);
  });
});

const optionIndex2 = (options: string[], text: string) => options.indexOf(text);

describe("Abgang und Reconnect", () => {
  it("Abgang beim Schreiben: verschwindet aus den offenen Eingaben, seine Lüge bleibt im Spiel und bringt ihm Punkte", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    lie(h, "p3", L[2]!);
    h.leave("p3");
    expect(tv(h).players.find((p) => p.id === "p3")!.left).toBe(true);
    lie(h, "p1", L[0]!);
    lie(h, "p2", L[1]!);
    expect(phase(h)).toBe("choose");
    expect(as(h, "choose").options).toContain(L[2]);
    choose(h, "p1", optionIndex(h, L[2]!));
    choose(h, "p2", optionIndex(h, L[2]!));
    expect(phase(h)).toBe("reveal");
    expect(as(h, "reveal").steps[0]).toMatchObject({ authors: ["p3"], fooled: ["p1", "p2"] });
  });

  it("Abgang ohne Lüge: bekommt keine Hauslüge; Abgang beim Wählen zählt nicht mehr", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    lie(h, "p1", L[0]!);
    lie(h, "p2", L[1]!);
    h.leave("p3");
    expect(phase(h)).toBe("choose");
    expect(as(h, "choose").options).toHaveLength(4); // Wahrheit + 2 + 1 Hauslüge
    const h2 = setup(3);
    h2.advance(TIMING.introMs);
    const q = current(h2);
    writeAll(h2);
    choose(h2, "p3", truthIndex(h2, q));
    h2.leave("p3");
    expect(as(h2, "choose").chosen).toEqual([]);
    choose(h2, "p1", truthIndex(h2, q));
    choose(h2, "p2", truthIndex(h2, q));
    expect(as(h2, "reveal").steps.at(-1)).toMatchObject({ kind: "truth", finders: ["p1", "p2"] });
  });

  it("gehen alle, kommt das Finale", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    h.leave("p1");
    expect(phase(h)).toBe("write");
    h.leave("p2");
    expect(phase(h)).toBe("final");
    h.advance(TIMING.finalMs);
    expect(h.results).not.toBeNull();
  });

  it("Reconnect bekommt den vollen Zustand inkl. eigener Lüge und Wahl", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    lie(h, "p1", L[0]!);
    h.setConnected("p1", false);
    h.setConnected("p1", true);
    expect(viewAs(h, "p1", "write").lie).toBe(L[0]);
    lie(h, "p2", L[1]!);
    const own = viewAs(h, "p1", "choose").own!;
    const pick = (own + 1) % 4;
    choose(h, "p1", pick);
    h.setConnected("p1", false);
    const before = h.views.get("p1")!.length;
    h.setConnected("p1", true);
    expect(h.views.get("p1")!.length).toBe(before + 1);
    expect(viewAs(h, "p1", "choose")).toMatchObject({ own, choice: pick });
  });
});

describe("Privatsphäre", () => {
  it("beim Schreiben kennt niemand fremde Lügen oder die Wahrheit", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const q = current(h);
    lie(h, "p1", L[0]!);
    lie(h, "p2", "Wahrheit?"); // eigene Lüge, nur für p2 sichtbar
    for (const s of h.tvStates) {
      expect(mentions(s, q.answer)).toBe(false);
      expect(mentions(s, L[0]!)).toBe(false);
      for (const l of q.lies) expect(mentions(s, l)).toBe(false);
    }
    for (const p of h.players) {
      for (const v of h.views.get(p.id)!) {
        expect(mentions(v, q.answer), p.id).toBe(false);
        for (const a of q.alternatives) expect(mentions(v, a)).toBe(false);
        if (p.id !== "p1") expect(mentions(v, L[0]!), p.id).toBe(false);
        if (p.id !== "p2") expect(mentions(v, "Wahrheit?"), p.id).toBe(false);
      }
    }
  });

  it("beim Wählen nur gemischte Texte – ohne Autoren und ohne Markierung der Wahrheit", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    writeAll(h);
    const c = as(h, "choose");
    expect(Object.keys(c).sort()).toEqual(["category", "chosen", "double", "durationMs", "endsAt", "options", "phase", "players", "round", "text", "total"]);
    expect(c.options.every((o) => typeof o === "string")).toBe(true);
    const v = viewAs(h, "p2", "choose");
    expect(Object.keys(v).sort()).toEqual(["auto", "choice", "double", "durationMs", "endsAt", "options", "own", "phase", "playerCount", "rank", "round", "score", "text", "total"]);
    choose(h, "p2", (v.own! + 1) % 4);
    expect(as(h, "choose").chosen).toEqual(["p2"]);
    // Wer was gewählt hat, steht nirgends öffentlich.
    expect(JSON.stringify(tv(h))).not.toMatch(/choice/);
  });

  it("die Auflösung deckt Schritt für Schritt auf; die Wahrheit erst im letzten Schritt", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const q = current(h);
    writeAll(h);
    choose(h, "p1", optionIndex(h, L[1]!));
    choose(h, "p2", optionIndex(h, L[0]!));
    choose(h, "p3", optionIndex(h, L[0]!));
    const first = as(h, "reveal");
    expect(first.steps.map((s) => s.kind)).toEqual(["lie"]);
    expect(first.steps[0]!.text).toBe(L[1]);
    for (const p of h.players) expect(viewAs(h, p.id, "reveal").result).toBeNull();
    h.advance(TIMING.revealLieMs);
    expect(as(h, "reveal").steps.map((s) => s.kind)).toEqual(["lie", "lie"]);
    h.advance(TIMING.revealLieMs);
    expect(as(h, "reveal").steps.at(-1)).toMatchObject({ kind: "truth", text: q.answer, finders: [] });
    expect(viewAs(h, "p1", "reveal").result!.truth).toBe(q.answer);
  });
});

describe("Überspringbare Wartezeiten", () => {
  it("Auflösung (komplett), Zwischenstand und Finale – nie Intro, Schreib- oder Wählzeit", () => {
    const h = setup(3);
    expect(h.skip()).toBe(false); // Intro: Handys melden gerade ihre gesehenen Fragen
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    expect(phase(h)).toBe("write");
    expect(h.skip()).toBe(false);
    const q = current(h);
    writeAll(h);
    expect(phase(h)).toBe("choose");
    expect(h.skip()).toBe(false);
    choose(h, "p1", truthIndex(h, q));
    choose(h, "p2", optionIndex(h, L[0]!));
    choose(h, "p3", optionIndex(h, L[0]!));
    expect(as(h, "reveal").steps).toHaveLength(1);
    // Mitten in der Auflösung überspringen → sofort Zwischenstand, Punkte gutgeschrieben, keine Schritt-Timer mehr.
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("standings");
    expect(score(h, "p1")).toBe(1000);
    h.advance(TIMING.revealLieMs);
    expect(phase(h)).toBe("standings");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("write");
    for (let r = 1; r < 3; r++) {
      h.advance(WRITE_MS + CHOOSE_MS);
      expect(phase(h)).toBe("reveal");
      expect(h.skip()).toBe(true);
      if (phase(h) === "standings") expect(h.skip()).toBe(true);
    }
    expect(phase(h)).toBe("final");
    expect(score(h, "p1")).toBe(1000);
    expect(h.skip()).toBe(true);
    expect(h.results).not.toBeNull();
    expect(h.session.skipId).toBeNull();
  });

  it("ohne Überspringen dauert die Auflösung alle Schritte", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    writeAll(h);
    choose(h, "p1", optionIndex(h, L[1]!));
    choose(h, "p2", optionIndex(h, L[0]!));
    choose(h, "p3", optionIndex(h, L[0]!));
    h.advance(revealDurationMs(3) - 1);
    expect(phase(h)).toBe("reveal");
    h.advance(1);
    expect(phase(h)).toBe("standings");
  });
});

describe("Gedächtnis", () => {
  it("bevorzugt Fragen, die keiner der Teilnehmer schon hatte", () => {
    const all = QUESTIONS_BY_CATEGORY.tiere.map((q) => q.id);
    const fresh = new Set(all.slice(-3));
    const known = { tie: all.slice(0, -3).map((id) => Number(id.split("-")[1])) };
    const h = setup(2, { categories: ["tiere"], rounds: 3 });
    h.input("p2", { type: "seen", ids: known });
    h.advance(TIMING.introMs);
    for (let i = 0; i < 3; i++) {
      expect(fresh.has(current(h).id), current(h).id).toBe(true);
      h.advance(WRITE_MS + CHOOSE_MS);
      h.skip();
      if (phase(h) === "standings") h.skip();
    }
  });

  it("meidet Fragen der Vorrunde (ctx.previous)", () => {
    const all = QUESTIONS_BY_CATEGORY.essen.map((q) => q.id);
    const previous = { gameId: "flunkern", ranking: [], data: { questionIds: all.slice(0, -3), total: 0, awards: [], players: [] } };
    const h = createTestHarness<FlTvState, FlPlayerView>(game, { players: 2, settings: { categories: ["essen"], rounds: 3 }, previous });
    h.advance(TIMING.introMs);
    const asked: string[] = [];
    for (let i = 0; i < 3; i++) {
      asked.push(current(h).id);
      h.advance(WRITE_MS + CHOOSE_MS);
      h.skip();
      if (phase(h) === "standings") h.skip();
    }
    expect(asked.sort()).toEqual(all.slice(-3).sort());
  });
});
