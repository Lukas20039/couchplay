// Integration: Raumverwaltung, Join/Rejoin/Resume, Host-Wechsel, Rollen/Phasen, Fehlerfälle.
import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION, WS_CLOSE } from "@couchplay/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { TestClient, createRoom, joinPlayer, sleep, startServer, type TestServer } from "./helpers.js";
import { testGame } from "./fixtures/test-game.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

describe("Raum erstellen und beitreten", () => {
  it("TV erstellt Raum: room.created → catalog → room.state", async () => {
    server = await startServer();
    const tv = await TestClient.connect(server.wsUrl);
    tv.send({ t: "room.create", v: PROTOCOL_VERSION, rid: "r1" });
    const created = await tv.next("room.created");
    expect(created.code).toMatch(/^\d{6}$/);
    expect(created.rid).toBe("r1");
    expect(created.joinUrl).toBe(`https://play.example.org/j/${created.code}`);
    expect(created.tvToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const catalog = await tv.next("catalog");
    expect(catalog.games.map((g) => g.id)).toEqual(["testgame"]);
    const room = await tv.state();
    expect(room).toMatchObject({ code: created.code, phase: "lobby", players: [], hostId: null, tvConnected: true });
    expect(server.app.couchplay.rooms.size).toBe(1);
  });

  it("ohne PUBLIC_URL wird joinUrl aus dem Host-Header abgeleitet", async () => {
    server = await startServer({ config: { publicUrl: null, trustProxy: 1 } });
    const { joinUrl, code } = await createRoom(server, { "x-forwarded-proto": "https", "x-forwarded-host": "tv.example.net" });
    expect(joinUrl).toBe(`https://tv.example.net/j/${code}`);
    const plain = await createRoom(server);
    expect(plain.joinUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/j\/\d{6}$/);
  });

  it("8 Spieler treten bei, der 9. wird abgelehnt; erster Spieler ist Host; Farben eindeutig", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const players = [];
    for (let i = 0; i < 8; i++) players.push(await joinPlayer(server, code, `Spieler ${i + 1}`));
    const room = await tv.state((r) => r.players.length === 8);
    expect(room.hostId).toBe(players[0]?.playerId);
    expect(room.players[0]?.isHost).toBe(true);
    expect(room.players.filter((p) => p.isHost)).toHaveLength(1);
    expect(new Set(room.players.map((p) => p.color)).size).toBe(8);

    const ninth = await TestClient.connect(server.wsUrl);
    ninth.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Neun", avatar: "eule", rid: "j9" });
    const err = await ninth.error("ROOM_FULL");
    expect(err.rid).toBe("j9");
  });

  it("Name: ungültig und doppelt (case-insensitive)", async () => {
    server = await startServer();
    const { code } = await createRoom(server);
    await joinPlayer(server, code, "Anna");
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "  ANNA ", avatar: "fuchs" });
    await c.error("NAME_TAKEN");
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "​ ", avatar: "fuchs" });
    await c.error("NAME_INVALID");
    // Verbindung bleibt nutzbar.
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Berta", avatar: "fuchs" });
    await c.next("room.joined");
  });

  it("falscher Code → ROOM_NOT_FOUND, Verbindung bleibt offen", async () => {
    server = await startServer();
    const { code } = await createRoom(server);
    const wrong = code === "000000" ? "000001" : "000000";
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code: wrong, name: "Anna", avatar: "fuchs" });
    await c.error("ROOM_NOT_FOUND");
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    await c.next("room.joined");
  });

  it("abgelaufener Code (Inaktivität) → room.closed{idle}, danach ROOM_NOT_FOUND", async () => {
    server = await startServer({ options: { limits: { roomIdleTimeoutMs: 200, sweepIntervalMs: 50 } } });
    const { tv, code } = await createRoom(server);
    const closed = await tv.next("room.closed", undefined, 2000);
    expect(closed.reason).toBe("idle");
    expect((await tv.closed).code).toBe(WS_CLOSE.ROOM_CLOSED);
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.join", v: PROTOCOL_VERSION, code, name: "Anna", avatar: "fuchs" });
    await c.error("ROOM_NOT_FOUND");
    expect(server.app.couchplay.rooms.size).toBe(0);
  });

  it("Aktivität verlängert die Raum-Lebensdauer", async () => {
    server = await startServer({ options: { limits: { roomIdleTimeoutMs: 300, sweepIntervalMs: 50 } } });
    const { tv } = await createRoom(server);
    for (let i = 0; i < 8; i++) {
      tv.send({ t: "lobby.selectGame", gameId: "testgame" });
      await sleep(100);
    }
    expect(tv.closeInfo).toBeNull();
    expect(server.app.couchplay.rooms.size).toBe(1);
  });

  it("ping allein hält einen Raum NICHT offen (Keep-alive ≠ Aktivität)", async () => {
    server = await startServer({ options: { limits: { roomIdleTimeoutMs: 300, sweepIntervalMs: 50 } } });
    const { tv } = await createRoom(server);
    const iv = setInterval(() => tv.send({ t: "ping" }), 50);
    try {
      expect((await tv.next("room.closed", undefined, 2000)).reason).toBe("idle");
    } finally {
      clearInterval(iv);
    }
  });

  it("room.close (TV) schließt den Raum für alle", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const p = await joinPlayer(server, code, "Anna");
    tv.send({ t: "room.close" });
    expect((await p.client.next("room.closed")).reason).toBe("closed_by_tv");
    expect((await tv.next("room.closed")).reason).toBe("closed_by_tv");
    expect((await p.client.closed).code).toBe(WS_CLOSE.ROOM_CLOSED);
    expect(server.app.couchplay.rooms.size).toBe(0);
  });
});

