// Spielablauf über createTestHarness (fester Seed, virtuelle Uhr).
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { GameResults } from "@couchplay/protocol";
import { describe, expect, it } from "vitest";
import { LINES, findWinner } from "../src/server/board.js";
import game, { BOT_DELAY_MS, END_DELAY_MS } from "../src/server/index.js";
import type { Difficulty, TicTacToePlayerView, TicTacToeResultData, TicTacToeTvState } from "../src/shared.js";

type H = GameHarness<TicTacToeTvState, TicTacToePlayerView>;

const pvp = (opts: { previous?: GameResults | null; seed?: number } = {}): H =>
  createTestHarness<TicTacToeTvState, TicTacToePlayerView>(game, { players: 2, ...opts });

const vsBot = (difficulty: Difficulty, opts: { previous?: GameResults | null; seed?: number } = {}): H =>
  createTestHarness<TicTacToeTvState, TicTacToePlayerView>(game, { players: 1, settings: { difficulty }, ...opts });

const place = (h: H, player: string, cell: number) => h.input(player, { type: "place", cell });
const tv = (h: H): TicTacToeTvState => h.lastTv()!;

/** Spielt abwechselnd p1/p2 (p1 beginnt) die angegebenen Felder. */
function playPvp(h: H, cells: number[], first = "p1"): void {
  const second = first === "p1" ? "p2" : "p1";
  cells.forEach((c, i) => expect(place(h, i % 2 === 0 ? first : second, c)).toEqual({ ok: true }));
}

describe("Manifest & Start", () => {
  it("hat ein gültiges Manifest mit Bot-Stärke", () => {
    expect(game.manifest.id).toBe("tictactoe");
    expect(game.manifest.minPlayers).toBe(1);
    expect(game.manifest.maxPlayers).toBe(2);
    expect(game.manifest.settings.map((s) => s.key)).toEqual(["difficulty"]);
  });

  it("2 Spieler: leeres Brett, Spieler 1 ist X und beginnt", () => {
    const h = pvp();
    const s = tv(h);
    expect(s.phase).toBe("playing");
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(s.seats.map((x) => x.kind)).toEqual(["human", "human"]);
    expect(s.turn).toBe("X");
    expect(h.lastView("p1")).toMatchObject({ myMark: "X", myTurn: true });
    expect(h.lastView("p2")).toMatchObject({ myMark: "O", myTurn: false });
  });

  it("1 Spieler: Gegner ist der Computer mit eingestellter Stärke", () => {
    const h = vsBot("unbesiegbar");
    expect(tv(h).seats[1]).toEqual({ kind: "bot", mark: "O", difficulty: "unbesiegbar" });
    expect(h.lastView("p1")?.opponent).toMatchObject({ kind: "bot" });
  });
});

