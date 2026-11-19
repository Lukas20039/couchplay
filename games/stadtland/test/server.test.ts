// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
// Die echten Wortlisten werden hier nicht geladen (vi.mock): Standard-Lexikon „nicht prüfbar“, damit die
// Ablauf-Tests unabhängig von den Listen bleiben. Lexikon-Fälle nutzen createStadtlandGame(fake).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it, vi } from "vitest";
import { ANSWER_MAX, LETTERS, SETS, type CategoryId } from "../src/constants.js";
import { answerKey } from "../src/normalize.js";
import game, { createStadtlandGame, type LexiconLookup } from "../src/server/index.js";
import { TIMING, type SlLexicon, type SlPlayerView, type SlResultData, type SlTvState } from "../src/shared.js";

vi.mock("../src/server/lexicon/index.js", () => ({ lookupAnswer: () => null, LEXICON_CATEGORIES: new Set() }));

type H = GameHarness<SlTvState, SlPlayerView>;
const SETTINGS: SettingsValues = { rounds: 3, roundSeconds: 60, categoryCount: 6, set: "klassisch", check: "streng" };
const ROUND_MS = 60_000;

const setup = (players = 3, settings: SettingsValues = SETTINGS, seed = 7, g = game): H =>
  createTestHarness<SlTvState, SlPlayerView>(g, { players, settings: { ...SETTINGS, ...settings }, seed });
const tv = (h: H) => h.lastTv()!;
const phase = (h: H) => tv(h).phase;
const view = (h: H, id: string) => h.lastView(id)!;
const as = <P extends SlTvState["phase"]>(h: H, p: P) => {
  const s = tv(h);
  if (s.phase !== p) throw new Error(`Phase ${s.phase} statt ${p}`);
  return s as Extract<SlTvState, { phase: P }>;
};
const viewAs = <P extends SlPlayerView["phase"]>(h: H, id: string, p: P) => {
  const v = view(h, id);
  if (v.phase !== p) throw new Error(`Phase ${v.phase} statt ${p}`);
  return v as Extract<SlPlayerView, { phase: P }>;
};
/** Bis zur Schreibphase der nächsten Runde. */
const toWrite = (h: H): H => {
  if (phase(h) === "intro") h.advance(TIMING.introMs);
  if (phase(h) === "letter") h.advance(TIMING.letterMs);
  return h;
};
const letterOf = (h: H) => as(h, "write").letter;
const roundOf = (h: H) => tv(h).round;
const send = (h: H, id: string, answers: string[]) => h.input(id, { type: "answers", round: roundOf(h), answers });
/** Gültige Antworten: alle beginnen mit dem Buchstaben, je Spieler verschieden. */
const valid = (h: H, tag: string) => as(h, "write").categories.map((_, i) => `${letterOf(h)}${tag}${"abcdef"[i]}`);
/** Schreibzeit ablaufen lassen und die Gnadenfrist abwarten → Prüfung der ersten Kategorie. */
const toReview = (h: H): H => {
  if (phase(h) === "write") h.advance(as(h, "write").endsAt - h.clock.now());
  if (phase(h) === "timeup") h.advance(TIMING.timeUpMs);
  return h;
};
const challenge = (h: H, id: string, key: string, on = true) =>
  h.input(id, { type: "challenge", round: roundOf(h), category: as(h, "review").index, key, on });
const ready = (h: H, id: string) => h.input(id, { type: "ready", round: roundOf(h), category: as(h, "review").index });
const entry = (h: H, id: string) => as(h, "review").entries.find((e) => e.playerId === id)!;
const score = (h: H, id: string) => tv(h).players.find((p) => p.id === id)!.score;
/** Alle Strings eines JSON-Werts (für Privatsphäre-Prüfungen). */
const strings = (x: unknown): string[] =>
  typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];

