// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { PROMPTS_BY_CATEGORY } from "../src/data/index.js";
import { tallyVotes } from "../src/scoring.js";
import game from "../src/server/index.js";
import { POINTS, TIMING, type WePlayerView, type WeResultData, type WeTvState } from "../src/shared.js";

type H = GameHarness<WeTvState, WePlayerView>;
const SETTINGS: SettingsValues = { categories: ["alltag", "chaos"], rounds: 5, voteSeconds: 20 };
const VOTE_MS = 20_000;
const setup = (players = 4, settings: SettingsValues = SETTINGS, seed = 7): H =>
  createTestHarness<WeTvState, WePlayerView>(game, { players, settings, seed });
const tv = (h: H) => h.lastTv()!;
const phase = (h: H) => tv(h).phase;
const vote = (h: H) => {
  const s = tv(h);
  if (s.phase !== "vote") throw new Error(`Phase ${s.phase}`);
  return s;
};
const reveal = (h: H) => {
  const s = tv(h);
  if (s.phase !== "reveal") throw new Error(`Phase ${s.phase}`);
  return s;
};
const cast = (h: H, voter: string, target: string) => h.input(voter, { type: "vote", target });
/** Mehrere Stimmen: { p1: "p2", … } */
const castAll = (h: H, votes: Record<string, string>) => {
  for (const [voter, target] of Object.entries(votes)) cast(h, voter, target);
};
const score = (h: H, id: string) => tv(h).players.find((p) => p.id === id)!.score;
/** Nach der Auflösung zur nächsten Runde (oder ins Finale). */
const next = (h: H) => {
  h.advance(TIMING.revealMs);
  if (phase(h) === "standings") h.advance(TIMING.standingsMs);
};
const toVote = (h: H): H => {
  h.advance(TIMING.introMs);
  return h;
};

describe("Auszählung (rein)", () => {
  it("Meistgewählte, Gleichstand an der Spitze, Mehrheit; Stimmen für Nicht-Kandidaten zählen nicht", () => {
    const t = tallyVotes(
      ["a", "b", "c", "d"],
      new Map([
        ["a", "b"],
        ["b", "c"],
        ["c", "b"],
        ["d", "c"],
        ["x", "zzz"],
      ]),
    );
    expect(t.counts).toEqual([
      { playerId: "a", votes: 0 },
      { playerId: "b", votes: 2 },
      { playerId: "c", votes: 2 },
      { playerId: "d", votes: 0 },
    ]);
    expect(t.winners).toEqual(["b", "c"]);
    expect(t.maxVotes).toBe(2);
    expect(t.majority).toEqual(["a", "b", "c", "d"]);
    expect(tallyVotes(["a", "b"], new Map())).toMatchObject({ winners: [], maxVotes: 0, majority: [] });
  });
});

