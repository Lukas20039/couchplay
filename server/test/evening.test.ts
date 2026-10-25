// Integration: Wartezeiten überspringen (game.skip) und Spieleabend (evening.*).
import { afterEach, describe, expect, it } from "vitest";
import { createRoom, joinPlayer, startServer, type TestServer } from "./helpers.js";

let server: TestServer;
afterEach(async () => {
  await server?.close();
});

async function lobbyWith(names: string[]) {
  server = await startServer();
  const { tv, code } = await createRoom(server);
  const players = [];
  for (const n of names) players.push(await joinPlayer(server, code, n));
  await tv.state((r) => r.players.length === names.length);
  tv.clear();
  for (const p of players) p.client.clear();
  return { tv, code, players };
}

describe("Wartezeit überspringen", () => {
  it("TV/Host überspringen per skipId, Spieler dürfen nicht, veraltete IDs werden ignoriert", async () => {
    const { tv, players } = await lobbyWith(["Anna", "Bernd"]);
    const [host, other] = players as [(typeof players)[number], (typeof players)[number]];
    tv.send({ t: "lobby.selectGame", gameId: "testgame" });
    tv.send({ t: "lobby.start" });
    const started = await tv.state((r) => r.phase === "game");
    expect(started.skipId ?? null).toBeNull();

    host.client.send({ t: "game.input", data: { type: "wait" } });
    const waiting = await tv.state((r) => typeof r.skipId === "number");
    const skipId = waiting.skipId as number;

    other.client.send({ t: "game.skip", skipId });
    await other.client.error("NOT_ALLOWED");

    host.client.send({ t: "game.skip", skipId });
    const results = await tv.state((r) => r.phase === "results");
    expect(results.skipId ?? null).toBeNull();

    // Revanche: alte ID ist wertlos.
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    host.client.send({ t: "game.input", data: { type: "wait" } });
    const again = await tv.state((r) => typeof r.skipId === "number");
    tv.send({ t: "game.skip", skipId: (again.skipId as number) + 1000 });
    await tv.expectNone("error");
    tv.send({ t: "game.skip", skipId: again.skipId as number });
    await tv.state((r) => r.phase === "results");
  });
});

