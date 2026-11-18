import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import game, { parseAonSettings } from "../src/server/index.js";
import { TIMING, type AonPlayerView, type AonResultData, type AonTvState } from "../src/shared.js";

type H = GameHarness<AonTvState, AonPlayerView>;

const setup = (players: number, settings: SettingsValues = {}, seed = 7): H =>
  createTestHarness<AonTvState, AonPlayerView>(game, { players, settings, seed });

const tv = (h: H): AonTvState => h.lastTv()!;
const phase = (h: H): string => tv(h).phase;
const view = (h: H, id: string): AonPlayerView => h.lastView(id)!;

/** Richtiger Index der aktuellen Frage – nur aus dem Katalog ermittelbar, nicht aus dem Zustand. */
function correctIndex(h: H): number {
  const s = tv(h);
  if (!("text" in s)) throw new Error(`keine Frage aktiv (${s.phase})`);
  const q = ALL_QUESTIONS.find((x) => x.text === s.text)!;
  return s.answers.indexOf(q.answers[0]);
}
const wrongIndices = (h: H): number[] => [0, 1, 2, 3].filter((i) => i !== correctIndex(h));

const pick = (h: H, id: string, index: number) => h.input(id, { type: "pick", index });
const abstain = (h: H, id: string) => h.input(id, { type: "abstain" });
const decide = (h: H, id: string, stay: boolean) => h.input(id, { type: "decide", stay });

/** Gestrichene Antwort der laufenden Elimination (nur der TV kennt sie). */
function spinTarget(h: H): number {
  const s = tv(h);
  if (s.phase !== "spin") throw new Error(`kein Lauflicht (${s.phase})`);
  return s.path[s.path.length - 1]!;
}

function toFirstQuestion(h: H): void {
  expect(phase(h)).toBe("intro");
  h.advance(TIMING.introMs);
  expect(phase(h)).toBe("pick");
}

/** Von der Auflösung zur nächsten Frage (oder zum Finale). */
function afterReveal(h: H): void {
  expect(phase(h)).toBe("reveal");
  h.advance(TIMING.revealMs);
  if (phase(h) === "standings") h.advance(TIMING.standingsMs);
}

const settings5 = { rounds: 5, answerSeconds: 20 };