describe("Gewinnerkennung im Spiel", () => {
  // Für jede Linie: X belegt sie, O spielt Felder außerhalb, die selbst keine Linie bilden.
  it.each(LINES.map((l) => [l.join("-"), l] as const))("Linie %s gewinnt und wird gemeldet", (_n, line) => {
    const h = pvp();
    const rest = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((c) => !line.includes(c));
    const oCells: number[] = [];
    for (const c of rest) {
      const trial = Array<string | null>(9).fill(null);
      for (const o of [...oCells, c]) trial[o] = "O";
      if (oCells.length < 2 && !findWinner(trial as never)) oCells.push(c);
    }
    playPvp(h, [line[0], oCells[0]!, line[1], oCells[1]!, line[2]]);
    const s = tv(h);
    expect(s.phase).toBe("over");
    expect(s.outcome).toEqual({ kind: "win", mark: "X", forfeit: false });
    expect(s.winLine).toEqual([...line]);
    expect(h.lastView("p1")).toMatchObject({ result: "win", winLine: [...line] });
    expect(h.lastView("p2")).toMatchObject({ result: "lose" });
  });

  it("Unentschieden bei vollem Brett", () => {
    const h = pvp();
    // X O X / X O O / O X X
    playPvp(h, [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(tv(h)).toMatchObject({ phase: "over", outcome: { kind: "draw" }, winLine: null });
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([
      { playerId: "p1", score: 0, rank: 1 },
      { playerId: "p2", score: 0, rank: 1 },
    ]);
    expect((h.results?.data as TicTacToeResultData).series).toMatchObject({ games: 1, draws: 1 });
  });
});

describe("Ungültige Züge", () => {
  it("falscher Spieler am Zug wird ignoriert", () => {
    const h = pvp();
    expect(place(h, "p2", 4)).toEqual({ ok: true });
    expect(tv(h).board[4]).toBeNull();
    expect(tv(h).turn).toBe("X");
  });

  it("belegtes Feld wird ignoriert", () => {
    const h = pvp();
    place(h, "p1", 4);
    place(h, "p2", 4);
    expect(tv(h).board[4]).toBe("X");
    expect(tv(h).turn).toBe("O");
  });

  it("Züge nach Spielende werden ignoriert, Ergebnis bleibt", () => {
    const h = pvp();
    playPvp(h, [0, 3, 1, 4, 2]);
    const before = tv(h);
    place(h, "p2", 8);
    expect(tv(h).board).toEqual(before.board);
    h.advance(END_DELAY_MS);
    expect(h.results).not.toBeNull();
    expect(place(h, "p2", 8)).toMatchObject({ ok: false, code: "INVALID_PHASE" });
  });

  it("schema-ungültige Eingaben lehnt das SDK ab", () => {
    const h = pvp();
    expect(place(h, "p1", 9)).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(h.input("p1", { type: "quatsch" })).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("gegen den Computer darf der Mensch nicht für ihn ziehen", () => {
    const h = vsBot("mittel");
    place(h, "p1", 0);
    place(h, "p1", 1); // Computer ist am Zug
    expect(tv(h).board.filter(Boolean)).toHaveLength(1);
    expect(tv(h).botThinking).toBe(true);
  });
});

describe("2-Spieler-Partie & Revanche", () => {
  it("läuft bis zum Sieg und endet nach der Ergebnisanzeige", () => {
    const h2 = pvp();
    playPvp(h2, [4, 0, 2, 1, 6]); // X: 4,2,6 → Diagonale
    expect(tv(h2).winLine).toEqual([2, 4, 6]);
    expect(h2.results).toBeNull();
    h2.advance(END_DELAY_MS - 1);
    expect(h2.results).toBeNull();
    h2.advance(1);
    expect(h2.results?.ranking).toEqual([
      { playerId: "p1", score: 1, rank: 1 },
      { playerId: "p2", score: 0, rank: 2 },
    ]);
    expect(h2.results?.data).toMatchObject({ winnerId: "p1", series: { games: 1, wins: { p1: 1 } } });
  });

  it("Revanche: Startspieler wechselt, Serienstand wird über previous fortgeführt", () => {
    const g1 = pvp();
    playPvp(g1, [4, 0, 2, 1, 6]); // p1 gewinnt
    g1.advance(END_DELAY_MS);

    const g2 = pvp({ previous: g1.results });
    expect(tv(g2).starter).toBe("O");
    expect(tv(g2).turn).toBe("O");
    expect(g2.lastView("p2")).toMatchObject({ myTurn: true, score: { me: 0, opponent: 1, draws: 0 } });
    playPvp(g2, [0, 3, 1, 4, 2], "p2"); // p2 gewinnt oben
    g2.advance(END_DELAY_MS);
    expect(g2.results?.data).toMatchObject({ series: { games: 2, wins: { p1: 1, p2: 1 } } });
    expect(g2.results?.ranking).toContainEqual({ playerId: "p2", score: 1, rank: 1 });

    const g3 = pvp({ previous: g2.results });
    expect(tv(g3).starter).toBe("X");
    expect(tv(g3).series).toMatchObject({ games: 2, wins: { p1: 1, p2: 1 } });
  });

  it("andere Paarung oder fremde Daten starten eine neue Serie", () => {
    const foreign: GameResults = { gameId: "tictactoe", ranking: [], data: { series: { key: "pvp:a,b", games: 5, draws: 0, wins: {} } } };
    expect(tv(pvp({ previous: foreign })).series.games).toBe(0);
    const broken: GameResults = { gameId: "tictactoe", ranking: [], data: "kaputt" };
    expect(tv(pvp({ previous: broken })).series.games).toBe(0);
  });

  it("Revanche gegen den Computer: Computer beginnt die zweite Partie", () => {
    const g1 = vsBot("leicht");
    const g2 = vsBot("leicht", { previous: { gameId: "tictactoe", ranking: [], data: { series: { ...tv(g1).series, games: 1 } } } });
    expect(tv(g2)).toMatchObject({ starter: "O", turn: "O", botThinking: true });
    g2.advance(BOT_DELAY_MS);
    expect(tv(g2).board.filter((c) => c === "O")).toHaveLength(1);
    expect(tv(g2).turn).toBe("X");
  });
});

describe("Verbindung", () => {
  it("Disconnect pausiert, Rejoin setzt fort", () => {
    const h = pvp();
    place(h, "p1", 4);
    h.setConnected("p2", false);
    expect(tv(h)).toMatchObject({ phase: "paused", waitingFor: ["p2"] });
    expect(h.lastView("p1")).toMatchObject({ phase: "paused", myTurn: false, waitingFor: ["p2"] });
    place(h, "p1", 0);
    expect(tv(h).board[0]).toBeNull();
    h.setConnected("p2", true);
    expect(tv(h)).toMatchObject({ phase: "playing", waitingFor: [], turn: "O" });
    expect(place(h, "p2", 0)).toEqual({ ok: true });
    expect(tv(h).board[0]).toBe("O");
  });

  it("gegen den Computer: Pause hält den Computer an", () => {
    const h = vsBot("unbesiegbar");
    place(h, "p1", 0);
    h.setConnected("p1", false);
    h.advance(BOT_DELAY_MS * 5);
    expect(tv(h).board.filter(Boolean)).toHaveLength(1);
    h.setConnected("p1", true);
    h.advance(BOT_DELAY_MS);
    expect(tv(h).board.filter(Boolean)).toHaveLength(2);
  });

  it("Leave → verbleibender Spieler gewinnt kampflos", () => {
    const h = pvp();
    place(h, "p1", 4);
    h.setConnected("p1", false);
    h.leave("p1");
    expect(tv(h)).toMatchObject({ phase: "over", outcome: { kind: "win", mark: "O", forfeit: true } });
    expect(h.lastView("p2")).toMatchObject({ result: "win", forfeit: true });
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([{ playerId: "p2", score: 1, rank: 1 }]);
    expect(h.results?.data).toMatchObject({ winnerId: "p2", series: { games: 1, wins: { p2: 1 } } });
  });

  it("Leave gegen den Computer beendet die Runde", () => {
    const h = vsBot("mittel");
    h.leave("p1");
    expect(tv(h).outcome).toEqual({ kind: "win", mark: "O", forfeit: true });
    h.advance(END_DELAY_MS);
    expect(h.results?.ranking).toEqual([]);
  });
});

describe("Computer im Spiel", () => {
  it("zieht nach künstlicher Verzögerung", () => {
    const h = vsBot("mittel");
    place(h, "p1", 4);
    expect(tv(h).botThinking).toBe(true);
    h.advance(BOT_DELAY_MS - 1);
    expect(tv(h).board.filter(Boolean)).toHaveLength(1);
    h.advance(1);
    expect(tv(h).board.filter(Boolean)).toHaveLength(2);
    expect(tv(h)).toMatchObject({ turn: "X", botThinking: false });
  });

  /**
   * Erschöpfend über das echte Spiel: der Mensch probiert jede mögliche Zugfolge
   * (Neustart mit gleichem Seed je Verlauf), als Startspieler (X) und als Nachziehender.
   */
  function exhaustiveVsBot(difficulty: Difficulty, botStarts: boolean, seed: number) {
    const previous: GameResults | null = botStarts
      ? { gameId: "tictactoe", ranking: [], data: { series: { key: `bot:${difficulty}:p1`, games: 1, draws: 0, wins: {} } } }
      : null;
    const stats = { games: 0, humanWins: 0, botWins: 0, draws: 0, winningLine: null as number[] | null };
    const replay = (moves: number[]): H => {
      const h = vsBot(difficulty, { seed, previous });
      h.advance(BOT_DELAY_MS);
      for (const m of moves) {
        place(h, "p1", m);
        h.advance(BOT_DELAY_MS);
      }
      return h;
    };
    const walk = (moves: number[]): void => {
      const s = tv(replay(moves));
      if (s.phase === "over") {
        stats.games++;
        if (s.outcome?.kind === "draw") stats.draws++;
        else if (s.outcome?.mark === "X") {
          stats.humanWins++;
          stats.winningLine ??= moves;
        } else stats.botWins++;
        return;
      }
      expect(s.turn).toBe("X");
      s.board.forEach((c, i) => {
        if (c === null) walk([...moves, i]);
      });
    };
    walk([]);
    return stats;
  }

  it.each([false, true])("„unbesiegbar“ verliert NIE im echten Spiel (Computer beginnt: %s)", (botStarts) => {
    for (const seed of [1, 42]) {
      const s = exhaustiveVsBot("unbesiegbar", botStarts, seed);
      expect(s.humanWins).toBe(0);
      expect(s.games).toBeGreaterThan(50);
    }
  });

  it("„leicht“ ist schlagbar: es gibt eine Gewinnfolge (Seed 42)", () => {
    const s = exhaustiveVsBot("leicht", false, 42);
    expect(s.humanWins).toBeGreaterThan(0);
    expect(s.winningLine).not.toBeNull();
  });
});
