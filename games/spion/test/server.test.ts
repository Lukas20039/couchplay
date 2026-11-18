// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it } from "vitest";
import { GUESS_OPTIONS, POINTS } from "../src/constants.js";
import { ALL_WORDS, WORDS_BY_CATEGORY } from "../src/data/index.js";
import { normalizeWord } from "../src/normalize.js";
import game, { parseSpSettings, revealDurationMs } from "../src/server/index.js";
import { TIMING, type SpPlayerView, type SpResultData, type SpTvState } from "../src/shared.js";
import {
  CLUE_MS,
  SETTINGS,
  VOTE_MS,
  allAccuse,
  as,
  castVotes,
  giveClues,
  ids,
  keys,
  others,
  phase,
  score,
  setup,
  skipReveal,
  spyOf,
  strings,
  toClues,
  toRole,
  toVote,
  tv,
  view,
  viewAs,
  wordOf,
  type H,
} from "./helpers.js";

const UNDERCOVER = { ...SETTINGS, mode: "undercover" };
const mentions = (x: unknown, text: string) => strings(x).some((s) => normalizeWord(s).includes(normalizeWord(text)));
/** Ein Unschuldiger. */
const innocent = (h: H) => ids(h).find((id) => id !== spyOf(h))!;
/** Bis zur Abstimmung spielen, dann beschuldigen alle `pick(h)`; Auflösung überspringen. */
const accuseAndResolve = (h: H, pick: (h: H) => string): H => {
  toVote(h);
  return skipReveal(allAccuse(h, pick(h)));
};
/** Eine ganze Runde spielen (Spion wird enttarnt und rät nicht) bis zur nächsten Rolle bzw. zum Finale. */
const playRound = (h: H): H => {
  accuseAndResolve(h, spyOf);
  if (phase(h) === "guess") h.advance(TIMING.guessMs);
  if (phase(h) === "result") h.skip();
  return h;
};

describe("Ablauf", () => {
  it("Intro → Rolle → Hinweise → Abstimmung → Auflösung → Raten → Ergebnis … → Finale → Ergebnis mit Wort-IDs", () => {
    const h = setup(4);
    expect(phase(h)).toBe("intro");
    expect(view(h, "p1").secret).toBeNull();
    h.advance(TIMING.introMs);
    for (let r = 0; r < 3; r++) {
      const role = as(h, "role");
      expect([role.round, role.total, role.clueRounds, role.order.length]).toEqual([r, 3, 2, 4]);
      h.advance(TIMING.roleMs);
      // 2 Hinweisrunden × 4 Spieler, alle lassen die Zeit ablaufen.
      for (let i = 0; i < 8; i++) {
        const c = as(h, "clue");
        expect(c.clueRound).toBe(i < 4 ? 0 : 1);
        expect(c.turn).toBe(c.order[i % 4]);
        h.advance(CLUE_MS);
      }
      expect(as(h, "vote").runoff).toBe(false);
      expect(tv(h).players.every((p) => p.clues.length === 2 && p.clues.every((x) => x === null))).toBe(true);
      h.advance(VOTE_MS);
      const rv = as(h, "reveal");
      expect([rv.accused, rv.tie, rv.next, rv.verdict]).toEqual([null, false, "verdict", null]);
      h.advance(revealDurationMs(0, true));
      const res = as(h, "result");
      expect([res.reason, res.winner, res.last]).toEqual(["none", "spy", r === 2]);
      h.advance(TIMING.resultMs);
    }
    expect(phase(h)).toBe("final");
    h.advance(TIMING.finalMs);
    const data = h.results!.data as SpResultData;
    expect(data.wordIds).toHaveLength(3);
    expect(new Set(data.wordIds).size).toBe(3);
    expect(h.results!.ranking).toHaveLength(4);
  });

  it("Settings: Runden 3/5/8, Grenzen geklemmt, Kategorien gefiltert, Modus", () => {
    expect(parseSpSettings({ rounds: "8", clueRounds: 9, clueSeconds: 1, voteSeconds: 999, mode: "undercover", categories: ["tiere", "x"] })).toEqual({
      mode: "undercover",
      categories: ["tiere"],
      rounds: 8,
      clueRounds: 3,
      clueSeconds: 15,
      voteSeconds: 120,
    });
    expect(parseSpSettings({ rounds: "7" })).toMatchObject({ rounds: 5, mode: "klassisch", clueRounds: 2 });
    const h = toRole(setup(3, { ...SETTINGS, categories: ["tiere"], clueRounds: 1 }));
    expect(as(h, "role").category).toBe("tiere");
    expect(as(h, "role").clueRounds).toBe(1);
  });

  it("Rolle endet vorzeitig, sobald alle verbundenen Spieler „Verstanden“ getippt haben", () => {
    const h = toRole(setup(3));
    h.input("p1", { type: "ready" });
    expect(as(h, "role").ready).toEqual(["p1"]);
    expect(viewAs(h, "p1", "role").ready).toBe(true);
    expect(viewAs(h, "p2", "role").ready).toBe(false);
    h.setConnected("p3", false);
    h.input("p2", { type: "ready" });
    expect(phase(h)).toBe("clue");
  });

  it("Startspieler zufällig (ctx.rng), Reihenfolge rotiert die Startreihenfolge", () => {
    const starts = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const h = toRole(setup(4, SETTINGS, seed));
      const order = as(h, "role").order;
      const i = ids(h).indexOf(order[0]!);
      expect(order).toEqual([...ids(h).slice(i), ...ids(h).slice(0, i)]);
      starts.add(order[0]!);
    }
    expect(starts.size).toBeGreaterThan(1);
  });
});