describe("Alles oder nichts – Ablauf", () => {
  it("1 Spieler hält immer durch: drei Eliminationen, +3 je Frage, Podium, Ergebnis", () => {
    const h = setup(1, settings5);
    toFirstQuestion(h);
    for (let i = 0; i < 5; i++) {
      expect(pick(h, "p1", correctIndex(h))).toEqual({ ok: true });
      // Einziger Spieler hat gewählt → sofort das erste Lauflicht.
      for (let stage = 1; stage <= 3; stage++) {
        const s = tv(h);
        expect(s.phase === "spin" && s.stage).toBe(stage);
        expect(spinTarget(h)).not.toBe(correctIndex(h));
        h.advance(TIMING.spinMs);
        if (stage < 3) {
          expect(phase(h)).toBe("decide");
          expect(view(h, "p1")).toMatchObject({ phase: "decide", stage, status: "in", decision: null });
          decide(h, "p1", true); // alle entschieden → sofort weiter
        }
      }
      expect(phase(h)).toBe("reveal");
      // Kein Solo-Bonus im Einzelspiel.
      expect(view(h, "p1")).toMatchObject({ phase: "reveal", status: "won", points: 3, score: 3 * (i + 1), bonus: false });
      afterReveal(h);
    }
    expect(phase(h)).toBe("final");
    expect(view(h, "p1")).toMatchObject({ phase: "final", rank: 1, score: 15, jackpots: 5 });
    h.advance(TIMING.finalMs);
    expect(h.results).toMatchObject({ gameId: "allesodernichts", ranking: [{ playerId: "p1", score: 15, rank: 1 }] });
    const data = h.results!.data as AonResultData;
    expect(new Set(data.questionIds).size).toBe(5);
    expect(h.crash).toBeNull();
  });

  it("4 Spieler auf alle vier Antworten: −1, −2, −3 und der Einzige bis zum Schluss bekommt +3 +1 Bonus", () => {
    const h = setup(4, settings5);
    toFirstQuestion(h);
    const [w1, w2, w3] = wrongIndices(h);
    const byChoice = new Map([
      [correctIndex(h), "p1"],
      [w1!, "p2"],
      [w2!, "p3"],
      [w3!, "p4"],
    ]);
    for (const [choice, id] of byChoice) pick(h, id, choice);
    const struck: number[] = [];
    for (let stage = 1; stage <= 3; stage++) {
      expect(phase(h)).toBe("spin");
      const gone = spinTarget(h);
      expect(struck).not.toContain(gone);
      struck.push(gone);
      h.advance(TIMING.spinMs);
      const loser = byChoice.get(gone)!;
      expect(h.lastView(loser)).toMatchObject({ status: "out", points: -stage });
      if (stage < 3) {
        expect(phase(h)).toBe("decide");
        const s = tv(h);
        expect(s.phase === "decide" && s.struck).toEqual(struck);
        // Alle, die noch drin sind, zocken weiter.
        for (const id of ["p1", "p2", "p3", "p4"]) if (h.lastView(id)!.phase === "decide" && (h.lastView(id) as { status: string }).status === "in") decide(h, id, true);
      }
    }
    const s = tv(h);
    expect(s.phase).toBe("reveal");
    if (s.phase !== "reveal") return;
    expect(s.correctIndex).toBe(correctIndex(h));
    expect(s.soloBonus).toBe("p1");
    expect(view(h, "p1")).toMatchObject({ status: "won", points: 4, score: 4, bonus: true });
    const points = Object.fromEntries(s.picks.map((p) => [p.playerId, p.points]));
    expect(points.p1).toBe(4);
    expect([points.p2, points.p3, points.p4].sort()).toEqual([-1, -2, -3]);
    expect(s.players[0]).toMatchObject({ id: "p1", rank: 1, jackpots: 1 });
  });

  it("Aussteigen sichert +1 bzw. +2; zwei Gewinner bekommen keinen Bonus", () => {
    const h = setup(4, settings5);
    toFirstQuestion(h);
    const c = correctIndex(h);
    for (const id of ["p1", "p2", "p3", "p4"]) pick(h, id, c);
    h.advance(TIMING.spinMs);
    expect(phase(h)).toBe("decide");
    decide(h, "p1", false);
    expect(phase(h)).toBe("decide"); // andere fehlen noch
    decide(h, "p2", true);
    decide(h, "p3", true);
    decide(h, "p4", true);
    expect(phase(h)).toBe("spin");
    expect(view(h, "p1")).toMatchObject({ phase: "spin", status: "cashed", points: 1, score: 1 });
    h.advance(TIMING.spinMs);
    decide(h, "p2", false);
    decide(h, "p3", true);
    decide(h, "p4", true);
    h.advance(TIMING.spinMs);
    const s = tv(h);
    expect(s.phase).toBe("reveal");
    if (s.phase !== "reveal") return;
    expect(s.soloBonus).toBeNull();
    const points = Object.fromEntries(s.picks.map((p) => [p.playerId, p.points]));
    expect(points).toEqual({ p1: 1, p2: 2, p3: 3, p4: 3 });
  });

  it("ohne Entscheidung wird nach Ablauf der Zeit automatisch ausgestiegen", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    const c = correctIndex(h);
    pick(h, "p1", c);
    pick(h, "p2", c);
    h.advance(TIMING.spinMs);
    decide(h, "p1", true);
    h.advance(TIMING.decideMs - 1);
    expect(phase(h)).toBe("decide");
    h.advance(1);
    expect(phase(h)).toBe("spin");
    expect(view(h, "p2")).toMatchObject({ status: "cashed", points: 1 });
    expect(view(h, "p1")).toMatchObject({ status: "in" });
  });

  it("ist niemand mehr drin, folgt sofort die Auflösung ohne weitere Eliminationen", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    const c = correctIndex(h);
    pick(h, "p1", c);
    abstain(h, "p2");
    h.advance(TIMING.spinMs);
    decide(h, "p1", false);
    const s = tv(h);
    expect(s.phase).toBe("reveal");
    expect(s.phase === "reveal" && s.struck).toHaveLength(1);
    expect(view(h, "p1")).toMatchObject({ phase: "reveal", status: "cashed", points: 1, correctIndex: c });
    expect(view(h, "p2")).toMatchObject({ phase: "reveal", status: "abstain", points: 0, choice: null });
  });

  it("alle enthalten sich oder tippen nicht → direkt Auflösung, 0 Punkte", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    abstain(h, "p1");
    h.advance(20_000); // p2 tippt nicht
    expect(phase(h)).toBe("reveal");
    expect(view(h, "p1")).toMatchObject({ status: "abstain", points: 0, score: 0 });
    expect(view(h, "p2")).toMatchObject({ status: "abstain", points: 0, score: 0 });
  });

  it("negative Punktestände sind möglich und werden korrekt gerankt", () => {
    const h = setup(2, { rounds: 5, answerSeconds: 20 }, 3);
    toFirstQuestion(h);
    // p1 tippt falsch und zockt immer weiter, bis die eigene Antwort fliegt.
    pick(h, "p1", wrongIndices(h)[0]!);
    abstain(h, "p2");
    for (let stage = 1; stage <= 3; stage++) {
      const gone = spinTarget(h);
      h.advance(TIMING.spinMs);
      if (gone === wrongIndices(h)[0]) break;
      decide(h, "p1", true);
    }
    expect(phase(h)).toBe("reveal");
    const v = view(h, "p1");
    expect(v).toMatchObject({ status: "out" });
    expect(v.score).toBeLessThan(0);
    const s = tv(h);
    expect(s.players.map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});

describe("Alles oder nichts – Geheimhaltung", () => {
  it("richtige Antwort erst in der Auflösung; das Lauflicht-Ziel kennt nur der TV", () => {
    const h = setup(3, settings5);
    toFirstQuestion(h);
    const c = correctIndex(h);
    pick(h, "p1", c);
    pick(h, "p2", c);
    pick(h, "p3", wrongIndices(h)[0]!);
    while (phase(h) !== "reveal") {
      if (phase(h) === "decide") for (const id of ["p1", "p2", "p3"]) decide(h, id, true);
      else h.advance(TIMING.spinMs);
    }
    for (const s of h.tvStates.filter((x) => x.phase !== "reveal")) expect(JSON.stringify(s)).not.toContain("correctIndex");
    for (const id of ["p1", "p2", "p3"]) {
      for (const v of h.views.get(id)!) {
        if (v.phase !== "reveal") expect(JSON.stringify(v)).not.toContain("correctIndex");
        expect(JSON.stringify(v)).not.toContain("path");
      }
    }
    // Während des Tippens verrät der TV keinen Status (auch kein „enthalten“).
    for (const s of h.tvStates.filter((x) => x.phase === "pick")) for (const p of s.players) expect(p.status).toBeNull();
  });

  it("gestrichen wird nie die richtige Antwort", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const h = setup(1, settings5, seed);
      h.advance(TIMING.introMs);
      const c = correctIndex(h);
      pick(h, "p1", c);
      for (let stage = 1; stage <= 3; stage++) {
        expect(spinTarget(h)).not.toBe(c);
        h.advance(TIMING.spinMs);
        if (stage < 3) decide(h, "p1", true);
      }
      const s = tv(h);
      expect(s.phase === "reveal" && [...s.struck].sort()).toEqual(wrongIndices(h).sort());
    }
  });
});

