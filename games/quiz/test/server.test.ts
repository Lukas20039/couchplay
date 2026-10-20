import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it } from "vitest";
import { ALL_QUESTIONS } from "../src/data/index.js";
import game from "../src/server/index.js";
import { drawQuestions } from "../src/server/questions.js";
import { rankScores } from "../src/server/ranking.js";
import { createRng } from "@couchplay/game-sdk";
import { QUESTIONS_BY_CATEGORY } from "../src/data/index.js";
import { TIMING, pointsForCorrect, type QuizPlayerView, type QuizResultData, type QuizTvState } from "../src/shared.js";
import type { SettingsValues } from "@couchplay/protocol";

type H = GameHarness<QuizTvState, QuizPlayerView>;

const setup = (players: number, settings: SettingsValues = {}, seed = 7): H =>
  createTestHarness<QuizTvState, QuizPlayerView>(game, { players, settings, seed });

const tv = (h: H): QuizTvState => h.lastTv()!;
const phase = (h: H): string => tv(h).phase;
const view = (h: H, id: string): QuizPlayerView => h.lastView(id)!;

/** Richtiger Index der aktuellen Frage – nur aus dem Katalog ermittelbar, nicht aus dem Zustand. */
function correctIndex(h: H): number {
  const s = tv(h);
  if (s.phase !== "question") throw new Error(`keine Frage aktiv (${s.phase})`);
  const q = ALL_QUESTIONS.find((x) => x.text === s.text)!;
  return s.answers.indexOf(q.answers[0]);
}
const wrongIndex = (h: H): number => (correctIndex(h) + 1) % 4;

const answer = (h: H, id: string, index: number) => h.input(id, { type: "answer", index });

/** Intro überspringen → erste Frage. */
function toFirstQuestion(h: H): void {
  expect(phase(h)).toBe("intro");
  h.advance(TIMING.introMs);
  expect(phase(h)).toBe("question");
}

/** Von der Auflösung zur nächsten Frage (oder zum Finale). */
function afterReveal(h: H): void {
  expect(phase(h)).toBe("reveal");
  h.advance(TIMING.revealMs);
  if (phase(h) === "standings") h.advance(TIMING.standingsMs);
}

const settings5 = { rounds: 5, answerSeconds: 20 };

describe("Quiz – kompletter Durchlauf", () => {
  it("1 Spieler: alle Fragen sofort richtig → 1000 Punkte je Frage, Podium, Ergebnis", () => {
    const h = setup(1, settings5);
    toFirstQuestion(h);
    for (let i = 0; i < 5; i++) {
      const s = tv(h);
      expect(s.phase === "question" && s.index).toBe(i);
      expect(answer(h, "p1", correctIndex(h))).toEqual({ ok: true });
      // Einziger Spieler hat geantwortet → sofort Auflösung
      expect(phase(h)).toBe("reveal");
      const v = view(h, "p1");
      expect(v).toMatchObject({ phase: "reveal", correct: true, points: 1000, score: 1000 * (i + 1), rank: 1 });
      if (i < 4) {
        h.advance(TIMING.revealMs);
        expect(phase(h)).toBe("standings");
        h.advance(TIMING.standingsMs);
      } else {
        h.advance(TIMING.revealMs);
      }
    }
    expect(phase(h)).toBe("final");
    expect(view(h, "p1")).toMatchObject({ phase: "final", rank: 1, score: 5000, correctCount: 5 });
    expect(h.results).toBeNull();
    h.advance(TIMING.finalMs);
    expect(h.results).toMatchObject({ gameId: "quiz", ranking: [{ playerId: "p1", score: 5000, rank: 1 }] });
    const data = h.results!.data as QuizResultData;
    expect(data.total).toBe(5);
    expect(new Set(data.questionIds).size).toBe(5);
    expect(h.crash).toBeNull();
  });

  it("8 Spieler: gemischte Antworten, Ranking absteigend und konsistent", () => {
    const h = setup(8, { rounds: 10, answerSeconds: 10 });
    toFirstQuestion(h);
    const ids = h.players.map((p) => p.id);
    for (let i = 0; i < 10; i++) {
      // Spieler k antwortet nach k Sekunden; gerade Spieler richtig, ungerade falsch, p8 nie.
      for (let k = 0; k < 7; k++) {
        if (k > 0) h.advance(1000);
        const id = ids[k]!;
        answer(h, id, k % 2 === 0 ? correctIndex(h) : wrongIndex(h));
      }
      expect(phase(h)).toBe("question"); // p8 fehlt noch
      h.advance(3000); // Zeit läuft ab (6 s + 3 s … + 1 s Rest)
      h.advance(1000);
      expect(phase(h)).toBe("reveal");
      afterReveal(h);
    }
    expect(phase(h)).toBe("final");
    h.advance(TIMING.finalMs);
    const ranking = h.results!.ranking;
    expect(ranking).toHaveLength(8);
    expect(ranking[0]).toMatchObject({ playerId: "p1", score: 10_000, rank: 1 });
    // p1 (0 s), p3 (2 s), p5 (4 s), p7 (6 s) richtig; Rest 0 Punkte, gemeinsamer Rang 5.
    expect(ranking.map((r) => r.playerId).slice(0, 4)).toEqual(["p1", "p3", "p5", "p7"]);
    expect(ranking[1]!.score).toBe(10 * pointsForCorrect(8000, 10_000));
    for (const r of ranking.slice(4)) expect(r).toMatchObject({ score: 0, rank: 5 });
    for (let i = 1; i < ranking.length; i++) expect(ranking[i - 1]!.score).toBeGreaterThanOrEqual(ranking[i]!.score);
  });

  it("ist deterministisch bei festem Seed", () => {
    const texts = (seed: number) => {
      const h = createTestHarness<QuizTvState, QuizPlayerView>(game, { players: 1, settings: settings5, seed });
      h.advance(TIMING.introMs);
      const s = tv(h);
      return s.phase === "question" ? [s.text, ...s.answers] : [];
    };
    expect(texts(1)).toEqual(texts(1));
    expect(texts(1)).not.toEqual(texts(2));
  });
});

