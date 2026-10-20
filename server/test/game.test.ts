// Integration: Spielstart, Teilnehmerauswahl, Zuschauer, Ende → results → lobby,
// Revanche (ctx.previous), Crash-Isolation, Reconnect mit gecachten Zuständen.
import { PROTOCOL_VERSION } from "@couchplay/protocol";
import { defineGame } from "@couchplay/game-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { TestClient, createRoom, joinPlayer, startServer, type TestServer } from "./helpers.js";
import { testGame, type TestTvState } from "./fixtures/test-game.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

async function lobbyWith(names: string[], opts: Parameters<typeof startServer>[0] = {}) {
  server = await startServer(opts);
  const { tv, code, tvToken } = await createRoom(server);
  const players = [];
  for (const n of names) players.push(await joinPlayer(server, code, n));
  tv.send({ t: "lobby.selectGame", gameId: "testgame" });
  await tv.state((r) => r.selectedGameId === "testgame" && r.players.length === names.length);
  tv.clear();
  for (const p of players) p.client.clear();
  return { tv, code, tvToken, players };
}

describe("Spielablauf", () => {
  it("Start → game.tv/game.view → Ende → results → room.toLobby → lobby", async () => {
    const { tv, players } = await lobbyWith(["Anna", "Bernd"]);
    const [a, b] = players as [(typeof players)[number], (typeof players)[number]];
    a.client.send({ t: "lobby.start", rid: "go" });
    const started = await tv.state((r) => r.phase === "game");
    expect(started.gamePlayerIds).toEqual([a.playerId, b.playerId]);
    const firstTv = await tv.next("game.tv");
    expect(firstTv.gameId).toBe("testgame");
    expect((firstTv.state as TestTvState).scores).toEqual({ [a.playerId]: 0, [b.playerId]: 0 });
    const viewA = await a.client.next("game.view");
    expect(viewA.view).toEqual({ mine: 0 });
    expect(viewA.seq).toBeGreaterThan(firstTv.seq);

    a.client.send({ t: "game.input", data: { type: "point" } });
    const tv2 = await tv.next("game.tv", (m) => (m.state as TestTvState).scores[a.playerId] === 1);
    expect(tv2.seq).toBeGreaterThan(viewA.seq);
    // Ungültige Eingabe → INVALID_INPUT, Spiel läuft weiter.
    b.client.send({ t: "game.input", data: { type: "quatsch" } });
    await b.client.error("INVALID_INPUT");

    a.client.send({ t: "game.input", data: { type: "point" } });
    const results = await tv.state((r) => r.phase === "results");
    expect(results.results?.gameId).toBe("testgame");
    expect(results.results?.ranking[0]).toEqual({ playerId: a.playerId, score: 2, rank: 1 });
    expect(results.gamePlayerIds).toEqual([a.playerId, b.playerId]);
    await b.client.state((r) => r.phase === "results");

    // Revanche: ctx.previous enthält das letzte Ergebnis.
    tv.send({ t: "lobby.start" });
    const rematch = await tv.next("game.tv", (m) => (m.state as TestTvState).previousWinner !== null);
    expect((rematch.state as TestTvState).previousWinner).toBe(a.playerId);
    tv.send({ t: "game.abort" });
    await tv.state((r) => r.phase === "lobby" && r.results === null);

    // results → toLobby
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    b.client.send({ t: "game.input", data: { type: "finish" } });
    await tv.state((r) => r.phase === "results");
    b.client.send({ t: "room.toLobby" });
    await b.client.error("NOT_ALLOWED");
    a.client.send({ t: "room.toLobby" });
    const lobby = await tv.state((r) => r.phase === "lobby");
    expect(lobby.results).toBeNull();
  });

  it("Teilnehmerauswahl: Default kappt auf maxPlayers, Rest sind Zuschauer", async () => {
    const { tv, code, players } = await lobbyWith(["A", "B", "C", "D"]);
    tv.send({ t: "lobby.start" });
    const room = await tv.state((r) => r.phase === "game");
    expect(room.gamePlayerIds).toEqual(players.slice(0, 3).map((p) => p.playerId));
    const spectator = players[3]!;
    await spectator.client.state((r) => r.phase === "game");
    await players[0]!.client.next("game.view");
    await spectator.client.expectNone("game.view");
    spectator.client.send({ t: "game.input", data: { type: "point" } });
    await spectator.client.error("NOT_ALLOWED");

    // Während der Runde Beitretende sind Zuschauer.
    const late = await joinPlayer(server, code, "Spät");
    const lateState = await late.client.state();
    expect(lateState.phase).toBe("game");
    expect(lateState.gamePlayerIds).not.toContain(late.playerId);
    await late.client.expectNone("game.view");
    late.client.send({ t: "game.input", data: { type: "point" } });
    await late.client.error("NOT_ALLOWED");
  });

  it("Teilnehmerauswahl mit playerIds und Fehlerfälle", async () => {
    const { tv, players } = await lobbyWith(["A", "B", "C", "D"]);
    const ids = players.map((p) => p.playerId);
    tv.send({ t: "lobby.start", playerIds: ids });
    await tv.error("PLAYER_COUNT");
    tv.send({ t: "lobby.start", playerIds: ["p_gibtsnicht"] });
    await tv.error("PLAYER_NOT_FOUND");
    tv.send({ t: "lobby.start", playerIds: [ids[0], ids[0]] });
    await tv.error("BAD_MESSAGE");
    players[2]!.client.close();
    await tv.state((r) => r.players.some((p) => !p.connected));
    tv.send({ t: "lobby.start", playerIds: [ids[2]] });
    await tv.error("PLAYER_NOT_CONNECTED");

    tv.send({ t: "lobby.start", playerIds: [ids[3], ids[1]] });
    const room = await tv.state((r) => r.phase === "game");
    expect(room.gamePlayerIds).toEqual([ids[3], ids[1]]);
    await players[3]!.client.next("game.view");
    await players[1]!.client.next("game.view");
    await players[0]!.client.expectNone("game.view");
  });

  it("Spieler-Reconnect im Spiel: gecachte game.view wird erneut gesendet; TV-resume bekommt game.tv", async () => {
    const { tv, code, tvToken, players } = await lobbyWith(["Anna", "Bernd"]);
    const [a] = players as [(typeof players)[number]];
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    a.client.send({ t: "game.input", data: { type: "point" } });
    await a.client.next("game.view", (m) => (m.view as { mine: number }).mine === 1);
    a.client.close();
    await tv.state((r) => r.players.some((p) => p.id === a.playerId && !p.connected));

    const c = await TestClient.connect(server.wsUrl);
    c.send({ t: "room.rejoin", v: PROTOCOL_VERSION, code, playerId: a.playerId, token: a.token });
    await c.next("room.joined");
    await c.next("catalog");
    await c.state((r) => r.phase === "game");
    expect((await c.next("game.view")).view).toEqual({ mine: 1 });

    tv.close();
    const tv2 = await TestClient.connect(server.wsUrl);
    tv2.send({ t: "room.resume", v: PROTOCOL_VERSION, code, tvToken });
    await tv2.next("room.resumed");
    const cached = await tv2.next("game.tv");
    expect((cached.state as TestTvState).scores[a.playerId]).toBe(1);
  });

  it("Teilnehmer überschreitet Gnadenfrist → onPlayerLeave; letzter weg → Spiel endet", async () => {
    const { tv, players } = await lobbyWith(["Anna"], { options: { limits: { reconnectGraceMs: 150 } } });
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    players[0]!.client.close();
    const room = await tv.state((r) => r.phase === "results", 2000);
    expect(room.players).toHaveLength(0);
  });
});

