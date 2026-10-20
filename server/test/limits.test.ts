// Integration: Rate-Limits (Join/Create pro IP, Nachrichten pro Socket, Verbindungen pro IP),
// TRUST_PROXY, Heartbeat, Graceful Shutdown.
import { CREATE_RATE_LIMIT, PROTOCOL_VERSION, WS_CLOSE } from "@couchplay/protocol";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { KeyedRateLimiter, TokenBucket, perMinute, perSecond } from "../src/rate-limit.js";
import { TestClient, createRoom, joinPlayer, sleep, startServer, type TestServer } from "./helpers.js";

let server: TestServer;
/** Kleiner Versuchs-Bucket für die Tests (Produktion: JOIN_ATTEMPT_RATE, 60/min). */
const JOIN_CAP = 10;
const smallJoin = { joinRate: perMinute(JOIN_CAP, JOIN_CAP) };
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
  it("Join-Versuche pro IP: Token-Bucket für alle Versuche (auch erfolglose ohne Code-Fehler)", async () => {
    server = await startServer({ options: { limits: smallJoin } });
    const { code } = await createRoom(server);
    const c = await TestClient.connect(server.wsUrl);
    for (let i = 0; i < JOIN_CAP; i++) {
      c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "", avatar: "fuchs" });
      await c.error("NAME_INVALID");
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

  it("Fehlversuche (falscher Code/Token) sind teurer: exponentieller Backoff pro IP", async () => {
    server = await startServer({
      config: { trustProxy: 1 },
      options: { limits: { joinFailureBackoff: { freeFailuresPerMinute: 3, baseDelayMs: 200, maxDelayMs: 5000, resetAfterMs: 60_000 } } },
    });
    const { code } = await createRoom(server);
    const wrong = code === "999999" ? "999998" : "999999";
    const c = await TestClient.connect(server.wsUrl, { "x-forwarded-for": "198.51.100.9" });
    const tryWrong = () => c.send({ t: "room.join", v: PROTOCOL_VERSION, code: wrong, name: "X", avatar: "fuchs" });
    for (let i = 0; i < 4; i++) {
      tryWrong();
      await c.error("ROOM_NOT_FOUND");
    }
    // 4. Fehlversuch hat 200 ms Sperre ausgelöst – auch der richtige Code wird jetzt abgewiesen.
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    const e1 = await c.error("RATE_LIMITED");
    expect(e1.retryAfterMs).toBeGreaterThan(0);
    expect(e1.retryAfterMs).toBeLessThanOrEqual(200);
    await sleep(220);
    tryWrong();
    await c.error("ROOM_NOT_FOUND");
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    const e2 = await c.error("RATE_LIMITED");
    expect(e2.retryAfterMs).toBeGreaterThan(200); // verdoppelt
    // Andere IP ist nicht betroffen.
    const other = await joinPlayer(server, code, "Bernd", { "x-forwarded-for": "203.0.113.9" });
    expect(other.playerId).toMatch(/^p_/);
  });

  it("globaler Fehlversuchs-Limiter: verteiltes Raten → Sperrphase für verdächtige IPs", async () => {
    server = await startServer({
      config: { trustProxy: 1 },
      options: {
        limits: {
          globalFailureRate: perSecond(5, 0.001),
          globalLockdownMs: 10_000,
          // Backoff praktisch aus, damit hier nur die globale Sperrphase wirkt.
          joinFailureBackoff: { freeFailuresPerMinute: 1, baseDelayMs: 1, maxDelayMs: 1, resetAfterMs: 60_000 },
        },
      },
    });
    const { code } = await createRoom(server);
    const wrong = code === "999999" ? "999998" : "999999";
    const results: string[] = [];
    for (let i = 0; i < 8; i++) {
      const c = await TestClient.connect(server.wsUrl, { "x-forwarded-for": `198.51.100.${i}` });
      c.send({ t: "room.join", v: PROTOCOL_VERSION, code: wrong, name: "X", avatar: "fuchs" });
      results.push((await c.next("error")).code);
      c.close();
    }
    expect(results.slice(0, 5)).toEqual(Array(5).fill("ROOM_NOT_FOUND"));
    expect(results.slice(5)).toEqual(Array(3).fill("RATE_LIMITED"));
    // Eine IP über dem Freikontingent bekommt in der Sperrphase selbst mit richtigem Code keine Auskunft …
    const guesser = await TestClient.connect(server.wsUrl, { "x-forwarded-for": "198.51.100.1" });
    guesser.send({ t: "room.join", v: PROTOCOL_VERSION, code: wrong, name: "X", avatar: "fuchs" });
    await guesser.error("RATE_LIMITED");
    await sleep(5);
    guesser.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Treffer", avatar: "fuchs" });
    await guesser.error("RATE_LIMITED");
    // … unbeteiligte IPs bzw. IPs mit nur einem Tippfehler treten normal bei.
    const legit = await joinPlayer(server, code, "Anna", { "x-forwarded-for": "203.0.113.50" });
    expect(legit.playerId).toMatch(/^p_/);
    const typo = await joinPlayer(server, code, "Bernd", { "x-forwarded-for": "198.51.100.2" });
    expect(typo.playerId).toMatch(/^p_/);
  });

  it("IPv6: Adressen eines /64 teilen sich einen Bucket", async () => {
    server = await startServer({ config: { trustProxy: 1 }, options: { limits: smallJoin } });
    const { code } = await createRoom(server);
    for (let i = 0; i < JOIN_CAP; i++) {
      const c = await TestClient.connect(server.wsUrl, { "x-forwarded-for": `2001:db8:1:2::${(i + 1).toString(16)}` });
      c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "", avatar: "fuchs" });
      await c.error("NAME_INVALID");
      c.close();
    }
    const same64 = await TestClient.connect(server.wsUrl, { "x-forwarded-for": "2001:db8:1:2:ffff:eeee:dddd:cccc" });
    same64.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    await same64.error("RATE_LIMITED");
    const other64 = await joinPlayer(server, code, "Bernd", { "x-forwarded-for": "2001:db8:1:3::1" });
    expect(other64.playerId).toMatch(/^p_/);
  });

  it("TRUST_PROXY: X-Forwarded-For trennt Clients hinter dem Proxy", async () => {
    server = await startServer({ config: { trustProxy: 1 }, options: { limits: smallJoin } });
    const { code } = await createRoom(server);
    for (let i = 0; i < JOIN_CAP; i++) {
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
    server = await startServer({ config: { trustProxy: false }, options: { limits: smallJoin } });
    const { code } = await createRoom(server);
    for (let i = 0; i < JOIN_CAP; i++) {
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

describe("SEC-15 Haushalt / gemeinsame IP", () => {
  it("8 Handys einer IP joinen, 3 Tippfehler, je 5× rejoin, TV-resume → nie RATE_LIMITED (Produktions-Limits)", async () => {
    server = await startServer({ options: { limits: { reconnectGraceMs: 120_000 } } });
    const { tv, code, tvToken } = await createRoom(server);
    const wrong = code === "999999" ? "999998" : "999999";
    const players: Array<{ playerId: string; token: string }> = [];
    const seen: string[] = [];
    for (let i = 0; i < 8; i++) {
      if (i % 3 === 1) {
        const typo = await TestClient.connect(server.wsUrl);
        typo.send({ t: "room.join", v: PROTOCOL_VERSION, code: wrong, name: `P${i}`, avatar: "fuchs" });
        seen.push((await typo.next("error")).code);
        typo.close();
      }
      const p = await joinPlayer(server, code, `Handy ${i + 1}`);
      players.push({ playerId: p.playerId, token: p.token });
      p.client.close();
    }
    expect(seen).toEqual(["ROOM_NOT_FOUND", "ROOM_NOT_FOUND", "ROOM_NOT_FOUND"]);
    // Jeder reconnectet 5× (iOS-Hintergrund), TV ebenfalls einige Male.
    for (let round = 0; round < 5; round++) {
      for (const p of players) {
        const c = await TestClient.connect(server.wsUrl);
        c.send({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: p.playerId, token: p.token });
        const first = await Promise.race([c.next("room.joined").then(() => "ok"), c.next("error").then((e) => e.code)]);
        expect(first).toBe("ok");
        c.close();
      }
      if (round < 3) {
        const t = await TestClient.connect(server.wsUrl);
        t.send({ t: "room.resume", v: PROTOCOL_VERSION, code, tvToken });
        await t.next("room.resumed");
        t.close();
      }
    }
    expect(tv).toBeDefined();
  });

  it("Gegentest: Code-Raten von einer IP wird weiterhin gebremst", async () => {
    server = await startServer();
    await createRoom(server);
    const c = await TestClient.connect(server.wsUrl);
    const codes: string[] = [];
    for (let i = 0; i < 12; i++) {
      c.send({ t: "room.join", v: PROTOCOL_VERSION, code: String(100000 + i), name: "X", avatar: "fuchs" });
      codes.push((await c.next("error")).code);
    }
    // 5 freie Fehlversuche, danach Backoff (1 s, 2 s, …) → weitere Versuche abgewiesen.
    expect(codes.slice(0, 6).filter((x) => x === "ROOM_NOT_FOUND").length).toBe(6);
    expect(codes.slice(6).every((x) => x === "RATE_LIMITED")).toBe(true);
  });
});