describe("Hinweise", () => {
  it("nur wer dran ist, darf; Hinweis erscheint am TV; Auslassen und Zeitablauf → null", () => {
    const h = toClues(setup(3, { ...SETTINGS, clueRounds: 1 }));
    const [a, b, c] = as(h, "clue").order as [string, string, string];
    expect(viewAs(h, a, "clue").myTurn).toBe(true);
    expect(viewAs(h, b, "clue")).toMatchObject({ myTurn: false, turnsUntil: 1 });
    expect(viewAs(h, c, "clue")).toMatchObject({ myTurn: false, turnsUntil: 2 });
    expect(viewAs(h, b, "clue").turn.id).toBe(a);
    h.input(b, { type: "clue", text: "Vordrängler" });
    expect(as(h, "clue").turn).toBe(a);
    h.input(a, { type: "clue", text: "  Sonnig  " });
    expect(tv(h).players.find((p) => p.id === a)!.clues).toEqual(["Sonnig"]);
    expect(as(h, "clue").turn).toBe(b);
    expect(viewAs(h, a, "clue")).toMatchObject({ turnsUntil: null, myClues: ["Sonnig"] });
    h.input(b, { type: "pass" });
    expect(tv(h).players.find((p) => p.id === b)!.clues).toEqual([null]);
    h.advance(CLUE_MS);
    expect(tv(h).players.find((p) => p.id === c)!.clues).toEqual([null]);
    expect(phase(h)).toBe("vote");
  });

  it("lehnt Hinweise ab, die das eigene Wort verraten (normalisiert) – nur der Absender erfährt es", () => {
    const h = toClues(setup(4));
    const word = wordOf(h);
    const spy = spyOf(h);
    // Bis ein Nicht-Spion dran ist.
    while (as(h, "clue").turn === spy) h.input(spy, { type: "pass" });
    const me = as(h, "clue").turn;
    for (const bad of [word.toUpperCase(), `${word.replace(/\s+/g, "")}s`]) {
      expect(h.input(me, { type: "clue", text: bad }).ok).toBe(true);
      expect(viewAs(h, me, "clue").rejected).toBe(true);
      expect(as(h, "clue").turn).toBe(me);
    }
    expect(viewAs(h, others(h, me)[0]!, "clue").rejected).toBe(false);
    expect(mentions(h.tvStates, word)).toBe(false);
    h.input(me, { type: "clue", text: "Quietscheente" });
    expect(as(h, "clue").turn).not.toBe(me);
  });

  it("ungültige Hinweise (mehrere Wörter, zu lang, leer) → INVALID_INPUT", () => {
    const h = toClues(setup(3));
    const me = as(h, "clue").turn;
    expect(h.input(me, { type: "clue", text: "zwei Wörter" }).ok).toBe(false);
    expect(h.input(me, { type: "clue", text: "x".repeat(25) }).ok).toBe(false);
    expect(h.input(me, { type: "clue", text: "  " }).ok).toBe(false);
    expect(h.input(me, { type: "vote", target: "p2" }).ok).toBe(true); // falsche Phase → ignoriert
    expect(as(h, "clue").turn).toBe(me);
  });

  it("Undercover: auch der Spion darf sein (anderes) Wort nicht verraten, das echte Wort aber nennen", () => {
    const h = toClues(setup(4, UNDERCOVER, 3));
    const spy = spyOf(h);
    const word = wordOf(h);
    const mine = viewAs(h, spy, "clue").secret;
    if (!mine || mine.kind !== "word") throw new Error("Undercover-Spion braucht ein Wort");
    expect(normalizeWord(mine.word)).not.toBe(normalizeWord(word));
    while (as(h, "clue").turn !== spy) h.input(as(h, "clue").turn, { type: "pass" });
    h.input(spy, { type: "clue", text: mine.word.replace(/\s+/g, "") });
    expect(viewAs(h, spy, "clue").rejected).toBe(true);
    // Das Wort der anderen ist für ihn nicht gesperrt (eine Ablehnung würde es ihm verraten).
    h.input(spy, { type: "clue", text: word.replace(/\s+/g, "") });
    expect(tv(h).players.find((p) => p.id === spy)!.clues).toHaveLength(1);
  });
});

