import { resolveParticipants } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { defaultSelection, needsPicker, reconcileSelection, startCheck, toggleSelection } from "../src/lib/participants.js";
import { player } from "./helpers.js";

const players = [player("a"), player("b"), player("c", { connected: false }), player("d")];
const ttt = { minPlayers: 1, maxPlayers: 2 };

describe("Teilnehmerauswahl", () => {
  it("Auswahl nur nötig, wenn mehr verbundene Spieler als maxPlayers", () => {
    expect(needsPicker(players, ttt)).toBe(true);
    expect(needsPicker(players, { minPlayers: 1, maxPlayers: 8 })).toBe(false);
    expect(needsPicker(players, null)).toBe(false);
  });

  it("Vorauswahl entspricht dem Serverstandard (resolveParticipants ohne playerIds)", () => {
    const server = resolveParticipants(players, ttt);
    expect(server.ok && server.playerIds).toEqual(defaultSelection(players, ttt));
  });

  it("toggle respektiert maxPlayers und Beitrittsreihenfolge", () => {
    expect(toggleSelection(["a", "b"], "d", players, ttt)).toEqual(["a", "b"]);
    expect(toggleSelection(["b"], "a", players, ttt)).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a", players, ttt)).toEqual(["b"]);
  });

  it("reconcile entfernt Getrennte", () => {
    expect(reconcileSelection(["a", "c", "x"], players)).toEqual(["a"]);
  });

  it("startCheck: ohne Spiel / zu wenige / mit Auswahl", () => {
    expect(startCheck(players, null, [])).toEqual({ ok: false, reason: "noGame" });
    expect(startCheck(players, { minPlayers: 4, maxPlayers: 8 }, [])).toEqual({ ok: false, reason: "count" });
    expect(startCheck(players, ttt, ["d", "a"])).toEqual({ ok: true, playerIds: ["a", "d"] });
    expect(startCheck(players, { minPlayers: 2, maxPlayers: 2 }, ["a"])).toEqual({ ok: false, reason: "count" });
    expect(startCheck(players, { minPlayers: 1, maxPlayers: 8 }, [])).toEqual({ ok: true });
  });
});
