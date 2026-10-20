import { STORAGE_KEYS } from "@couchplay/protocol/constants";
import { describe, expect, it } from "vitest";
import {
  decodeServerMessage,
  HANDSHAKE_TIMEOUT_MS_CLIENT,
  PONG_TIMEOUT_MS,
  TvClient,
  wsUrlFromLocation,
  type SocketLike,
} from "../src/net/client.js";
import type { Action } from "../src/state/store.js";

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closedWith: number | null = null;
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(code = 1000): void {
    this.closedWith = code;
  }
  // Testhelfer
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

const TOKEN = "Xc1o7JfS1b2Q9mVnq0aZrT5kLwE3yPdu";

function setup(storageInit: Record<string, string> = {}) {
  const sockets: FakeSocket[] = [];
  const actions: Action[] = [];
  const timers: Array<{ fn: () => void; ms: number; id: number; done: boolean }> = [];
  let clock = 1_000_000;
  const storage = memoryStorage(storageInit);
  const client = new TvClient({
    url: "ws://host/ws",
    dispatch: (a) => actions.push(a),
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    storage,
    setTimer: (fn, ms) => {
      const t = { fn, ms, id: timers.length, done: false };
      timers.push(t);
      return t.id;
    },
    clearTimer: (id) => {
      const t = timers[id as number];
      if (t) t.done = true;
    },
    now: () => clock,
    random: () => 0.5,
  });
  const runTimer = (ms: number) => {
    const t = timers.find((x) => !x.done && x.ms === ms);
    if (!t) throw new Error(`kein Timer mit ${ms} ms`);
    t.done = true;
    clock += ms;
    t.fn();
  };
  return { client, sockets, actions, timers, storage, runTimer, last: () => sockets[sockets.length - 1]! };
}