describe("Ablauf", () => {
  it("Intro → Abstimmung → Auflösung → Zwischenstand … → Finale → Ergebnis mit Aussage-IDs", () => {
    const h = setup(3);
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    for (let i = 0; i < 5; i++) {
      const s = vote(h);
      expect(s.round).toBe(i);
      expect(s.total).toBe(5);
      expect(s.candidates).toEqual(["p1", "p2", "p3"]);
      const v = h.lastView("p1")!;
      expect(v.phase === "vote" && v.text).toBe(s.text);
      expect(v.phase === "vote" && v.candidates.map((c) => c.name)).toEqual(["Spieler 1", "Spieler 2", "Spieler 3"]);
      h.advance(VOTE_MS);
      expect(reveal(h).winners).toEqual([]);
      h.advance(TIMING.revealMs);
      expect(phase(h)).toBe(i < 4 ? "standings" : "final");
      if (i < 4) h.advance(TIMING.standingsMs);
    }
    h.advance(TIMING.finalMs);
    const data = h.results!.data as WeResultData;
    expect(data.promptIds).toHaveLength(5);
    expect(new Set(data.promptIds).size).toBe(5);
    expect(h.results!.ranking).toHaveLength(3);
  });

  it("Wertung: Stimme an den Meistgewählten +100, Gewählt werden bringt nichts, Nichtabstimmer 0", () => {
    const h = toVote(setup(5));
    // p2 bekommt 3 Stimmen (inkl. Selbstwahl), p1 eine; p5 stimmt nicht ab.
    castAll(h, { p1: "p2", p2: "p2", p3: "p2", p4: "p1" });
    expect(phase(h)).toBe("vote");
    h.advance(VOTE_MS);
    const r = reveal(h);
    expect(r.winners).toEqual(["p2"]);
    expect(r.maxVotes).toBe(3);
    expect(r.counts.find((c) => c.playerId === "p2")!.votes).toBe(3);
    expect(r.majority).toEqual(["p1", "p2", "p3"]);
    expect(r.majorityCount).toBe(3);
    expect(r.voterCount).toBe(4);
    expect([score(h, "p1"), score(h, "p2"), score(h, "p3"), score(h, "p4"), score(h, "p5")]).toEqual([100, 100, 100, 0, 0]);
    const v2 = h.lastView("p2")!;
    expect(v2.phase === "reveal" && [v2.withMajority, v2.points, v2.myVotes, v2.choice?.id]).toEqual([true, POINTS.majority, 3, "p2"]);
    const v5 = h.lastView("p5")!;
    expect(v5.phase === "reveal" && [v5.choice, v5.points, v5.withMajority, v5.myVotes]).toEqual([null, 0, false, 0]);
    const v4 = h.lastView("p4")!;
    expect(v4.phase === "reveal" && [v4.withMajority, v4.points, v4.myVotes]).toEqual([false, 0, 0]);
    const v1 = h.lastView("p1")!;
    expect(v1.phase === "reveal" && v1.myVotes).toBe(1);
  });

  it("Gleichstand an der Spitze: alle Meistgewählten zählen", () => {
    const h = toVote(setup(4));
    castAll(h, { p1: "p2", p2: "p3", p3: "p2", p4: "p3" });
    const r = reveal(h); // alle abgestimmt → sofort
    expect(r.winners).toEqual(["p2", "p3"]);
    expect(r.majority).toEqual(["p1", "p2", "p3", "p4"]);
    expect(h.players.every((p) => score(h, p.id) === 100)).toBe(true);
    const v = h.lastView("p1")!;
    expect(v.phase === "reveal" && v.winners.map((w) => w.id)).toEqual(["p2", "p3"]);
  });

  it("Selbstwahl des Meistgewählten zählt wie jede Stimme", () => {
    const h = toVote(setup(3));
    castAll(h, { p1: "p1", p2: "p1", p3: "p2" });
    const r = reveal(h);
    expect(r.winners).toEqual(["p1"]);
    expect([score(h, "p1"), score(h, "p2"), score(h, "p3")]).toEqual([100, 100, 0]);
  });

  it("Wahl ist fix; Stimmen für Unbekannte und außerhalb der Abstimmung werden ignoriert", () => {
    const h = setup(3);
    expect(cast(h, "p1", "p2").ok).toBe(true); // Intro → ignoriert
    toVote(h);
    expect(vote(h).voted).toEqual([]);
    expect(cast(h, "p1", "nobody").ok).toBe(true);
    expect(vote(h).voted).toEqual([]);
    expect(cast(h, "p1", "p2").ok).toBe(true);
    expect(cast(h, "p1", "p3").ok).toBe(true);
    const v = h.lastView("p1")!;
    expect(v.phase === "vote" && v.choice).toBe("p2");
    expect(vote(h).voted).toEqual(["p1"]);
    expect(h.input("p1", { type: "vote", target: "" }).ok).toBe(false);
    expect(h.input("p1", { type: "vote" }).ok).toBe(false);
    expect(h.input("p1", { type: "boo" }).ok).toBe(false);
  });

  it("Titel im Finale: Aussage mit den meisten Stimmen je Spieler; Ergebnisdaten enthalten sie", () => {
    const h = toVote(setup(3, { ...SETTINGS, rounds: 5 }));
    const texts: string[] = [];
    const plan: Record<string, string>[] = [
      { p1: "p2", p2: "p1", p3: "p3" }, // alle 1 Stimme
      { p1: "p2", p2: "p2", p3: "p2" }, // p2: 3
      { p1: "p1", p2: "p1", p3: "p3" }, // p1: 2
      { p1: "p3", p2: "p3", p3: "p1" }, // p3: 2
      { p1: "p2", p2: "p2", p3: "p2" }, // p2: 3 (gleich viel – frühere bleibt)
    ];
    for (const votes of plan) {
      texts.push(vote(h).text);
      castAll(h, votes);
      next(h);
    }
    const f = tv(h);
    if (f.phase !== "final") throw new Error("final erwartet");
    const title = (id: string) => f.titles.find((x) => x.playerId === id)!.title!;
    expect(title("p2")).toMatchObject({ votes: 3, text: texts[1]!.slice(0, -1) });
    expect(title("p1")).toMatchObject({ votes: 2, text: texts[2]!.slice(0, -1) });
    expect(title("p3")).toMatchObject({ votes: 2, text: texts[3]!.slice(0, -1) });
    const v = h.lastView("p2")!;
    expect(v.phase === "final" && v.title?.votes).toBe(3);
    h.advance(TIMING.finalMs);
    const data = h.results!.data as WeResultData;
    expect(data.players.find((p) => p.id === "p2")!.title!.votes).toBe(3);
    expect(data.promptIds).toHaveLength(5);
  });

  it("ohne Stimmen gibt es keinen Titel", () => {
    const h = toVote(setup(3, { ...SETTINGS, rounds: 5 }));
    for (let i = 0; i < 5; i++) {
      h.advance(VOTE_MS);
      next(h);
    }
    const f = tv(h);
    expect(f.phase === "final" && f.titles.every((x) => x.title === null)).toBe(true);
  });
});

