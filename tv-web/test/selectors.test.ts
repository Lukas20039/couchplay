import { describe, expect, it } from "vitest";
import { botWon, dataPlayerName, defaultSelection, disconnectedParticipants, rematchPlayerIds, startCheck, toggleSelection } from "../src/state/selectors.js";
import { rankingRows } from "../src/ui/Results.js";
import { player, quiz, room, ttt } from "./fixtures.js";

const lim = (minPlayers: number, maxPlayers: number) => ({ minPlayers, maxPlayers });

describe("startCheck", () => {
  it("ohne Spiel", () => {
    expect(startCheck(room(), [quiz]).kind).toBe("noGame");
  });
  it("zu wenige verbundene Spieler", () => {
    const r = room({ selectedGameId: "tictactoe", playerLimits: lim(1, 2), players: [player("a", { connected: false })] });
    expect(startCheck(r, [ttt])).toEqual({ kind: "tooFew", missing: 1, min: 1 });
  });
  it("bereit, wenn Anzahl passt", () => {
    const r = room({ selectedGameId: "tictactoe", playerLimits: lim(1, 2), players: [player("a"), player("b")] });
    expect(startCheck(r, [ttt])).toEqual({ kind: "ready", count: 2 });
  });
  it("Auswahl, wenn mehr verbunden als erlaubt", () => {
    const r = room({ selectedGameId: "tictactoe", playerLimits: lim(1, 2), players: [player("a"), player("b"), player("c")] });
    expect(startCheck(r, [ttt])).toEqual({ kind: "choose", max: 2, min: 1, connected: 3 });
  });
  it("nutzt Manifest-Grenzen, wenn playerLimits fehlt", () => {
    const r = room({ selectedGameId: "tictactoe", players: [player("a"), player("b"), player("c")] });
    expect(startCheck(r, [ttt]).kind).toBe("choose");
  });
});

describe("Teilnehmerauswahl", () => {
  const r = room({
    selectedGameId: "tictactoe",
    players: [player("a"), player("b"), player("c", { connected: false }), player("d")],
    gamePlayerIds: ["d", "c"],
  });
  it("Vorauswahl: letzte Teilnehmer (verbunden), dann Beitrittsreihenfolge", () => {
    expect(defaultSelection(r, 2)).toEqual(["d", "a"]);
    expect(defaultSelection(r, 3)).toEqual(["d", "a", "b"]);
  });
  it("Umschalten respektiert max und sortiert nach Beitritt", () => {
    expect(toggleSelection(r, ["d"], "a", 2)).toEqual(["a", "d"]);
    expect(toggleSelection(r, ["a", "d"], "b", 2)).toEqual(["a", "d"]);
    expect(toggleSelection(r, ["a", "d"], "a", 2)).toEqual(["d"]);
  });
});

describe("Revanche & getrennte Spieler", () => {
  it("gleiche Teilnehmer, wenn alle verbunden", () => {
    const r = room({ phase: "results", playerLimits: lim(1, 2), players: [player("a"), player("b"), player("c")], gamePlayerIds: ["b", "a"] });
    expect(rematchPlayerIds(r)).toEqual(["b", "a"]);
  });
  it("undefined, wenn ein Teilnehmer fehlt", () => {
    const r = room({ phase: "results", players: [player("a"), player("b", { connected: false })], gamePlayerIds: ["a", "b"] });
    expect(rematchPlayerIds(r)).toBeUndefined();
  });
  it("listet getrennte Teilnehmer nur in der Spielphase", () => {
    const players = [player("a", { connected: false }), player("b", { connected: false })];
    expect(disconnectedParticipants(room({ phase: "game", players, gamePlayerIds: ["a"] })).map((p) => p.id)).toEqual(["a"]);
    expect(disconnectedParticipants(room({ phase: "lobby", players, gamePlayerIds: ["a"] }))).toEqual([]);
  });
});

describe("rankingRows", () => {
  it("sortiert nach Rang und verknüpft Spieler", () => {
    const r = room({
      phase: "results",
      players: [player("a"), player("b")],
      results: {
        gameId: "quiz",
        ranking: [
          { playerId: "b", score: 5, rank: 2 },
          { playerId: "x", score: 1, rank: 3 },
          { playerId: "a", score: 9, rank: 1 },
        ],
      },
    });
    const rows = rankingRows(r);
    expect(rows.map((x) => x.playerId)).toEqual(["a", "b", "x"]);
    expect(rows[2]?.player).toBeNull();
  });
});

describe("Ergebnisdaten aus results.data", () => {
  it("erkennt Computer-Sieg nur mit winnerId bot und bot-Objekt", () => {
    expect(botWon({ gameId: "tictactoe", ranking: [], data: { winnerId: "bot", bot: { mark: "O" } } })).toBe(true);
    expect(botWon({ gameId: "tictactoe", ranking: [], data: { winnerId: "bot" } })).toBe(false);
    expect(botWon({ gameId: "quiz", ranking: [], data: [1] })).toBe(false);
    expect(botWon(null)).toBe(false);
  });
  it("liest Namen aus data.players", () => {
    const res = { gameId: "x", ranking: [], data: { players: [{ playerId: "p", name: "Pia" }, { playerId: "q" }] } };
    expect(dataPlayerName(res, "p")).toBe("Pia");
    expect(dataPlayerName(res, "q")).toBeNull();
    expect(dataPlayerName({ gameId: "x", ranking: [] }, "p")).toBeNull();
  });
});