describe("Ablauf", () => {
  it("Intro → Buchstabe → Schreiben → Stifte weg → Prüfung je Kategorie → Zwischenstand … → Finale → Ergebnis", () => {
    const h = setup(3);
    expect(phase(h)).toBe("intro");
    expect(as(h, "intro")).toMatchObject({ set: "klassisch", check: "streng", custom: null, categoryCount: 6 });
    h.advance(TIMING.introMs);
    const letters: string[] = [];
    for (let r = 0; r < 3; r++) {
      const l = as(h, "letter");
      expect([l.round, l.total, l.categories.map((c) => c.id)]).toEqual([r, 3, ["stadt", "land", "fluss", "name", "beruf", "tier"]]);
      expect(l.categories.every((c) => c.custom === null)).toBe(true);
      letters.push(l.letter);
      h.advance(TIMING.letterMs);
      expect(as(h, "write").durationMs).toBe(ROUND_MS);
      h.advance(ROUND_MS);
      expect(phase(h)).toBe("timeup");
      h.advance(TIMING.timeUpMs);
      for (let c = 0; c < 6; c++) {
        const rv = as(h, "review");
        expect(rv.index).toBe(c);
        // Niemand hat etwas geschrieben → nichts anzufechten, kurze Prüfung.
        expect(rv.durationMs).toBe(TIMING.reviewEmptyMs);
        expect(rv.entries.map((e) => e.status)).toEqual(["empty", "empty", "empty"]);
        h.advance(TIMING.reviewEmptyMs);
      }
      expect(phase(h)).toBe(r < 2 ? "standings" : "final");
      if (r < 2) h.advance(TIMING.standingsMs);
    }
    expect(as(h, "final").letters).toEqual(letters);
    h.advance(TIMING.finalMs);
    const data = h.results!.data as SlResultData;
    expect(data.letters).toEqual(letters);
    expect(new Set(letters).size).toBe(3);
    for (const l of letters) expect(LETTERS).toContain(l);
    expect(h.results!.ranking).toHaveLength(3);
  });

  it("Settings: Set, Kategorien pro Runde, Rundenzeit", () => {
    const h = toWrite(setup(2, { set: "essen", categoryCount: 5, roundSeconds: 120, rounds: 3 }));
    const w = as(h, "write");
    expect(w.categories).toHaveLength(5);
    for (const c of w.categories) expect(SETS.essen).toContain(c.id);
    expect(w.durationMs).toBe(120_000);
    expect(viewAs(h, "p1", "write").categories).toEqual(w.categories);
  });

  it("7 Runden: kein Buchstabe doppelt; Buchstaben der Vorrunde werden gemieden", () => {
    const h = setup(2, { rounds: 7 }, 3);
    for (let i = 0; i < 2000 && !h.results; i++) if (!h.skip()) h.advance(1_000);
    const first = (h.results!.data as SlResultData).letters;
    expect(first).toHaveLength(7);
    expect(new Set(first).size).toBe(7);
    const again = createTestHarness<SlTvState, SlPlayerView>(game, { players: 2, settings: { ...SETTINGS, rounds: 7 }, seed: 3, previous: h.results });
    for (let i = 0; i < 2000 && !again.results; i++) if (!again.skip()) again.advance(1_000);
    const second = (again.results!.data as SlResultData).letters;
    expect(second.filter((l) => first.includes(l))).toEqual([]);
  });

  it("Handys erfahren den Buchstaben erst nach der Walze", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    const l = as(h, "letter");
    expect(view(h, "p1").phase).toBe("letter");
    expect("letter" in view(h, "p1")).toBe(false);
    h.advance(TIMING.letterMs);
    expect(viewAs(h, "p1", "write").letter).toBe(l.letter);
  });
});