describe("Quiz – Punkte", () => {
  it("Formel: 1000 × (0,5 + 0,5 × Restzeitanteil), gerundet", () => {
    expect(pointsForCorrect(20_000, 20_000)).toBe(1000);
    expect(pointsForCorrect(15_000, 20_000)).toBe(875);
    expect(pointsForCorrect(500, 20_000)).toBe(513); // 512,5 → 513
    expect(pointsForCorrect(0, 20_000)).toBe(500);
    expect(pointsForCorrect(-5, 20_000)).toBe(500);
    expect(pointsForCorrect(99_999, 20_000)).toBe(1000);
  });

  it("Zeitbonus im Spiel nach der virtuellen Uhr; falsch = 0", () => {
    const h = setup(3, settings5);
    toFirstQuestion(h);
    h.advance(5000);
    answer(h, "p1", correctIndex(h)); // 15 s Rest von 20 s
    h.advance(14_500);
    answer(h, "p2", correctIndex(h)); // 0,5 s Rest
    answer(h, "p3", wrongIndex(h));
    expect(phase(h)).toBe("reveal");
    const s = tv(h);
    if (s.phase !== "reveal") throw new Error();
    expect(s.picks).toEqual([
      { playerId: "p1", choice: s.correctIndex, correct: true, points: 875 },
      { playerId: "p2", choice: s.correctIndex, correct: true, points: 513 },
      { playerId: "p3", choice: (s.correctIndex + 1) % 4, correct: false, points: 0 },
    ]);
    expect(s.distribution[s.correctIndex]).toBe(2);
    expect(s.distribution.reduce((a, b) => a + b, 0)).toBe(3);
    expect(view(h, "p1")).toMatchObject({ correct: true, points: 875, score: 875, rank: 1 });
    expect(view(h, "p2")).toMatchObject({ correct: true, points: 513, rank: 2 });
    expect(view(h, "p3")).toMatchObject({ correct: false, points: 0, score: 0, rank: 3 });
    expect(s.players.map((p) => [p.id, p.roundPoints])).toEqual([
      ["p1", 875],
      ["p2", 513],
      ["p3", 0],
    ]);
  });
});

describe("Quiz – Zeitablauf und vorzeitiges Ende", () => {
  it("Timeout: ohne Antworten nach Ablauf Auflösung mit 0 Punkten", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    h.advance(19_999);
    expect(phase(h)).toBe("question");
    h.advance(1);
    expect(phase(h)).toBe("reveal");
    const s = tv(h);
    if (s.phase !== "reveal") throw new Error();
    expect(s.picks.every((p) => p.choice === null && p.points === 0)).toBe(true);
    expect(view(h, "p1")).toMatchObject({ phase: "reveal", choice: null, correct: false, points: 0 });
  });

  it("endet vorzeitig, sobald alle aktiven Spieler geantwortet haben", () => {
    const h = setup(3, settings5);
    toFirstQuestion(h);
    answer(h, "p1", 0);
    answer(h, "p2", 1);
    expect(phase(h)).toBe("question");
    const s = tv(h);
    expect(s.phase === "question" && s.answered).toEqual(["p1", "p2"]);
    answer(h, "p3", 2);
    expect(phase(h)).toBe("reveal");
    // Der ursprüngliche Frage-Timer ist weg: nach revealMs folgt der Zwischenstand, nicht mehr.
    h.advance(TIMING.revealMs);
    expect(phase(h)).toBe("standings");
  });
});

