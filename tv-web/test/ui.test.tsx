// Render-Tests der Bildschirme: stabile data-testid-Attribute für E2E.
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage } from "@couchplay/protocol";
import { initialState, type AppState } from "../src/state/store.js";
import { ApiContext, type AppApi } from "../src/ui/context.js";
import { Lobby } from "../src/ui/Lobby.js";
import { Results } from "../src/ui/Results.js";
import { player, quiz, room, ttt } from "./fixtures.js";

function mount(node: preact.ComponentChild): { sent: ClientMessage[]; el: HTMLElement } {
  const sent: ClientMessage[] = [];
  const api: AppApi = { send: (m) => sent.push(m), serverNow: () => 0, retryNow: vi.fn(), newRoom: vi.fn(), reload: vi.fn() };
  const el = document.createElement("div");
  document.body.appendChild(el);
  render(<ApiContext.Provider value={api}>{node}</ApiContext.Provider>, el);
  return { sent, el };
}

const q = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Lobby", () => {
  const players = [player("a", { isHost: true, color: 1 }), player("b", { connected: false, color: 2 })];
  const r = room({ players, selectedGameId: "tictactoe", playerLimits: { minPlayers: 1, maxPlayers: 2 }, settings: { difficulty: "leicht" } });
  const state: AppState = { ...initialState, catalog: [quiz, ttt], room: r, conn: { status: "online", attempt: 0, retryAt: null } };

  it("zeigt Code, QR, URL, Spieler, Kacheln und Start", () => {
    const { el } = mount(<Lobby state={state} room={r} />);
    expect(q(el, "room-code")?.dataset.code).toBe("042137");
    expect(q(el, "room-code")?.textContent).toBe("042137");
    expect(el.querySelectorAll('[data-testid="room-code"] .code-group')).toHaveLength(2);
    expect(q(el, "join-qr")?.getAttribute("data-join-url")).toBe("http://192.168.1.5:8080/j/042137");
    expect(q(el, "join-url")?.textContent).toBe("192.168.1.5:8080/j/042137");
    expect(el.querySelectorAll('[data-testid="player-item"]')).toHaveLength(2);
    expect(el.querySelector('[data-player-id="b"]')?.getAttribute("data-connected")).toBe("false");
    expect(el.querySelector('[data-player-id="a"]')?.getAttribute("data-host")).toBe("true");
    expect(el.querySelectorAll('[data-testid="game-tile"]')).toHaveLength(2);
    expect(q(el, "start-button")?.dataset.state).toBe("ready");
    expect(q(el, "start-hint")?.textContent).toBe("1 Spieler ist bereit.");
    expect(q(el, "setting")?.textContent).toContain("Leicht");
  });

  it("zeigt gesperrte Optionen erst ab dem nötigen Fortschritt", () => {
    const locked = {
      ...ttt,
      progressKey: "ttt.xp",
      settings: [
        ...ttt.settings,
        {
          type: "select" as const,
          key: "mode",
          label: "Modus",
          options: [{ value: "normal", label: "Normal" }, { value: "turbo", label: "Turbo", minProgress: 50 }],
          default: "normal",
        },
      ],
    };
    const keys = (progress: number) => {
      const rr = { ...r, progress: { tictactoe: progress } };
      const { el } = mount(<Lobby state={{ ...state, catalog: [quiz, locked], room: rr }} room={rr} />);
      const out = [...el.querySelectorAll<HTMLElement>('[data-testid="setting"]')].map((b) => b.dataset.settingKey);
      document.body.innerHTML = "";
      return out;
    };
    expect(keys(49)).toEqual(["difficulty"]);
    expect(keys(50)).toEqual(["difficulty", "mode"]);
  });

  it("Kachel wählt Spiel, Start sendet lobby.start", () => {
    const { el, sent } = mount(<Lobby state={state} room={r} />);
    el.querySelector<HTMLElement>('[data-game-id="quiz"]')!.click();
    q(el, "start-button")!.click();
    expect(sent).toEqual([{ t: "lobby.selectGame", gameId: "quiz" }, { t: "lobby.start" }]);
  });

  it("Start ist ohne Spieler deaktiviert", () => {
    const empty = { ...r, players: [] };
    const { el, sent } = mount(<Lobby state={{ ...state, room: empty }} room={empty} />);
    expect(q(el, "start-button")?.getAttribute("aria-disabled")).toBe("true");
    expect(q(el, "player-list")?.dataset.count).toBe("0");
    q(el, "start-button")!.click();
    expect(sent).toEqual([]);
  });

  it("bei zu vielen Spielern öffnet Start die Teilnehmerauswahl", async () => {
    const many = { ...r, players: [player("a"), player("b"), player("c")] };
    const { el, sent } = mount(<Lobby state={{ ...state, room: many }} room={many} />);
    expect(q(el, "start-button")?.dataset.state).toBe("choose");
    q(el, "start-button")!.click();
    await new Promise((res) => setTimeout(res, 0));
    expect(q(el, "choose-players")).not.toBeNull();
    q(el, "choose-start")!.click();
    expect(sent).toEqual([{ t: "lobby.start", playerIds: ["a", "b"] }]);
  });
});

