// Serverlogik Vier gewinnt (server-authoritative).
// 1 Teilnehmer: gegen den Computer (Stärke aus Settings), 2 Teilnehmer: Handy gegen Handy.
// Ein Match besteht aus bis zu `bestOf` Partien; wer zuerst ceil(bestOf/2) gewinnt, gewinnt das Match
// (nach bestOf Partien entscheidet die Mehrzahl, Gleichstand = unentschieden).
// Wer eine Partie beginnt, wechselt mit jeder Partie – auch über Revanchen hinweg.
import { defineGame, type GameContext } from "@couchplay/game-sdk";
import type { GameResults, RankingEntry } from "@couchplay/protocol";
import { z } from "zod";
import manifest from "../../manifest.json" with { type: "json" };
import {
  BEST_OF,
  BOARD_SIZES,
  DIFFICULTIES,
  TURN_TIMES,
  dropInto,
  emptyGrid,
  isFull,
  landingRow,
  legalColumns,
  otherSeat,
  winLinesAt,
  type BestOf,
  type BoardSize,
  type Difficulty,
  type GamePhase,
  type Grid,
  type LastMove,
  type MatchState,
  type Outcome,
  type Seat,
  type SeatIndex,
  type Series,
  type TurnTime,
  type VierGewinntInput,
  type VierGewinntPlayerView,
  type VierGewinntResultData,
  type VierGewinntSettings,
  type VierGewinntTvState,
} from "../shared.js";
import { chooseBotMove } from "./bot.js";
import { VierGewinntInputSchema } from "./input.js";

/** Künstliche Bedenkzeit des Computers, damit sein Zug am TV sichtbar wird. */
export const BOT_DELAY_MS = 900;
/** So lange bleibt eine entschiedene Partie (Gewinnreihe) stehen, bevor die nächste beginnt. */
export const ROUND_DELAY_MS = 4000;
/** So lange bleibt das Match-Ergebnis stehen, bevor die Runde endet. */
export const END_DELAY_MS = 6000;

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

export function parseVierGewinntSettings(values: Record<string, unknown>): VierGewinntSettings {
  const d = values.difficulty;
  const b = Number(values.bestOf);
  const t = Number(values.turnTime);
  const size = values.board;
  return {
    difficulty: DIFFICULTIES.includes(d as Difficulty) ? (d as Difficulty) : "mittel",
    bestOf: BEST_OF.includes(b as BestOf) ? (b as BestOf) : 3,
    turnTime: TURN_TIMES.includes(t as TurnTime) ? (t as TurnTime) : 0,
    board: typeof size === "string" && Object.hasOwn(BOARD_SIZES, size) ? (size as BoardSize) : "7x6",
  };
}

type Ctx = GameContext<VierGewinntSettings, VierGewinntTvState, VierGewinntPlayerView>;