describe("Quiz – ungültige Eingaben", () => {
  it("doppelte Antwort zählt nur einmal", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    const wrong = wrongIndex(h);
    answer(h, "p1", wrong);
    expect(answer(h, "p1", correctIndex(h))).toEqual({ ok: true }); // akzeptiert, aber ignoriert
    expect(view(h, "p1")).toMatchObject({ phase: "question", choice: wrong });
    answer(h, "p2", wrong);
    expect(view(h, "p1")).toMatchObject({ phase: "reveal", choice: wrong, correct: false, score: 0 });
  });

  it("ungültige Daten werden vom Schema abgelehnt", () => {
    const h = setup(1, settings5);
    toFirstQuestion(h);
    for (const bad of [{ type: "answer", index: 4 }, { type: "answer", index: -1 }, { type: "answer", index: 1.5 }, { type: "answer" }, { type: "quatsch" }, "A", null]) {
      expect(h.input("p1", bad), JSON.stringify(bad)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    }
    expect(phase(h)).toBe("question");
  });

  it("Nicht-Teilnehmer dürfen nicht antworten", () => {
    const h = setup(1, settings5);
    toFirstQuestion(h);
    expect(answer(h, "zuschauer", 0)).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
  });

  it("verspätete Antworten (Auflösung, Zwischenstand, Intro) werden ignoriert", () => {
    const h = setup(2, settings5);
    answer(h, "p1", 0); // Intro
    toFirstQuestion(h);
    expect(view(h, "p1")).toMatchObject({ choice: null });
    h.advance(20_000);
    expect(phase(h)).toBe("reveal");
    const before = tv(h);
    for (let i = 0; i < 4; i++) answer(h, "p1", i);
    expect(tv(h)).toEqual(before);
    expect(view(h, "p1")).toMatchObject({ score: 0, choice: null });
    h.advance(TIMING.revealMs);
    expect(phase(h)).toBe("standings");
    answer(h, "p1", 0);
    h.advance(TIMING.standingsMs);
    expect(view(h, "p1")).toMatchObject({ phase: "question", index: 1, choice: null });
  });
});

