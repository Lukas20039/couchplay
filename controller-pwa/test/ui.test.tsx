// Gerenderte Abläufe mit Fake-Spiel-View (statt echter Spiele) und Mock-WebSocket.
import type { ControllerViewApi } from "@couchplay/game-sdk/client";
import type { RoomState } from "@couchplay/protocol";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";
import { createApp } from "../src/app.js";
import { MockSocket, player, room, TOKEN } from "./helpers.js";

const fake = vi.hoisted(() => ({
  fail: false,
  api: null as ControllerViewApi | null,
  updates: [] as unknown[],
}));

vi.mock("../src/games.js", () => ({
  CONTROLLER_VIEWS: {
    quiz: () =>
      fake.fail
        ? Promise.reject(new Error("Failed to fetch dynamically imported module"))
        : Promise.resolve({
            default: () => ({
              mount: (_el: HTMLElement, api: ControllerViewApi) => {
                fake.api = api;
              },
              update: (v: unknown) => {
                fake.updates.push(v);
                // Spiele vibrieren typischerweise direkt beim Empfang einer View.
                fake.api?.vibrate(50);
              },
              unmount: () => undefined,
            }),
          }),
  },
}));

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

async function joined(state: RoomState, pathname = "/j/042137") {
  const app = createApp({ pathname, url: "ws://t/ws", createSocket: (u) => new MockSocket(u), bindWindow: false });
  const root = document.getElementById("app")!;
  await act(() => render(<App app={app} />, root));
  await act(() => app.join("Anna", "fuchs"));
  const ws = MockSocket.last();
  await act(() => {
    ws.open();
    ws.receive({ t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN });
    ws.receive({ t: "catalog", games: [] });
    ws.receive({ t: "room.state", room: state });
  });
  return { app, ws, root };
}

const q = (root: Element, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  MockSocket.reset();
  fake.fail = false;
  fake.api = null;
  fake.updates = [];
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => {
  render(null, document.getElementById("app")!);
  vi.restoreAllMocks();
});

const gameRoom = room({ phase: "game", selectedGameId: "quiz", gamePlayerIds: ["p1", "p2"] });

describe("Spiel-View", () => {
  it("wiederholte View nach (Re-)Join vibriert nicht, live-Views schon", async () => {
    const vib = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vib, configurable: true });
    const { ws } = await joined(gameRoom);
    await act(() => ws.receive({ t: "game.view", gameId: "quiz", seq: 3, view: { n: 1 } })); // gecachte View
    await flush();
    expect(fake.updates).toEqual([{ n: 1 }]);
    expect(vib).not.toHaveBeenCalled();
    await act(() => ws.receive({ t: "game.view", gameId: "quiz", seq: 4, view: { n: 2 } }));
    expect(vib).toHaveBeenCalledTimes(1);
  });

  it("Chunk-Ladefehler: einmal neu laden, beim zweiten Mal Fehlermeldung statt Schleife", async () => {
    fake.fail = true;
    sessionStorage.setItem("couchplay.player.chunkReload", "1"); // Reload hat schon stattgefunden
    const { root } = await joined(gameRoom);
    await flush();
    expect(q(root, "game-stage")!.textContent).toContain("konnte nicht geladen werden");
  });
});

describe("Host bricht ab (In-App-Dialog)", () => {
  it("sendet game.abort erst nach Bestätigung", async () => {
    const { ws, root } = await joined(gameRoom);
    await act(() => q(root, "abort-button")!.click());
    expect(q(root, "confirm-dialog")).not.toBeNull();
    expect(ws.sent.some((m) => m.t === "game.abort")).toBe(false);
    await act(() => q(root, "confirm-yes")!.click());
    expect(ws.lastSent()).toEqual({ t: "game.abort" });
  });

  it("Spiel endet, während der Dialog offen ist → Dialog weg, nichts gesendet", async () => {
    const { ws, root } = await joined(gameRoom);
    await act(() => q(root, "abort-button")!.click());
    await act(() => ws.receive({ t: "room.state", room: { ...gameRoom, phase: "results", results: { gameId: "quiz", ranking: [] } } }));
    expect(q(root, "confirm-dialog")).toBeNull();
    expect(ws.sent.some((m) => m.t === "game.abort")).toBe(false);
  });

  it("Abbrechen schließt den Dialog ohne Nachricht", async () => {
    const { ws, root } = await joined(gameRoom);
    await act(() => q(root, "abort-button")!.click());
    await act(() => q(root, "confirm-no")!.click());
    expect(q(root, "confirm-dialog")).toBeNull();
    expect(ws.sent.some((m) => m.t === "game.abort")).toBe(false);
  });
});

