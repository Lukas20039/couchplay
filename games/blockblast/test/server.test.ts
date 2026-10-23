// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it } from "vitest";
import game, { COUNTDOWN_MS, END_DELAY_MS } from "../src/server/index.js";
import { bestMove } from "../src/testing.js";
import { SHAPES, SIZE, STONE, fits, type BlockblastPlayerView, type BlockblastResultData, type BlockblastTvState } from "../src/shared.js";

type H = GameHarness<BlockblastTvState, BlockblastPlayerView>;

const make = (players = 2, settings: Record<string, string | boolean> = {}, seed = 42): H => {
  const h = createTestHarness<BlockblastTvState, BlockblastPlayerView>(game, { players, settings, seed });
  return h;
};
const started = (players = 2, settings: Record<string, string | boolean> = {}, seed = 42): H => {
  const h = make(players, settings, seed);
  h.advance(COUNTDOWN_MS);
  return h;
};
const view = (h: H, p: string) => h.lastView(p)!;

/** Erste mögliche Lage für das erste Teil der Hand (oder null). */
function firstMove(v: BlockblastPlayerView): { slot: number; x: number; y: number } | null {
  for (const [slot, id] of v.hand.entries()) {
    if (id === null) continue;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (fits(v.me.board, SHAPES[id]!, x, y)) return { slot, x, y };
  }
  return null;
}

const play = (h: H, p: string): boolean => {
  const v = view(h, p);
  const m = bestMove(v.me.board, v.hand);
  if (!m) return false;
  expect(h.input(p, { type: "place", ...m })).toEqual({ ok: true });
  return true;
};

describe("Start", () => {
  it("Countdown, dann Spiel; alle haben dieselbe Hand", () => {
    const h = make(3);
    expect(h.lastTv()!.phase).toBe("countdown");
    expect(view(h, "p1").hand).toEqual(view(h, "p2").hand);
    expect(view(h, "p1").hand).toHaveLength(3);
    // Legen im Countdown wird ignoriert
    const m = firstMove(view(h, "p1"))!;
    h.input("p1", { type: "place", ...m });
    expect(view(h, "p1").me.moves).toBe(0);
    h.advance(COUNTDOWN_MS);
    expect(h.lastTv()).toMatchObject({ phase: "playing", durationMs: 180_000 });
  });

  it("Spielzeit aus den Settings", () => {
    expect(started(1, { duration: "120" }).lastTv()!.durationMs).toBe(120_000);
  });
});

describe("Legen", () => {
  it("Punkte für gelegte Felder, Teil verschwindet aus der Hand, nach drei Teilen neue Hand", () => {
    const h = started(2);
    const before = view(h, "p1").hand;
    const id = before[0]!;
    h.input("p1", { type: "place", slot: 0, x: 0, y: 0 });
    const v = view(h, "p1");
    expect(v.me.score).toBe(SHAPES[id]!.cells.length);
    expect(v.hand[0]).toBeNull();
    expect(v.me.last).toMatchObject({ seq: 1, lines: 0 });
    play(h, "p1");
    play(h, "p1");
    expect(view(h, "p1").hand.every((x) => x !== null)).toBe(true);
    // Gleiche Reihenfolge: p2 bekommt nach drei Zügen dieselbe zweite Hand.
    for (let i = 0; i < 3; i++) play(h, "p2");
    expect(view(h, "p2").hand).toEqual(view(h, "p1").hand);
  });

  it("ungültige Lage, leerer Slot und fremde Züge werden ignoriert", () => {
    const h = started(2);
    const id = view(h, "p1").hand[0]!;
    h.input("p1", { type: "place", slot: 0, x: SIZE - 1, y: SIZE - 1 });
    if (SHAPES[id]!.cells.length > 1) expect(view(h, "p1").me.moves).toBe(0);
    h.input("p1", { type: "place", slot: 0, x: 0, y: 0 });
    const moves = view(h, "p1").me.moves;
    h.input("p1", { type: "place", slot: 0, x: 4, y: 4 }); // Slot leer
    expect(view(h, "p1").me.moves).toBe(moves);
    expect(view(h, "p2").me.moves).toBe(0);
  });

  it("spielt bis niemand mehr legen kann oder die Zeit abläuft; Ranking nach Punkten", () => {
    const h = started(2, {}, 7);
    for (let i = 0; i < 500 && h.lastTv()!.phase === "playing"; i++) {
      play(h, "p1");
      play(h, "p2");
      if (i % 20 === 0) h.advance(1000);
    }
    const tv = h.lastTv()!;
    expect(tv.players.reduce((s, p) => s + p.lines, 0)).toBeGreaterThan(0);
    h.advance(180_000);
    h.advance(END_DELAY_MS);
    expect(h.results).not.toBeNull();
    const ranking = h.results!.ranking;
    const scores = (h.results!.data as BlockblastResultData).players;
    const top = [...scores].sort((a, b) => b.score - a.score)[0]!;
    expect(ranking.find((r) => r.playerId === top.playerId)?.rank).toBe(1);
  });
});