describe("Vorzeitiges Ende, Abgang, Reconnect", () => {
  it("löst auf, sobald alle verbundenen Spieler abgestimmt haben – getrennte zählen nicht", () => {
    const h = toVote(setup(4));
    castAll(h, { p1: "p2", p2: "p1" });
    h.setConnected("p4", false);
    expect(phase(h)).toBe("vote");
    cast(h, "p3", "p1");
    expect(phase(h)).toBe("reveal");
  });

  it("sind alle getrennt, läuft die Abstimmzeit normal ab", () => {
    const h = toVote(setup(3));
    for (const p of h.players) h.setConnected(p.id, false);
    expect(phase(h)).toBe("vote");
    h.advance(VOTE_MS);
    expect(phase(h)).toBe("reveal");
  });

  it("Abgang eines gewählten Spielers: nicht mehr wählbar, Stimmen für ihn und von ihm fallen weg, neu wählen erlaubt", () => {
    const h = toVote(setup(4));
    castAll(h, { p1: "p4", p4: "p1" });
    expect(vote(h).voted).toEqual(["p1", "p4"]);
    h.leave("p4");
    const s = vote(h);
    expect(s.candidates).toEqual(["p1", "p2", "p3"]);
    expect(s.voted).toEqual([]);
    const v1 = h.lastView("p1")!;
    expect(v1.phase === "vote" && v1.choice).toBe(null);
    expect(v1.phase === "vote" && v1.candidates.map((c) => c.id)).toEqual(["p1", "p2", "p3"]);
    expect(cast(h, "p2", "p4").ok).toBe(true); // nicht mehr wählbar → ignoriert
    expect(vote(h).voted).toEqual([]);
    castAll(h, { p1: "p3", p2: "p3", p3: "p1" });
    const r = reveal(h);
    expect(r.counts.map((c) => c.playerId)).toEqual(["p1", "p2", "p3"]);
    expect(r.winners).toEqual(["p3"]);
    expect(r.flights.every((f) => f.voter !== "p4" && f.target !== "p4")).toBe(true);
    expect(tv(h).players.find((p) => p.id === "p4")!.left).toBe(true);
  });

  it("fallen weniger als 2 Spieler übrig, endet das Spiel sauber über das Finale", () => {
    const h = toVote(setup(3));
    h.leave("p3");
    expect(phase(h)).toBe("vote");
    h.leave("p2");
    expect(phase(h)).toBe("final");
    h.advance(TIMING.finalMs);
    expect(h.results).not.toBeNull();
    expect(h.results!.ranking).toHaveLength(3);
    expect(h.crash).toBeNull();
  });

  it("Abgang im Intro mit nur noch einem Spieler: direkt Finale", () => {
    const h = setup(3);
    h.leave("p1");
    h.leave("p2");
    expect(phase(h)).toBe("final");
  });

  it("Reconnect: Spieler bekommt seine Ansicht mit eigener Wahl erneut", () => {
    const h = toVote(setup(3));
    cast(h, "p1", "p3");
    h.setConnected("p1", false);
    const before = h.views.get("p1")!.length;
    h.setConnected("p1", true);
    expect(h.views.get("p1")!.length).toBe(before + 1);
    const v = h.lastView("p1")!;
    expect(v.phase === "vote" && v.choice).toBe("p3");
  });
});