describe("Quiz – Verbindungsabbruch und Verlassen", () => {
  it("getrennter Spieler blockiert nicht, behält Punkte und spielt nach Rejoin weiter", () => {
    const h = setup(3, settings5);
    toFirstQuestion(h);
    answer(h, "p3", correctIndex(h));
    const p3Score = () => (tv(h).players.find((p) => p.id === "p3")!).score;
    answer(h, "p1", wrongIndex(h));
    answer(h, "p2", wrongIndex(h));
    expect(phase(h)).toBe("reveal");
    const earned = p3Score();
    expect(earned).toBe(1000);
    afterReveal(h);

    h.setConnected("p3", false);
    answer(h, "p1", 0);
    answer(h, "p2", 0);
    expect(phase(h)).toBe("reveal"); // p3 zählt nicht mehr für „alle haben geantwortet“
    expect(p3Score()).toBe(earned);
    afterReveal(h);

    // Weiterhin getrennt: die nächste Frage endet ebenfalls ohne p3
    answer(h, "p1", 0);
    answer(h, "p2", 0);
    expect(phase(h)).toBe("reveal");
    expect(p3Score()).toBe(earned);
  });

  it("Trennung während der Frage löst auf, wenn alle Verbleibenden schon geantwortet haben", () => {
    const h = setup(3, settings5);
    toFirstQuestion(h);
    answer(h, "p1", 0);
    answer(h, "p2", 0);
    expect(phase(h)).toBe("question");
    h.setConnected("p3", false);
    expect(phase(h)).toBe("reveal");
  });

  it("Rejoin: Spieler bekommt aktuelle Ansicht und kann wieder antworten", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    h.setConnected("p2", false);
    answer(h, "p1", 0);
    expect(phase(h)).toBe("reveal");
    afterReveal(h);
    expect(phase(h)).toBe("question");
    h.setConnected("p2", true);
    expect(view(h, "p2")).toMatchObject({ phase: "question", index: 1, choice: null });
    answer(h, "p1", correctIndex(h));
    expect(phase(h)).toBe("question"); // p2 ist wieder relevant
    answer(h, "p2", correctIndex(h));
    expect(phase(h)).toBe("reveal");
    expect(view(h, "p2")).toMatchObject({ correct: true, points: 1000 });
  });

  it("alle getrennt: Frage läuft bis zum Timeout statt durchzurauschen", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    h.setConnected("p1", false);
    h.setConnected("p2", false);
    expect(phase(h)).toBe("question");
    h.advance(20_000);
    expect(phase(h)).toBe("reveal");
  });

  it("Verlassen: Spieler bleibt mit Punkten in der Wertung (markiert)", () => {
    const h = setup(3, settings5);
    toFirstQuestion(h);
    answer(h, "p2", correctIndex(h));
    answer(h, "p1", wrongIndex(h));
    answer(h, "p3", wrongIndex(h));
    afterReveal(h);
    answer(h, "p1", 0);
    answer(h, "p3", 0);
    h.leave("p2");
    expect(phase(h)).toBe("reveal"); // p2 weg → alle Verbleibenden haben geantwortet
    expect(tv(h).players.find((p) => p.id === "p2")).toMatchObject({ left: true, score: 1000 });
    expect(answer(h, "p2", 0)).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
    // Rest durchspielen
    while (phase(h) !== "final") {
      if (phase(h) === "question") h.advance(20_000);
      else afterReveal(h);
    }
    h.advance(TIMING.finalMs);
    const p2 = h.results!.ranking.find((r) => r.playerId === "p2");
    expect(p2).toBeDefined();
    expect(p2!.score).toBeGreaterThanOrEqual(1000);
    const data = h.results!.data as QuizResultData;
    expect(data.players.find((p) => p.id === "p2")).toMatchObject({ left: true });
    expect(data.players.find((p) => p.id === "p1")).toMatchObject({ left: false });
  });

  it("verlassen alle Spieler, endet das Spiel sofort", () => {
    const h = setup(2, settings5);
    toFirstQuestion(h);
    answer(h, "p1", correctIndex(h));
    h.leave("p1");
    expect(h.results).toBeNull();
    h.leave("p2");
    expect(h.results).not.toBeNull();
    expect(h.results!.ranking.map((r) => r.playerId)).toEqual(["p1", "p2"]);
    expect(h.clock.pending).toBe(0);
  });
});

describe("Quiz – Gleichstand", () => {
  it("gleiche Punkte = gleicher Rang (1, 1, 3)", () => {
    const h = setup(3, { rounds: 5, answerSeconds: 10 });
    toFirstQuestion(h);
    for (let i = 0; i < 5; i++) {
      answer(h, "p1", correctIndex(h));
      answer(h, "p2", correctIndex(h));
      answer(h, "p3", wrongIndex(h));
      afterReveal(h);
    }
    expect(view(h, "p1")).toMatchObject({ phase: "final", rank: 1 });
    expect(view(h, "p2")).toMatchObject({ phase: "final", rank: 1 });
    expect(view(h, "p3")).toMatchObject({ phase: "final", rank: 3 });
    h.advance(TIMING.finalMs);
    expect(h.results!.ranking.map((r) => [r.playerId, r.rank])).toEqual([
      ["p1", 1],
      ["p2", 1],
      ["p3", 3],
    ]);
  });

  it("rankScores: Wettkampf-Rangfolge", () => {
    const r = rankScores([
      { id: "a", score: 5, order: 0 },
      { id: "b", score: 9, order: 1 },
      { id: "c", score: 5, order: 2 },
      { id: "d", score: 1, order: 3 },
      { id: "e", score: 9, order: 4 },
    ]);
    expect(r.map((x) => `${x.id}${x.rank}`)).toEqual(["b1", "e1", "a3", "c3", "d5"]);
  });
});

