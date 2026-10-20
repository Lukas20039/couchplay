import { resolveParticipants } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { AUTO, defaultSelection, effectiveSelection, needsPicker, reconcileSelection, startCheck, toggleSelection } from "../src/lib/participants.js";
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
    expect(effectiveSelection(AUTO, players, ttt)).toEqual(["a", "b"]);
  });

  it("auto füllt nach, wenn ein Gewählter geht, und nimmt Rückkehrer wieder auf", () => {
    const bAway = [player("a"), player("b", { connected: false }), player("c"), player("d")];
    expect(effectiveSelection(AUTO, bAway, ttt)).toEqual(["a", "c"]);
    const allBack = [player("a"), player("b"), player("c"), player("d")];
    expect(effectiveSelection(AUTO, allBack, ttt)).toEqual(["a", "b"]);
  });

  it("manuelle Auswahl: kurz getrennte Spieler fallen nicht dauerhaft heraus", () => {
    let sel = toggleSelection(AUTO, "a", players, ttt); // a abwählen → [b]
    sel = toggleSelection(sel, "d", players, ttt); // → [b, d]
    expect(sel).toEqual({ mode: "manual", ids: ["b", "d"] });
    const dAway = [player("a"), player("b"), player("c", { connected: false }), player("d", { connected: false })];
    expect(effectiveSelection(sel, dAway, ttt)).toEqual(["b"]); // nicht nachgefüllt (manuell)
    expect(effectiveSelection(sel, players, ttt)).toEqual(["b", "d"]); // d wieder da → wieder dabei
  });

  it("toggle respektiert maxPlayers und Beitrittsreihenfolge", () => {
    expect(toggleSelection(AUTO, "d", players, ttt)).toBe(AUTO); // schon 2 gewählt
    const onlyB = { mode: "manual" as const, ids: ["b"] };
    expect(effectiveSelection(toggleSelection(onlyB, "a", players, ttt), players, ttt)).toEqual(["a", "b"]);
  });

  it("reconcile entfernt Getrennte (nur für die wirksame Auswahl)", () => {
    expect(reconcileSelection(["a", "c", "x"], players)).toEqual(["a"]);
  });

  it("startCheck: ohne Spiel / zu wenige / mit Auswahl", () => {
    expect(startCheck(players, null, AUTO)).toEqual({ ok: false, reason: "noGame" });
    expect(startCheck(players, { minPlayers: 4, maxPlayers: 8 }, AUTO)).toEqual({ ok: false, reason: "count" });
    expect(startCheck(players, ttt, { mode: "manual", ids: ["d", "a"] })).toEqual({ ok: true, playerIds: ["a", "d"] });
    expect(startCheck(players, ttt, AUTO)).toEqual({ ok: true, playerIds: ["a", "b"] });
    expect(startCheck(players, { minPlayers: 2, maxPlayers: 2 }, { mode: "manual", ids: ["a"] })).toEqual({ ok: false, reason: "count" });
    expect(startCheck(players, { minPlayers: 1, maxPlayers: 8 }, AUTO)).toEqual({ ok: true });
  });
});
