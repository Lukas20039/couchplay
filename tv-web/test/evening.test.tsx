// Spieleabend und Überspringen auf dem TV: Helfer und Render-Tests.
import { render } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, Evening } from "@couchplay/protocol";
import { eveningRows, playerPoints, showFinale, suggestGames, teamPoints, toggleGame } from "../src/state/evening.js";
import { initialState, type AppState } from "../src/state/store.js";
import { ApiContext, type AppApi } from "../src/ui/context.js";
import { EveningFinale } from "../src/ui/Evening.js";
import { GameStage } from "../src/ui/GameStage.js";
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
const all = (el: HTMLElement, id: string) => [...el.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)];

afterEach(() => {
  document.body.innerHTML = "";
});

const players = [player("a", { isHost: true, color: 1 }), player("b", { color: 2 }), player("c", { color: 3 })];

const solo: Evening = {
  games: ["quiz", "tictactoe", "quiz"],
  teams: null,
  teamsLocked: true,
  doubleFinal: true,
  rounds: [{ gameId: "quiz", double: false, awards: [{ key: "b", place: 1, points: 10 }, { key: "a", place: 2, points: 7 }, { key: "gone", place: 3, points: 5 }] }],
  standings: [
    { key: "b", points: 10, rank: 1, name: "B", avatar: "fuchs" },
    { key: "a", points: 7, rank: 2, name: "A", avatar: "fuchs" },
    { key: "gone", points: 5, rank: 3, name: "Weg", avatar: "eule" },
    { key: "c", points: 0, rank: 4, name: "C", avatar: "fuchs" },
  ],
};

const teams: Evening = {
  games: ["quiz", "tictactoe"],
  teams: [["a", "c"], ["b"]],
  teamsLocked: false,
  doubleFinal: false,
  rounds: [],
  standings: [
    { key: "team:0", points: 0, rank: 1 },
    { key: "team:1", points: 0, rank: 1 },
  ],
};

describe("Helfer", () => {
  it("bereitet Wertung, Punkte und Finale auf", () => {
    const r = room({ players, evening: solo });
    const rows = eveningRows(r);
    expect(rows.map((x) => [x.key, x.name, x.player?.id ?? null])).toEqual([
      ["b", "B", "b"],
      ["a", "A", "a"],
      ["gone", "Weg", null],
      ["c", "C", "c"],
    ]);
    expect(playerPoints(solo).get("a")).toBe(7);
    expect(playerPoints(teams).size).toBe(0);
    expect(teamPoints({ ...teams, standings: [{ key: "team:1", points: 9, rank: 1 }, { key: "team:0", points: 4, rank: 2 }] })).toEqual([4, 9]);
    expect(showFinale(r)).toBe(false);
    const finished = { ...solo, rounds: [...solo.rounds, ...solo.rounds, ...solo.rounds] };
    expect(showFinale(room({ evening: finished }))).toBe(true);
    expect(showFinale(room({ evening: finished, phase: "results" }))).toBe(false);
  });

  it("Planer: Reihenfolge per Klick, Vorschlag passend zur Spielerzahl", () => {
    expect(toggleGame(["quiz"], "tictactoe")).toEqual(["quiz", "tictactoe"]);
    expect(toggleGame(["quiz", "tictactoe"], "quiz")).toEqual(["tictactoe"]);
    expect(suggestGames([quiz, ttt], 2)).toEqual(["quiz", "tictactoe"]);
    // 5 Spieler: TicTacToe (max 2) passt trotzdem (mind. 2 können spielen).
    expect(suggestGames([quiz, ttt], 5)).toEqual(["quiz", "tictactoe"]);
  });
});