describe("Ergebnis", () => {
  it("Top 3 als Podium (2-1-3), weitere Plätze als Liste", async () => {
    const players = ["p1", "p2", "p3", "p4"].map((id, i) => player(id, { color: i, isHost: id === "p1" }));
    const { root } = await joined(
      room({
        phase: "results",
        players,
        gamePlayerIds: ["p1", "p2", "p3", "p4"],
        results: {
          gameId: "quiz",
          ranking: [
            { playerId: "p3", score: 30, rank: 1 },
            { playerId: "p1", score: 20, rank: 2 },
            { playerId: "p2", score: 10, rank: 3 },
            { playerId: "p4", score: 0, rank: 4 },
          ],
        },
      }),
    );
    const steps = [...root.querySelectorAll('[data-testid="podium"] > li')].map((li) => li.getAttribute("data-testid"));
    expect(steps).toEqual(["podium-2", "podium-1", "podium-3"]);
    expect(q(root, "podium-1")!.textContent).toContain("P3");
    expect(root.querySelectorAll(".ranking__row")).toHaveLength(1);
    expect(q(root, "own-place")!.textContent).toContain("Platz 2");
  });

  it("TicTacToe gegen Computer verloren: Computer auf Sockel 1, Spieler auf 2, keine Sieg-Vibration", async () => {
    const vib = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vib, configurable: true });
    const { app, ws, root } = await joined(room({ phase: "game", selectedGameId: "quiz", gamePlayerIds: ["p1"] }));
    await act(() =>
      ws.receive({
        t: "room.state",
        room: room({
          phase: "results",
          gamePlayerIds: ["p1"],
          results: {
            gameId: "tictactoe",
            ranking: [{ playerId: "p1", score: 0, rank: 1 }],
            data: { winnerId: "bot", bot: { difficulty: "unbesiegbar", mark: "O" }, series: {}, outcome: "win", players: [] },
          },
        }),
      }),
    );
    expect(app.store.getState().resultsLive).toBe(true);
    expect(q(root, "bot-wins")!.textContent).toContain("Der Computer gewinnt");
    expect(q(root, "own-place")).toBeNull();
    const steps = [...root.querySelectorAll('[data-testid="podium"] > li')].map((li) => li.getAttribute("data-testid"));
    expect(steps).toEqual(["podium-2", "podium-bot"]);
    expect(q(root, "podium-2")!.querySelector(".podium__rank")!.textContent).toBe("2");
    expect(vib).not.toHaveBeenCalled();
  });

  it("Reload auf dem Ergebnis-Screen vibriert nicht", async () => {
    const vib = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vib, configurable: true });
    await joined(room({ phase: "results", gamePlayerIds: ["p1"], results: { gameId: "quiz", ranking: [{ playerId: "p1", score: 1, rank: 1 }] } }));
    expect(vib).not.toHaveBeenCalled();
  });
});

describe("Join: Name vergeben", () => {
  it("zeigt Erklärung und Vorschlag „Anna2“, der direkt beitritt", async () => {
    const app = createApp({ pathname: "/j/042137", url: "ws://t/ws", createSocket: (u) => new MockSocket(u), bindWindow: false });
    const root = document.getElementById("app")!;
    await act(() => render(<App app={app} />, root));
    const name = root.querySelector<HTMLInputElement>('[data-testid="name-input"]')!;
    await act(() => {
      name.value = "Anna";
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(() => q(root, "join-button")!.click());
    await act(() => {
      MockSocket.last().open();
      MockSocket.last().receive({ t: "error", code: "NAME_TAKEN", message: "intern" });
    });
    expect(q(root, "join-error")!.textContent).toContain("vorigen Versuch");
    const sug = q(root, "name-suggestion")!;
    expect(sug.textContent).toContain("Anna2");
    await act(() => sug.click());
    MockSocket.last().open();
    expect(MockSocket.last().sent[0]).toMatchObject({ t: "room.join", name: "Anna2" });
  });
});
