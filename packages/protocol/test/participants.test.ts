import { describe, expect, it } from "vitest";
import { isSpectator, resolveParticipants, type Player } from "../src/index.js";

const mk = (id: string, connected = true): Player => ({ id, name: id, avatar: "fuchs", color: 0, connected, isHost: false });
const players = [mk("a"), mk("b", false), mk("c"), mk("d")];
const ttt = { minPlayers: 1, maxPlayers: 2 };

describe("resolveParticipants", () => {
  it("Default: verbundene Spieler in Beitrittsreihenfolge, gekappt auf max", () => {
    expect(resolveParticipants(players, ttt)).toEqual({ ok: true, playerIds: ["a", "c"] });
    expect(resolveParticipants(players, { minPlayers: 1, maxPlayers: 8 })).toEqual({ ok: true, playerIds: ["a", "c", "d"] });
  });

  it("Default: zu wenige verbundene Spieler → PLAYER_COUNT", () => {
    expect(resolveParticipants([mk("a", false)], ttt)).toMatchObject({ ok: false, code: "PLAYER_COUNT" });
    expect(resolveParticipants(players, { minPlayers: 4, maxPlayers: 8 })).toMatchObject({ ok: false, code: "PLAYER_COUNT" });
  });

  it("Auswahl: Reihenfolge bleibt erhalten", () => {
    expect(resolveParticipants(players, ttt, ["d", "a"])).toEqual({ ok: true, playerIds: ["d", "a"] });
  });

  it("Auswahl: Fehlerfälle", () => {
    expect(resolveParticipants(players, ttt, ["a", "c", "d"])).toMatchObject({ ok: false, code: "PLAYER_COUNT" });
    expect(resolveParticipants(players, { minPlayers: 2, maxPlayers: 2 }, ["a"])).toMatchObject({ ok: false, code: "PLAYER_COUNT" });
    expect(resolveParticipants(players, ttt, ["x"])).toMatchObject({ ok: false, code: "PLAYER_NOT_FOUND" });
    expect(resolveParticipants(players, ttt, ["b"])).toMatchObject({ ok: false, code: "PLAYER_NOT_CONNECTED" });
    expect(resolveParticipants(players, ttt, ["a", "a"])).toMatchObject({ ok: false, code: "BAD_MESSAGE" });
  });
});

describe("isSpectator", () => {
  it("nur in Phase game und ohne Teilnahme", () => {
    expect(isSpectator({ phase: "game", gamePlayerIds: ["a"] }, "c")).toBe(true);
    expect(isSpectator({ phase: "game", gamePlayerIds: ["a"] }, "a")).toBe(false);
    expect(isSpectator({ phase: "lobby", gamePlayerIds: [] }, "c")).toBe(false);
    expect(isSpectator({ phase: "results", gamePlayerIds: ["a"] }, "c")).toBe(false);
  });
});
