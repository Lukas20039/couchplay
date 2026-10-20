// Tests zu den Review-Fixes: Handshake-Timeout, Reconnect-Burst, Replay-Vibration,
// Ergebnis-Feedback einmalig, Chunk-Reload-Guard, Namensvorschlag, SW-Update.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestName } from "../src/lib/names.js";
import { firstTime, reloadOnceForChunkError, clearChunkReloadGuard, resultsKey } from "../src/lib/once.js";
import { CHECK_THROTTLE_MS, CONNECT_TIMEOUT_MS, Connection } from "../src/net/connection.js";
import { initialState, reducer, type AppState } from "../src/state/store.js";
import { isUpdateSafe, startSwUpdater, type ContainerLike, type RegistrationLike, type WorkerLike } from "../src/sw-register.js";
import { MockSocket, room, TOKEN } from "./helpers.js";

const joinedMsg = { t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN } as const;

function conn() {
  let clock = 0;
  const ev = { status: [] as string[], joinErrors: [] as string[], ended: [] as string[] };
  const c = new Connection({
    url: "ws://t/ws",
    createSocket: (u) => new MockSocket(u),
    loadSession: () => null,
    saveSession: () => undefined,
    random: () => 0.5,
    now: () => clock,
    events: {
      message: () => undefined,
      status: (s) => ev.status.push(s),
      joinError: (e) => ev.joinErrors.push(e),
      ended: (r) => ev.ended.push(r),
    },
  });
  return { c, ev, tick: (ms: number) => (clock += ms) };
}

describe("Connection – Handshake-Timeout und Reconnect-Burst", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockSocket.reset();
  });
  afterEach(() => vi.useRealTimers());

  it("Socket offen, aber keine Antwort auf room.join → Timeout bricht ab", () => {
    const { c, ev } = conn();
    c.join("042137", "Anna", "fuchs");
    MockSocket.last().open();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS - 1);
    expect(ev.joinErrors).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(ev.joinErrors).toEqual(["connect"]);
    expect(MockSocket.last().closedWith).toBe(1000);
  });

  it("hängender room.rejoin → Timeout und neuer Versuch mit Backoff", () => {
    const { c } = conn();
    c.resume({ code: "042137", playerId: "p1", token: TOKEN });
    MockSocket.last().open();
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    expect(c.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(500);
    expect(MockSocket.all).toHaveLength(2);
  });

  it("nach room.joined läuft kein Handshake-Timeout mehr", () => {
    const { c } = conn();
    c.join("042137", "Anna", "fuchs");
    MockSocket.last().open();
    MockSocket.last().receive(joinedMsg);
    MockSocket.last().receive({ t: "pong", serverTime: 0 });
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS * 2);
    expect(c.getStatus()).toBe("joined");
    expect(MockSocket.all).toHaveLength(1);
  });

  it("checkAlive schießt einen Socket im Aufbau (CONNECTING) nicht ab", () => {
    const { c, tick } = conn();
    c.resume({ code: "042137", playerId: "p1", token: TOKEN });
    expect(MockSocket.last().readyState).toBe(0);
    c.checkAlive();
    tick(CHECK_THROTTLE_MS);
    c.checkAlive();
    expect(MockSocket.all).toHaveLength(1);
    // auch nicht, wenn er offen ist und auf die Rejoin-Antwort wartet
    MockSocket.last().open();
    tick(CHECK_THROTTLE_MS);
    c.checkAlive();
    expect(MockSocket.all).toHaveLength(1);
  });

  it("gebündelte Ereignisse (focus + visibilitychange + pageshow) lösen nur einen Neuaufbau aus", () => {
    const { c, tick } = conn();
    c.join("042137", "Anna", "fuchs");
    MockSocket.last().open();
    MockSocket.last().receive(joinedMsg);
    MockSocket.last().dieSilently();
    c.checkAlive();
    c.checkAlive();
    c.checkAlive();
    expect(MockSocket.all).toHaveLength(2);
    tick(CHECK_THROTTLE_MS);
    c.checkAlive(); // neuer Socket noch CONNECTING → bleibt
    expect(MockSocket.all).toHaveLength(2);
  });
});

