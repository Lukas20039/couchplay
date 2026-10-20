// Reconnect-Zustandsmaschine mit gemocktem WebSocket und virtueller Zeit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerSession } from "../src/lib/storage.js";
import { Connection, LIVENESS_TIMEOUT_MS, type ConnStatus, type EndReason } from "../src/net/connection.js";
import { MockSocket, TOKEN } from "./helpers.js";

function setup(initial: PlayerSession | null = null) {
  let session = initial;
  const statuses: ConnStatus[] = [];
  const ended: EndReason[] = [];
  const joinErrors: string[] = [];
  const messages: string[] = [];
  let clock = 1_000_000;
  const conn = new Connection({
    url: "ws://test/ws",
    createSocket: (url) => new MockSocket(url),
    loadSession: () => session,
    saveSession: (s) => {
      session = s;
    },
    random: () => 0.5, // kein Jitter → exakte Backoff-Zeiten
    now: () => clock,
    events: {
      message: (m) => messages.push(m.t),
      status: (s) => statuses.push(s),
      joinError: (c) => joinErrors.push(c),
      ended: (r) => ended.push(r),
    },
  });
  return {
    conn,
    statuses,
    ended,
    joinErrors,
    messages,
    session: () => session,
    advanceClock: (ms: number) => {
      clock += ms;
    },
  };
}

const joined = { t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN } as const;

function joinedConnection() {
  const ctx = setup();
  ctx.conn.join("042137", "Anna", "fuchs");
  MockSocket.last().open();
  MockSocket.last().receive(joined);
  return ctx;
}

beforeEach(() => {
  vi.useFakeTimers();
  MockSocket.reset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Connection – Beitritt", () => {
  it("sendet room.join nach dem Öffnen und speichert die Sitzung", () => {
    const ctx = setup();
    ctx.conn.join("042137", "Anna", "fuchs");
    expect(ctx.conn.getStatus()).toBe("connecting");
    const ws = MockSocket.last();
    expect(ws.url).toBe("ws://test/ws");
    ws.open();
    expect(ws.sent[0]).toMatchObject({ t: "room.join", v: 1, code: "042137", name: "Anna", avatar: "fuchs" });
    ws.receive(joined);
    expect(ctx.conn.getStatus()).toBe("joined");
    expect(ctx.session()).toEqual({ code: "042137", playerId: "p1", token: TOKEN });
    expect(ctx.messages).toContain("room.joined");
    // Erster Ping für Uhr-Offset/Lebendigkeit.
    expect(ws.lastSent()).toMatchObject({ t: "ping" });
  });

  it("abgelehnter Join → joinError, Socket zu, kein Reconnect", () => {
    const ctx = setup();
    ctx.conn.join("999999", "Anna", "fuchs");
    const ws = MockSocket.last();
    ws.open();
    ws.receive({ t: "error", code: "ROOM_NOT_FOUND", message: "x" });
    expect(ctx.joinErrors).toEqual(["ROOM_NOT_FOUND"]);
    expect(ctx.conn.getStatus()).toBe("idle");
    expect(ws.closedWith).toBe(1000);
    vi.advanceTimersByTime(60_000);
    expect(MockSocket.all).toHaveLength(1);
  });

  it("Server nicht erreichbar beim Erstbeitritt → joinError('connect'), kein Endlos-Retry", () => {
    const ctx = setup();
    ctx.conn.join("042137", "Anna", "fuchs");
    MockSocket.last().drop();
    expect(ctx.joinErrors).toEqual(["connect"]);
    expect(ctx.conn.getStatus()).toBe("idle");
    vi.advanceTimersByTime(60_000);
    expect(MockSocket.all).toHaveLength(1);
  });

  it("hängender Verbindungsaufbau läuft in den Connect-Timeout", () => {
    const ctx = setup();
    ctx.conn.join("042137", "Anna", "fuchs");
    vi.advanceTimersByTime(8_000);
    expect(ctx.joinErrors).toEqual(["connect"]);
  });
});