describe("Crash-Isolation", () => {
  it("Exception im Spiel → INTERNAL an TV + Spieler, Raum zurück in Lobby, Server läuft weiter", async () => {
    const { tv, players } = await lobbyWith(["Anna", "Bernd"]);
    const [a, b] = players as [(typeof players)[number], (typeof players)[number]];
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    a.client.send({ t: "game.input", data: { type: "crash" } });
    await tv.error("INTERNAL");
    await a.client.error("INTERNAL");
    await b.client.error("INTERNAL");
    const room = await tv.state((r) => r.phase === "lobby");
    expect(room.selectedGameId).toBe("testgame");
    expect(room.results).toBeNull();

    const health = await fetch(`${server.url}/healthz`);
    expect(health.status).toBe(200);
    // Neues Spiel funktioniert.
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    await tv.next("game.tv");
  });

  it("Exception schon in createGame() bzw. nicht serialisierbarer Zustand", async () => {
    const broken = defineGame({
      manifest: { ...testGame.manifest, id: "broken", settings: [] },
      inputSchema: z.unknown(),
      createGame() {
        throw new Error("kaputt beim Start");
      },
    });
    const bigint = defineGame({
      manifest: { ...testGame.manifest, id: "bigint", settings: [] },
      inputSchema: z.unknown(),
      createGame(ctx) {
        ctx.broadcastTv({ n: BigInt(1) });
        return { onPlayerInput() {}, onPlayerLeave() {} };
      },
    });
    server = await startServer({ options: { games: [broken, bigint] } });
    const { tv, code } = await createRoom(server);
    await joinPlayer(server, code, "Anna");
    for (const id of ["broken", "bigint"]) {
      tv.clear();
      tv.send({ t: "lobby.selectGame", gameId: id });
      await tv.state((r) => r.selectedGameId === id);
      tv.send({ t: "lobby.start" });
      await tv.error("INTERNAL");
      await tv.state((r) => r.phase === "lobby");
    }
  });
});