describe("Privatsphäre", () => {
  it("während der Abstimmung: TV kennt nur, wer abgestimmt hat; Handys nur die eigene Wahl", () => {
    const h = toVote(setup(4));
    castAll(h, { p1: "p3", p2: "p4" });
    const s = vote(h);
    expect(s.voted).toEqual(["p1", "p2"]);
    // Kein Ziel taucht im TV-Zustand neben dem Wähler auf.
    expect(JSON.stringify(h.tvStates)).not.toMatch(/"(choice|target|votes|flights|counts)"/);
    const v3 = h.lastView("p3")!;
    expect(v3.phase === "vote" && v3.choice).toBe(null);
    for (const id of ["p3", "p4"]) expect(JSON.stringify(h.views.get(id))).not.toContain('"choice":"p');
    const v1 = h.lastView("p1")!;
    expect(v1.phase === "vote" && v1.choice).toBe("p3");
  });

  it("offen: Auflösung zeigt, wer wen gewählt hat (in zufälliger Reihenfolge)", () => {
    const h = toVote(setup(4, { ...SETTINGS, anonymous: "offen" }));
    castAll(h, { p1: "p3", p2: "p3", p3: "p4", p4: "p3" });
    const r = reveal(h);
    expect(r.anonymous).toBe(false);
    expect([...r.flights].sort((a, b) => a.voter!.localeCompare(b.voter!))).toEqual([
      { voter: "p1", target: "p3" },
      { voter: "p2", target: "p3" },
      { voter: "p3", target: "p4" },
      { voter: "p4", target: "p3" },
    ]);
    expect(r.majority).toEqual(["p1", "p2", "p4"]);
    expect(r.players.find((p) => p.id === "p1")!.roundPoints).toBe(100);
  });

  it("anonym: keine Zuordnung Wähler → Ziel an TV oder fremde Handys, nur Zähler; eigene Wahl bleibt bekannt", () => {
    const h = toVote(setup(4, { ...SETTINGS, anonymous: "anonym" }));
    expect(tv(h).anonymous).toBe(true);
    castAll(h, { p1: "p3", p2: "p3", p3: "p4", p4: "p3" });
    const r = reveal(h);
    expect(r.flights.every((f) => f.voter === null)).toBe(true);
    expect(r.flights.map((f) => f.target).sort()).toEqual(["p3", "p3", "p3", "p4"]);
    expect(r.counts.find((c) => c.playerId === "p3")!.votes).toBe(3);
    expect(r.majority).toBeNull();
    expect(r.majorityCount).toBe(3);
    // Auch Rundenpunkte würden verraten, wer mit der Mehrheit stimmte.
    expect(r.players.every((p) => p.roundPoints === 0)).toBe(true);
    h.advance(TIMING.revealMs);
    expect(tv(h).players.every((p) => p.roundPoints === 0)).toBe(true);
    // Kein TV-Zustand enthält jemals einen Wähler.
    for (const s of h.tvStates) {
      if (s.phase === "reveal") expect(s.flights.some((f) => f.voter !== null)).toBe(false);
      if (s.phase === "reveal") expect(s.majority).toBeNull();
    }
    // Handys: nur die eigene Wahl.
    for (const p of h.players) {
      const views = h.views.get(p.id)!;
      const reveals = views.filter((v): v is Extract<WePlayerView, { phase: "reveal" }> => v.phase === "reveal");
      expect(reveals.length).toBeGreaterThan(0);
      for (const v of reveals) expect(Object.keys(v)).not.toContain("flights");
    }
    const v3 = h.views.get("p3")!.find((v) => v.phase === "reveal")!;
    expect(v3.phase === "reveal" && [v3.choice?.id, v3.myVotes, v3.withMajority]).toEqual(["p4", 3, false]);
  });
});

