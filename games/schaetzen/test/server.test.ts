// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { ALL_QUESTIONS, QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import game from "../src/server/index.js";
import { TIMING, type EsPlayerView, type EsResultData, type EsTvState } from "../src/shared.js";

type H = GameHarness<EsTvState, EsPlayerView>;
const SETTINGS: SettingsValues = { categories: ["geografie", "technik"], rounds: 5, answerSeconds: 20 };
const ANSWER_MS = 20_000;
const REVEAL_MS = TIMING.revealAnimMs + TIMING.revealHoldMs;
const setup = (players = 3, settings: SettingsValues = SETTINGS, seed = 7): H =>
  createTestHarness<EsTvState, EsPlayerView>(game, { players, settings, seed });
const tv = (h: H) => h.lastTv()!;
const phase = (h: H) => tv(h).phase;
const question = (h: H) => {
  const s = tv(h);
  if (s.phase !== "question") throw new Error(`Phase ${s.phase}`);
  return s;
};
const reveal = (h: H) => {
  const s = tv(h);
  if (s.phase !== "reveal") throw new Error(`Phase ${s.phase}`);
  return s;
};
/** Aktuelle Frage aus Sicht eines aktiven Spielers (nur Tests kennen die Lösung vorab). */
const current = (h: H, id = h.players[0]!.id) => {
  const v = h.lastView(id)!;
  if (v.phase !== "question") throw new Error(`Phase ${v.phase}`);
  return ALL_QUESTIONS.find((q) => q.id === v.questionId)!;
};
const guess = (h: H, id: string, value: number) => h.input(id, { type: "guess", value });
/** Nach der Auflösung zur nächsten Frage (oder ins Finale). */
const next = (h: H) => {
  h.advance(REVEAL_MS);
  if (phase(h) === "standings") h.advance(TIMING.standingsMs);
};
const score = (h: H, id: string) => tv(h).players.find((p) => p.id === id)!.score;

describe("Ablauf", () => {
  it("Intro → Fragen → Auflösung → Zwischenstand … → Finale → Ergebnis mit Fragen-IDs", () => {
    const h = setup(2);
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    for (let i = 0; i < 5; i++) {
      const q = question(h);
      expect(q.round).toBe(i);
      expect(q.total).toBe(5);
      expect(JSON.stringify(q)).not.toContain('"answer"');
      const v = h.lastView("p1")!;
      expect(v.phase === "question" && v.unit).toBe(q.unit);
      h.advance(ANSWER_MS);
      expect(reveal(h).guesses.every((g) => g.value === null && g.points === 0)).toBe(true);
      h.advance(REVEAL_MS);
      expect(phase(h)).toBe(i < 4 ? "standings" : "final");
      if (i < 4) h.advance(TIMING.standingsMs);
    }
    h.advance(TIMING.finalMs);
    const data = h.results!.data as EsResultData;
    expect(data.questionIds).toHaveLength(5);
    expect(new Set(data.questionIds).size).toBe(5);
    expect(h.results!.ranking).toHaveLength(2);
  });

  it("Rangwertung mit Gleichstand und Volltreffer bei Jahreszahl (nur exakt)", () => {
    const h = setup(4, { categories: ["geschichte"], rounds: 5, answerSeconds: 20 });
    h.advance(TIMING.introMs);
    const q = current(h);
    expect(q.unit).toBe("Jahr");
    guess(h, "p1", q.answer);
    guess(h, "p2", q.answer + 10);
    guess(h, "p3", q.answer - 10);
    guess(h, "p4", q.answer + 1);
    const r = reveal(h); // alle fertig → sofort
    const by = (id: string) => r.guesses.find((g) => g.playerId === id)!;
    expect([by("p1").place, by("p4").place, by("p2").place, by("p3").place]).toEqual([1, 2, 3, 3]);
    expect([by("p1").points, by("p4").points, by("p2").points, by("p3").points]).toEqual([150, 70, 50, 50]);
    expect(by("p4").bullseye).toBe(false);
    expect(r.nearest).toEqual(["p1"]);
    expect(r.answer).toBe(q.answer);
    expect(score(h, "p1")).toBe(150);
    const v = h.lastView("p2")!;
    expect(v.phase === "reveal" && [v.place, v.distance, v.points]).toEqual([3, 10, 50]);
  });

  it("Volltreffer bei Zahlen: bis 2 % daneben +50; ohne Tipp 0", () => {
    const h = setup(3, { categories: ["technik", "geografie"], rounds: 10, answerSeconds: 20 });
    h.advance(TIMING.introMs);
    // Erste Frage ohne Jahreszahl suchen.
    while (current(h).unit === "Jahr") {
      h.advance(ANSWER_MS);
      next(h);
    }
    const q = current(h);
    const near = Math.round(q.answer * 1.015 * 100) / 100;
    guess(h, "p1", near);
    guess(h, "p2", q.answer * 3 + 10);
    h.advance(ANSWER_MS);
    const r = reveal(h);
    const p1 = r.guesses.find((g) => g.playerId === "p1")!;
    expect(p1.bullseye).toBe(true);
    expect(p1.points).toBe(150);
    expect(r.guesses.find((g) => g.playerId === "p2")!.points).toBe(70);
    expect(r.guesses.find((g) => g.playerId === "p3")).toMatchObject({ value: null, points: 0, place: null });
  });

  it("1 Spieler: Wertung nach Genauigkeit", () => {
    const h = setup(1, { categories: ["geschichte"], rounds: 5, answerSeconds: 20 });
    expect(tv(h).solo).toBe(true);
    h.advance(TIMING.introMs);
    const q = current(h);
    guess(h, "p1", q.answer - 2);
    const r = reveal(h);
    expect(r.solo).toBe(true);
    expect(r.guesses[0]!.points).toBe(100);
    expect(r.nearest).toEqual(["p1"]);
  });

  it("ignoriert doppelte Tipps, Kommazahlen bei Jahreszahlen und ungültige Eingaben", () => {
    const h = setup(2, { categories: ["geschichte"], rounds: 5, answerSeconds: 20 });
    h.advance(TIMING.introMs);
    expect(guess(h, "p1", 1.5).ok).toBe(true); // Schema ok, aber Jahreszahl → ignoriert
    expect(question(h).answered).toEqual([]);
    expect(guess(h, "p1", 1900).ok).toBe(true);
    expect(guess(h, "p1", 1950).ok).toBe(true);
    expect(h.lastView("p1")!.phase === "question" && (h.lastView("p1") as { guess: number }).guess).toBe(1900);
    expect(guess(h, "p2", -1).ok).toBe(false);
    expect(guess(h, "p2", 1.234).ok).toBe(false);
    expect(guess(h, "p2", 1e16).ok).toBe(false);
    expect(question(h).answered).toEqual(["p1"]);
  });
});