describe("Vibration nur für Live-Ereignisse (C3)", () => {
  const game = room({ phase: "game", selectedGameId: "quiz", gamePlayerIds: ["p1"] });
  const view = (seq: number) => ({ t: "game.view", gameId: "quiz", seq, view: {} }) as const;
  const apply = (s: AppState, ...msgs: Parameters<typeof reducer>[1][]) => msgs.reduce(reducer, s);

  it("erste game.view nach (Re-)Join ist Replay, folgende sind live", () => {
    let s = apply(initialState(), { type: "server", msg: joinedMsg }, { type: "server", msg: { t: "room.state", room: game } }, { type: "server", msg: view(4) });
    expect(s.gameView?.replay).toBe(true);
    s = reducer(s, { type: "server", msg: view(5) });
    expect(s.gameView?.replay).toBe(false);
  });

  it("Beitritt in der Lobby: erste View beim Spielstart ist live", () => {
    let s = apply(initialState(), { type: "server", msg: joinedMsg }, { type: "server", msg: { t: "room.state", room: room() } });
    s = apply(s, { type: "server", msg: { t: "room.state", room: game } }, { type: "server", msg: view(1) });
    expect(s.gameView?.replay).toBe(false);
  });

  it("resultsLive nur beim miterlebten Übergang game → results", () => {
    const results = { ...game, phase: "results" as const, results: { gameId: "quiz", ranking: [{ playerId: "p1", score: 1, rank: 1 }] } };
    const live = apply(initialState(), { type: "server", msg: joinedMsg }, { type: "server", msg: { t: "room.state", room: game } }, { type: "server", msg: { t: "room.state", room: results } });
    expect(live.resultsLive).toBe(true);
    // Reload auf dem Ergebnis-Screen: frischer Zustand → nicht live
    const reloaded = apply(initialState(), { type: "server", msg: joinedMsg }, { type: "server", msg: { t: "room.state", room: results } });
    expect(reloaded.resultsLive).toBe(false);
    expect(reducer(live, { type: "server", msg: { t: "room.state", room: room() } }).resultsLive).toBe(false);
  });

  it("Ergebnis-Feedback pro Runde nur einmal (sessionStorage-Schlüssel)", () => {
    sessionStorage.clear();
    const r = room({ phase: "results", gamePlayerIds: ["p1"], results: { gameId: "quiz", ranking: [{ playerId: "p1", score: 3, rank: 1 }] } });
    expect(firstTime(resultsKey(r))).toBe(true);
    expect(firstTime(resultsKey(r))).toBe(false);
    const next = { ...r, results: { gameId: "quiz", ranking: [{ playerId: "p1", score: 5, rank: 1 }] } };
    expect(firstTime(resultsKey(next))).toBe(true);
  });
});