describe("Schreiben", () => {
  it("Antworten werden bereinigt, gekürzt und gespeichert; TV kennt nur die Anzahl ausgefüllter Felder", () => {
    const h = toWrite(setup(3));
    const L = letterOf(h);
    expect(send(h, "p1", [`  ${L}onn  `, "", `${L}${"x".repeat(60)}`]).ok).toBe(true);
    const v = viewAs(h, "p1", "write");
    expect(v.answers).toHaveLength(6);
    expect(v.answers[0]).toBe(`${L}onn`);
    expect([...v.answers[2]!]).toHaveLength(ANSWER_MAX);
    expect(v.answers.slice(3)).toEqual(["", "", ""]);
    expect(as(h, "write").progress).toEqual([
      { playerId: "p1", filled: 2 },
      { playerId: "p2", filled: 0 },
      { playerId: "p3", filled: 0 },
    ]);
    expect(strings(h.tvStates).some((s) => s.includes("onn"))).toBe(false);
    expect(strings(h.views.get("p2")).some((s) => s.includes("onn"))).toBe(false);
  });

  it("Eingaben einer anderen Runde oder Phase werden ignoriert; zu große Eingaben → INVALID_INPUT", () => {
    const h = setup(2);
    h.advance(TIMING.introMs);
    expect(h.input("p1", { type: "answers", round: 0, answers: ["Xyz"] }).ok).toBe(true); // Buchstabenphase
    h.advance(TIMING.letterMs);
    expect(viewAs(h, "p1", "write").answers).toEqual(["", "", "", "", "", ""]);
    expect(h.input("p1", { type: "answers", round: 5, answers: ["Abc"] }).ok).toBe(true);
    expect(viewAs(h, "p1", "write").answers[0]).toBe("");
    expect(h.input("p1", { type: "answers", round: 0, answers: Array(7).fill("a") }).ok).toBe(false);
    expect(h.input("p1", { type: "answers", round: 0, answers: ["a".repeat(121)] }).ok).toBe(false);
    expect(h.input("p1", { type: "nope" }).ok).toBe(false);
  });

  it("Stopp nur mit allen Feldern; danach 5 s Countdown für alle, zweiter Stopp wirkungslos", () => {
    const h = toWrite(setup(3));
    const a = valid(h, "a");
    send(h, "p1", a.slice(0, 5));
    h.input("p1", { type: "stop", round: 0 });
    expect(as(h, "write").stop).toBeNull();
    send(h, "p1", a);
    h.advance(10_000);
    h.input("p1", { type: "stop", round: 0 });
    const w = as(h, "write");
    expect(w.stop).toEqual({ by: "p1", endsAt: h.clock.now() + TIMING.stopMs });
    expect(w.endsAt).toBe(h.clock.now() + TIMING.stopMs);
    expect(viewAs(h, "p1", "write").stop).toEqual({ by: "Spieler 1", mine: true, endsAt: w.endsAt });
    expect(viewAs(h, "p2", "write").stop).toEqual({ by: "Spieler 1", mine: false, endsAt: w.endsAt });
    // Die anderen dürfen weiterschreiben.
    send(h, "p2", valid(h, "b"));
    send(h, "p2", valid(h, "b"));
    h.input("p2", { type: "stop", round: 0 });
    expect(as(h, "write").stop!.by).toBe("p1");
    h.advance(TIMING.stopMs - 1);
    expect(phase(h)).toBe("write");
    h.advance(1);
    expect(as(h, "timeup").stoppedBy).toBe("p1");
  });

  it("Stopp kurz vor Schluss verlängert nicht", () => {
    const h = toWrite(setup(2));
    send(h, "p1", valid(h, "a"));
    h.advance(ROUND_MS - 2_000);
    const end = as(h, "write").endsAt;
    h.input("p1", { type: "stop", round: 0 });
    expect(as(h, "write").endsAt).toBe(end);
    h.advance(2_000);
    expect(phase(h)).toBe("timeup");
  });

  it("„Stifte weg!“ nimmt verspätete Eingaben noch an, die Prüfung nicht mehr", () => {
    const h = toWrite(setup(2));
    const L = letterOf(h);
    h.advance(ROUND_MS);
    expect(phase(h)).toBe("timeup");
    send(h, "p1", [`${L}ingo`]);
    expect(viewAs(h, "p1", "timeup").answers[0]).toBe(`${L}ingo`);
    h.advance(TIMING.timeUpMs);
    send(h, "p1", [`${L}ongo`]);
    expect(entry(h, "p1").text).toBe(`${L}ingo`);
  });
});