describe("Vorzeitiges Ende, Abgang, Reconnect", () => {
  it("löst auf, sobald alle verbundenen Spieler fertig sind – getrennte zählen nicht", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    guess(h, "p1", 10);
    h.setConnected("p3", false);
    expect(phase(h)).toBe("question");
    guess(h, "p2", 20);
    expect(phase(h)).toBe("reveal");
  });

  it("sind alle getrennt, läuft die Antwortzeit normal ab", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    h.setConnected("p1", false);
    h.setConnected("p2", false);
    expect(phase(h)).toBe("question");
    h.advance(ANSWER_MS);
    expect(phase(h)).toBe("reveal");
  });

  it("Reconnect: Spieler bekommt seine Ansicht mit eigenem Tipp erneut", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    guess(h, "p1", 42);
    h.setConnected("p1", false);
    const before = h.views.get("p1")!.length;
    h.setConnected("p1", true);
    expect(h.views.get("p1")!.length).toBe(before + 1);
    const v = h.lastView("p1")!;
    expect(v.phase === "question" && v.guess).toBe(42);
  });

  it("Abgang: die übrigen spielen weiter; gehen alle, kommt das Finale", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    guess(h, "p1", 10);
    guess(h, "p2", 20);
    h.leave("p3");
    expect(phase(h)).toBe("reveal");
    expect(reveal(h).guesses.map((g) => g.playerId)).toEqual(["p1", "p2"]);
    expect(tv(h).players.find((p) => p.id === "p3")!.left).toBe(true);
    next(h);
    h.leave("p1");
    expect(question(h).solo).toBe(false);
    h.advance(ANSWER_MS);
    next(h);
    // Allein übrig: ab der nächsten Frage Ein-Spieler-Wertung.
    expect(question(h).solo).toBe(true);
    h.leave("p2");
    expect(phase(h)).toBe("final");
    h.advance(TIMING.finalMs);
    expect(h.results).not.toBeNull();
  });
});

describe("Überspringbare Wartezeiten", () => {
  it("Lesezeit der Auflösung, Zwischenstand und Finale – nie Intro, Antwortzeit oder Animation", () => {
    const h = setup(2);
    expect(h.skip()).toBe(false); // Intro: Handys melden gerade ihre gesehenen Fragen
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    expect(phase(h)).toBe("question");
    expect(h.skip()).toBe(false);
    guess(h, "p1", 1);
    guess(h, "p2", 2);
    expect(phase(h)).toBe("reveal");
    expect(h.skip()).toBe(false); // Animation läuft
    h.advance(TIMING.revealAnimMs);
    expect(phase(h)).toBe("reveal");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("standings");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("question");
    for (let i = 1; i < 5; i++) {
      h.advance(ANSWER_MS + TIMING.revealAnimMs);
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
  it("bevorzugt Fragen, die keiner der Teilnehmer schon hatte", () => {
    const all = QUESTIONS_BY_CATEGORY.weltall.map((q) => q.id);
    const fresh = new Set(all.slice(-5));
    const known = { wel: all.slice(0, -5).map((id) => Number(id.split("-")[1])) };
    const h = setup(2, { categories: ["weltall"], rounds: 5, answerSeconds: 20 });
    h.input("p2", { type: "seen", ids: known });
    h.advance(TIMING.introMs);
    for (let i = 0; i < 5; i++) {
      expect(fresh.has(current(h).id), current(h).id).toBe(true);
      h.advance(ANSWER_MS);
      next(h);
    }
  });

  it("meidet Fragen der Vorrunde (ctx.previous)", () => {
    const all = QUESTIONS_BY_CATEGORY.sport.map((q) => q.id);
    const previous = { gameId: "schaetzen", ranking: [], data: { questionIds: all.slice(0, -5), total: 0, players: [] } };
    const h = createTestHarness<EsTvState, EsPlayerView>(game, {
      players: 1,
      settings: { categories: ["sport"], rounds: 5, answerSeconds: 20 },
      previous,
    });
    h.advance(TIMING.introMs);
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      asked.push(current(h).id);
      h.advance(ANSWER_MS);
      next(h);
    }
    expect(asked.sort()).toEqual(all.slice(-5).sort());
  });
});
