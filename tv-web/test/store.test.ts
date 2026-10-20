import { describe, expect, it, vi } from "vitest";
import { createStore, initialState, reducer, type AppState } from "../src/state/store.js";
import { player, quiz, room } from "./fixtures.js";

const created = { t: "room.created", v: 1, code: "042137", joinUrl: "http://x/j/042137", tvToken: "t".repeat(24) } as const;

function online(state: AppState = initialState): AppState {
  let s = reducer(state, { type: "server", msg: created });
  s = reducer(s, { type: "conn", status: "online" });
  return s;
}

describe("reducer", () => {
  it("übernimmt Sitzung, Katalog und Raumzustand", () => {
    let s = online();
    s = reducer(s, { type: "server", msg: { t: "catalog", games: [quiz] } });
    s = reducer(s, { type: "server", msg: { t: "room.state", room: room({ players: [player("a")] }) } });
    expect(s.session).toEqual({ code: "042137", joinUrl: "http://x/j/042137" });
    expect(s.catalog).toHaveLength(1);
    expect(s.room?.players).toHaveLength(1);
    expect(s.conn).toEqual({ status: "online", attempt: 0, retryAt: null });
  });

  it("verwirft game.tv mit kleinerer seq", () => {
    let s = online();
    s = reducer(s, { type: "server", msg: { t: "room.state", room: room({ phase: "game", selectedGameId: "quiz" }) } });
    s = reducer(s, { type: "server", msg: { t: "game.tv", gameId: "quiz", seq: 5, state: { n: 5 } } });
    s = reducer(s, { type: "server", msg: { t: "game.tv", gameId: "quiz", seq: 3, state: { n: 3 } } });
    expect(s.game).toEqual({ gameId: "quiz", seq: 5, state: { n: 5 } });
  });

  it("setzt seq beim Reconnect zurück", () => {
    let s = online();
    s = reducer(s, { type: "server", msg: { t: "game.tv", gameId: "quiz", seq: 9, state: 1 } });
    s = reducer(s, { type: "conn", status: "reconnecting", attempt: 1, retryAt: 123 });
    expect(s.lastSeq).toBe(-1);
    expect(s.conn).toEqual({ status: "reconnecting", attempt: 1, retryAt: 123 });
    s = reducer(s, { type: "server", msg: { t: "game.tv", gameId: "quiz", seq: 2, state: 2 } });
    expect(s.game?.seq).toBe(2);
  });

  it("verwirft den Spielzustand beim Verlassen der Spielphase", () => {
    let s = online();
    s = reducer(s, { type: "server", msg: { t: "room.state", room: room({ phase: "game", selectedGameId: "quiz" }) } });
    s = reducer(s, { type: "server", msg: { t: "game.tv", gameId: "quiz", seq: 1, state: 1 } });
    s = reducer(s, { type: "server", msg: { t: "room.state", room: room({ phase: "game", selectedGameId: "quiz" }) } });
    expect(s.game).not.toBeNull();
    s = reducer(s, { type: "server", msg: { t: "room.state", room: room({ phase: "lobby", selectedGameId: "quiz" }) } });
    expect(s.game).toBeNull();
  });

  it("room.closed wird fatal, error wird Hinweis", () => {
    let s = online();
    s = reducer(s, { type: "server", msg: { t: "error", code: "PLAYER_COUNT", message: "x" } });
    expect(s.notice?.code).toBe("PLAYER_COUNT");
    s = reducer(s, { type: "dismissNotice" });
    expect(s.notice).toBeNull();
    s = reducer(s, { type: "server", msg: { t: "room.closed", reason: "idle" } });
    expect(s.fatal).toEqual({ kind: "closed", reason: "idle" });
  });

  it("reset behält nur den Katalog", () => {
    let s = online();
    s = reducer(s, { type: "server", msg: { t: "catalog", games: [quiz] } });
    s = reducer(s, { type: "fatal", fatal: { kind: "replaced" } });
    s = reducer(s, { type: "reset" });
    expect(s).toEqual({ ...initialState, catalog: [quiz] });
  });

  it("room.created verwirft alten Raum, room.resumed behält ihn", () => {
    let s = online();
    s = reducer(s, { type: "server", msg: { t: "room.state", room: room() } });
    const resumed = reducer(s, { type: "server", msg: { t: "room.resumed", v: 1, code: "042137", joinUrl: "u" } });
    expect(resumed.room).not.toBeNull();
    const fresh = reducer(s, { type: "server", msg: { ...created, code: "111111" } });
    expect(fresh.room).toBeNull();
  });
});

describe("Store", () => {
  it("benachrichtigt nur bei Änderungen", () => {
    const store = createStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.dispatch({ type: "dismissNotice" });
    expect(fn).not.toHaveBeenCalled();
    store.dispatch({ type: "notice", code: "INTERNAL" });
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    store.dispatch({ type: "notice", code: "INTERNAL" });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