describe("Connection – Reconnect", () => {
  it("baut nach Abbruch mit Backoff neu auf und sendet room.rejoin", () => {
    const ctx = joinedConnection();
    MockSocket.last().drop(1006);
    expect(ctx.conn.getStatus()).toBe("reconnecting");
    expect(MockSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(499);
    expect(MockSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockSocket.all).toHaveLength(2);
    const ws = MockSocket.last();
    ws.open();
    expect(ws.sent[0]).toMatchObject({ t: "room.rejoin", v: 1, code: "042137", playerId: "p1", token: TOKEN });
    ws.receive(joined);
    expect(ctx.conn.getStatus()).toBe("joined");
    expect(ctx.statuses).toEqual(["connecting", "joined", "reconnecting", "joined"]);
  });

  it("verdoppelt die Wartezeit bis maximal 10 s", () => {
    joinedConnection();
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      MockSocket.last().drop();
      const before = MockSocket.all.length;
      let waited = 0;
      while (MockSocket.all.length === before) {
        vi.advanceTimersByTime(10);
        waited += 10;
      }
      delays.push(waited);
    }
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 10000, 10000]);
  });

  it("TOKEN_INVALID / ROOM_NOT_FOUND beim Rejoin → Sitzung löschen, nicht erneut versuchen", () => {
    const ctx = joinedConnection();
    MockSocket.last().drop();
    vi.advanceTimersByTime(500);
    const ws = MockSocket.last();
    ws.open();
    ws.receive({ t: "error", code: "TOKEN_INVALID", message: "x", fatal: true });
    expect(ctx.ended).toEqual(["expired"]);
    expect(ctx.session()).toBeNull();
    expect(ctx.conn.getStatus()).toBe("closed");
    vi.advanceTimersByTime(60_000);
    expect(MockSocket.all).toHaveLength(2);
  });

  it("RATE_LIMITED beim Rejoin → wartet retryAfterMs", () => {
    const ctx = joinedConnection();
    MockSocket.last().drop();
    vi.advanceTimersByTime(500);
    MockSocket.last().open();
    MockSocket.last().receive({ t: "error", code: "RATE_LIMITED", message: "x", retryAfterMs: 3000 });
    expect(ctx.conn.getStatus()).toBe("reconnecting");
    vi.advanceTimersByTime(2999);
    expect(MockSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockSocket.all).toHaveLength(3);
  });

  it.each([
    [4003, "kicked", true],
    [4002, "replaced", false],
    [4001, "version", true],
    [4004, "expired", true],
  ] as const)("Close-Code %i → Ende '%s', kein Reconnect", (code, reason, cleared) => {
    const ctx = joinedConnection();
    MockSocket.last().drop(code);
    expect(ctx.ended).toEqual([reason]);
    expect(ctx.session() === null).toBe(cleared);
    vi.advanceTimersByTime(60_000);
    expect(MockSocket.all).toHaveLength(1);
  });

  it("room.closed beendet die Sitzung mit dem Grund des Servers", () => {
    const ctx = joinedConnection();
    MockSocket.last().receive({ t: "room.closed", reason: "closed_by_tv" });
    MockSocket.last().drop(4004);
    expect(ctx.ended).toEqual(["closed_by_tv"]);
    expect(ctx.session()).toBeNull();
  });

  it("resume() nimmt eine gespeicherte Sitzung beim Start auf", () => {
    const ctx = setup({ code: "042137", playerId: "p1", token: TOKEN });
    ctx.conn.resume(ctx.session()!);
    expect(ctx.conn.getStatus()).toBe("reconnecting");
    MockSocket.last().open();
    expect(MockSocket.last().sent[0]).toMatchObject({ t: "room.rejoin", playerId: "p1" });
  });

  it("abandon() bricht ab und löscht die Sitzung", () => {
    const ctx = setup({ code: "042137", playerId: "p1", token: TOKEN });
    ctx.conn.resume(ctx.session()!);
    MockSocket.last().drop();
    ctx.conn.abandon();
    expect(ctx.conn.getStatus()).toBe("idle");
    expect(ctx.session()).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(MockSocket.all).toHaveLength(1);
  });
});

describe("Connection – Lebendigkeit (visibilitychange/pageshow)", () => {
  it("still gestorbener Socket → sofort neu verbinden", () => {
    const ctx = joinedConnection();
    MockSocket.last().dieSilently();
    ctx.conn.checkAlive();
    expect(ctx.conn.getStatus()).toBe("reconnecting");
    expect(MockSocket.all).toHaveLength(2);
  });

  it("offener Socket ohne pong → nach Timeout neu verbinden", () => {
    const ctx = joinedConnection();
    const ws = MockSocket.last();
    ws.receive({ t: "pong", serverTime: 1 }); // Antwort auf den ersten Ping
    ctx.conn.checkAlive();
    expect(ws.lastSent()).toMatchObject({ t: "ping" });
    vi.advanceTimersByTime(LIVENESS_TIMEOUT_MS);
    expect(ctx.conn.getStatus()).toBe("reconnecting");
    expect(MockSocket.all).toHaveLength(2);
    expect(ws.closedWith).toBe(1000);
  });

  it("offener Socket mit pong → bleibt verbunden; Uhr-Offset wird übernommen", () => {
    const ctx = joinedConnection();
    const ws = MockSocket.last();
    ws.receive({ t: "pong", serverTime: 1 });
    ctx.conn.checkAlive();
    const ts = ws.lastSent()!.ts as number;
    ctx.advanceClock(100);
    ws.receive({ t: "pong", ts, serverTime: ts + 5_050 });
    vi.advanceTimersByTime(LIVENESS_TIMEOUT_MS * 2);
    expect(ctx.conn.getStatus()).toBe("joined");
    expect(MockSocket.all).toHaveLength(1);
    // serverTime + rtt/2 = ts + 5050 + 50 = jetzt + 5000
    expect(ctx.conn.serverNow() - (ts + 100)).toBe(5000);
  });

  it("während Backoff-Wartezeit: sofort neu versuchen statt warten", () => {
    const ctx = joinedConnection();
    MockSocket.last().drop();
    MockSocket.last(); // alter Socket
    ctx.conn.checkAlive();
    expect(MockSocket.all).toHaveLength(2);
    expect(ctx.conn.getStatus()).toBe("reconnecting");
  });
});

describe("Connection – Verlassen und Senden", () => {
  it("leave() sendet room.leave und endet mit 'left'", () => {
    const ctx = joinedConnection();
    ctx.conn.leave();
    expect(MockSocket.last().lastSent()).toEqual({ t: "room.leave" });
    MockSocket.last().receive({ t: "room.closed", reason: "left" });
    expect(ctx.ended).toEqual(["left"]);
    expect(ctx.session()).toBeNull();
  });

  it("send() verweigert vor dem Handshake", () => {
    const ctx = setup();
    ctx.conn.join("042137", "Anna", "fuchs");
    MockSocket.last().open();
    expect(ctx.conn.send({ t: "lobby.start" })).toBe(false);
  });

  it("Nachrichten nach dem Handshake werden weitergereicht", () => {
    const ctx = joinedConnection();
    MockSocket.last().receive({ t: "catalog", games: [] });
    expect(ctx.messages).toEqual(["room.joined", "catalog"]);
  });
});