describe("Prüfung und Wertung", () => {
  it("klassische Punkte: einzigartig 10, doppelt 5, einzig gültige 20, falscher Buchstabe und leer 0", () => {
    const h = toWrite(setup(3));
    const L = letterOf(h);
    const other = L === "A" ? "B" : "A";
    // Kategorie 0: p1, p2 gleich (normalisiert), p3 anders → 5/5/10
    // Kategorie 1: nur p3 gültig → 20; p1 falscher Buchstabe, p2 leer
    // Kategorie 2: alle verschieden → 10/10/10
    send(h, "p1", [`Der ${L}aum`, `${other}xyz`, `${L}aa`]);
    send(h, "p2", [`${L.toLowerCase()}AUM!`, "", `${L}bb`]);
    send(h, "p3", [`${L}eins`, `${L}solo`, `${L}cc`]);
    toReview(h);
    let rv = as(h, "review");
    expect(rv.durationMs).toBe(TIMING.reviewMs);
    expect(rv.entries.map((e) => [e.status, e.points, e.shared])).toEqual([
      ["ok", 5, true],
      ["ok", 5, true],
      ["ok", 10, false],
    ]);
    h.advance(TIMING.reviewMs);
    rv = as(h, "review");
    expect(rv.entries.map((e) => [e.status, e.points])).toEqual([
      ["letter", 0],
      ["empty", 0],
      ["ok", 20],
    ]);
    h.advance(TIMING.reviewMs);
    expect(as(h, "review").entries.map((e) => e.points)).toEqual([10, 10, 10]);
    // Punkte erst am Ende der Prüfung.
    expect(score(h, "p3")).toBe(0);
    h.advance(TIMING.reviewMs);
    for (let c = 3; c < 6; c++) h.advance(TIMING.reviewEmptyMs);
    const st = as(h, "standings");
    expect(st.players.map((p) => [p.id, p.score, p.roundPoints, p.rank])).toEqual([
      ["p3", 40, 40, 1],
      ["p1", 15, 15, 2],
      ["p2", 15, 15, 2],
    ]);
    expect(viewAs(h, "p3", "standings").roundPoints).toBe(40);
  });

  it("Anfechtung: Mehrheit der anderen streicht, zurücknehmen stellt wieder her, Punkte passen sich live an", () => {
    const h = toWrite(setup(4));
    const L = letterOf(h);
    send(h, "p1", [`${L}eins`]);
    send(h, "p2", [`${L}zwei`]);
    toReview(h);
    const key = entry(h, "p2").key;
    expect([entry(h, "p2").needed, entry(h, "p2").points]).toEqual([2, 10]);
    challenge(h, "p1", key);
    expect([entry(h, "p2").status, entry(h, "p2").votes]).toEqual(["ok", 1]);
    expect(viewAs(h, "p1", "review").entries.find((e) => e.playerId === "p2")!.voted).toBe(true);
    challenge(h, "p3", key);
    expect([entry(h, "p2").status, entry(h, "p2").points]).toEqual(["rejected", 0]);
    // p1 ist jetzt die einzige gültige Antwort.
    expect(entry(h, "p1").points).toBe(20);
    challenge(h, "p3", key, false);
    expect([entry(h, "p2").status, entry(h, "p1").points]).toEqual(["ok", 10]);
  });

  it("nicht anfechtbar: eigene Antwort, gleiche eigene Antwort, ungültige Antworten, falsche Kategorie", () => {
    const h = toWrite(setup(3));
    const L = letterOf(h);
    send(h, "p1", [`${L}gleich`]);
    send(h, "p2", [`${L}gleich`]);
    send(h, "p3", ["?!"]);
    toReview(h);
    const key = entry(h, "p1").key;
    challenge(h, "p1", key);
    challenge(h, "p2", key);
    expect(entry(h, "p1").votes).toBe(0);
    challenge(h, "p1", entry(h, "p3").key);
    expect(entry(h, "p3").votes).toBe(0);
    h.input("p3", { type: "challenge", round: 0, category: 1, key, on: true });
    expect(entry(h, "p1").votes).toBe(0);
    const v1 = viewAs(h, "p1", "review").entries;
    expect(v1.map((e) => [e.playerId, e.mine, e.canVote])).toEqual([
      ["p1", true, false],
      ["p2", false, false],
      ["p3", false, false],
    ]);
    expect(viewAs(h, "p3", "review").entries.map((e) => e.canVote)).toEqual([true, true, false]);
    // p3 allein reicht (einziger Stimmberechtigter → Mehrheit 1) und streicht beide.
    challenge(h, "p3", key);
    expect(as(h, "review").entries.map((e) => e.status)).toEqual(["rejected", "rejected", "short"]);
  });

  it("alle „Passt“ → nächste Kategorie sofort; getrennte Spieler zählen nicht", () => {
    const h = toWrite(setup(3));
    send(h, "p1", valid(h, "a"));
    toReview(h);
    ready(h, "p1");
    ready(h, "p1");
    expect(as(h, "review").ready).toEqual(["p1"]);
    expect(viewAs(h, "p1", "review").ready).toBe(true);
    h.setConnected("p3", false);
    ready(h, "p2");
    expect(as(h, "review").index).toBe(1);
    expect(as(h, "review").ready).toEqual([]);
  });

  it("Finale mit Auszeichnungen; Ergebnisdaten mit Statistik", () => {
    const h = toWrite(setup(2, { rounds: 3 }));
    send(h, "p1", valid(h, "a"));
    h.input("p1", { type: "stop", round: 0 });
    toReview(h);
    challenge(h, "p2", entry(h, "p1").key);
    for (let i = 0; i < 300 && phase(h) !== "final"; i++) if (!h.skip()) h.advance(1_000);
    const f = as(h, "final");
    expect(f.awards.map((a) => [a.kind, a.playerIds, a.count])).toEqual([
      ["solo", ["p1"], 5],
      ["stopper", ["p1"], 1],
      ["judge", ["p2"], 1],
    ]);
    expect(viewAs(h, "p1", "final")).toMatchObject({ solos: 5, valid: 5, awards: ["solo", "stopper"] });
    h.skip();
    const data = h.results!.data as SlResultData;
    expect(data.players[0]).toMatchObject({ id: "p1", score: 100, rank: 1, valid: 5, solos: 5, stops: 1 });
    expect(h.results!.ranking[0]).toEqual({ playerId: "p1", score: 100, rank: 1 });
  });
});