describe("Host-Wechsel, leave, kick", () => {
  it("Host verlässt den Raum → am längsten anwesender Spieler wird Host", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    const b = await joinPlayer(server, code, "Bernd");
    await joinPlayer(server, code, "Clara");
    await tv.state((r) => r.players.length === 3);
    tv.clear();
    a.client.send({ t: "room.leave" });
    expect((await a.client.next("room.closed")).reason).toBe("left");
    expect((await a.client.closed).code).toBe(WS_CLOSE.NORMAL);
    const room = await tv.state((r) => r.players.length === 2);
    expect(room.hostId).toBe(b.playerId);
    expect(room.players.find((p) => p.id === b.playerId)?.isHost).toBe(true);
  });

  it("Host bleibt während der Gnadenfrist Host, danach Wechsel", async () => {
    server = await startServer({ options: { limits: { reconnectGraceMs: 300 } } });
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    const b = await joinPlayer(server, code, "Bernd");
    await tv.state((r) => r.players.length === 2);
    tv.clear();
    a.client.close();
    const during = await tv.state((r) => r.players.some((p) => p.id === a.playerId && !p.connected));
    expect(during.hostId).toBe(a.playerId);
    const after = await tv.state((r) => r.players.length === 1, 2000);
    expect(after.hostId).toBe(b.playerId);
  });

  it("player.kick: Ziel erhält room.closed{kicked} + Close 4003; nur TV/Host darf", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    const b = await joinPlayer(server, code, "Bernd");
    b.client.send({ t: "player.kick", playerId: a.playerId, rid: "k" });
    expect((await b.client.error("NOT_ALLOWED")).rid).toBe("k");
    tv.send({ t: "player.kick", playerId: "p_unbekannt" });
    await tv.error("PLAYER_NOT_FOUND");
    a.client.send({ t: "player.kick", playerId: b.playerId });
    expect((await b.client.next("room.closed")).reason).toBe("kicked");
    expect((await b.client.closed).code).toBe(WS_CLOSE.KICKED);
    await tv.state((r) => r.players.length === 1);
  });

  it("player.update ändert Name/Avatar, prüft Eindeutigkeit", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    await joinPlayer(server, code, "Bernd");
    a.client.send({ t: "player.update", name: "bernd" });
    await a.client.error("NAME_TAKEN");
    a.client.send({ t: "player.update", name: "Anni", avatar: "eule" });
    const room = await tv.state((r) => r.players.some((p) => p.name === "Anni"));
    expect(room.players[0]).toMatchObject({ name: "Anni", avatar: "eule" });
  });
});