describe("Geheimhaltung", () => {
  it("TV kennt bis zum Ergebnis weder Wort noch Spion; Handys nur das eigene Geheimnis", () => {
    const h = setup(5, SETTINGS, 11);
    toVote(h);
    const word = wordOf(h);
    const spy = spyOf(h);
    allAccuse(h, spy);
    h.advance(voteScheduleDone(h));
    const before = h.tvStates.filter((s) => s.phase !== "result" && s.phase !== "guess");
    for (const s of before) {
      expect(mentions(s, word), s.phase).toBe(false);
      if (s.phase !== "reveal" || s.verdict === null) expect(keys(s), s.phase).not.toContain("spyId");
    }
    // Erst das Urteil nennt den Spion.
    const verdict = as(h, "reveal").verdict!;
    expect(verdict).toEqual({ spyId: spy, caught: true });
    // Beim Raten: acht Wörter, das richtige ohne Markierung.
    h.skip();
    const g = as(h, "guess");
    expect(g.options).toHaveLength(GUESS_OPTIONS);
    expect(g.options).toContain(word);
    expect(keys(g)).not.toContain("word");
    for (const id of ids(h)) {
      const views = h.views.get(id)!.filter((v) => v.phase !== "result" && v.phase !== "guess");
      for (const v of views) {
        expect(keys(v)).not.toContain("wordId");
        expect(keys(v)).not.toContain("spy");
        if (id === spy) expect(mentions(v, word), `${id} ${v.phase}`).toBe(false);
        else if (v.secret) expect(v.secret).toEqual({ kind: "word", category: g.category, word });
      }
    }
    expect(view(h, spy).secret).toEqual({ kind: "spy", category: g.category });
  });

  it("Undercover: Ansicht des Spions sieht aus wie jede andere – nur mit ähnlichem Wort", () => {
    const h = toClues(setup(4, UNDERCOVER, 5));
    const spy = spyOf(h);
    const word = wordOf(h);
    const entry = ALL_WORDS.find((w) => w.word === word)!;
    const sv = viewAs(h, spy, "clue");
    const ov = viewAs(h, others(h, spy)[0]!, "clue");
    expect(sv.secret?.kind).toBe("word");
    expect(entry.undercover).toContain(sv.secret?.kind === "word" ? sv.secret.word : "");
    expect(keys(sv).sort()).toEqual(keys(ov).sort());
    expect(mentions(h.views.get(spy), word)).toBe(false);
    expect(mentions(h.tvStates, word)).toBe(false);
    expect(mentions(h.tvStates, sv.secret?.kind === "word" ? sv.secret.word : "")).toBe(false);
  });

  it("Wort-ID und Wörter erst im Rundenergebnis (für das Gedächtnis gegen Wiederholung)", () => {
    const h = setup(3);
    accuseAndResolve(h, innocent);
    const r = as(h, "result");
    const v = viewAs(h, "p1", "result");
    expect(ALL_WORDS.find((w) => w.id === v.wordId)!.word).toBe(r.word);
    expect(r.spyWord).toBeNull();
  });
});