describe("Quiz – kein Spoiler", () => {
  it("TV und Handys erfahren die richtige Antwort erst in der Auflösung", () => {
    const h = setup(4, settings5);
    const leaks = (x: unknown) => /"correct(Index)?"/.test(JSON.stringify(x));
    toFirstQuestion(h);
    for (let i = 0; i < 5; i++) {
      answer(h, "p1", 0);
      answer(h, "p2", 1);
      h.advance(20_000);
      afterReveal(h);
    }
    const checkedTv = h.tvStates.filter((s) => s.phase === "intro" || s.phase === "question");
    expect(checkedTv.length).toBeGreaterThan(5);
    for (const s of checkedTv) expect(leaks(s), JSON.stringify(s)).toBe(false);
    for (const p of h.players) {
      const vs = h.views.get(p.id)!.filter((v) => v.phase === "intro" || v.phase === "question");
      expect(vs.length).toBeGreaterThan(5);
      for (const v of vs) expect(leaks(v), JSON.stringify(v)).toBe(false);
    }
    // In der Auflösung ist sie enthalten
    expect(h.tvStates.some((s) => s.phase === "reveal" && typeof s.correctIndex === "number")).toBe(true);
  });

  it("Antworten werden gemischt: die richtige steht an allen vier Positionen", () => {
    // Über viele Seeds muss die richtige Antwort an allen vier Positionen vorkommen.
    const positions = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const h = createTestHarness<QuizTvState, QuizPlayerView>(game, { players: 1, settings: settings5, seed });
      h.advance(TIMING.introMs);
      positions.add(correctIndex(h));
    }
    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe("Quiz – Einstellungen", () => {
  it("Grenzen der Fragenanzahl (5 und 30) werden eingehalten, ohne Wiederholung", () => {
    for (const rounds of [5, 30]) {
      const h = setup(1, { rounds, answerSeconds: 10, categories: ["sport"] });
      expect(tv(h).total).toBe(rounds);
      const seen = new Set<string>();
      h.advance(TIMING.introMs);
      while (phase(h) !== "final") {
        const s = tv(h);
        if (s.phase === "question") {
          expect(s.category).toBe("sport");
          expect(seen.has(s.text)).toBe(false);
          seen.add(s.text);
          h.advance(10_000);
        } else afterReveal(h);
      }
      expect(seen.size).toBe(rounds);
    }
  });

  it("Antwortzeit-Grenzen (10 s und 30 s) bestimmen den Countdown", () => {
    for (const answerSeconds of [10, 30]) {
      const h = setup(1, { answerSeconds, rounds: 5 });
      h.advance(TIMING.introMs);
      const s = tv(h);
      expect(s.phase === "question" && s.durationMs).toBe(answerSeconds * 1000);
      expect(s.phase === "question" && s.endsAt - h.clock.now()).toBe(answerSeconds * 1000);
    }
  });

  it("ungültige Einstellungen werden abgelehnt", () => {
    const bad: SettingsValues[] = [
      { rounds: 0 },
      { rounds: 35 },
      { rounds: 7 },
      { answerSeconds: 5 },
      { answerSeconds: 35 },
      { answerSeconds: 12 },
      { categories: [] },
      { categories: ["astrologie"] },
      { categories: ["sport", "sport"] },
    ];
    for (const settings of bad) expect(() => setup(1, settings), JSON.stringify(settings)).toThrow();
  });

  it("mischt mehrere Kategorien reihum", () => {
    const h = setup(1, { rounds: 10, categories: ["sport", "essen"], answerSeconds: 10 });
    const cats: string[] = [];
    h.advance(TIMING.introMs);
    while (phase(h) !== "final") {
      const s = tv(h);
      if (s.phase === "question") {
        cats.push(s.category);
        h.advance(10_000);
      } else afterReveal(h);
    }
    expect(cats.filter((c) => c === "sport")).toHaveLength(5);
    expect(cats.filter((c) => c === "essen")).toHaveLength(5);
  });

  it("Revanche bevorzugt Fragen, die in der Vorrunde nicht dran waren", () => {
    const first = drawQuestions(QUESTIONS_BY_CATEGORY, ["technik"], 30, createRng(1));
    const prevIds = first.map((q) => q.id);
    const h = createTestHarness<QuizTvState, QuizPlayerView>(game, {
      players: 1,
      seed: 99,
      settings: { rounds: 10, categories: ["technik"], answerSeconds: 10 },
      previous: { gameId: "quiz", ranking: [], data: { questionIds: prevIds } },
    });
    h.advance(TIMING.introMs);
    while (phase(h) !== "final") {
      const s = tv(h);
      if (s.phase === "question") {
        const q = ALL_QUESTIONS.find((x) => x.text === s.text)!;
        expect(prevIds).not.toContain(q.id);
        h.advance(10_000);
      } else afterReveal(h);
    }
  });
});