describe("Reconnect", () => {
  it("rejoin innerhalb der Gnadenfrist: gleicher Platz, gleiche ID", async () => {
    server = await startServer({ options: { limits: { reconnectGraceMs: 1000 } } });
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    a.client.close();
    await tv.state((r) => r.players[0]?.connected === false);
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: a.playerId, token: a.token, rid: "rj" });
    const joined = await c.next("room.joined");
    expect(joined).toMatchObject({ playerId: a.playerId, token: a.token, rid: "rj" });
    await c.next("catalog");
    const room = await c.state();
    expect(room.players).toHaveLength(1);
    expect(room.players[0]).toMatchObject({ id: a.playerId, connected: true, isHost: true, name: "Anna" });
  });

  it("rejoin nach Ablauf der Gnadenfrist → TOKEN_INVALID (fatal)", async () => {
    server = await startServer({ options: { limits: { reconnectGraceMs: 150 } } });
    const { tv, code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    a.client.close();
    await tv.state((r) => r.players.length === 0, 2000);
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: a.playerId, token: a.token });
    const err = await c.error("TOKEN_INVALID");
    expect(err.fatal).toBe(true);
    await c.closed;
  });

  it("rejoin mit falschem Token → TOKEN_INVALID", async () => {
    server = await startServer();
    const { code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: a.playerId, token: "A".repeat(32) });
    await c.error("TOKEN_INVALID");
  });

  it("doppelte Verbindung: alte wird mit 4002 geschlossen", async () => {
    server = await startServer();
    const { code } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: a.playerId, token: a.token });
    await c.next("room.joined");
    expect((await a.client.closed).code).toBe(WS_CLOSE.SESSION_REPLACED);
    const room = await c.state((r) => r.players[0]?.connected === true);
    expect(room.players).toHaveLength(1);
  });

  it("TV-resume: tvConnected wechselt, room.resumed → catalog → room.state", async () => {
    server = await startServer();
    const { tv, code, tvToken } = await createRoom(server);
    const a = await joinPlayer(server, code, "Anna");
    tv.close();
    await a.client.state((r) => !r.tvConnected);
    const bad = await TestClient.connect(server.wsUrl);
    bad.send({ t: "room.resume", v: PROTOCOL_VERSION, code, tvToken: "B".repeat(32) });
    await bad.error("TOKEN_INVALID");
    const tv2 = await TestClient.connect(server.wsUrl);
    tv2.send({ t: "room.resume", v: PROTOCOL_VERSION, code, tvToken, rid: "res" });
    const resumed = await tv2.next("room.resumed");
    expect(resumed).toMatchObject({ code, rid: "res", joinUrl: `https://play.example.org/j/${code}` });
    await tv2.next("catalog");
    expect((await tv2.state()).tvConnected).toBe(true);
    await a.client.state((r) => r.tvConnected);
  });

  it("zweites TV mit gleichem Token übernimmt, altes bekommt 4002", async () => {
    server = await startServer();
    const { tv, code, tvToken } = await createRoom(server);
    const tv2 = await TestClient.connect(server.wsUrl);
    tv2.send({ t: "room.resume", v: PROTOCOL_VERSION, code, tvToken });
    await tv2.next("room.resumed");
    expect((await tv.closed).code).toBe(WS_CLOSE.SESSION_REPLACED);
  });
});

