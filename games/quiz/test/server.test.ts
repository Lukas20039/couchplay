import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it } from "vitest";
import game from "../src/server/index.js";

describe("quiz (Platzhalter)", () => {
  it("hat ein gültiges Manifest", () => {
    expect(game.manifest.id).toBe("quiz");
  });

  it("sendet TV-Zustand und endet auf finish", () => {
    const h = createTestHarness(game, { players: 2 });
    expect(h.lastTv()).toMatchObject({ phase: "placeholder" });
    expect(h.input("p1", { type: "finish" })).toEqual({ ok: true });
    expect(h.results?.gameId).toBe("quiz");
  });

  it("lehnt ungültige Eingaben ab", () => {
    const h = createTestHarness(game, { players: 1 });
    expect(h.input("p1", { type: "quatsch" })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});