describe("Lobby im Spieleabend", () => {
  const base: AppState = { ...initialState, catalog: [quiz, ttt], conn: { status: "online", attempt: 0, retryAt: null } };

  it("Planer startet den Abend mit Spielen, Teams und Finale", () => {
    const r = room({ players, selectedGameId: "quiz", playerLimits: { minPlayers: 1, maxPlayers: 8 } });
    const { el, sent } = mount(<Lobby state={{ ...base, room: r }} room={r} />);
    q(el, "evening-open")!.click();
    return Promise.resolve().then(() => {
      expect(q(document.body, "evening-setup")).not.toBeNull();
      // Vorschlag: beide Spiele; TicTacToe abwählen und wieder an → Reihenfolge quiz, tictactoe.
      const tttPick = document.querySelector<HTMLElement>('[data-testid="evening-game"][data-game-id="tictactoe"]')!;
      tttPick.click();
      return Promise.resolve().then(() => {
        document.querySelector<HTMLElement>('[data-testid="evening-game"][data-game-id="tictactoe"]')!.click();
        return Promise.resolve().then(() => {
          document.querySelector<HTMLElement>('[data-testid="evening-teams"][data-teams="2"]')!.click();
          return Promise.resolve().then(() => {
            q(document.body, "evening-start")!.click();
            expect(sent).toEqual([{ t: "evening.start", games: ["quiz", "tictactoe"], teams: 2, doubleFinal: true }]);
          });
        });
      });
    });
  });

  it("zeigt Spielplan, Teams und verschiebt Spieler per Klick", () => {
    const r = room({ players, selectedGameId: "quiz", playerLimits: { minPlayers: 1, maxPlayers: 8 }, evening: teams });
    const { el, sent } = mount(<Lobby state={{ ...base, room: r }} room={r} />);
    expect(q(el, "game-catalog")).toBeNull();
    expect(all(el, "evening-chip").map((c) => c.dataset.state)).toEqual(["current", "todo"]);
    expect(all(el, "team-col")).toHaveLength(2);
    expect(q(el, "start-button")?.textContent).toBe("Spiel 1 starten");
    el.querySelector<HTMLElement>('[data-testid="team-member"][data-player-id="c"]')!.click();
    q(el, "evening-shuffle")!.click();
    expect(sent).toEqual([{ t: "evening.setTeam", playerId: "c", team: 1 }, { t: "evening.shuffle" }]);
  });

  it("jeder für sich: Punkte an den Spielern, Finale-Start", () => {
    const r = room({ players, selectedGameId: "quiz", playerLimits: { minPlayers: 1, maxPlayers: 8 }, evening: { ...solo, rounds: [solo.rounds[0]!, solo.rounds[0]!] } });
    const { el } = mount(<Lobby state={{ ...base, room: r }} room={r} />);
    expect(all(el, "player-points").map((p) => p.textContent)).toEqual(["7", "10", "0"]);
    expect(q(el, "start-button")?.textContent).toBe("Finale starten");
    expect(q(el, "evening-open")).toBeNull();
  });
});

describe("Ergebnis und Siegerehrung", () => {
  it("Ergebnis zeigt Wertung der Runde und führt zum nächsten Spiel", () => {
    const r = room({
      players,
      phase: "results",
      selectedGameId: "quiz",
      results: { gameId: "quiz", ranking: [{ playerId: "b", score: 900, rank: 1 }, { playerId: "a", score: 500, rank: 2 }] },
      evening: solo,
    });
    const { el, sent } = mount(<Results room={r} catalog={[quiz, ttt]} />);
    expect(q(el, "play-again")).toBeNull();
    expect(all(el, "evening-row").map((x) => x.dataset.key)).toEqual(["b", "a", "gone", "c"]);
    expect(el.querySelector('[data-key="b"] .evening-award')?.textContent).toBe("+10");
    expect(q(el, "evening-next")?.textContent).toBe("Weiter: TicTacToe");
    q(el, "evening-next")!.click();
    expect(sent).toEqual([{ t: "room.toLobby" }]);
  });

  it("Siegerehrung mit Teams; Fertig beendet den Abend", () => {
    const done: Evening = {
      ...teams,
      teamsLocked: true,
      rounds: [
        { gameId: "quiz", double: false, awards: [] },
        { gameId: "tictactoe", double: false, awards: [] },
      ],
      standings: [
        { key: "team:1", points: 17, rank: 1 },
        { key: "team:0", points: 14, rank: 2 },
      ],
    };
    const r = room({ players, evening: done });
    const { el, sent } = mount(<EveningFinale room={r} catalog={[quiz, ttt]} />);
    expect(q(el, "finale-winner")?.textContent).toBe("🌊 Team Welle");
    expect(all(el, "finale-row").map((x) => x.dataset.key)).toEqual(["team:1", "team:0"]);
    q(el, "finale-done")!.click();
    expect(sent).toEqual([{ t: "evening.end" }]);
  });
});

describe("Wartezeit überspringen", () => {
  it("zeigt Weiter nur mit skipId und sendet game.skip", () => {
    const r = room({ players, phase: "game", selectedGameId: "unbekannt", gamePlayerIds: ["a"] });
    const { el } = mount(<GameStage room={r} game={null} />);
    expect(q(el, "skip-button")).toBeNull();
    document.body.innerHTML = "";
    const { el: el2, sent } = mount(<GameStage room={{ ...r, skipId: 12 }} game={null} />);
    q(el2, "skip-button")!.click();
    expect(sent).toEqual([{ t: "game.skip", skipId: 12 }]);
  });
});
