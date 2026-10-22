// Routing /j/:code, Sitzungswiederaufnahme beim Start und Render-Smoke-Test der Join-Seiten.
import { STORAGE_KEYS } from "@couchplay/protocol/constants";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App.js";
import { createApp } from "../src/app.js";
import { parseRoute } from "../src/lib/route.js";
import { MockSocket, TOKEN } from "./helpers.js";

function makeApp(pathname: string) {
  return createApp({ pathname, url: "ws://test/ws", createSocket: (u) => new MockSocket(u), bindWindow: false });
}

beforeEach(() => {
  localStorage.clear();
  MockSocket.reset();
  document.body.innerHTML = '<div id="app"></div>';
});
afterEach(() => {
  render(null, document.getElementById("app")!);
});

describe("Routing", () => {
  it("parseRoute erkennt /j/:code", () => {
    expect(parseRoute("/j/042137")).toEqual({ code: "042137" });
    expect(parseRoute("/j/042137/")).toEqual({ code: "042137" });
    expect(parseRoute("/j/12345")).toEqual({ code: null });
    expect(parseRoute("/")).toEqual({ code: null });
  });

  it("/j/:code füllt den Code vor und springt zu Name/Avatar", () => {
    const app = makeApp("/j/042137");
    expect(app.store.getState()).toMatchObject({ code: "042137", step: "profile" });
    expect(MockSocket.all).toHaveLength(0);
  });

  it("gespeicherte Sitzung wird beim Start wieder aufgenommen", () => {
    localStorage.setItem(STORAGE_KEYS.playerSession, JSON.stringify({ code: "042137", playerId: "p1", token: TOKEN }));
    const app = makeApp("/");
    expect(app.store.getState().conn).toBe("reconnecting");
    MockSocket.last().open();
    expect(MockSocket.last().sent[0]).toMatchObject({ t: "room.rejoin", code: "042137" });
  });

  it("Link zu einem anderen Raum hat Vorrang vor der gespeicherten Sitzung", () => {
    localStorage.setItem(STORAGE_KEYS.playerSession, JSON.stringify({ code: "111111", playerId: "p1", token: TOKEN }));
    const app = makeApp("/j/042137");
    expect(app.store.getState()).toMatchObject({ conn: "idle", code: "042137", step: "profile" });
    expect(MockSocket.all).toHaveLength(0);
  });

  it("kaputte gespeicherte Daten werden ignoriert", () => {
    localStorage.setItem(STORAGE_KEYS.playerSession, "{kaputt");
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ name: 5, avatar: "drache" }));
    const app = makeApp("/");
    expect(app.store.getState().conn).toBe("idle");
  });
});

describe("Join-Seiten (gerendert)", () => {
  it("Startseite: Code tippen → automatisch weiter zu Name/Avatar → room.join", async () => {
    const app = makeApp("/");
    const root = document.getElementById("app")!;
    await act(() => render(<App app={app} />, root));
    const input = root.querySelector<HTMLInputElement>('[data-testid="code-input"]')!;
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");

    await act(() => {
      input.value = "042 137";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const name = root.querySelector<HTMLInputElement>('[data-testid="name-input"]');
    expect(name).not.toBeNull();
    expect(root.querySelectorAll('[data-testid^="avatar-option-"]')).toHaveLength(12);

    await act(() => {
      name!.value = "Anna";
      name!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(() => root.querySelector<HTMLButtonElement>('[data-testid="avatar-option-eule"]')!.click());
    await act(() => root.querySelector<HTMLButtonElement>('[data-testid="join-button"]')!.click());
    MockSocket.last().open();
    expect(MockSocket.last().sent[0]).toMatchObject({ t: "room.join", code: "042137", name: "Anna", avatar: "eule" });
    // Profil für das nächste Mal gemerkt.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.profile)!)).toEqual({ name: "Anna", avatar: "eule" });
  });

  it("zuletzt verwendeter Name wird bei Code-Eingabe vorgeschlagen", async () => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify({ name: "Bert", avatar: "krake" }));
    const app = makeApp("/");
    const root = document.getElementById("app")!;
    await act(() => render(<App app={app} />, root));
    const input = root.querySelector<HTMLInputElement>('[data-testid="code-input"]')!;
    await act(() => {
      input.value = "042137";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(root.querySelector<HTMLInputElement>('[data-testid="name-input"]')!.value).toBe("Bert");
    expect(root.querySelector('[data-testid="avatar-option-krake"]')!.getAttribute("aria-checked")).toBe("true");
  });

  it("Lobby nach Beitritt: Host sieht Spielauswahl und Start-Button", async () => {
    const app = makeApp("/j/042137");
    const root = document.getElementById("app")!;
    await act(() => render(<App app={app} />, root));
    await act(() => app.join("Anna", "fuchs"));
    const ws = MockSocket.last();
    await act(() => {
      ws.open();
      ws.receive({ t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN });
      ws.receive({
        t: "catalog",
        games: [{ id: "tictactoe", name: "TicTacToe", description: "", version: "0.1.0", minPlayers: 1, maxPlayers: 2, botSupport: true, settings: [] }],
      });
      ws.receive({
        t: "room.state",
        room: {
          code: "042137",
          phase: "lobby",
          joinUrl: "",
          players: [{ id: "p1", name: "Anna", avatar: "fuchs", color: 0, connected: true, isHost: true }],
          hostId: "p1",
          tvConnected: true,
          selectedGameId: null,
          playerLimits: null,
          settings: {},
          gamePlayerIds: [],
          results: null,
          progress: {},
        },
      });
    });
    expect(root.querySelector('[data-testid="lobby-status"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="host-game-select"]')).not.toBeNull();
    const start = root.querySelector<HTMLButtonElement>('[data-testid="start-button"]')!;
    expect(start.disabled).toBe(true);
    await act(() => root.querySelector<HTMLButtonElement>('[data-testid="game-option-tictactoe"]')!.click());
    expect(ws.lastSent()).toEqual({ t: "lobby.selectGame", gameId: "tictactoe" });
  });
});