describe("Abgang und Reconnect", () => {
  it("Reconnect: Spieler bekommt seine Antworten erneut; Server sendet die letzte Ansicht", () => {
    const h = toWrite(setup(2));
    const a = valid(h, "a");
    send(h, "p1", a);
    h.setConnected("p1", false);
    const before = h.views.get("p1")!.length;
    h.setConnected("p1", true);
    expect(h.views.get("p1")!.length).toBe(before + 1);
    expect(viewAs(h, "p1", "write").answers).toEqual(a);
    toReview(h);
    challenge(h, "p2", entry(h, "p1").key);
    h.setConnected("p2", false);
    h.setConnected("p2", true);
    expect(viewAs(h, "p2", "review").entries.find((e) => e.playerId === "p1")!.voted).toBe(true);
  });

  it("Abgang in der Prüfung: Antworten und Stimmen fallen weg; mit weniger als 2 Spielern endet das Spiel nach der Runde", () => {
    const h = toWrite(setup(3));
    const L = letterOf(h);
    send(h, "p1", [`${L}gleich`]);
    send(h, "p2", [`${L}gleich`]);
    send(h, "p3", [`${L}drei`]);
    toReview(h);
    challenge(h, "p3", entry(h, "p1").key);
    expect(entry(h, "p1").votes).toBe(1);
    h.leave("p3");
    expect(as(h, "review").entries.map((e) => e.playerId)).toEqual(["p1", "p2"]);
    h.leave("p2");
    expect(as(h, "review").entries.map((e) => [e.playerId, e.points])).toEqual([["p1", 20]]);
    for (let i = 0; i < 20 && phase(h) === "review"; i++) h.skip();
    expect(phase(h)).toBe("final");
    expect(score(h, "p1")).toBe(20);
  });

  it("gehen alle, kommt das Finale", () => {
    const h = toWrite(setup(2));
    h.leave("p1");
    h.leave("p2");
    expect(phase(h)).toBe("final");
  });
});