describe("Alles oder nichts – Eingaben und Robustheit", () => {
  it("nur einmal tippen, nur in der passenden Phase, Entscheidung nur wer noch drin ist", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    const c = correctIndex(h);
    decide(h, "p1", true); // falsche Phase → ignoriert
    pick(h, "p1", c);
    pick(h, "p1", (c + 1) % 4); // zweiter Tipp → ignoriert
    expect(view(h, "p1")).toMatchObject({ phase: "pick", locked: true, choice: c });
    abstain(h, "p2");
    expect(phase(h)).toBe("spin");
    pick(h, "p2", c); // zu spät
    h.advance(TIMING.spinMs);
    decide(h, "p2", true); // enthalten → darf nicht entscheiden
    expect(view(h, "p2")).toMatchObject({ status: "abstain" });
    expect(h.input("p1", { type: "decide" })).toMatchObject({ ok: false });
    expect(h.input("p1", { type: "pick", index: 4 })).toMatchObject({ ok: false });
  });

  it("TV zeigt, wer gewählt bzw. entschieden hat – ohne zu verraten, was", () => {
    const h = setup(3, settings5);
    toFirstQuestion(h);
    const c = correctIndex(h);
    pick(h, "p2", c);
    const s = tv(h);
    expect(s.phase === "pick" && s.answered).toEqual(["p2"]);
    pick(h, "p1", c);
    pick(h, "p3", c);
    h.advance(TIMING.spinMs);
    decide(h, "p3", false);
    const d = tv(h);
    expect(d.phase === "decide" && d.decided).toEqual(["p3"]);
    expect(JSON.stringify(d)).not.toContain('"cash"');
  });

  it("Tipp-Phase wartet nicht auf getrennte Spieler, aber auf verbundene", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    h.setConnected("p2", false);
    pick(h, "p1", correctIndex(h));
    expect(phase(h)).toBe("spin");
  });

  it("verlassen alle, endet das Spiel; Verlassene bleiben in der Wertung", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    h.leave("p2");
    expect(h.results).toBeNull();
    h.leave("p1");
    expect(h.results).not.toBeNull();
    expect(h.results!.ranking).toHaveLength(2);
  });

  it("Spieler verlässt während der Entscheidung → Rest geht weiter", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    const c = correctIndex(h);
    pick(h, "p1", c);
    pick(h, "p2", c);
    h.advance(TIMING.spinMs);
    decide(h, "p1", true);
    h.leave("p2");
    expect(phase(h)).toBe("spin");
    expect(h.crash).toBeNull();
  });

  it("Wartezeiten (Auflösung, Zwischenstand, Finale) sind überspringbar, Lauflicht und Entscheidung nicht", () => {
    const h = setup(1, settings5);
    toFirstQuestion(h);
    expect(h.skip()).toBe(false);
    pick(h, "p1", correctIndex(h));
    expect(h.skip()).toBe(false);
    h.advance(TIMING.spinMs);
    expect(h.skip()).toBe(false);
    decide(h, "p1", false);
    expect(phase(h)).toBe("reveal");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("standings");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("pick");
  });

  it("ist deterministisch bei festem Seed", () => {
    const run = (seed: number) => {
      const h = setup(1, settings5, seed);
      h.advance(TIMING.introMs);
      pick(h, "p1", 0);
      const s = tv(h);
      return s.phase === "spin" ? [s.text, ...s.answers, ...s.path] : [];
    };
    expect(run(1)).toEqual(run(1));
    expect(run(1)).not.toEqual(run(2));
  });

  it("bevorzugt Fragen, die kein Mitspieler schon gesehen hat", () => {
    const geo = QUESTIONS_BY_CATEGORY.geografie;
    const unseen = geo[17]!;
    const ids: Record<string, number[]> = { geo: geo.filter((q) => q !== unseen).map((q) => Number(q.id.slice(4))) };
    const h = setup(1, { categories: ["geografie"], rounds: 5, answerSeconds: 20 });
    h.input("p1", { type: "seen", ids });
    h.advance(TIMING.introMs);
    expect(view(h, "p1")).toMatchObject({ phase: "pick", questionId: unseen.id });
  });

  it("Settings werden defensiv übernommen", () => {
    expect(parseAonSettings({ categories: ["quatsch"], rounds: 3.7, answerSeconds: "x" })).toEqual({
      categories: ["rechtschreibung", "woerter", "geografie", "geschichte", "natur", "kultur", "sport", "alltag"],
      rounds: 4,
      answerSeconds: 25,
    });
  });
});
