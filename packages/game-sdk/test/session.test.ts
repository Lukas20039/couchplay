import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ManualClock, createRng, defineGame, type GameContext } from "../src/index.js";
import { createTestHarness, makePlayers } from "../src/testing.js";

const manifest = {
  id: "zaehler",
  name: "Zähler",
  description: "Testspiel",
  version: "1.0.0",
  minPlayers: 1,
  maxPlayers: 4,
  botSupport: false,
  settings: [{ type: "number", key: "target", label: "Ziel", min: 1, max: 10, default: 3 }],
};

type Tv = { counts: Record<string, number>; endsAt: number; ticks: number; previousWins: number };

/** Kleines Testspiel: Wer zuerst `target`-mal klickt, gewinnt; Zeitlimit 10 s. */
const counterGame = defineGame<{ target: number }, { type: "click" } | { type: "boom" }, Tv, { mine: number }>({
  manifest,
  inputSchema: z.discriminatedUnion("type", [z.object({ type: z.literal("click") }), z.object({ type: z.literal("boom") })]),
  parseSettings: (v) => ({ target: v.target as number }),
  tickIntervalMs: 1000,
  createGame(ctx: GameContext<{ target: number }, Tv, { mine: number }>) {
    const counts: Record<string, number> = Object.fromEntries(ctx.players.map((p) => [p.id, 0]));
    let ticks = 0;
    const previousWins = (ctx.previous?.data as { wins?: number } | undefined)?.wins ?? 0;
    const finish = (): void => {
      const ranking = ctx
        .activePlayerIds()
        .map((id) => ({ playerId: id, score: counts[id] ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .map((e, i) => ({ ...e, rank: i + 1 }));
      ctx.end({ ranking, data: { wins: previousWins + 1 } });
    };
    const { endsAt } = ctx.timers.countdown(10_000, finish);
    const publish = (): void => {
      ctx.broadcastTv({ counts, endsAt, ticks, previousWins });
      ctx.sendToAllPlayers((p) => ({ mine: counts[p.id] ?? 0 }));
    };
    publish();
    return {
      onPlayerInput(playerId, input) {
        if (input.type === "boom") throw new Error("Bug im Spiel");
        counts[playerId] = (counts[playerId] ?? 0) + 1;
        publish();
        if ((counts[playerId] ?? 0) >= ctx.settings.target) finish();
      },
      onPlayerLeave() {
        if (ctx.activePlayerIds().length === 0) ctx.end({ ranking: [] });
        else publish();
      },
      tick() {
        ticks++;
      },
    };
  },
});

describe("defineGame", () => {
  it("validiert das Manifest", () => {
    expect(() => defineGame({ ...counterGame, manifest: { ...manifest, maxPlayers: 99 } })).toThrow();
  });

  it("lehnt ungültige Default-Settings ab", () => {
    const broken = { ...manifest, settings: [{ type: "number", key: "x", label: "X", min: 1, max: 2, default: 5 }] };
    expect(() => defineGame({ ...counterGame, manifest: broken })).toThrow(/Default-Settings/);
  });
});

describe("GameSession über Test-Harness", () => {
  it("verteilt TV-Zustand und private Ansichten", () => {
    const h = createTestHarness<Tv, { mine: number }>(counterGame, { players: 2 });
    expect(h.lastTv()?.counts).toEqual({ p1: 0, p2: 0 });
    h.input("p1", { type: "click" });
    expect(h.lastView("p1")).toEqual({ mine: 1 });
    expect(h.lastView("p2")).toEqual({ mine: 0 });
  });

  it("validiert Eingaben und Teilnehmer", () => {
    const h = createTestHarness(counterGame, { players: 1 });
    expect(h.input("p1", { type: "jump" })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(h.input("fremd", { type: "click" })).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
  });

  it("beendet mit Ergebnis und ignoriert danach alles", () => {
    const h = createTestHarness(counterGame, { players: 2, settings: { target: 2 } });
    h.input("p2", { type: "click" });
    h.input("p2", { type: "click" });
    expect(h.results).toEqual({
      gameId: "zaehler",
      ranking: [
        { playerId: "p2", score: 2, rank: 1 },
        { playerId: "p1", score: 0, rank: 2 },
      ],
      data: { wins: 1 },
    });
    const sent = h.tvStates.length;
    expect(h.input("p1", { type: "click" })).toMatchObject({ ok: false, code: "INVALID_PHASE" });
    h.advance(60_000);
    expect(h.tvStates.length).toBe(sent);
    expect(h.clock.pending).toBe(0);
  });

  it("feuert Countdown und Ticks über die virtuelle Uhr", () => {
    const h = createTestHarness<Tv>(counterGame, { players: 1 });
    expect(h.lastTv()?.endsAt).toBe(h.clock.now() + 10_000);
    h.advance(9_999);
    expect(h.results).toBeNull();
    h.advance(1);
    expect(h.results?.ranking).toEqual([{ playerId: "p1", score: 0, rank: 1 }]);
  });

  it("zählt Ticks", () => {
    const h = createTestHarness<Tv>(counterGame, { players: 1 });
    h.advance(3_000);
    h.input("p1", { type: "click" });
    expect(h.lastTv()?.ticks).toBe(3);
  });

  it("meldet onPlayerLeave und filtert Sendungen an Ausgeschiedene", () => {
    const h = createTestHarness(counterGame, { players: 2 });
    h.leave("p2");
    const before = h.views.get("p2")?.length;
    h.input("p1", { type: "click" });
    expect(h.views.get("p2")?.length).toBe(before);
    expect(h.input("p2", { type: "click" })).toMatchObject({ ok: false, code: "NOT_ALLOWED" });
    h.leave("p1");
    expect(h.results).toEqual({ gameId: "zaehler", ranking: [] });
  });

  it("fängt Exceptions im Spielcode ab", () => {
    const h = createTestHarness(counterGame, { players: 1 });
    h.input("p1", { type: "boom" });
    expect(h.crash).toBeInstanceOf(Error);
    expect(h.session.ended).toBe(true);
    expect(h.clock.pending).toBe(0);
  });

  it("reicht previous (Revanche) durch", () => {
    const h = createTestHarness<Tv>(counterGame, {
      players: 1,
      previous: { gameId: "zaehler", ranking: [], data: { wins: 4 } },
    });
    expect(h.lastTv()?.previousWins).toBe(4);
  });

  it("abort räumt Timer auf ohne Ergebnis", () => {
    const h = createTestHarness(counterGame, { players: 1 });
    h.session.abort();
    expect(h.clock.pending).toBe(0);
    expect(h.results).toBeNull();
  });

  it("ist mit gleichem Seed deterministisch", () => {
    const a = createTestHarness(counterGame, { players: makePlayers(3), seed: 7 });
    const b = createTestHarness(counterGame, { players: makePlayers(3), seed: 7 });
    expect(a.session.seed).toBe(b.session.seed);
  });
});

describe("Rng", () => {
  it("ist reproduzierbar", () => {
    const a = createRng(123);
    const b = createRng(123);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it("int/pick/shuffle bleiben im Bereich", () => {
    const r = createRng(1);
    for (let i = 0; i < 200; i++) {
      const n = r.int(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
    }
    expect([1, 2, 3]).toContain(r.pick([1, 2, 3]));
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(() => r.pick([])).toThrow();
    expect(() => r.int(3, 1)).toThrow();
  });

  it("fork ist deterministisch und unabhängig", () => {
    const a = createRng(5).fork();
    const b = createRng(5).fork();
    expect(a.next()).toBe(b.next());
  });
});

describe("ManualClock", () => {
  it("führt Timer in Zeitreihenfolge aus", () => {
    const c = new ManualClock(0);
    const log: string[] = [];
    c.setTimeout(() => log.push("b"), 20);
    c.setTimeout(() => log.push("a"), 10);
    const h = c.setTimeout(() => log.push("x"), 15);
    c.clearTimeout(h);
    c.advance(25);
    expect(log).toEqual(["a", "b"]);
    expect(c.now()).toBe(25);
  });
});
