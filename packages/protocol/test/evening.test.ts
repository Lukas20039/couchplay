import { describe, expect, it } from "vitest";
import { ClientMessageSchema } from "../src/messages.js";
import { eveningCurrentGame, eveningFinished, eveningIsFinal, scoreEveningRound, teamKey, teamOfKey, teamOfPlayer } from "../src/evening.js";

const ranking = [
  { playerId: "a", score: 900, rank: 1 },
  { playerId: "b", score: 700, rank: 2 },
  { playerId: "c", score: 700, rank: 2 },
  { playerId: "d", score: 100, rank: 4 },
];

describe("scoreEveningRound", () => {
  it("vergibt jeder-für-sich Punkte nach Platz (Gleichstand teilt den Platz)", () => {
    expect(scoreEveningRound(ranking, null, false)).toEqual([
      { key: "a", place: 1, points: 10 },
      { key: "b", place: 2, points: 7 },
      { key: "c", place: 2, points: 7 },
      { key: "d", place: 4, points: 4 },
    ]);
  });

  it("verdoppelt im Finale", () => {
    expect(scoreEveningRound(ranking, null, true)[0]).toEqual({ key: "a", place: 1, points: 20 });
  });

  it("platziert Teams nach Durchschnittsrang ihrer Teilnehmer", () => {
    // Team 0: a(1) + d(4) = 2,5 · Team 1: b(2) + c(2) = 2 → Team 1 vorn. Team 2 hat niemanden im Spiel.
    expect(scoreEveningRound(ranking, [["a", "d"], ["b", "c"], ["x"]], false)).toEqual([
      { key: "team:1", place: 1, points: 10 },
      { key: "team:0", place: 2, points: 7 },
    ]);
  });

  it("gibt Teams mit gleichem Durchschnitt denselben Platz", () => {
    const r = [
      { playerId: "a", score: 1, rank: 1 },
      { playerId: "b", score: 0, rank: 2 },
    ];
    expect(scoreEveningRound(r, [["a", "b"], ["x"], ["y"]], false)).toEqual([{ key: "team:0", place: 1, points: 10 }]);
    const tie = [
      { playerId: "a", score: 1, rank: 1 },
      { playerId: "b", score: 1, rank: 1 },
    ];
    expect(scoreEveningRound(tie, [["a"], ["b"]], false).map((x) => x.place)).toEqual([1, 1]);
  });
});

describe("Abfragen", () => {
  const e = { games: ["quiz", "kennstdu", "quiz"], rounds: [], doubleFinal: true, teams: [["a"], ["b", "c"]] };
  it("findet aktuelles Spiel, Finale und Ende", () => {
    expect(eveningCurrentGame(e)).toBe("quiz");
    expect(eveningIsFinal(e)).toBe(false);
    const two = { ...e, rounds: [1, 2] as never[] };
    expect(eveningCurrentGame(two)).toBe("quiz");
    expect(eveningIsFinal(two)).toBe(true);
    expect(eveningFinished({ ...e, rounds: [1, 2, 3] as never[] })).toBe(true);
  });
  it("übersetzt Team-Schlüssel und findet Teams", () => {
    expect(teamOfKey(teamKey(3))).toBe(3);
    expect(teamOfKey("p_abc")).toBeNull();
    expect(teamOfPlayer(e, "c")).toBe(1);
    expect(teamOfPlayer(e, "z")).toBeNull();
  });
  it("lehnt ungültige Teamzahlen ab", () => {
    expect(ClientMessageSchema.safeParse({ t: "evening.start", games: ["a1", "b1"], teams: 1, doubleFinal: false }).success).toBe(false);
    expect(ClientMessageSchema.safeParse({ t: "evening.start", games: ["a1"], teams: 0, doubleFinal: false }).success).toBe(false);
  });
});