describe("Lexikon-Prüfung", () => {
  /** Fake-Lexikon: Antworten mit „ok“ am Ende sind bekannt, alles andere unbekannt; jede Kategorie prüfbar. */
  const calls: Array<[CategoryId, string]> = [];
  const fake: LexiconLookup = (category, text): SlLexicon => {
    calls.push([category, text]);
    return answerKey(text).endsWith("ok") ? "known" : "unknown";
  };
  const lexGame = createStadtlandGame(fake);
  const play = (check: string, players = 3) => toWrite(setup(players, { check }, 7, lexGame));

  it("streng: Unbekanntes ist zunächst gestrichen, die Mehrheit der Nicht-Autoren rettet es (👍)", () => {
    const h = play("streng");
    const L = letterOf(h);
    send(h, "p1", [`${L}aok`]);
    send(h, "p2", [`${L}xyz`]);
    toReview(h);
    // Rettungskandidat → normale Prüfdauer.
    expect(as(h, "review").durationMs).toBe(TIMING.reviewMs);
    expect([entry(h, "p1").status, entry(h, "p1").lexicon, entry(h, "p1").points]).toEqual(["ok", "known", 20]);
    expect(entry(h, "p2")).toMatchObject({ status: "unlisted", preset: false, lexicon: "unknown", votes: 0, needed: 2, points: 0 });
    // p1 und p3 dürfen abstimmen, p2 nicht (eigene Antwort).
    expect(viewAs(h, "p1", "review").entries.find((e) => e.playerId === "p2")).toMatchObject({ canVote: true, preset: false });
    expect(viewAs(h, "p2", "review").entries.find((e) => e.playerId === "p2")!.canVote).toBe(false);
    const key = entry(h, "p2").key;
    challenge(h, "p2", key);
    challenge(h, "p1", key);
    expect([entry(h, "p2").status, entry(h, "p2").votes]).toEqual(["unlisted", 1]);
    challenge(h, "p3", key);
    expect(entry(h, "p2")).toMatchObject({ status: "ok", preset: false, votes: 2, points: 10 });
    expect(entry(h, "p1").points).toBe(10);
    // Zurücknehmen streicht wieder.
    challenge(h, "p3", key, false);
    expect(entry(h, "p2").status).toBe("unlisted");
    challenge(h, "p3", key);
    for (let i = 0; i < 6 && phase(h) === "review"; i++) h.skip();
    expect(as(h, "standings").players.map((p) => [p.id, p.score])).toEqual([
      ["p1", 10],
      ["p2", 10],
      ["p3", 0],
    ]);
  });

  it("👍-Rettungen zählen nicht für „Strengste Jury“, 👎 schon", () => {
    const h = play("streng", 2);
    const L = letterOf(h);
    send(h, "p1", [`${L}xyz`, `${L}aok`]);
    toReview(h);
    challenge(h, "p2", entry(h, "p1").key);
    expect(entry(h, "p1").status).toBe("ok");
    h.skip();
    challenge(h, "p2", entry(h, "p1").key);
    expect(entry(h, "p1").status).toBe("rejected");
    for (let i = 0; i < 300 && phase(h) !== "final"; i++) if (!h.skip()) h.advance(1_000);
    expect(as(h, "final").awards.find((a) => a.kind === "judge")).toEqual({ kind: "judge", playerIds: ["p2"], count: 1 });
  });

  it("hinweis: Unbekanntes zählt, ist aber markiert; aus: Lexikon wird gar nicht gefragt", () => {
    const h = play("hinweis");
    const L = letterOf(h);
    send(h, "p1", [`${L}xyz`]);
    toReview(h);
    expect(entry(h, "p1")).toMatchObject({ status: "ok", preset: true, lexicon: "unknown", points: 20 });

    calls.length = 0;
    const off = play("aus");
    send(off, "p1", [`${letterOf(off)}xyz`]);
    toReview(off);
    expect(entry(off, "p1")).toMatchObject({ status: "ok", lexicon: null, points: 20 });
    expect(calls).toEqual([]);
  });

  it("nur automatisch gültige Antworten werden nachgeschlagen (gecacht)", () => {
    calls.length = 0;
    const h = play("streng");
    const L = letterOf(h);
    const other = L === "A" ? "B" : "A";
    send(h, "p1", [`${L}xyz`]);
    send(h, "p2", [`${other}xyz`]);
    toReview(h);
    challenge(h, "p3", entry(h, "p1").key);
    expect(calls).toEqual([["stadt", `${L}xyz`]]);
    expect(entry(h, "p2")).toMatchObject({ status: "letter", lexicon: null });
  });
});