describe("Chunk-Ladefehler", () => {
  it("lädt genau einmal neu (Guard gegen Schleifen) und setzt den Guard nach Erfolg zurück", () => {
    sessionStorage.clear();
    const reload = vi.fn();
    expect(reloadOnceForChunkError(reload)).toBe(true);
    expect(reloadOnceForChunkError(reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    clearChunkReloadGuard();
    expect(reloadOnceForChunkError(reload)).toBe(true);
  });
});

describe("Namensvorschlag bei NAME_TAKEN", () => {
  it.each([
    ["Anna", "Anna2"],
    ["Anna2", "Anna3"],
    ["Spieler 9", "Spieler 10"],
    ["ABCDEFGHIJKLMNOP", "ABCDEFGHIJKLMNO2"],
    ["  Bert  ", "Bert2"],
  ])("%s → %s", (input, out) => {
    expect(suggestName(input)).toBe(out);
    expect([...suggestName(input)].length).toBeLessThanOrEqual(16);
  });
});

// ---------------------------------------------------------------------------
// Service-Worker-Update mit Fake-Container
// ---------------------------------------------------------------------------

class FakeWorker implements WorkerLike {
  state = "installing";
  messages: unknown[] = [];
  private fns: Array<() => void> = [];
  postMessage(m: unknown): void {
    this.messages.push(m);
  }
  addEventListener(_t: "statechange", fn: () => void): void {
    this.fns.push(fn);
  }
  setState(s: string): void {
    this.state = s;
    for (const f of this.fns) f();
  }
}

function fakeSw(hasController: boolean) {
  const reg = {
    waiting: null as WorkerLike | null,
    installing: null as WorkerLike | null,
    updateFns: [] as Array<() => void>,
    addEventListener(_t: "updatefound", fn: () => void) {
      this.updateFns.push(fn);
    },
    update: () => Promise.resolve(),
  };
  const changeFns: Array<() => void> = [];
  const container: ContainerLike & { controller: unknown } = {
    controller: hasController ? {} : null,
    register: () => Promise.resolve(reg as RegistrationLike),
    addEventListener: (_t, fn) => changeFns.push(fn),
  };
  return {
    reg,
    container,
    newVersion(): FakeWorker {
      const w = new FakeWorker();
      reg.installing = w;
      for (const f of reg.updateFns) f();
      w.setState("installed");
      return w;
    },
    controllerChange(): void {
      container.controller = {};
      for (const f of changeFns) f();
    },
  };
}

describe("Service-Worker-Update (C2)", () => {
  function setup(hasController = true) {
    const sw = fakeSw(hasController);
    let safe = false;
    const subs: Array<() => void> = [];
    const reload = vi.fn();
    const ready = startSwUpdater({ container: sw.container, isSafe: () => safe, subscribe: (fn) => subs.push(fn), reload });
    const setSafe = (v: boolean) => {
      safe = v;
      for (const f of subs) f();
    };
    return { sw, reload, ready, setSafe };
  }

  it("neuer SW wartet während des Spiels und übernimmt erst in Lobby/Ergebnis", async () => {
    const { sw, ready, setSafe, reload } = setup();
    await ready;
    const w = sw.newVersion();
    expect(w.messages).toEqual([]);
    setSafe(true);
    expect(w.messages).toEqual([{ type: "SKIP_WAITING" }]);
    sw.controllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("controllerchange (durch anderen Tab) während des Spiels → Reload erst nach Spielende", async () => {
    const { sw, ready, setSafe, reload } = setup();
    await ready;
    sw.controllerChange();
    expect(reload).not.toHaveBeenCalled();
    setSafe(true);
    setSafe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("Erstinstallation (clients.claim) lädt nicht neu", async () => {
    const { sw, ready, setSafe, reload } = setup(false);
    await ready;
    setSafe(true);
    sw.controllerChange();
    expect(reload).not.toHaveBeenCalled();
  });

  it("beim Start bereits wartender SW wird übernommen, sobald sicher", async () => {
    const sw = fakeSw(true);
    const w = new FakeWorker();
    w.state = "installed";
    sw.reg.waiting = w;
    await startSwUpdater({ container: sw.container, isSafe: () => true, subscribe: () => undefined, reload: vi.fn() });
    expect(w.messages).toEqual([{ type: "SKIP_WAITING" }]);
  });

  it("isUpdateSafe: Lobby/Ergebnis/Startseite ja, Spiel und laufender Beitritt nein", () => {
    const base = { ...initialState(), playerId: "p1" };
    expect(isUpdateSafe({ ...base, room: room() })).toBe(true);
    expect(isUpdateSafe({ ...base, room: room({ phase: "results" }) })).toBe(true);
    expect(isUpdateSafe({ ...base, room: room({ phase: "game" }) })).toBe(false);
    expect(isUpdateSafe(initialState())).toBe(true);
    expect(isUpdateSafe({ ...initialState(), joinPending: true, conn: "connecting" })).toBe(false);
    expect(isUpdateSafe(initialState({ code: "042137" }))).toBe(false); // Profilseite: Eingaben nicht verlieren
  });
});
