// Integrationstests zu den Security-/Code-Review-Befunden (SEC-01 … SEC-10, S1–S3).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { defineGame } from "@couchplay/game-sdk";
import { PROTOCOL_VERSION, type ServerMessage } from "@couchplay/protocol";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { ipKey } from "../src/net.js";
import { perSecond } from "../src/rate-limit.js";
import { testGame } from "./fixtures/test-game.js";
import { TestClient, createRoom, joinPlayer, sleep, startServer, type TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

const xff = (ip: string) => ({ "x-forwarded-for": ip });

describe("ipKey", () => {
  it("IPv4 exakt, IPv4-mapped → IPv4, IPv6 → /64", () => {
    expect(ipKey("203.0.113.7")).toBe("203.0.113.7");
    expect(ipKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(ipKey("2001:db8:1:2::1")).toBe("2001:0db8:0001:0002::/64");
    expect(ipKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:0db8:0001:0002::/64");
    expect(ipKey("2001:db8:1:3::1")).not.toBe(ipKey("2001:db8:1:2::1"));
    expect(ipKey("::1")).toBe("0000:0000:0000:0000::/64");
  });
});

describe("SEC-01 Raumflut", () => {
  it("Räume ohne verbundenen Client werden nach der Frist geschlossen, belegte nicht", async () => {
    server = await startServer({ options: { limits: { orphanRoomTimeoutMs: 200, sweepIntervalMs: 50 } } });
    const orphan = await createRoom(server);
    const kept = await createRoom(server);
    orphan.tv.close();
    await orphan.tv.closed;
    await sleep(500);
    expect(server.app.couchplay.rooms.size).toBe(1);
    expect(server.app.couchplay.rooms.get(kept.code)).toBeDefined();
    expect(server.app.couchplay.rooms.get(orphan.code)).toBeUndefined();
  });

  it("Raum mit nur einem getrennten Spieler in der Gnadenfrist gilt ebenfalls als verwaist", async () => {
    server = await startServer({ options: { limits: { orphanRoomTimeoutMs: 200, sweepIntervalMs: 50, reconnectGraceMs: 60_000 } } });
    const { tv, code } = await createRoom(server);
    const p = await joinPlayer(server, code, "Anna");
    tv.close();
    await sleep(400);
    expect(server.app.couchplay.rooms.size).toBe(1); // Spieler noch verbunden
    p.client.close();
    await sleep(500);
    expect(server.app.couchplay.rooms.size).toBe(0);
  });

  it("Limit offener Räume pro IP; Schließen gibt Platz frei; room.resume umgeht es nicht", async () => {
    server = await startServer({ config: { trustProxy: 1 }, options: { limits: { createRate: perSecond(100, 100) } } });
    const ip = xff("198.51.100.20");
    const rooms = [];
    for (let i = 0; i < 5; i++) rooms.push(await createRoom(server, ip));
    const sixth = await TestClient.connect(server.wsUrl, ip);
    sixth.send({ t: "room.create", v: PROTOCOL_VERSION });
    const err = await sixth.error("RATE_LIMITED");
    expect(err.message).toMatch(/offene Räume/);
    // TV trennt und nimmt den Raum von einer anderen IP wieder auf → zählt weiter beim Ersteller.
    const first = rooms[0]!;
    first.tv.close();
    const resumed = await TestClient.connect(server.wsUrl, xff("203.0.113.99"));
    resumed.send({ t: "room.resume", v: PROTOCOL_VERSION, code: first.code, tvToken: first.tvToken });
    await resumed.next("room.resumed");
    sixth.send({ t: "room.create", v: PROTOCOL_VERSION });
    await sixth.error("RATE_LIMITED");
    // Raum schließen → Platz frei.
    resumed.send({ t: "room.close" });
    await resumed.closed;
    sixth.send({ t: "room.create", v: PROTOCOL_VERSION });
    await sixth.next("room.created");
  });

  it("IPv6: Räume eines /64 zählen zusammen", async () => {
    server = await startServer({ config: { trustProxy: 1 }, options: { limits: { createRate: perSecond(100, 100) } } });
    for (let i = 1; i <= 5; i++) await createRoom(server, xff(`2001:db8:5:6::${i}`));
    const c = await TestClient.connect(server.wsUrl, xff("2001:db8:5:6:ffff::1"));
    c.send({ t: "room.create", v: PROTOCOL_VERSION });
    await c.error("RATE_LIMITED");
    await createRoom(server, xff("2001:db8:5:7::1"));
  });
});

describe("SEC-02 Backpressure & Liveness", () => {
  it("Client, der nicht liest, wird bei vollem Sendepuffer getrennt", async () => {
    server = await startServer({
      options: { limits: { maxBufferedBytes: 64 * 1024, messageRate: perSecond(100_000, 100_000) } },
    });
    const { tv, code } = await createRoom(server);
    const p = await joinPlayer(server, code, "Anna");
    tv.send({ t: "lobby.selectGame", gameId: "testgame" });
    tv.send({ t: "lobby.updateSettings", settings: { target: 10 } });
    tv.send({ t: "lobby.start" });
    await p.client.state((r) => r.phase === "game");
    // TV liest ab jetzt nicht mehr.
    (tv.ws as unknown as { _socket: { pause(): void } })._socket.pause();
    let dropped = false;
    for (let i = 0; i < 4000 && !dropped; i++) {
      p.client.send({ t: "game.input", data: { type: "blob", size: 15_000 } });
      if (i % 50 === 49) {
        await sleep(10);
        dropped = p.client.peekAll("room.state").some((m) => !m.room.tvConnected);
      }
    }
    await p.client.state((r) => !r.tvConnected, 3000);
    expect(server.app.couchplay.gateway.connectionCount).toBe(1);
    tv.ws.terminate();
  });

  it("Liveness nur über Pong: sendender, aber nicht pongender Client wird getrennt", async () => {
    server = await startServer({ options: { limits: { heartbeatIntervalMs: 50, heartbeatTimeoutMs: 200 } } });
    const { code } = await createRoom(server);
    const ws = new WebSocket(server.wsUrl, { autoPong: false });
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Stumm", avatar: "fuchs" }));
    const iv = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: "ping" })), 30);
    const closeCode = await new Promise<number>((r) => ws.once("close", (c) => r(c)));
    clearInterval(iv);
    expect(closeCode).toBe(1006);
  });

  it("room.state wird pro Raum zusammengefasst; Endzustand kommt an", async () => {
    server = await startServer({
      options: { limits: { stateCoalesceMs: 100, playerUpdateRate: perSecond(100, 100) } },
    });
    const { tv, code } = await createRoom(server);
    const p = await joinPlayer(server, code, "Anna");
    await tv.state((r) => r.players.length === 1);
    await sleep(150);
    tv.clear();
    for (let i = 0; i < 10; i++) p.client.send({ t: "player.update", name: `Anna ${i}` });
    await tv.state((r) => r.players[0]?.name === "Anna 9");
    await sleep(150);
    const count = 1 + tv.peekAll("room.state").length;
    expect(count).toBeLessThanOrEqual(3);
  });

  it("player.update: eigenes enges Limit; No-op-Update löst keinen Broadcast aus", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const p = await joinPlayer(server, code, "Anna");
    await tv.state((r) => r.players.length === 1);
    await sleep(80);
    tv.clear();
    p.client.send({ t: "player.update", avatar: "fuchs" }); // unverändert
    await tv.expectNone("room.state", 150);
    for (let i = 0; i < 4; i++) p.client.send({ t: "player.update", name: `N${i}` });
    const err = await p.client.error("RATE_LIMITED");
    expect(err.retryAfterMs).toBeGreaterThan(0);
  });
});

