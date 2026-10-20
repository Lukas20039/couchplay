// Serverlogik TicTacToe (server-authoritative).
// 1 Teilnehmer: gegen den Computer (Stärke aus Settings), 2 Teilnehmer: Handy gegen Handy.
// Platz 0 spielt X, Platz 1 spielt O. Wer beginnt, wechselt mit jeder Partie der Serie.
import { defineGame, type GameContext, type GameEndResults } from "@couchplay/game-sdk";
import type { GameResults, RankingEntry } from "@couchplay/protocol";
import { z } from "zod";
import manifest from "../../manifest.json" with { type: "json" };
import {
  DIFFICULTIES,
  TicTacToeInputSchema,
  type Cell,
  type Difficulty,
  type GamePhase,
  type Mark,
  type Outcome,
  type Seat,
  type Series,
  type TicTacToeInput,
  type TicTacToePlayerView,
  type TicTacToeResultData,
  type TicTacToeSettings,
  type TicTacToeTvState,
} from "../shared.js";
import { chooseBotMove, emptyBoard, findWinner, isFull, other } from "./board.js";

/** Künstliche Bedenkzeit des Computers, damit sein Zug am TV sichtbar wird. */
export const BOT_DELAY_MS = 700;
/** So lange bleibt das Endergebnis (Gewinnlinie, Banner) stehen, bevor die Runde endet. */
export const END_DELAY_MS = 4000;

const SeriesSchema = z.object({
  key: z.string(),
  games: z.number().int().min(0),
  draws: z.number().int().min(0),
  wins: z.record(z.string(), z.number().int().min(0)),
});

/** Serie aus der Vorrunde übernehmen, wenn dieselbe Paarung erneut spielt. */
export function seriesFromPrevious(previous: GameResults | null, key: string): Series {
  const parsed = SeriesSchema.safeParse((previous?.data as { series?: unknown } | undefined)?.series);
  if (parsed.success && parsed.data.key === key) return structuredClone(parsed.data);
  return { key, games: 0, draws: 0, wins: {} };
}

const parseSettings = (values: Record<string, unknown>): TicTacToeSettings => {
  const d = values.difficulty;
  return { difficulty: DIFFICULTIES.includes(d as Difficulty) ? (d as Difficulty) : "mittel" };
};

type Ctx = GameContext<TicTacToeSettings, TicTacToeTvState, TicTacToePlayerView>;