describe("Ergebnis", () => {
  it("zeigt die Rangliste und startet die Revanche mit denselben Spielern", () => {
    const r = room({
      phase: "results",
      selectedGameId: "tictactoe",
      playerLimits: { minPlayers: 1, maxPlayers: 2 },
      players: [player("a"), player("b")],
      gamePlayerIds: ["a", "b"],
      results: { gameId: "tictactoe", ranking: [{ playerId: "b", score: 1, rank: 1 }, { playerId: "a", score: 0, rank: 2 }] },
    });
    const { el, sent } = mount(<Results room={r} catalog={[ttt]} />);
    const rows = el.querySelectorAll<HTMLElement>('[data-testid="result-row"]');
    expect([...rows].map((x) => x.dataset.playerId)).toEqual(["b", "a"]);
    q(el, "play-again")!.click();
    q(el, "to-lobby")!.click();
    expect(sent).toEqual([{ t: "lobby.start", playerIds: ["a", "b"] }, { t: "room.toLobby" }]);
  });

  it("zeigt die Top 3 als Podium und den Rest als Liste (DOM-Reihenfolge = Rang)", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const r = room({
      phase: "results",
      selectedGameId: "quiz",
      players: ids.map((id) => player(id)),
      gamePlayerIds: ids,
      results: { gameId: "quiz", ranking: ids.map((id, i) => ({ playerId: id, score: 50 - i * 10, rank: i + 1 })).reverse() },
    });
    const { el } = mount(<Results room={r} catalog={[{ ...quiz, icon: "🧠" }]} />);
    expect(el.querySelectorAll(".podium [data-testid='result-row']")).toHaveLength(3);
    expect(el.querySelectorAll(".ranking [data-testid='result-row']")).toHaveLength(2);
    const order = [...el.querySelectorAll<HTMLElement>("[data-testid='result-row']")].map((x) => x.dataset.rank);
    expect(order).toEqual(["1", "2", "3", "4", "5"]);
    expect(el.querySelector(".results-icon")?.textContent).toBe("🧠");
  });

  it("TicTacToe gegen Computer verloren: Banner + Computer auf Sockel 1, Mensch auf 2", () => {
    const r = room({
      phase: "results",
      selectedGameId: "tictactoe",
      players: [player("a")],
      gamePlayerIds: ["a"],
      results: {
        gameId: "tictactoe",
        ranking: [{ playerId: "a", score: 0, rank: 2 }],
        data: { winnerId: "bot", bot: { difficulty: "mittel", mark: "O" }, players: [{ playerId: "a", name: "A", mark: "X", left: false }] },
      },
    });
    const { el } = mount(<Results room={r} catalog={[ttt]} />);
    expect(q(el, "bot-wins")?.textContent).toContain("Der Computer gewinnt");
    expect(q(el, "podium-bot")?.className).toContain("place-1");
    const row = q(el, "result-row")!;
    expect(row.className).toContain("place-2");
    expect(row.dataset.rank).toBe("2");
    expect(el.querySelectorAll(".podium-place")).toHaveLength(2);
  });

  it("ohne Computer-Sieg kein Banner; gegangene Spieler mit Namen aus data", () => {
    const r = room({
      phase: "results",
      selectedGameId: "tictactoe",
      players: [player("a")],
      gamePlayerIds: ["a", "b"],
      results: {
        gameId: "tictactoe",
        ranking: [{ playerId: "a", score: 1, rank: 1 }, { playerId: "b", score: 0, rank: 2 }],
        data: { winnerId: "a", bot: null, players: [{ playerId: "b", name: "Bea", mark: "O", left: true }] },
      },
    });
    const { el } = mount(<Results room={r} catalog={[ttt]} />);
    expect(q(el, "bot-wins")).toBeNull();
    expect(el.querySelector('[data-player-id="b"] .podium-name')?.textContent).toBe("Bea");
  });
});