describe("Eigene Kategorien (setup)", () => {
  const CUSTOM: SettingsValues = { set: "eigene" };
  const custom = (h: H, id: string, categories: string[], done = false) => h.input(id, { type: "custom", categories, done });
  const calls: Array<[CategoryId, string]> = [];
  const lexGame = createStadtlandGame((category, text) => {
    calls.push([category, text]);
    return "unknown";
  });

  it("Setup vor dem Intro: Liste live auf TV und Handys, bereinigt; „Los geht’s“ erst ab 3 Einträgen", () => {
    const h = setup(3, CUSTOM);
    expect(as(h, "setup")).toMatchObject({ categories: [], durationMs: TIMING.setupMs });
    expect(viewAs(h, "p2", "setup").categories).toEqual([]);
    expect(custom(h, "p1", ["  Städte ", "Automarken", "automarken!"]).ok).toBe(true);
    expect(as(h, "setup").categories).toEqual(["Städte", "Automarken"]);
    expect(viewAs(h, "p3", "setup").categories).toEqual(["Städte", "Automarken"]);
    // Zu wenige → done wirkungslos.
    custom(h, "p1", ["Städte", "Automarken", ""], true);
    expect(phase(h)).toBe("setup");
    // Zu viele bzw. zu lange Rohtexte → INVALID_INPUT; lange Namen werden gekürzt.
    expect(custom(h, "p1", Array(7).fill("x")).ok).toBe(false);
    expect(custom(h, "p1", ["x".repeat(121)]).ok).toBe(false);
    custom(h, "p1", ["Städte", "Automarken", "Dinge im Bad, die man nie benutzt", "Tiere"]);
    expect(as(h, "setup").categories).toEqual(["Städte", "Automarken", "Dinge im Bad, die man nie be", "Tiere"]);
    // Jeder Spieler darf senden (Server kennt den Host nicht) – nur das Host-Handy zeigt den Editor.
    custom(h, "p2", ["Städte", "Automarken", "Tiere"], true);
    const intro = as(h, "intro");
    expect(intro.categoryCount).toBe(3);
    expect(intro.custom).toEqual([
      { id: "stadt", custom: "Städte" },
      { id: null, custom: "Automarken" },
      { id: "tier", custom: "Tiere" },
    ]);
    // Nach dem Setup ist custom wirkungslos.
    custom(h, "p1", ["A1", "B2", "C3"], true);
    expect(as(h, "intro").custom).toHaveLength(3);
  });

  it("jede Runde spielt alle eigenen Kategorien (categoryCount egal); Lexikon nur für abgebildete", () => {
    calls.length = 0;
    const h = setup(2, { ...CUSTOM, categoryCount: 5, rounds: 3 }, 7, lexGame);
    custom(h, "p1", ["Städte", "Automarken", "Tiere", "Vorname"], true);
    h.skip();
    h.advance(TIMING.letterMs);
    const w = as(h, "write");
    expect(w.categories.map((c) => [c.id, c.custom])).toEqual([
      ["stadt", "Städte"],
      [null, "Automarken"],
      ["tier", "Tiere"],
      ["name", "Vorname"],
    ]);
    expect(viewAs(h, "p1", "write").answers).toHaveLength(4);
    const L = letterOf(h);
    send(h, "p1", [`${L}eins`, `${L}zwei`, `${L}drei`, `${L}vier`]);
    toReview(h);
    expect(entry(h, "p1").status).toBe("unlisted");
    h.skip();
    // „Automarken“ ist nicht prüfbar → gilt wie bisher.
    expect(entry(h, "p1")).toMatchObject({ status: "ok", lexicon: null });
    h.skip();
    h.skip();
    expect(calls).toEqual([
      ["stadt", `${L}eins`],
      ["tier", `${L}drei`],
      ["name", `${L}vier`],
    ]);
    h.skip();
    expect(as(h, "standings").categories).toHaveLength(4);
    h.skip();
    expect(as(h, "letter").categories.map((c) => c.custom)).toEqual(["Städte", "Automarken", "Tiere", "Vorname"]);
  });

  it("Zeit abgelaufen: zuletzt empfangene Liste; nie etwas (oder < 3) → Klassisch; überspringbar", () => {
    const h = setup(2, CUSTOM);
    custom(h, "p1", ["Automarken", "Dinge im Bad", "Ausreden"]);
    h.advance(TIMING.setupMs - 1);
    expect(phase(h)).toBe("setup");
    h.advance(1);
    expect(as(h, "intro").custom!.map((c) => c.custom)).toEqual(["Automarken", "Dinge im Bad", "Ausreden"]);

    const none = setup(2, CUSTOM);
    none.advance(TIMING.setupMs);
    expect(as(none, "intro").custom).toEqual(SETS.klassisch.map((id) => ({ id, custom: null })));

    const few = setup(2, CUSTOM);
    custom(few, "p1", ["Automarken", "Tiere"]);
    expect(few.skip()).toBe(true);
    expect(as(few, "intro").custom!.map((c) => c.id)).toEqual(["stadt", "land", "fluss", "name", "beruf", "tier"]);
  });

  it("Ergebnisdaten enthalten die eigenen Kategorien", () => {
    const h = setup(2, { ...CUSTOM, rounds: 3 });
    custom(h, "p1", ["Automarken", "Dinge im Bad", "Tiere"], true);
    for (let i = 0; i < 2000 && !h.results; i++) if (!h.skip()) h.advance(1_000);
    expect(h.results!.data).toMatchObject({ set: "eigene", check: "streng", custom: ["Automarken", "Dinge im Bad", "Tiere"] });
  });
});

describe("Überspringbare Wartezeiten", () => {
  it("Intro, Prüfung, Zwischenstand, Finale – nie Buchstabe, Schreibzeit oder „Stifte weg!“", () => {
    const h = setup(2);
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("letter");
    expect(h.skip()).toBe(false);
    h.advance(TIMING.letterMs);
    expect(h.skip()).toBe(false);
    expect(phase(h)).toBe("write");
    h.advance(ROUND_MS);
    expect(h.skip()).toBe(false);
    h.advance(TIMING.timeUpMs);
    for (let c = 0; c < 6; c++) {
      expect(as(h, "review").index).toBe(c);
      expect(h.skip()).toBe(true);
    }
    expect(phase(h)).toBe("standings");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("letter");
  });
});