describe("SEC-04 TRUST_PROXY / Origin", () => {
  it("warnt einmalig, wenn bei TRUST_PROXY=false X-Forwarded-For ankommt", async () => {
    const stream = new PassThrough();
    const lines: string[] = [];
    stream.on("data", (d: Buffer) => lines.push(...d.toString().split("\n").filter(Boolean)));
    server = await startServer({ config: { logLevel: "warn", trustProxy: false }, options: { logStream: stream } });
    await fetch(`${server.url}/healthz`, { headers: xff("203.0.113.1") });
    await fetch(`${server.url}/healthz`, { headers: xff("203.0.113.2") });
    const c = await TestClient.connect(server.wsUrl, xff("203.0.113.3"));
    c.close();
    await sleep(50);
    expect(lines.filter((l) => l.includes("TRUST_PROXY=false"))).toHaveLength(1);
  });

  it("mit PUBLIC_URL macht X-Forwarded-Host keine fremde Origin „gleich“", async () => {
    server = await startServer({ config: { trustProxy: 1 } });
    await expect(
      TestClient.connect(server.wsUrl, { origin: "https://evil.example", "x-forwarded-host": "evil.example" }),
    ).rejects.toThrow(/403/);
  });
});

describe("SEC-06 Kick-Sperre", () => {
  it("gekickter Spieler (fremde IP) kann nicht erneut beitreten; Spieler im TV-Netz schon", async () => {
    server = await startServer({ config: { trustProxy: 1 } });
    const { tv, code } = await createRoom(server, xff("192.0.2.10"));
    const remote = await joinPlayer(server, code, "Troll", xff("198.51.100.66"));
    const local = await joinPlayer(server, code, "Kind", xff("192.0.2.10"));
    tv.send({ t: "player.kick", playerId: remote.playerId });
    await remote.client.closed;
    tv.send({ t: "player.kick", playerId: local.playerId });
    await local.client.closed;
    const again = await TestClient.connect(server.wsUrl, xff("198.51.100.66"));
    again.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Troll2", avatar: "alien" });
    await again.error("NOT_ALLOWED");
    again.send({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: remote.playerId, token: remote.token });
    await again.error("TOKEN_INVALID");
    const back = await joinPlayer(server, code, "Kind", xff("192.0.2.10"));
    expect(back.playerId).not.toBe(local.playerId);
  });
});

