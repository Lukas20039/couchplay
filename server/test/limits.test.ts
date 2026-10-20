// Integration: Rate-Limits (Join/Create pro IP, Nachrichten pro Socket, Verbindungen pro IP),
// TRUST_PROXY, Heartbeat, Graceful Shutdown.
import { JOIN_RATE_LIMIT, CREATE_RATE_LIMIT, PROTOCOL_VERSION, WS_CLOSE } from "@couchplay/protocol";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { KeyedRateLimiter, TokenBucket, perSecond } from "../src/rate-limit.js";
import { TestClient, createRoom, joinPlayer, sleep, startServer, type TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

describe("Token-Bucket", () => {
  it("leert sich und füllt mit der Zeit nach", () => {
    let now = 0;
    const b = new TokenBucket(perSecond(2, 1), () => now);
    expect(b.take().ok).toBe(true);
    expect(b.take().ok).toBe(true);
    const r = b.take();
    expect(r).toEqual({ ok: false, retryAfterMs: 1000 });
    now += 1000;
    expect(b.take().ok).toBe(true);
  });

  it("KeyedRateLimiter verwirft volle Buckets beim Sweep", () => {
    let now = 0;
    const l = new KeyedRateLimiter(perSecond(1, 1), () => now);
    l.take("a");
    expect(l.size).toBe(1);
    now += 5000;
    l.sweep();
    expect(l.size).toBe(0);
  });
});

describe("Rate-Limits", () => {
  it("Join-Versuche pro IP (zählt auch Fehlversuche)", async () => {
    server = await startServer();
    const { code } = await createRoom(server);
    const c = await TestClient.connect(server.wsUrl);
    for (let i = 0; i < JOIN_RATE_LIMIT.capacity; i++) {
      c.send({ t: "room.join", v: PROTOCOL_VERSION, code: "999999" === code ? "999998" : "999999", name: "X", avatar: "fuchs" });
      await c.error("ROOM_NOT_FOUND");
    }
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs", rid: "late" });
    const err = await c.error("RATE_LIMITED");
    expect(err.rid).toBe("late");
    expect(err.retryAfterMs).toBeGreaterThan(0);
    // Auch von einer anderen Verbindung derselben IP.
    const d = await TestClient.connect(server.wsUrl);
    d.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    await d.error("RATE_LIMITED");
  });

  it("TRUST_PROXY: X-Forwarded-For trennt Clients hinter dem Proxy", async () => {
    server = await startServer({ config: { trustProxy: true } });
    const { code } = await createRoom(server);
    for (let i = 0; i < JOIN_RATE_LIMIT.capacity; i++) {
      const c = await TestClient.connect(server.wsUrl, { "x-forwarded-for": "203.0.113.7" });
      c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "", avatar: "fuchs" });
      await c.error("NAME_INVALID");
      c.close();
    }
    const blocked = await TestClient.connect(server.wsUrl, { "x-forwarded-for": "203.0.113.7" });
    blocked.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    await blocked.error("RATE_LIMITED");
    const other = await joinPlayer(server, code, "Anna", { "x-forwarded-for": "198.51.100.1" });
    expect(other.playerId).toMatch(/^p_/);
  });

  it("ohne TRUST_PROXY wird X-Forwarded-For ignoriert", async () => {
    server = await startServer({ config: { trustProxy: false } });
    const { code } = await createRoom(server);
    for (let i = 0; i < JOIN_RATE_LIMIT.capacity; i++) {
      const c = await TestClient.connect(server.wsUrl, { "x-forwarded-for": `203.0.113.${i}` });
      c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "", avatar: "fuchs" });
      await c.error("NAME_INVALID");
      c.close();
    }
    const c = await TestClient.connect(server.wsUrl, { "x-forwarded-for": "198.51.100.1" });
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    await c.error("RATE_LIMITED");
  });

  it("Raumerstellung pro IP", async () => {
    server = await startServer();
    for (let i = 0; i < CREATE_RATE_LIMIT.capacity; i++) await createRoom(server);
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.create", v: PROTOCOL_VERSION });
    expect((await c.error("RATE_LIMITED")).retryAfterMs).toBeGreaterThan(0);
  });

  it("Raumlimit der Instanz → SERVER_FULL", async () => {
    server = await startServer({ options: { limits: { maxRooms: 1 } } });
    await createRoom(server);
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.create", v: PROTOCOL_VERSION });
    await c.error("SERVER_FULL");
  });

  it("Nachrichten pro Verbindung: RATE_LIMITED, nach zu vielen Verstößen Close 4008", async () => {
    server = await startServer({ options: { limits: { messageRate: perSecond(5, 1), rateLimitStrikesBeforeClose: 5 } } });
    const { tv } = await createRoom(server);
    for (let i = 0; i < 12; i++) tv.send({ t: "ping" });
    const err = await tv.error("RATE_LIMITED");
    expect(err.retryAfterMs).toBeGreaterThan(0);
    expect((await tv.closed).code).toBe(WS_CLOSE.RATE_LIMITED);
  });

  it("Verbindungen pro IP begrenzt (Upgrade → 429)", async () => {
    server = await startServer({ options: { limits: { maxConnectionsPerIp: 2 } } });
    const a = await TestClient.connect(server.wsUrl);
    const b = await TestClient.connect(server.wsUrl);
    await expect(TestClient.connect(server.wsUrl)).rejects.toThrow(/429/);
    a.close();
    await a.closed;
    await sleep(50);
    const c = await TestClient.connect(server.wsUrl);
    b.close();
    c.close();
  });
});

describe("Heartbeat", () => {
  it("Server pingt; Client ohne Pong wird getrennt (gilt als Abbruch)", async () => {
    server = await startServer({ options: { limits: { heartbeatIntervalMs: 50, heartbeatTimeoutMs: 200, reconnectGraceMs: 5000 } } });
    const { tv, code } = await createRoom(server);
    // Client, der keine Pongs sendet: autoPong abschalten.
    const ws = new WebSocket(server.wsUrl, { autoPong: false });
    let pings = 0;
    ws.on("ping", () => pings++);
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Stumm", avatar: "fuchs" }));
    const closed = new Promise<number>((r) => ws.once("close", (c) => r(c)));
    expect(await closed).toBe(1006);
    expect(pings).toBeGreaterThan(0);
    await tv.state((r) => r.players[0]?.connected === false);
    // Normaler Client (antwortet automatisch auf Pings) bleibt verbunden.
    await sleep(400);
    expect(tv.closeInfo).toBeNull();
  });
});

describe("Graceful Shutdown", () => {
  it("app.close(): alle Clients erhalten room.closed{server_shutdown}, Sockets werden geschlossen", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    const idle = await TestClient.connect(server.wsUrl);
    await server.close();
    expect((await tv.next("room.closed")).reason).toBe("server_shutdown");
    expect((await a.client.next("room.closed")).reason).toBe("server_shutdown");
    expect((await tv.closed).code).toBe(WS_CLOSE.ROOM_CLOSED);
    expect((await a.client.closed).code).toBe(WS_CLOSE.ROOM_CLOSED);
    expect((await idle.closed).code).toBe(1001);
    await expect(fetch(`${server.url}/healthz`)).rejects.toThrow();
  });
});