describe("Angriffe", () => {
  /** Spielt p1 so lange, bis eine Räumung Steine schickt. */
  function untilAttack(h: H): boolean {
    for (let i = 0; i < 400 && h.lastTv()!.phase === "playing"; i++) {
      if (!play(h, "p1")) return false;
      if (view(h, "p1").me.last?.attack) return true;
    }
    return false;
  }

  it("große Räumungen schicken Steine zum führenden Gegner", () => {
    let found = false;
    for (let seed = 1; seed <= 30 && !found; seed++) {
      const h = started(2, {}, seed);
      play(h, "p2"); // p2 führt mit Punkten → wird Ziel
      if (!untilAttack(h)) continue;
      found = true;
      const attack = view(h, "p1").me.last!.attack!;
      expect(attack.to).toBe("p2");
      const p2 = view(h, "p2").me;
      expect(p2.incoming?.cells).toHaveLength(attack.stones);
      expect([...p2.board].filter((c) => c === STONE)).toHaveLength(attack.stones);
    }
    expect(found).toBe(true);
  });

  it("ohne Angriffe bleiben die Felder der anderen unberührt", () => {
    const h = started(2, { attacks: false }, 3);
    for (let i = 0; i < 200 && h.lastTv()!.phase === "playing"; i++) if (!play(h, "p1")) break;
    expect(view(h, "p2").me.board.includes(STONE)).toBe(false);
  });
});

describe("Ende", () => {
  it("Solo: festgefahren → Spielende", () => {
    const h = started(1, {}, 11);
    for (let i = 0; i < 1000 && h.lastTv()!.phase === "playing"; i++) {
      // Schlecht spielen: immer unten rechts zuerst, damit das Brett schnell voll wird.
      const v = view(h, "p1");
      let done = false;
      for (const [slot, id] of v.hand.entries()) {
        if (id === null || done) continue;
        for (let y = SIZE - 1; y >= 0 && !done; y -= 1) {
          for (let x = 0; x < SIZE && !done; x += 2) {
            if (fits(v.me.board, SHAPES[id]!, x, y)) {
              h.input("p1", { type: "place", slot, x, y });
              done = true;
            }
          }
        }
      }
      if (!done && !play(h, "p1")) break;
    }
    expect(h.lastTv()!.phase).toBe("over");
    expect(view(h, "p1").me.alive).toBe(false);
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([{ playerId: "p1", score: view(h, "p1").me.score, rank: 1 }]);
  });

  it("Zeit abgelaufen → Spielende; Gleichstand = gleicher Rang", () => {
    const h = started(2);
    h.advance(180_000);
    expect(h.lastTv()!.phase).toBe("over");
    h.input("p1", { type: "place", slot: 0, x: 0, y: 0 });
    expect(view(h, "p1").me.moves).toBe(0);
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("Leave: Spieler ist raus, die anderen spielen weiter", () => {
    const h = started(3);
    h.leave("p2");
    const tv = h.lastTv()!;
    expect(tv.phase).toBe("playing");
    expect(tv.players.find((p) => p.id === "p2")).toMatchObject({ left: true, alive: false });
    h.leave("p1");
    h.leave("p3");
    expect(h.lastTv()!.phase).toBe("over");
  });
});