describe("Protokoll-Durchsetzung", () => {
  it("ungültiges JSON / unbekannter Typ → BAD_MESSAGE, Verbindung bleibt", async () => {
    server = await startServer();
    const { tv } = await createRoom(server);
    tv.sendRaw("{kein json");
    await tv.error("BAD_MESSAGE");
    tv.send({ t: "gibts.nicht", rid: "x1" });
    expect((await tv.error("BAD_MESSAGE")).rid).toBe("x1");
    tv.send({ t: "ping", ts: 42 });
    const pong = await tv.next("pong");
    expect(pong.ts).toBe(42);
    expect(Math.abs(pong.serverTime - Date.now())).toBeLessThan(5000);
  });

  it("zu große Nachricht → MESSAGE_TOO_LARGE", async () => {
    server = await startServer();
    const { tv } = await createRoom(server);
    tv.send({ t: "ping", pad: "x".repeat(MAX_MESSAGE_BYTES + 10) });
    await tv.error("MESSAGE_TOO_LARGE");
    tv.send({ t: "ping" });
    await tv.next("pong");
  });

  it("Nachricht vor Handshake → NOT_IN_ROOM; zweiter Handshake → ALREADY_IN_ROOM", async () => {
    server = await startServer();
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "ping" });
    await c.error("NOT_IN_ROOM");
    c.send({ t: "lobby.start" });
    await c.error("NOT_IN_ROOM");
    c.send({ t: "room.create", v: PROTOCOL_VERSION });
    await c.next("room.created");
    c.send({ t: "room.create", v: PROTOCOL_VERSION });
    await c.error("ALREADY_IN_ROOM");
  });

  it("falsche Protokollversion → VERSION_MISMATCH fatal + Close 4001", async () => {
    server = await startServer();
    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.create", v: PROTOCOL_VERSION + 1 });
    const err = await c.error("VERSION_MISMATCH");
    expect(err.fatal).toBe(true);
    expect((await c.closed).code).toBe(WS_CLOSE.VERSION_MISMATCH);
  });

  it("Handshake-Timeout → Close 4009", async () => {
    server = await startServer({ options: { limits: { handshakeTimeoutMs: 100 } } });
    const c = await TestClient.connect(server.wsUrl);
    expect((await c.closed).code).toBe(WS_CLOSE.HANDSHAKE_TIMEOUT);
  });

  it("Rollen × Phasen laut CLIENT_MESSAGE_RULES", async () => {
    server = await startServer();
    const { tv, code } = await createRoom(server);
    const host = await joinPlayer(server, code, "Host");
    const p = await joinPlayer(server, code, "Spieler");

    // Nicht-Host darf keine Lobby-Aktionen.
    p.client.send({ t: "lobby.selectGame", gameId: "testgame" });
    await p.client.error("NOT_ALLOWED");
    p.client.send({ t: "lobby.start" });
    await p.client.error("NOT_ALLOWED");
    // TV darf nicht spielen, nicht "verlassen", Spieler nicht schließen.
    tv.send({ t: "game.input", data: {} });
    await tv.error("NOT_ALLOWED");
    tv.send({ t: "room.leave" });
    await tv.error("NOT_ALLOWED");
    host.client.send({ t: "room.close" });
    await host.client.error("NOT_ALLOWED");
    // Phase falsch.
    tv.send({ t: "room.toLobby" });
    await tv.error("INVALID_PHASE");
    tv.send({ t: "game.abort" });
    await tv.error("INVALID_PHASE");
    host.client.send({ t: "game.input", data: { type: "point" } });
    await host.client.error("INVALID_PHASE");
    // Lobby-Fehler.
    host.client.send({ t: "lobby.start", rid: "s" });
    expect((await host.client.error("NO_GAME_SELECTED")).rid).toBe("s");
    host.client.send({ t: "lobby.updateSettings", settings: { target: 3 } });
    await host.client.error("INVALID_SETTINGS");
    host.client.send({ t: "lobby.selectGame", gameId: "gibtsnicht" });
    await host.client.error("GAME_NOT_FOUND");
    // Host darf.
    host.client.send({ t: "lobby.selectGame", gameId: "testgame" });
    const selected = await tv.state((r) => r.selectedGameId === "testgame");
    expect(selected.settings).toEqual({ target: 2 });
    expect(selected.playerLimits).toEqual({ minPlayers: 1, maxPlayers: 3 });
    host.client.send({ t: "lobby.updateSettings", settings: { target: 99 } });
    await host.client.error("INVALID_SETTINGS");
    tv.send({ t: "lobby.updateSettings", settings: { target: 5 } });
    expect((await host.client.state((r) => r.settings.target === 5)).settings).toEqual({ target: 5 });
    // In Phase game keine Lobby-Aktionen, kein player.update.
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    tv.send({ t: "lobby.selectGame", gameId: "testgame" });
    await tv.error("INVALID_PHASE");
    p.client.send({ t: "player.update", name: "Neu" });
    await p.client.error("INVALID_PHASE");
    p.client.send({ t: "game.abort" });
    await p.client.error("NOT_ALLOWED");
    host.client.send({ t: "game.abort" });
    await tv.state((r) => r.phase === "lobby");
  });

  it("WS-Origin-Prüfung (Produktion): fremde Origin abgelehnt, gleiche/erlaubte Origin ok", async () => {
    server = await startServer({ config: { allowedOrigins: ["https://extra.example.com"] } });
    await expect(TestClient.connect(server.wsUrl, { origin: "https://evil.example.com" })).rejects.toThrow(/403/);
    const port = new URL(server.url).port;
    const same = await TestClient.connect(server.wsUrl, { origin: `http://127.0.0.1:${port}` });
    const pub = await TestClient.connect(server.wsUrl, { origin: "https://play.example.org" });
    const extra = await TestClient.connect(server.wsUrl, { origin: "https://extra.example.com" });
    for (const c of [same, pub, extra]) c.close();
  });

  it("WS-Origin-Prüfung (Dev-Modus): jede Origin erlaubt; falscher Pfad → 404", async () => {
    server = await startServer({ config: { devMode: true } });
    const c = await TestClient.connect(server.wsUrl, { origin: "http://localhost:5173" });
    c.close();
    await expect(TestClient.connect(server.wsUrl.replace("/ws", "/nicht-ws"))).rejects.toThrow(/404/);
  });
});