describe("SEC-10/13 /healthz und Source Maps", () => {
  it("/healthz öffentlich nur {ok:true}, Details nur mit METRICS_TOKEN; .map nur im Dev-Modus", async () => {
    const dir = mkdtempSync(join(tmpdir(), "couchplay-sec-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<!doctype html>");
    writeFileSync(join(dir, "assets", "a-1.js"), "1");
    writeFileSync(join(dir, "assets", "a-1.js.map"), "{}");
    const token = "t".repeat(24);
    const prod = await buildApp(
      { ...loadConfig({ NODE_ENV: "production", METRICS_TOKEN: token }), logLevel: "silent" },
      { staticDirs: { tv: dir, controller: dir } },
    );
    const dev = await buildApp({ ...loadConfig({}), logLevel: "silent" }, { staticDirs: { tv: dir, controller: dir } });
    try {
      expect((await prod.inject({ url: "/healthz" })).json()).toEqual({ ok: true });
      expect((await prod.inject({ url: "/healthz", headers: { authorization: "Bearer falsch" } })).json()).toEqual({ ok: true });
      expect((await prod.inject({ url: "/healthz", headers: { authorization: `Bearer ${token}` } })).json()).toEqual({
        ok: true,
        rooms: 0,
        connections: 0,
      });
      expect((await prod.inject({ url: "/assets/a-1.js.map" })).statusCode).toBe(404);
      expect((await prod.inject({ url: "/tv/assets/a-1.js.map" })).statusCode).toBe(404);
      expect((await prod.inject({ url: "/assets/a-1.js" })).statusCode).toBe(200);
      expect((await dev.inject({ url: "/assets/a-1.js.map" })).statusCode).toBe(200);
      expect((await dev.inject({ url: "/healthz" })).json()).toEqual({ ok: true });
    } finally {
      await prod.close();
      await dev.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Code-Review S2/S3", () => {
  it("S2: beim Rejoin im Spiel kommt room.joined vor jedem game.*-Paket", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    tv.send({ t: "lobby.selectGame", gameId: "testgame" });
    tv.send({ t: "lobby.start" });
    await a.client.next("game.view");
    a.client.close();
    await tv.state((r) => r.players[0]?.connected === false);
    const ws = new WebSocket(server.wsUrl);
    const order: ServerMessage["t"][] = [];
    ws.on("message", (d) => order.push((JSON.parse(d.toString()) as ServerMessage).t));
    await new Promise((r) => ws.once("open", r));
    ws.send(JSON.stringify({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: a.playerId, token: a.token }));
    await sleep(200);
    ws.close();
    expect(order.slice(0, 3)).toEqual(["room.joined", "catalog", "room.state"]);
    expect(order.filter((t) => t === "game.view").length).toBeGreaterThanOrEqual(1);
  });

  it("S3: wirft parseSettings, bleibt der Raum in der Lobby und der Auslöser erhält INVALID_SETTINGS", async () => {
    const picky = defineGame({
      manifest: { ...testGame.manifest, id: "picky" },
      inputSchema: testGame.inputSchema,
      parseSettings: (v) => {
        if (Number(v.target) > 5) throw new Error("zu groß");
        return { target: Number(v.target) };
      },
      createGame: testGame.createGame,
    });
    server = await startServer({ options: { games: [picky] } });
    const { tv, code } = await createRoom(server);
    await joinPlayer(server, code, "Anna");
    tv.send({ t: "lobby.selectGame", gameId: "picky" });
    tv.send({ t: "lobby.updateSettings", settings: { target: 9 } });
    await tv.state((r) => r.settings.target === 9);
    tv.clear();
    tv.send({ t: "lobby.start", rid: "s" });
    expect((await tv.error("INVALID_SETTINGS")).rid).toBe("s");
    await tv.expectNone("game.tv");
    tv.send({ t: "lobby.updateSettings", settings: { target: 3 } });
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
  });
});