describe("Überspringbare Wartezeiten", () => {
  it("Auflösung, Zwischenstand und Finale – nie Intro oder Abstimmung", () => {
    const h = setup(3);
    expect(h.skip()).toBe(false); // Intro: Handys melden gerade ihre gesehenen Aussagen
    expect(phase(h)).toBe("intro");
    h.advance(TIMING.introMs);
    expect(phase(h)).toBe("vote");
    expect(h.session.skipId).toBeNull();
    expect(h.skip()).toBe(false);
    castAll(h, { p1: "p2", p2: "p2", p3: "p1" });
    expect(phase(h)).toBe("reveal");
    expect(h.skip()).toBe(true);
    expect(phase(h)).toBe("standings");
    expect(h.skip()).toBe(true);
    expect(vote(h).round).toBe(1);
    // Alte Timer feuern nicht nach.
    h.advance(TIMING.revealMs);
    expect(vote(h).round).toBe(1);
    for (let i = 1; i < 5; i++) {
      h.advance(vote(h).endsAt - h.clock.now());
      expect(phase(h)).toBe("reveal");
      expect(h.skip()).toBe(true);
      if (phase(h) === "standings") expect(h.skip()).toBe(true);
    }
    expect(phase(h)).toBe("final");
    expect(h.results).toBeNull();
    expect(h.skip()).toBe(true);
    expect((h.results!.data as WeResultData).total).toBe(5);
    expect(h.session.skipId).toBeNull();
  });
});

describe("Gedächtnis", () => {
  it("bevorzugt Aussagen, die keiner der Teilnehmer schon hatte", () => {
    const all = PROMPTS_BY_CATEGORY.essen.map((q) => q.id);
    const fresh = new Set(all.slice(-5));
    const known = { ess: all.slice(0, -5).map((id) => Number(id.split("-")[1])) };
    const h = setup(3, { categories: ["essen"], rounds: 5, voteSeconds: 20 });
    h.input("p2", { type: "seen", ids: known });
    toVote(h);
    for (let i = 0; i < 5; i++) {
      const v = h.lastView("p1")!;
      expect(v.phase === "vote" && fresh.has(v.promptId)).toBe(true);
      h.advance(VOTE_MS);
      next(h);
    }
  });

  it("meidet Aussagen der Vorrunde (ctx.previous)", () => {
    const all = PROMPTS_BY_CATEGORY.zukunft.map((q) => q.id);
    const previous = { gameId: "wuerdeeher", ranking: [], data: { promptIds: all.slice(0, -5), total: 0, players: [] } };
    const h = createTestHarness<WeTvState, WePlayerView>(game, {
      players: 3,
      settings: { categories: ["zukunft"], rounds: 5, voteSeconds: 20 },
      previous,
    });
    toVote(h);
    const asked: string[] = [];
    for (let i = 0; i < 5; i++) {
      const v = h.lastView("p1")!;
      if (v.phase !== "vote") throw new Error("vote erwartet");
      asked.push(v.promptId);
      h.advance(VOTE_MS);
      next(h);
    }
    expect(asked.sort()).toEqual(all.slice(-5).sort());
  });
});