export default defineGame<VierGewinntSettings, VierGewinntInput, VierGewinntTvState, VierGewinntPlayerView>({
  manifest,
  inputSchema: VierGewinntInputSchema,
  parseSettings: parseVierGewinntSettings,
  createGame(ctx: Ctx) {
    const [p0, p1] = ctx.players;
    if (!p0) throw new Error("Vier gewinnt braucht mindestens einen Teilnehmer");
    const { settings } = ctx;
    const dims = BOARD_SIZES[settings.board];

    const human = (p: NonNullable<typeof p0>): Seat => ({ kind: "human", playerId: p.id, name: p.name, avatar: p.avatar, color: p.color });
    const seats: [Seat, Seat] = [human(p0), p1 ? human(p1) : { kind: "bot", difficulty: settings.difficulty }];
    const seatId = (s: Seat): string => (s.kind === "human" ? s.playerId : "bot");
    const seatOfPlayer = (playerId: string): SeatIndex | null => {
      const i = seats.findIndex((s) => s.kind === "human" && s.playerId === playerId);
      return i === 0 || i === 1 ? i : null;
    };

    const seriesKey = p1 ? `pvp:${[p0.id, p1.id].sort().join(",")}` : `bot:${settings.difficulty}:${p0.id}`;
    const series = seriesFromPrevious(ctx.previous, seriesKey);

    const match: MatchState = {
      bestOf: settings.bestOf,
      needed: Math.ceil(settings.bestOf / 2),
      round: 1,
      wins: [0, 0],
      draws: 0,
      history: [],
    };
    /** Erste Partie einer Serie beginnt Platz 0, danach abwechselnd (auch über Revanchen). */
    const starterOf = (round: number): SeatIndex => ((series.games + round - 1) % 2 === 0 ? 0 : 1);

    let grid: Grid = emptyGrid(dims);
    let starter: SeatIndex = starterOf(1);
    let turn: SeatIndex = starter;
    let phase: GamePhase = "playing";
    let lastMove: LastMove | null = null;
    let winLines: number[][] = [];
    let roundOutcome: Outcome | null = null;
    let outcome: Outcome | null = null;
    const aims: [number | null, number | null] = [null, null];
    let botTimer: number | null = null;
    let turnTimer: number | null = null;
    let turnEndsAt: number | null = null;
    const waiting = new Set<string>();
    const left = new Set<string>();
    for (const s of seats) if (s.kind === "human" && !ctx.isConnected(s.playerId)) waiting.add(s.playerId);
    if (waiting.size > 0) phase = "paused";

    const tvState = (): VierGewinntTvState => ({
      phase,
      dims,
      grid,
      seats,
      turn,
      starter,
      lastMove,
      winLines,
      roundOutcome,
      outcome,
      match: { ...match, wins: [...match.wins], history: [...match.history] },
      series,
      aims: [...aims],
      turnTime: settings.turnTime,
      turnEndsAt,
      waitingFor: [...waiting],
      botThinking: botTimer !== null,
    });

    const resultFor = (o: Outcome | null, seat: SeatIndex): "win" | "lose" | "draw" | null =>
      o ? (o.winner === null ? "draw" : o.winner === seat ? "win" : "lose") : null;

    const viewFor = (seat: SeatIndex): VierGewinntPlayerView => {
      const me = seats[seat] as Seat & { kind: "human" };
      const opp = otherSeat(seat);
      return {
        phase,
        dims,
        grid,
        mySeat: seat,
        myColor: me.color,
        opponent: seats[opp],
        myTurn: phase === "playing" && turn === seat,
        lastMove,
        winLines,
        aim: aims[seat],
        roundResult: resultFor(roundOutcome, seat),
        result: resultFor(outcome, seat),
        forfeit: outcome?.forfeit ?? false,
        match: { bestOf: match.bestOf, needed: match.needed, round: match.round, me: match.wins[seat], opponent: match.wins[opp], draws: match.draws },
        turnTime: settings.turnTime,
        turnEndsAt,
        waitingFor: [...waiting],
        botThinking: botTimer !== null,
      };
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      seats.forEach((s, i) => {
        if (s.kind === "human" && ctx.isActive(s.playerId)) ctx.sendToPlayer(s.playerId, viewFor(i as SeatIndex));
      });
    };

    /** Laufenden Zug anhalten: Computer-Bedenkzeit und Zugzeit stoppen. */
    const cancelTurn = (): void => {
      if (botTimer !== null) ctx.timers.clear(botTimer);
      if (turnTimer !== null) ctx.timers.clear(turnTimer);
      botTimer = null;
      turnTimer = null;
      turnEndsAt = null;
    };

    /** Zug von `turn` vorbereiten: Computer überlegt bzw. Zugzeit läuft (nie überspringbar). */
    const startTurn = (): void => {
      if (phase !== "playing" || botTimer !== null || turnTimer !== null) return;
      const seat = seats[turn];
      const mover = turn;
      if (seat.kind === "bot") {
        botTimer = ctx.timers.setTimeout(() => {
          botTimer = null;
          if (phase !== "playing" || turn !== mover) return;
          drop(mover, chooseBotMove(grid, dims, mover, seat.difficulty, ctx.rng), false);
        }, BOT_DELAY_MS);
        return;
      }
      if (settings.turnTime > 0) {
        const t = ctx.timers.countdown(settings.turnTime * 1000, () => {
          turnTimer = null;
          turnEndsAt = null;
          if (phase !== "playing" || turn !== mover) return;
          // Zeit abgelaufen: zufällige gültige Spalte.
          drop(mover, ctx.rng.pick(legalColumns(grid, dims)), true);
        });
        turnTimer = t.id;
        turnEndsAt = t.endsAt;
      }
    };

    const ranking = (): RankingEntry[] =>
      seats.flatMap((s, i): RankingEntry[] =>
        s.kind === "human"
          ? [{ playerId: s.playerId, score: match.wins[i as SeatIndex], rank: outcome?.winner === null || outcome?.winner === i ? 1 : 2 }]
          : [],
      );

    const finishMatch = (result: Outcome): void => {
      cancelTurn();
      aims[0] = aims[1] = null;
      phase = "over";
      outcome = result;
      series.games += 1;
      let winnerId: string | null = null;
      if (result.winner === null) series.draws += 1;
      else {
        winnerId = seatId(seats[result.winner]);
        series.wins[winnerId] = (series.wins[winnerId] ?? 0) + 1;
      }
      const data = (): VierGewinntResultData => ({
        series,
        outcome: result,
        winnerId,
        players: seats.flatMap((s, i) =>
          s.kind === "human" ? [{ playerId: s.playerId, name: s.name, seat: i as SeatIndex, left: left.has(s.playerId) }] : [],
        ),
        bot: seats[1].kind === "bot" ? { difficulty: seats[1].difficulty } : null,
        bestOf: match.bestOf,
        board: settings.board,
        wins: [...match.wins],
        history: [...match.history],
      });
      publish();
      // Reine Ergebnisanzeige → TV/Host dürfen sie überspringen.
      ctx.timers.countdown(END_DELAY_MS, () => ctx.end({ ranking: ranking(), data: data() }), { skippable: true });
    };

    const startRound = (): void => {
      if (phase !== "roundOver") return; // Match inzwischen beendet (z. B. Spieler gegangen)
      match.round += 1;
      grid = emptyGrid(dims);
      starter = starterOf(match.round);
      turn = starter;
      lastMove = null;
      winLines = [];
      roundOutcome = null;
      phase = waiting.size > 0 ? "paused" : "playing";
      startTurn();
      publish();
    };

    /** Partie entschieden (winner null = Brett voll). */
    const endRound = (winner: SeatIndex | null): void => {
      cancelTurn();
      aims[0] = aims[1] = null;
      roundOutcome = { winner, forfeit: false };
      match.history.push(winner);
      if (winner === null) match.draws += 1;
      else match.wins[winner] += 1;
      const [a, b] = match.wins;
      if (a >= match.needed || b >= match.needed || match.history.length >= match.bestOf) {
        return finishMatch({ winner: a === b ? null : a > b ? 0 : 1, forfeit: false });
      }
      phase = "roundOver";
      publish();
      // Gewinnreihe ansehen ist reine Wartezeit → überspringbar.
      ctx.timers.countdown(ROUND_DELAY_MS, startRound, { skippable: true });
    };

    const drop = (seat: SeatIndex, col: number, auto: boolean): void => {
      const next = dropInto(grid, dims, col, seat);
      if (!next) return;
      cancelTurn();
      grid = next.grid;
      lastMove = { by: seat, col, row: next.row, cell: next.cell, auto };
      aims[seat] = null;
      const lines = winLinesAt(grid, dims, next.cell);
      if (lines.length > 0) {
        winLines = lines;
        return endRound(seat);
      }
      if (isFull(grid)) return endRound(null);
      turn = otherSeat(seat);
      startTurn();
      publish();
    };

    const updatePause = (): void => {
      if (phase === "playing" && waiting.size > 0) {
        phase = "paused";
        cancelTurn(); // Zugzeit beginnt nach der Pause neu
      } else if (phase === "paused" && waiting.size === 0) {
        phase = "playing";
        startTurn();
      }
    };

    startTurn(); // beginnt der Computer, zeigt der erste Zustand gleich botThinking
    publish();

    /** Ungültige Eingabe: Handy auf den echten Stand zurücksetzen. */
    const resync = (playerId: string, seat: SeatIndex, why: string, input: VierGewinntInput): void => {
      ctx.log.debug(`Eingabe ignoriert: ${why}`, { playerId, input, phase, turn });
      ctx.sendToPlayer(playerId, viewFor(seat));
    };

    return {
      onPlayerInput(playerId, input) {
        const seat = seatOfPlayer(playerId);
        if (seat === null) return;
        if (phase !== "playing" || turn !== seat) return resync(playerId, seat, "nicht am Zug", input);
        if (input.type === "aim") {
          const col = input.col !== null && landingRow(grid, dims, input.col) >= 0 ? input.col : null;
          if (aims[seat] === col) return;
          aims[seat] = col;
          return publish();
        }
        if (landingRow(grid, dims, input.col) < 0) return resync(playerId, seat, "Spalte voll", input);
        drop(seat, input.col, false);
      },

      onPlayerConnectionChange(playerId, connected) {
        if (connected) waiting.delete(playerId);
        else waiting.add(playerId);
        updatePause();
        publish();
      },

      onPlayerLeave(playerId) {
        waiting.delete(playerId);
        left.add(playerId);
        if (phase === "over") return; // Ergebnis steht schon, Timer beendet die Runde
        const seat = seatOfPlayer(playerId);
        if (seat === null) return;
        // Wer geht, verliert das Match kampflos – der andere Platz (Mensch oder Computer) gewinnt.
        finishMatch({ winner: otherSeat(seat), forfeit: true });
      },
    };
  },
});
