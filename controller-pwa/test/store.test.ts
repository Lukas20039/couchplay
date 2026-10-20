import { describe, expect, it } from "vitest";
import { createStore, initialState, isSelfHost, ownResult, reducer, type AppState } from "../src/state/store.js";
import { player, room, TOKEN } from "./helpers.js";

function joinedState(extra: Partial<AppState> = {}): AppState {
  let s = initialState();
  s = reducer(s, { type: "server", msg: { t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN } });
  s = reducer(s, { type: "server", msg: { t: "room.state", room: room() } });
  return { ...s, ...extra };
}

const gameRoom = room({ phase: "game", selectedGameId: "quiz", gamePlayerIds: ["p1", "p2"] });

describe("Store/Reducer", () => {
  it("Startzustand: mit Code aus /j/:code direkt beim Profil", () => {
    expect(initialState({ code: "042137" })).toMatchObject({ step: "profile", code: "042137" });
    expect(initialState()).toMatchObject({ step: "code", code: "" });
  });

  it("room.joined setzt Spieler-ID und räumt Fehler/Hinweise", () => {
    let s: AppState = { ...initialState(), joinPending: true, notice: "idle" };
    s = reducer(s, { type: "server", msg: { t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN } });
    expect(s).toMatchObject({ playerId: "p1", joinPending: false, notice: null, lastSeq: -1 });
  });

  it("game.view: ältere seq verwerfen, nach Reconnect neu beginnen", () => {
    let s = reducer(joinedState(), { type: "server", msg: { t: "room.state", room: gameRoom } });
    s = reducer(s, { type: "server", msg: { t: "game.view", gameId: "quiz", seq: 5, view: { a: 1 } } });
    const dropped = reducer(s, { type: "server", msg: { t: "game.view", gameId: "quiz", seq: 3, view: { a: 0 } } });
    expect(dropped).toBe(s);
    s = reducer(s, { type: "server", msg: { t: "game.view", gameId: "quiz", seq: 7, view: { a: 2 } } });
    expect(s.gameView).toEqual({ gameId: "quiz", seq: 7, view: { a: 2 } });
    // Reconnect: seq beginnt neu, gecachte View (evtl. kleinere seq nach Serverneustart) gilt.
    s = reducer(s, { type: "server", msg: { t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN } });
    s = reducer(s, { type: "server", msg: { t: "game.view", gameId: "quiz", seq: 2, view: { a: 3 } } });
    expect(s.gameView?.view).toEqual({ a: 3 });
  });

  it("Phasenwechsel aus dem Spiel verwirft die View", () => {
    let s = reducer(joinedState(), { type: "server", msg: { t: "room.state", room: gameRoom } });
    s = reducer(s, { type: "server", msg: { t: "game.view", gameId: "quiz", seq: 1, view: {} } });
    s = reducer(s, { type: "server", msg: { t: "room.state", room: { ...gameRoom, phase: "results" } } });
    expect(s.gameView).toBeNull();
    expect(s.lastSeq).toBe(-1);
  });

  it("INVALID_INPUT im Spiel geht an die Spiel-View, andere Fehler als Toast", () => {
    let s = reducer(joinedState(), { type: "server", msg: { t: "room.state", room: gameRoom } });
    s = reducer(s, { type: "server", msg: { t: "error", code: "INVALID_INPUT", message: "intern" } });
    expect(s.gameError?.code).toBe("INVALID_INPUT");
    expect(s.toast).toBeNull();
    s = reducer(s, { type: "server", msg: { t: "error", code: "NOT_ALLOWED", message: "intern" } });
    expect(s.toast?.code).toBe("NOT_ALLOWED");
    const cleared = reducer(s, { type: "toastClear", id: s.toast!.id });
    expect(cleared.toast).toBeNull();
    // Veraltete Clear-Aktion lässt neuen Toast stehen.
    expect(reducer(s, { type: "toastClear", id: -1 })).toBe(s);
  });

  it("joinError: falscher Code → zurück zur Code-Eingabe, Name vergeben → bleibt beim Profil", () => {
    const s = { ...initialState({ code: "042137" }), joinPending: true };
    expect(reducer(s, { type: "joinError", code: "ROOM_NOT_FOUND" })).toMatchObject({ step: "code", joinPending: false, joinError: "ROOM_NOT_FOUND" });
    expect(reducer(s, { type: "joinError", code: "NAME_TAKEN" })).toMatchObject({ step: "profile", joinError: "NAME_TAKEN" });
  });

  it("ended: Raum weg, Hinweis gesetzt, Katalog bleibt", () => {
    let s = reducer(joinedState(), { type: "server", msg: { t: "catalog", games: [] } });
    s = reducer(s, { type: "ended", reason: "kicked" });
    expect(s).toMatchObject({ room: null, playerId: null, notice: "kicked", step: "code", code: "" });
    expect(reducer(s, { type: "dismissNotice" }).notice).toBeNull();
  });

  it("Code-Eingabe löscht alte Fehlermeldung", () => {
    const s = { ...initialState(), joinError: "ROOM_NOT_FOUND" as const };
    expect(reducer(s, { type: "code", code: "1" })).toMatchObject({ code: "1", joinError: null });
  });

  it("Selektoren: Host und eigener Platz", () => {
    let s = joinedState();
    expect(isSelfHost(s)).toBe(true);
    s = reducer(s, {
      type: "server",
      msg: {
        t: "room.state",
        room: room({
          phase: "results",
          players: [player("p1", { isHost: true }), player("p2")],
          results: { gameId: "quiz", ranking: [{ playerId: "p2", score: 10, rank: 1 }, { playerId: "p1", score: 5, rank: 2 }] },
        }),
      },
    });
    expect(ownResult(s)).toEqual({ playerId: "p1", score: 5, rank: 2 });
  });

  it("createStore benachrichtigt nur bei Änderung", () => {
    const store = createStore(initialState());
    let n = 0;
    const off = store.subscribe(() => n++);
    store.dispatch({ type: "code", code: "1" });
    store.dispatch({ type: "toastClear", id: 1 }); // keine Änderung
    expect(n).toBe(1);
    off();
    store.dispatch({ type: "code", code: "12" });
    expect(n).toBe(1);
  });
});