/** Dauer des Auszählens (bis zum Urteil) der aktuellen Auflösung. */
function voteScheduleDone(h: H): number {
  const s = as(h, "reveal");
  return revealDurationMs(s.flights.length, false);
}

describe("Abstimmung, Auflösung und Wertung", () => {
  it("nicht sich selbst, nur Kandidaten, Wahl fix; TV kennt nur, WER abgestimmt hat", () => {
    const h = toVote(setup(4));
    h.input("p1", { type: "vote", target: "p1" });
    h.input("p1", { type: "vote", target: "zz" });
    expect(as(h, "vote").voted).toEqual([]);
    h.input("p1", { type: "vote", target: "p2" });
    h.input("p1", { type: "vote", target: "p3" });
    expect(as(h, "vote").voted).toEqual(["p1"]);
    expect(viewAs(h, "p1", "vote").choice).toBe("p2");
    expect(viewAs(h, "p1", "vote").candidates.map((c) => c.id)).toEqual(["p2", "p3", "p4"]);
    expect(viewAs(h, "p2", "vote").choice).toBeNull();
    expect(JSON.stringify(as(h, "vote"))).not.toMatch(/"(choice|target|flights|counts)"/);
  });

  it("Spion enttarnt → Raten (klassisch); falsch geraten → Gruppe +100, richtige Verdächtiger +50", () => {
    const h = setup(4, SETTINGS, 21);
    toVote(h);
    const spy = spyOf(h);
    const word = wordOf(h);
    const [x] = others(h, spy) as [string];
    // Alle außer x tippen auf den Spion, x auf einen anderen.
    for (const id of ids(h)) h.input(id, { type: "vote", target: id === spy ? x : id === x ? others(h, x).find((o) => o !== spy)! : spy });
    const rv = as(h, "reveal");
    expect([rv.accused, rv.next, rv.verdict]).toEqual([spy, "verdict", null]);
    expect(rv.flights).toHaveLength(4);
    h.advance(voteScheduleDone(h));
    expect(as(h, "reveal").verdict).toEqual({ spyId: spy, caught: true });
    h.advance(TIMING.verdictMs);
    const g = as(h, "guess");
    expect(viewAs(h, spy, "guess")).toMatchObject({ canGuess: true, options: g.options });
    expect(viewAs(h, x, "guess").canGuess).toBe(false);
    expect(h.skip()).toBe(false); // Raten ist keine Wartezeit
    expect(h.input(x, { type: "guess", index: 0 }).ok).toBe(true); // nicht der Spion → ignoriert
    expect(phase(h)).toBe("guess");
    h.input(spy, { type: "guess", index: g.options.findIndex((o) => o !== word) });
    const r = as(h, "result");
    expect([r.reason, r.winner, r.spyId, r.word]).toEqual(["caught", "group", spy, word]);
    expect(r.guess).not.toBe(word);
    expect([...r.correctVoters].sort()).toEqual(others(h, spy).filter((o) => o !== x).sort());
    for (const id of others(h, spy)) expect(score(h, id)).toBe(POINTS.groupWin + (id === x ? 0 : POINTS.correctVote));
    expect(score(h, spy)).toBe(0);
    expect(viewAs(h, x, "result")).toMatchObject({ won: true, votedRight: false, points: POINTS.groupWin, wasSpy: false });
    expect(viewAs(h, spy, "result")).toMatchObject({ won: false, wasSpy: true, points: 0 });
  });

  it("Spion errät das Wort → Spion gewinnt trotzdem (+250), richtige Verdächtiger behalten ihren Bonus", () => {
    const h = setup(3);
    accuseAndResolve(h, spyOf);
    const spy = as(h, "guess").spyId;
    const word = wordOf(h);
    h.input(spy, { type: "guess", index: as(h, "guess").options.indexOf(word) });
    const r = as(h, "result");
    expect([r.reason, r.winner, r.guess]).toEqual(["guessed", "spy", word]);
    expect(score(h, spy)).toBe(POINTS.spyGuess);
    for (const id of others(h, spy)) expect(score(h, id)).toBe(POINTS.correctVote);
    expect(viewAs(h, spy, "result").won).toBe(true);
  });

  it("Raten ohne Wahl in der Zeit → Gruppe gewinnt", () => {
    const h = setup(3);
    accuseAndResolve(h, spyOf);
    h.advance(TIMING.guessMs);
    expect(as(h, "result")).toMatchObject({ reason: "caught", winner: "group", guess: null });
  });

  it("falscher Verdacht → Urteil zeigt den echten Spion, Spion +300", () => {
    const h = setup(4, SETTINGS, 2);
    toVote(h);
    const spy = spyOf(h);
    const wrong = innocent(h);
    allAccuse(h, wrong);
    h.advance(voteScheduleDone(h));
    expect(as(h, "reveal").verdict).toEqual({ spyId: spy, caught: false });
    h.advance(TIMING.verdictMs);
    expect(as(h, "result")).toMatchObject({ reason: "wrong", winner: "spy", correctVoters: [] });
    expect(score(h, spy)).toBe(POINTS.spyEscape);
    for (const id of others(h, spy)) expect(score(h, id)).toBe(0);
  });

  it("Gleichstand → Stichwahl nur zwischen den Gleichplatzierten; entscheidet sie, geht es normal weiter", () => {
    const h = setup(4, SETTINGS, 9);
    toVote(h);
    const spy = spyOf(h);
    const [a, b, c] = others(h, spy) as [string, string, string];
    // spy 2 Stimmen, a 2 Stimmen → Gleichstand
    castVotes(h, { [a]: spy, [b]: spy, [spy]: a, [c]: a });
    const rv = as(h, "reveal");
    expect([rv.accused, rv.tie, rv.next]).toEqual([null, true, "runoff"]);
    expect(h.skip()).toBe(true);
    const ro = as(h, "vote");
    expect([ro.runoff, [...ro.candidates].sort()]).toEqual([true, [a, spy].sort()]);
    expect(viewAs(h, a, "vote")).toMatchObject({ runoff: true, inRunoff: true });
    expect(viewAs(h, a, "vote").candidates.map((x) => x.id)).toEqual([spy]);
    expect(viewAs(h, b, "vote").inRunoff).toBe(false);
    h.input(b, { type: "vote", target: c }); // kein Kandidat → ignoriert
    expect(ro.voted).toEqual([]);
    castVotes(h, { [a]: spy, [b]: spy, [c]: spy, [spy]: a });
    const rv2 = as(h, "reveal");
    expect([rv2.runoff, rv2.accused, rv2.next]).toEqual([true, spy, "verdict"]);
    h.skip();
    expect(phase(h)).toBe("guess");
    h.advance(TIMING.guessMs);
    // Bonus zählt aus der entscheidenden Abstimmung (Stichwahl).
    expect([...as(h, "result").correctVoters].sort()).toEqual([a, b, c].sort());
  });

  it("Gleichstand auch in der Stichwahl → der Spion entkommt", () => {
    const h = setup(4, SETTINGS, 9);
    toVote(h);
    const spy = spyOf(h);
    const [a, b, c] = others(h, spy) as [string, string, string];
    castVotes(h, { [a]: spy, [b]: spy, [spy]: a, [c]: a });
    h.skip();
    castVotes(h, { [a]: spy, [b]: spy, [spy]: a, [c]: a });
    const rv = as(h, "reveal");
    expect([rv.tie, rv.accused, rv.next]).toEqual([true, null, "verdict"]);
    h.advance(revealDurationMs(rv.flights.length, false));
    expect(as(h, "reveal").verdict).toEqual({ spyId: spy, caught: false });
    h.skip();
    expect(as(h, "result")).toMatchObject({ reason: "tie", winner: "spy" });
    expect(score(h, spy)).toBe(POINTS.spyEscape);
    expect(score(h, a)).toBe(POINTS.correctVote);
  });

  it("Undercover: enttarnter Spion rät nicht – die Gruppe gewinnt direkt", () => {
    const h = setup(4, UNDERCOVER, 5);
    toVote(h);
    const spy = spyOf(h);
    const sw = viewAs(h, spy, "vote").secret;
    accuseAndResolve(h, () => spy);
    const r = as(h, "result");
    expect([r.reason, r.winner, r.spyWord]).toEqual(["caught", "group", sw?.kind === "word" ? sw.word : "?"]);
    expect(viewAs(h, spy, "result")).toMatchObject({ wasSpy: true, won: false, spyWord: r.spyWord });
  });
});

