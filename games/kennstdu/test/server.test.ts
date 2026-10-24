// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import game from "../src/server/index.js";
import { POINTS, TIMING, type KdPlayerView, type KdResultData, type KdTvState } from "../src/shared.js";

type H = GameHarness<KdTvState, KdPlayerView>;
const SETTINGS: SettingsValues = { categories: ["freizeit", "reisen"], turns: 1, answerSeconds: 15 };
const setup = (players = 3, settings: SettingsValues = SETTINGS, seed = 7): H =>
  createTestHarness<KdTvState, KdPlayerView>(game, { players, settings, seed });
const tv = (h: H) => h.lastTv()!;
const ask = (h: H) => {
  const s = tv(h);
  if (s.phase !== "ask") throw new Error(`Phase ${s.phase}`);
  return s;
};
/** Nach der Auflösung zur nächsten Frage (oder ins Finale). */
const next = (h: H) => {
  h.advance(TIMING.revealMs);
  if (tv(h).phase === "standings") h.advance(TIMING.standingsMs);
};

describe("Ablauf", () => {
  it("Intro, dann reihum jede Person einmal Hauptperson; Rollen und Texte stimmen", () => {
    const h = setup(3);
    expect(tv(h).phase).toBe("intro");
    h.advance(TIMING.introMs);
    const hots: string[] = [];
    for (let i = 0; i < 3; i++) {
      const s = ask(h);
      hots.push(s.hotseat.id);
      expect(s.total).toBe(3);
      expect(s.text).toContain(s.hotseat.name);
      const hv = h.lastView(s.hotseat.id)!;
      expect(hv.phase === "ask" && hv.role).toBe("hotseat");
      expect(hv.phase === "ask" && hv.text).not.toContain("{name}");
      const other = h.players.find((p) => p.id !== s.hotseat.id)!.id;
      const ov = h.lastView(other)!;
      expect(ov.phase === "ask" && ov.role).toBe("guess");
      expect(ov.phase === "ask" && ov.text).toBe(s.text);
      h.advance(15_000);
      next(h);
    }
    expect(new Set(hots).size).toBe(3);
    expect(tv(h).phase).toBe("final");
  });

  it("Punkte: richtige Rater +100, Hauptperson +50 je richtigem Rater; Antwort erst in der Auflösung", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const s = ask(h);
    const [a, b] = h.players.filter((p) => p.id !== s.hotseat.id).map((p) => p.id);
    expect(JSON.stringify(s)).not.toContain("hotseatChoice");
    h.input(s.hotseat.id, { type: "answer", index: 1 });
    h.input(a!, { type: "answer", index: 1 });
    h.input(b!, { type: "answer", index: 0 });
    // Alle haben geantwortet → sofort Auflösung.
    const r = tv(h);
    expect(r.phase).toBe("reveal");
    if (r.phase !== "reveal") return;
    expect(r.hotseatChoice).toBe(1);
    expect(r.guesses.find((g) => g.playerId === a)?.correct).toBe(true);
    const score = (id: string) => r.players.find((p) => p.id === id)!.score;
    expect(score(a!)).toBe(POINTS.guess);
    expect(score(b!)).toBe(0);
    expect(score(s.hotseat.id)).toBe(POINTS.perGuesser);
    const hv = h.lastView(s.hotseat.id)!;
    expect(hv.phase === "reveal" && hv.rightGuessers).toBe(1);
  });

  it("antwortet die Hauptperson nicht, bekommt niemand Punkte", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    const s = ask(h);
    const other = h.players.find((p) => p.id !== s.hotseat.id)!.id;
    h.input(other, { type: "answer", index: 0 });
    h.advance(15_000);
    const r = tv(h);
    expect(r.phase === "reveal" && r.hotseatChoice).toBe(null);
    expect(r.players.every((p) => p.score === 0)).toBe(true);
  });

  it("doppelte und ungültige Antworten werden ignoriert", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const s = ask(h);
    h.input(s.hotseat.id, { type: "answer", index: 0 });
    h.input(s.hotseat.id, { type: "answer", index: 1 });
    expect(h.lastView(s.hotseat.id)!.phase === "ask" && (h.lastView(s.hotseat.id) as { choice: number }).choice).toBe(0);
    if (s.answers.length < 4) h.input(h.players.find((p) => p.id !== s.hotseat.id)!.id, { type: "answer", index: 3 });
    expect(ask(h).guessed).toHaveLength(0);
  });

  it("Ergebnis mit Ranking, Treffern und gestellten Fragen", () => {
    const h = setup(2, { ...SETTINGS, turns: 2 });
    h.advance(TIMING.introMs);
    for (let i = 0; i < 4; i++) {
      const s = ask(h);
      const other = h.players.find((p) => p.id !== s.hotseat.id)!.id;
      h.input(s.hotseat.id, { type: "answer", index: 0 });
      h.input(other, { type: "answer", index: 0 });
      next(h);
    }
    expect(tv(h).phase).toBe("final");
    h.advance(TIMING.finalMs);
    const data = h.results!.data as KdResultData;
    expect(data.questionIds).toHaveLength(4);
    expect(new Set(data.questionIds).size).toBe(4);
    expect(data.players.every((p) => p.matches === 4)).toBe(true);
    expect(h.results!.ranking.map((r) => r.score)).toEqual([300, 300]);
  });
});

describe("Gedächtnis und Verlassen", () => {
  it("bevorzugt Fragen, die keiner der Teilnehmer schon hatte", () => {
    const all = QUESTIONS_BY_CATEGORY.freizeit.map((q) => q.id);
    const fresh = new Set(all.slice(-5));
    const known = { frz: all.slice(0, -5).map((id) => Number(id.split("-")[1])) };
    const h = setup(3, { categories: ["freizeit"], turns: 1, answerSeconds: 15 });
    h.input("p1", { type: "seen", ids: known });
    h.advance(TIMING.introMs);
    for (let i = 0; i < 3; i++) {
      const s = ask(h);
      const v = h.lastView(s.hotseat.id)!;
      expect(v.phase === "ask" && fresh.has(v.questionId)).toBe(true);
      h.advance(15_000);
      next(h);
    }
  });

  it("geht die Hauptperson, wird aufgelöst; fallen alle bis auf einen weg, kommt das Finale", () => {
    const h = setup(3);
    h.advance(TIMING.introMs);
    const s = ask(h);
    h.leave(s.hotseat.id);
    expect(tv(h).phase).toBe("reveal");
    const rest = h.players.filter((p) => p.id !== s.hotseat.id).map((p) => p.id);
    h.leave(rest[0]!);
    expect(tv(h).phase).toBe("final");
  });
});