export default defineGame<TicTacToeSettings, TicTacToeInput, TicTacToeTvState, TicTacToePlayerView>({
  manifest,
  inputSchema: TicTacToeInputSchema,
  parseSettings,
  createGame(ctx: Ctx) {
    const [p0, p1] = ctx.players;
    if (!p0) throw new Error("TicTacToe braucht mindestens einen Teilnehmer");

    const human = (p: NonNullable<typeof p0>, mark: Mark): Seat => ({
      kind: "human",
      mark,
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
    });
    const seats: [Seat, Seat] = [
      human(p0, "X"),
      p1 ? human(p1, "O") : { kind: "bot", mark: "O", difficulty: ctx.settings.difficulty },
    ];
    const seatId = (s: Seat): string => (s.kind === "human" ? s.playerId : "bot");
    const seatOf = (mark: Mark): Seat => (mark === "X" ? seats[0] : seats[1]);

    const seriesKey = p1
      ? `pvp:${[p0.id, p1.id].sort().join(",")}`
      : `bot:${ctx.settings.difficulty}:${p0.id}`;
    const series = seriesFromPrevious(ctx.previous, seriesKey);

    // Erste Partie der Serie beginnt Platz 0 (X), danach abwechselnd.
    const starter: Mark = seats[series.games % 2 === 0 ? 0 : 1].mark;

    const board: Cell[] = emptyBoard();
    const history: { cell: number; mark: Mark }[] = [];
    let turn: Mark = starter;
    let phase: GamePhase = "playing";
    let winLine: number[] | null = null;
    let outcome: Outcome | null = null;
    let botTimer: number | null = null;
    let endResults: GameEndResults | null = null;
    const waiting = new Set<string>();

    for (const s of seats) if (s.kind === "human" && !ctx.isConnected(s.playerId)) waiting.add(s.playerId);
    if (waiting.size > 0) phase = "paused";

    const tvState = (): TicTacToeTvState => ({
      phase,
      board: [...board],
      seats,
      turn,
      starter,
      lastMove: history.at(-1) ?? null,
      winLine,
      outcome,
      series,
      waitingFor: [...waiting],
      botThinking: botTimer !== null,
    });

    const viewFor = (seat: Seat & { kind: "human" }): TicTacToePlayerView => {
      const opp = seatOf(other(seat.mark));
      const lastOpp = [...history].reverse().find((m) => m.mark === opp.mark);
      let result: TicTacToePlayerView["result"] = null;
      if (outcome) result = outcome.kind === "draw" ? "draw" : outcome.mark === seat.mark ? "win" : "lose";
      return {
        phase,
        board: [...board],
        myMark: seat.mark,
        myColor: seat.color,
        myTurn: phase === "playing" && turn === seat.mark,
        opponent: opp,
        opponentMoves: lastOpp ? [lastOpp.cell] : [],
        winLine,
        result,
        forfeit: outcome?.kind === "win" && outcome.forfeit,
        score: {
          me: series.wins[seat.playerId] ?? 0,
          opponent: series.wins[seatId(opp)] ?? 0,
          draws: series.draws,
        },
        waitingFor: [...waiting],
        botThinking: botTimer !== null,
      };
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      for (const s of seats) if (s.kind === "human" && ctx.isActive(s.playerId)) ctx.sendToPlayer(s.playerId, viewFor(s));
    };

    const cancelBot = (): void => {
      if (botTimer !== null) ctx.timers.clear(botTimer);
      botTimer = null;
    };

    const scheduleBot = (): void => {
      const seat = seatOf(turn);
      if (phase !== "playing" || seat.kind !== "bot" || botTimer !== null) return;
      botTimer = ctx.timers.setTimeout(() => {
        botTimer = null;
        if (phase !== "playing" || turn !== seat.mark) return;
        place(chooseBotMove(board, seat.mark, seat.difficulty, ctx.rng), seat.mark);
      }, BOT_DELAY_MS);
    };

    const ranking = (): RankingEntry[] => {
      const out: RankingEntry[] = [];
      for (const s of seats) {
        if (s.kind !== "human" || !ctx.isActive(s.playerId)) continue;
        const won = outcome?.kind === "win" && outcome.mark === s.mark;
        const rank = outcome?.kind === "draw" || won ? 1 : 2;
        out.push({ playerId: s.playerId, score: series.wins[s.playerId] ?? 0, rank });
      }
      return out;
    };

    /** Partie entscheiden: Serie fortschreiben, Ergebnis zeigen, nach END_DELAY_MS beenden. */
    const finish = (result: Outcome, line: number[] | null): void => {
      cancelBot();
      phase = "over";
      outcome = result;
      winLine = line;
      series.games += 1;
      let winnerId: string | null = null;
      if (result.kind === "draw") series.draws += 1;
      else {
        winnerId = seatId(seatOf(result.mark));
        series.wins[winnerId] = (series.wins[winnerId] ?? 0) + 1;
      }
      const data: TicTacToeResultData = { series, outcome: result, winnerId };
      publish();
      endResults = { ranking: [], data };
      ctx.timers.setTimeout(() => {
        if (endResults) ctx.end({ ...endResults, ranking: ranking() });
      }, END_DELAY_MS);
    };

    const place = (cell: number, mark: Mark): void => {
      board[cell] = mark;
      history.push({ cell, mark });
      const w = findWinner(board);
      if (w) return finish({ kind: "win", mark: w.mark, forfeit: false }, w.line);
      if (isFull(board)) return finish({ kind: "draw" }, null);
      turn = other(mark);
      scheduleBot();
      publish();
    };

    scheduleBot(); // beginnt der Computer, zeigt der erste Zustand gleich botThinking
    publish();

    return {
      onPlayerInput(playerId, input) {
        const seat = seats.find((s) => s.kind === "human" && s.playerId === playerId) as (Seat & { kind: "human" }) | undefined;
        if (!seat) return;
        const valid =
          input.type === "place" && phase === "playing" && turn === seat.mark && board[input.cell] === null;
        if (!valid) {
          ctx.log.debug("Ungültiger Zug ignoriert", { playerId, input, phase, turn });
          ctx.sendToPlayer(playerId, viewFor(seat)); // Handy auf den echten Stand zurücksetzen
          return;
        }
        place(input.cell, seat.mark);
      },

      onPlayerConnectionChange(playerId, connected) {
        if (connected) waiting.delete(playerId);
        else waiting.add(playerId);
        if (phase === "playing" && waiting.size > 0) {
          phase = "paused";
          cancelBot();
        } else if (phase === "paused" && waiting.size === 0) {
          phase = "playing";
          scheduleBot();
        }
        publish();
      },

      onPlayerLeave(playerId) {
        waiting.delete(playerId);
        if (phase === "over") return; // Ergebnis steht schon, Timer beendet die Runde
        const seat = seats.find((s) => s.kind === "human" && s.playerId === playerId);
        if (!seat) return;
        // Wer geht, verliert kampflos – der andere Platz (Mensch oder Computer) gewinnt.
        finish({ kind: "win", mark: other(seat.mark), forfeit: true }, null);
      },

      dispose() {
        endResults = null;
      },
    };
  },
});