describe("TvClient", () => {
  it("leitet die WS-URL aus der Seiten-URL ab", () => {
    expect(wsUrlFromLocation({ protocol: "http:", host: "10.0.2.2:8080" })).toBe("ws://10.0.2.2:8080/ws");
    expect(wsUrlFromLocation({ protocol: "https:", host: "play.example.org" })).toBe("wss://play.example.org/ws");
  });

  it("erstellt ohne Sitzung einen Raum und speichert das Token", () => {
    const { client, last, storage, actions } = setup();
    client.start();
    last().open();
    expect(last().sent[0]).toEqual({ t: "room.create", v: 1 });
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    expect(JSON.parse(storage.data.get(STORAGE_KEYS.tvSession)!)).toEqual({ code: "042137", tvToken: TOKEN });
    expect(actions).toContainEqual({ type: "conn", status: "online", attempt: 0 });
    // Ping für Uhr-Offset direkt nach dem Handshake
    expect(last().sent[1]).toMatchObject({ t: "ping" });
  });

  it("nimmt mit gespeicherter Sitzung den Raum wieder auf", () => {
    const { client, last } = setup({ [STORAGE_KEYS.tvSession]: JSON.stringify({ code: "042137", tvToken: TOKEN }) });
    client.start();
    last().open();
    expect(last().sent[0]).toEqual({ t: "room.resume", v: 1, code: "042137", tvToken: TOKEN });
  });

  it("verbindet nach Abbruch mit Backoff neu und sendet room.resume", () => {
    const { client, sockets, last, actions, runTimer } = setup();
    client.start();
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    last().drop(1006);
    expect(actions[actions.length - 1]).toMatchObject({ type: "conn", status: "reconnecting", attempt: 1 });
    runTimer(500); // reconnectDelayMs(0) mit Jitter 0
    expect(sockets).toHaveLength(2);
    last().open();
    expect(last().sent[0]).toMatchObject({ t: "room.resume", code: "042137" });
    // zweiter Fehlschlag → längere Wartezeit
    last().drop(1006);
    runTimer(1000);
    expect(sockets).toHaveLength(3);
  });

  it("verwirft eine ungültige Sitzung und erstellt still einen neuen Raum", () => {
    const { client, sockets, last, storage, actions } = setup({ [STORAGE_KEYS.tvSession]: JSON.stringify({ code: "042137", tvToken: TOKEN }) });
    client.start();
    last().open();
    last().receive({ t: "error", code: "ROOM_NOT_FOUND", message: "weg" });
    expect(storage.data.has(STORAGE_KEYS.tvSession)).toBe(false);
    expect(actions).toContainEqual({ type: "reset" });
    expect(actions.some((a) => a.type === "server")).toBe(false); // kein Fehler-Toast
    expect(sockets).toHaveLength(2);
    last().open();
    expect(last().sent[0]).toEqual({ t: "room.create", v: 1 });
  });

  it("reconnectet nicht bei Close 4002 (Sitzung übernommen)", () => {
    const { client, sockets, last, actions, timers } = setup();
    client.start();
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    last().drop(4002);
    expect(actions[actions.length - 1]).toEqual({ type: "fatal", fatal: { kind: "replaced" } });
    expect(timers.filter((t) => !t.done && t.ms !== 10_000)).toHaveLength(0);
    expect(sockets).toHaveLength(1);
  });

  it("löscht die Sitzung bei room.closed und verbindet nicht neu", () => {
    const { client, sockets, last, storage } = setup();
    client.start();
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    last().receive({ t: "room.closed", reason: "idle" });
    last().drop(4004);
    expect(storage.data.has(STORAGE_KEYS.tvSession)).toBe(false);
    expect(sockets).toHaveLength(1);
  });

  it("wartet bei RATE_LIMITED im Handshake mindestens retryAfterMs", () => {
    const { client, last, timers } = setup();
    client.start();
    last().open();
    last().receive({ t: "error", code: "RATE_LIMITED", message: "x", retryAfterMs: 6000 });
    expect(timers.some((t) => !t.done && t.ms === 6000)).toBe(true);
  });

  it("send() erst nach dem Handshake; Uhr-Offset aus pong", () => {
    const { client, last } = setup();
    client.start();
    expect(client.send({ t: "room.toLobby" })).toBe(false);
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    expect(client.send({ t: "lobby.start" })).toBe(true);
    last().receive({ t: "pong", ts: 1_000_000, serverTime: 1_005_000 });
    expect(client.serverNow()).toBe(1_005_000);
  });

  it("decodeServerMessage ignoriert Müll", () => {
    expect(decodeServerMessage("nope")).toBeNull();
    expect(decodeServerMessage('{"x":1}')).toBeNull();
    expect(decodeServerMessage(42)).toBeNull();
    expect(decodeServerMessage('{"t":"pong","serverTime":1}')).toEqual({ t: "pong", serverTime: 1 });
  });

  it("schließt den Socket ohne pong und verbindet neu (halboffene Verbindung)", () => {
    const { client, sockets, last, actions, runTimer } = setup();
    client.start();
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    const first = last();
    runTimer(PONG_TIMEOUT_MS); // kein pong auf den ersten ping
    expect(first.closedWith).toBe(1000);
    expect(actions[actions.length - 1]).toMatchObject({ type: "conn", status: "reconnecting", attempt: 1 });
    runTimer(500);
    expect(sockets).toHaveLength(2);
    last().open();
    expect(last().sent[0]).toMatchObject({ t: "room.resume" });
  });

  it("pong (oder jede andere Nachricht) hält die Verbindung am Leben", () => {
    const { client, sockets, last, timers } = setup();
    client.start();
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    last().receive({ t: "pong", ts: 1, serverTime: 2 });
    expect(timers.some((t) => !t.done && t.ms === PONG_TIMEOUT_MS)).toBe(false);
    expect(sockets).toHaveLength(1);
  });

  it("bricht einen hängenden Verbindungsaufbau/Handshake ab", () => {
    const { client, sockets, runTimer } = setup();
    client.start();
    const first = sockets[0]!;
    runTimer(HANDSHAKE_TIMEOUT_MS_CLIENT); // Socket öffnet nie
    expect(first.closedWith).toBe(1000);
    runTimer(500);
    expect(sockets).toHaveLength(2);
  });

  it("kein Handshake-Timeout nach room.created", () => {
    const { client, last, timers } = setup();
    client.start();
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    expect(timers.some((t) => !t.done && t.ms === HANDSHAKE_TIMEOUT_MS_CLIENT)).toBe(false);
  });

  it("probe(): pingt einen offen wirkenden Socket und verbindet ohne Antwort neu", () => {
    const { client, sockets, last, runTimer } = setup();
    client.start();
    last().open();
    last().receive({ t: "room.created", v: 1, code: "042137", joinUrl: "u", tvToken: TOKEN });
    last().receive({ t: "pong", ts: 1, serverTime: 2 });
    const before = last().sent.length;
    client.probe();
    expect(last().sent.length).toBe(before + 1);
    expect(last().sent[before]).toMatchObject({ t: "ping" });
    runTimer(PONG_TIMEOUT_MS);
    runTimer(500);
    expect(sockets).toHaveLength(2);
  });

  it("probe(): wartender Reconnect startet sofort", () => {
    const { client, sockets, last } = setup();
    client.start();
    last().drop(1006);
    expect(client.waiting()).toBe(true);
    client.probe();
    expect(client.waiting()).toBe(false);
    expect(sockets).toHaveLength(2);
  });
});