describe("Spion und Wörter ohne Wiederholung", () => {
  it("5 Runden mit 5 Spielern: jeder ist genau einmal Spion; keine Wörter doppelt", () => {
    const h = setup(5, { ...SETTINGS, rounds: "5" }, 13);
    const spies: string[] = [];
    const words: string[] = [];
    toRole(h);
    for (let r = 0; r < 5; r++) {
      spies.push(spyOf(h));
      words.push(wordOf(h));
      playRound(h);
    }
    expect(phase(h)).toBe("final");
    expect([...spies].sort()).toEqual(ids(h));
    expect(new Set(words).size).toBe(5);
  });

  it("8 Runden mit 3 Spielern: gleichmäßig verteilt, nie zweimal hintereinander derselbe", () => {
    const h = setup(3, { ...SETTINGS, rounds: "8", clueRounds: 1 }, 17);
    const spies: string[] = [];
    toRole(h);
    for (let r = 0; r < 8; r++) {
      spies.push(spyOf(h));
      playRound(h);
    }
    const counts = ids(h).map((id) => spies.filter((s) => s === id).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    for (let i = 1; i < spies.length; i++) expect(spies[i]).not.toBe(spies[i - 1]);
  });

  it("gemeldete (seen) Wörter werden gemieden, ebenso die der Vorrunde", () => {
    const cat = WORDS_BY_CATEGORY.tiere;
    const settings = { ...SETTINGS, categories: ["tiere"] };
    // Alle bis auf die letzten drei schon gesehen → eines der drei frischen kommt dran.
    const seen = cat.slice(0, -3).map((w) => Number(w.id.slice(4)));
    const h = setup(3, settings, 4);
    h.input("p1", { type: "seen", ids: { tie: seen } });
    toRole(h);
    expect(cat.slice(-3).map((w) => w.word)).toContain(wordOf(h));
    // Zusätzlich war das letzte in der Vorrunde dran → nur noch die beiden anderen.
    const previous = { gameId: "spion", ranking: [], data: { wordIds: [cat.at(-1)!.id] } };
    for (let seed = 1; seed <= 6; seed++) {
      const hp = createTestHarness<SpTvState, SpPlayerView>(game, { players: 3, settings, seed, previous });
      hp.input("p2", { type: "seen", ids: { tie: seen } });
      toRole(hp);
      expect(cat.slice(-3, -1).map((w) => w.word)).toContain(wordOf(hp));
    }
  });
});

describe("Reconnect und Verlassen", () => {
  it("nach Reconnect sieht das Handy sofort wieder seine Rolle und den Stand", () => {
    const h = toClues(setup(4));
    const spy = spyOf(h);
    const me = others(h, spy)[0]!;
    const before = viewAs(h, me, "clue");
    h.setConnected(me, false);
    const n = h.views.get(me)!.length;
    h.setConnected(me, true);
    expect(h.views.get(me)!.length).toBe(n + 1);
    const after = viewAs(h, me, "clue");
    expect(after.secret).toEqual(before.secret);
    expect(after.turn).toEqual(before.turn);
    h.setConnected(spy, false);
    h.setConnected(spy, true);
    expect(view(h, spy).secret?.kind).toBe("spy");
  });

  it("Abstimmung endet vorzeitig, wenn alle verbundenen Spieler gewählt haben", () => {
    const h = toVote(setup(4));
    h.setConnected("p4", false);
    castVotes(h, { p1: "p2", p2: "p3", p3: "p2" });
    expect(phase(h)).toBe("reveal");
  });

  it("Spion verlässt das Spiel → Runde ohne Wertung, danach nächste Runde", () => {
    const h = setup(4);
    toClues(h);
    const spy = spyOf(h);
    h.leave(spy);
    const r = as(h, "result");
    expect([r.reason, r.winner]).toEqual(["left", "none"]);
    expect(tv(h).players.every((p) => p.roundPoints === 0)).toBe(true);
    h.skip();
    expect(phase(h)).toBe("role");
    expect(spyOf(h)).not.toBe(spy);
  });

  it("wer dran ist und geht, wird übersprungen; unter 3 Spielern endet das Spiel", () => {
    const h = toClues(setup(4));
    const spy = spyOf(h);
    while (as(h, "clue").turn === spy) h.input(spy, { type: "pass" });
    const me = as(h, "clue").turn;
    h.leave(me);
    expect(phase(h)).toBe("clue");
    expect(as(h, "clue").turn).not.toBe(me);
    h.leave(others(h, spy)[0]!);
    expect(phase(h)).toBe("final");
  });

  it("Verdächtiger geht während der Abstimmung → wer ihn gewählt hat, darf neu wählen", () => {
    const h = toVote(setup(5));
    castVotes(h, { p1: "p5", p2: "p5" });
    h.leave("p5");
    expect(as(h, "vote").voted).toEqual([]);
    expect(viewAs(h, "p1", "vote")).toMatchObject({ choice: null });
    expect(viewAs(h, "p1", "vote").candidates.map((c) => c.id)).not.toContain("p5");
  });
});

describe("Überspringbare Wartezeiten", () => {
  it("Auflösung, Ergebnis und Finale – nie Intro, Rolle, Hinweise, Abstimmung oder Raten", () => {
    const h = setup(3);
    expect(h.skip()).toBe(false);
    toRole(h);
    expect(h.skip()).toBe(false);
    toClues(h);
    expect(h.skip()).toBe(false);
    giveClues(h);
    expect(h.skip()).toBe(false);
    allAccuse(h, innocent(h));
    expect(phase(h)).toBe("reveal");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("result");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("role");
  });

  it("Finale mit Auszeichnungen und Ergebnisdaten", () => {
    const h = setup(3, SETTINGS, 8);
    toRole(h);
    for (let r = 0; r < 3; r++) playRound(h);
    const f = as(h, "final") as Extract<SpTvState, { phase: "final" }>;
    expect(f.awards.find((a) => a.kind === "detective")?.count).toBeGreaterThan(0);
    const fv = view(h, "p1") as Extract<SpPlayerView, { phase: "final" }>;
    expect(fv.phase).toBe("final");
    h.skip();
    const data = h.results!.data as SpResultData;
    expect(data.players.reduce((n, p) => n + p.correctVotes, 0)).toBeGreaterThan(0);
    expect(h.results!.ranking[0]!.rank).toBe(1);
  });
});
