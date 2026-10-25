// Spieleabend und Überspringen am Handy (gerendert, Mock-WebSocket).
import type { Evening, GameManifest, RoomState } from "@couchplay/protocol";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { createApp } from "../src/app.js";
import { suggestGames, toggleGame } from "../src/components/Evening.js";
import { MockSocket, player, room, TOKEN } from "./helpers.js";

vi.mock("../src/games.js", () => ({ CONTROLLER_VIEWS: {} }));

const game = (id: string, maxPlayers = 8): GameManifest => ({
  id,
  name: id.toUpperCase(),
  description: "",
  version: "1.0.0",
  minPlayers: 1,
  maxPlayers,
  botSupport: false,
  settings: [],
});
const catalog = [game("quiz"), game("tictactoe", 2), game("kennstdu")];

async function joined(state: RoomState, playerId = "p1") {
  const app = createApp({ pathname: "/j/042137", url: "ws://t/ws", createSocket: (u) => new MockSocket(u), bindWindow: false });
  const root = document.getElementById("app")!;
  await act(() => render(<App app={app} />, root));
  await act(() => app.join("Anna", "fuchs"));
  const ws = MockSocket.last();
  await act(() => {
    ws.open();
    ws.receive({ t: "room.joined", v: 1, code: "042137", playerId, token: TOKEN });
    ws.receive({ t: "catalog", games: catalog });
    ws.receive({ t: "room.state", room: state });
  });
  ws.sent = [];
  return { app, ws, root };
}

const q = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const click = (el: HTMLElement | null) => act(() => el!.click());

beforeEach(() => {
  localStorage.clear();
  MockSocket.reset();
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => {
  render(null, document.getElementById("app")!);
});

const teams: Evening = {
  games: ["quiz", "kennstdu"],
  teams: [["p1"], ["p2"]],
  teamsLocked: false,
  doubleFinal: true,
  rounds: [],
  standings: [
    { key: "team:0", points: 0, rank: 1 },
    { key: "team:1", points: 0, rank: 1 },
  ],
};

describe("Helfer", () => {
  it("Planer-Auswahl und Vorschlag", () => {
    expect(toggleGame(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleGame(["a", "b"], "a")).toEqual(["b"]);
    expect(suggestGames(catalog, 3)).toEqual(["quiz", "tictactoe", "kennstdu"]);
  });
});

describe("Spieleabend am Handy", () => {
  it("Host plant einen Abend mit Teams", async () => {
    const { ws, root } = await joined(room({ selectedGameId: "quiz", playerLimits: { minPlayers: 1, maxPlayers: 8 } }));
    await click(q(root, "evening-open"));
    // Vorschlag: alle drei; TicTacToe abwählen, 2 Teams, Finale nicht doppelt.
    await click(q(root, "evening-game-tictactoe"));
    await click(q(root, "evening-mode-2"));
    await click(q(root, "evening-double"));
    await click(q(root, "evening-start"));
    expect(ws.sent).toEqual([{ t: "evening.start", games: ["quiz", "kennstdu"], teams: 2, doubleFinal: false }]);
  });

  it("Spieler wechselt ins andere Team; Host lost neu aus; Start-Label zeigt Spielnummer", async () => {
    const r = room({ selectedGameId: "quiz", playerLimits: { minPlayers: 1, maxPlayers: 8 }, evening: teams });
    const { ws, root } = await joined(r);
    expect(q(root, "evening-card")).not.toBeNull();
    expect(q(root, "host-game-select")).toBeNull();
    expect(q(root, "start-button")?.textContent).toBe("Spiel 1 starten");
    // Eigenes Team ist kein Button.
    expect(q(root, "team-0")?.tagName).toBe("DIV");
    await click(q(root, "team-1"));
    await click(q(root, "evening-shuffle"));
    expect(ws.sent).toEqual([{ t: "evening.setTeam", playerId: "p1", team: 1 }, { t: "evening.shuffle" }]);
  });

  it("Ergebnis zeigt Abendpunkte; Host geht zum nächsten Spiel", async () => {
    const e: Evening = {
      ...teams,
      teamsLocked: true,
      rounds: [{ gameId: "quiz", double: false, awards: [{ key: "team:1", place: 1, points: 10 }, { key: "team:0", place: 2, points: 7 }] }],
      standings: [
        { key: "team:1", points: 10, rank: 1 },
        { key: "team:0", points: 7, rank: 2 },
      ],
    };
    const r = room({ phase: "results", selectedGameId: "quiz", results: { gameId: "quiz", ranking: [{ playerId: "p2", score: 5, rank: 1 }, { playerId: "p1", score: 3, rank: 2 }] }, evening: e });
    const { ws, root } = await joined(r);
    expect(q(root, "evening-award")?.textContent).toBe("Team Feuer: +7 Abendpunkte");
    expect(q(root, "again-button")).toBeNull();
    expect(q(root, "evening-next")?.textContent).toBe("Weiter: KENNSTDU");
    await click(q(root, "evening-next"));
    expect(ws.sent).toEqual([{ t: "room.toLobby" }]);
  });

  it("Siegerehrung nach dem letzten Spiel", async () => {
    const e: Evening = {
      ...teams,
      teams: null,
      teamsLocked: true,
      rounds: [
        { gameId: "quiz", double: false, awards: [] },
        { gameId: "kennstdu", double: true, awards: [] },
      ],
      standings: [
        { key: "p2", points: 27, rank: 1, name: "P2", avatar: "fuchs" },
        { key: "p1", points: 17, rank: 2, name: "P1", avatar: "fuchs" },
      ],
    };
    const { ws, root } = await joined(room({ evening: e, players: [player("p1", { isHost: true }), player("p2", { color: 1 })] }));
    expect(q(root, "evening-finale")).not.toBeNull();
    expect(q(root, "finale-winner")?.textContent).toBe("P2");
    await click(q(root, "finale-done"));
    expect(ws.sent).toEqual([{ t: "evening.end" }]);
  });

  it("Host sieht Weiter nur bei überspringbarer Wartezeit", async () => {
    const r = room({ phase: "game", selectedGameId: "quiz", gamePlayerIds: ["p1", "p2"] });
    const { ws, root } = await joined(r);
    expect(q(root, "skip-button")).toBeNull();
    await act(() => ws.receive({ t: "room.state", room: { ...r, skipId: 4 } }));
    await click(q(root, "skip-button"));
    expect(ws.sent).toEqual([{ t: "game.skip", skipId: 4 }]);
  });

  it("Nicht-Host sieht keinen Weiter-Knopf", async () => {
    const r = room({ phase: "game", selectedGameId: "quiz", gamePlayerIds: ["p1", "p2"], skipId: 4 });
    const { root } = await joined(r, "p2");
    expect(q(root, "skip-button")).toBeNull();
  });
});