describe("Spieleabend", () => {
  it("jeder für sich: Wertung, nächstes Spiel per room.toLobby, keine Revanche, Finale doppelt", async () => {
    const { tv, players } = await lobbyWith(["Anna", "Bernd"]);
    const [a, b] = players as [(typeof players)[number], (typeof players)[number]];
    tv.send({ t: "evening.start", games: ["testgame", "testgame"], teams: 0, doubleFinal: true });
    const lobby = await tv.state((r) => !!r.evening);
    expect(lobby.selectedGameId).toBe("testgame");
    expect(lobby.evening?.teams).toBeNull();
    expect(lobby.evening?.standings.map((s) => [s.name, s.points])).toEqual([
      ["Anna", 0],
      ["Bernd", 0],
    ]);

    // Spiel 1: Bernd gewinnt.
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    b.client.send({ t: "game.input", data: { type: "point" } });
    b.client.send({ t: "game.input", data: { type: "point" } });
    const r1 = await tv.state((r) => r.phase === "results");
    expect(r1.evening?.rounds).toEqual([
      {
        gameId: "testgame",
        double: false,
        awards: [
          { key: b.playerId, place: 1, points: 10 },
          { key: a.playerId, place: 2, points: 7 },
        ],
      },
    ]);
    expect(r1.evening?.standings[0]).toMatchObject({ key: b.playerId, points: 10, rank: 1, name: "Bernd" });

    // Keine Revanche im Abend.
    tv.send({ t: "lobby.start" });
    await tv.error("NOT_ALLOWED");

    // Weiter → nächstes Spiel (Finale, doppelt).
    tv.send({ t: "room.toLobby" });
    await tv.state((r) => r.phase === "lobby" && r.selectedGameId === "testgame");
    tv.send({ t: "lobby.start" });
    await tv.state((r) => r.phase === "game");
    a.client.send({ t: "game.input", data: { type: "point" } });
    a.client.send({ t: "game.input", data: { type: "point" } });
    const r2 = await tv.state((r) => r.phase === "results");
    expect(r2.evening?.rounds[1]?.double).toBe(true);
    // Anna: 7 + 20 = 27, Bernd: 10 + 14 = 24.
    expect(r2.evening?.standings.map((s) => [s.name, s.points, s.rank])).toEqual([
      ["Anna", 27, 1],
      ["Bernd", 24, 2],
    ]);

    // Abend vorbei: room.toLobby führt in die Lobby, Start ist gesperrt, bis der Abend beendet wird.
    tv.send({ t: "room.toLobby" });
    await tv.state((r) => r.phase === "lobby" && r.evening?.rounds.length === 2);
    tv.send({ t: "lobby.start" });
    await tv.error("NOT_ALLOWED");
    tv.send({ t: "evening.end" });
    await tv.state((r) => r.phase === "lobby" && !r.evening);
  });

  it("Teams: auslosen, wechseln (bis Spielstart), Wertung nach Durchschnittsrang, Nachzügler ins kleinste Team", async () => {
    const { tv, code, players } = await lobbyWith(["Anna", "Bernd", "Clara"]);
    const [a, b, c] = players as [(typeof players)[number], (typeof players)[number], (typeof players)[number]];
    tv.send({ t: "evening.start", games: ["testgame", "testgame"], teams: 2, doubleFinal: false });
    const lobby = await tv.state((r) => !!r.evening?.teams);
    const teams = lobby.evening?.teams ?? [];
    expect(teams.map((t) => t.length).sort()).toEqual([1, 2]);
    expect(teams.flat().sort()).toEqual([a.playerId, b.playerId, c.playerId].sort());

    // Spieler wechselt selbst; anderen umsetzen darf nur der Host.
    b.client.send({ t: "evening.setTeam", playerId: b.playerId, team: 1 });
    c.client.send({ t: "evening.setTeam", playerId: c.playerId, team: 1 });
    a.client.send({ t: "evening.setTeam", playerId: a.playerId, team: 0 });
    const set = await tv.state((r) => {
      const t = r.evening?.teams;
      return !!t && t[0]?.join() === a.playerId && t[1]?.length === 2;
    });
    expect(set.evening?.teams?.[1]?.sort()).toEqual([b.playerId, c.playerId].sort());
    b.client.send({ t: "evening.setTeam", playerId: c.playerId, team: 0 });
    await b.client.error("NOT_ALLOWED");

    // Neuer Spieler landet im kleineren Team 0.
    const d = await joinPlayer(server, code, "Dora");
    const withD = await tv.state((r) => r.players.length === 4);
    expect(withD.evening?.teams?.[0]).toEqual([a.playerId, d.playerId]);

    // Spiel: maxPlayers 3 → Anna, Bernd, Clara spielen. Bernd 2 Punkte (Platz 1), Anna 0, Clara 0.
    tv.send({ t: "lobby.start", playerIds: [a.playerId, b.playerId, c.playerId] });
    await tv.state((r) => r.phase === "game");
    // Teams sind ab jetzt fest.
    tv.send({ t: "evening.shuffle" });
    await tv.error("INVALID_PHASE");
    b.client.send({ t: "game.input", data: { type: "point" } });
    b.client.send({ t: "game.input", data: { type: "point" } });
    const res = await tv.state((r) => r.phase === "results");
    // Ranking: Bernd 1, Anna 2, Clara 3 → Team 0 (Anna) Ø 2, Team 1 (Bernd, Clara) Ø 2 → Gleichstand.
    expect(res.evening?.rounds[0]?.awards).toEqual([
      { key: "team:0", place: 1, points: 10 },
      { key: "team:1", place: 1, points: 10 },
    ]);
    expect(res.evening?.standings.map((s) => s.key)).toEqual(["team:0", "team:1"]);
    d.client.close();
  });

  it("Fehlerfälle: unbekanntes Spiel, zu wenige Spieler für Teams, Spielwahl ersetzt den Plan", async () => {
    const { tv } = await lobbyWith(["Anna"]);
    tv.send({ t: "evening.start", games: ["testgame", "gibtsnicht"], teams: 0, doubleFinal: false });
    await tv.error("GAME_NOT_FOUND");
    tv.send({ t: "evening.start", games: ["testgame", "testgame"], teams: 2, doubleFinal: false });
    await tv.error("PLAYER_COUNT");
    tv.send({ t: "evening.shuffle" });
    await tv.error("INVALID_PHASE");
    tv.send({ t: "evening.start", games: ["testgame", "testgame", "testgame"], teams: 0, doubleFinal: false });
    await tv.state((r) => r.evening?.games.length === 3);
  });
});