describe("Freischaltungen (player.progress)", () => {
  const unlockGame = {
    ...testGame,
    manifest: {
      ...testGame.manifest,
      id: "unlockgame",
      progressKey: "cp.unlockgame.xp",
      settings: [
        ...testGame.manifest.settings,
        {
          type: "select" as const,
          key: "mode",
          label: "Modus",
          options: [{ value: "normal", label: "Normal" }, { value: "blitz", label: "Blitz", minProgress: 100 }],
          default: "normal",
        },
      ],
    },
  };

  it("Raum zeigt das Maximum, gesperrte Optionen werden abgelehnt und nach Verlust zurückgesetzt", async () => {
    server = await startServer({ options: { games: [testGame, unlockGame] } });
    const { tv, code } = await createRoom(server);
    const host = await joinPlayer(server, code, "Anna");
    const pro = await joinPlayer(server, code, "Ben");
    tv.send({ t: "lobby.selectGame", gameId: "unlockgame" });
    await tv.state((r) => r.selectedGameId === "unlockgame");

    tv.send({ t: "lobby.updateSettings", settings: { mode: "blitz" } });
    await tv.error("INVALID_SETTINGS");

    // Spiele ohne progressKey und unbekannte Spiele werden ignoriert.
    host.client.send({ t: "player.progress", progress: { unlockgame: 30, testgame: 500, fremd: 7 } });
    expect((await tv.state((r) => r.progress.unlockgame === 30)).progress).toEqual({ unlockgame: 30 });
    pro.client.send({ t: "player.progress", progress: { unlockgame: 150 } });
    expect((await tv.state((r) => r.progress.unlockgame === 150)).progress).toEqual({ unlockgame: 150 });

    tv.send({ t: "lobby.updateSettings", settings: { mode: "blitz" } });
    await tv.state((r) => r.settings.mode === "blitz");

    pro.client.send({ t: "room.leave" });
    const after = await tv.state((r) => r.players.length === 1 && r.progress.unlockgame !== 150 && r.selectedGameId !== null);
    expect(after.progress).toEqual({ unlockgame: 30 });
    expect(after.settings.mode).toBe("normal");
  });

  it("TV darf keinen Fortschritt melden", async () => {
    server = await startServer();
    const { tv } = await createRoom(server);
    tv.send({ t: "player.progress", progress: {} });
    await tv.error("NOT_ALLOWED");
  });
});
