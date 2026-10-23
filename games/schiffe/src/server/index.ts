// Serverlogik Schiffe versenken (server-authoritative).
// 1 Teilnehmer: gegen den Computer (Stärke aus Settings), 2 Teilnehmer: Handy gegen Handy.
// Ablauf: Aufstellung (jeder geheim am Handy, Entwurf liegt auf dem Server) → Kampf → Ergebnis.
// Wer beginnt, wechselt mit jeder Partie der Serie.
import { defineGame, type GameContext } from "@couchplay/game-sdk";
import type { GameResults, RankingEntry } from "@couchplay/protocol";
import { z } from "zod";
import manifest from "../../manifest.json" with { type: "json" };
import {
  DIFFICULTIES,
  FLEETS,
  FLEET_KINDS,
  fleetProblem,
  otherSeat,
  type Difficulty,
  type FleetKind,
  type GamePhase,
  type LastShot,
  type Outcome,
  type SchiffeInput,
  type SchiffePlayerView,
  type SchiffeResultData,
  type SchiffeSettings,
  type SchiffeTvState,
  type Seat,
  type SeatIndex,
  type SeatStats,
  type Series,
  type Ship,
  type WatersView,
} from "../shared.js";
import { chooseBotShot } from "./bot.js";
import { SchiffeInputSchema } from "./input.js";
import { Ocean, randomFleet } from "./ocean.js";

/** Bedenkzeit des Computers, damit sein Schuss am TV sichtbar wird. */
export const BOT_DELAY_MS = 1100;
/** Der Computer stellt seine Flotte nicht sofort auf – sonst wirkt es, als hätte er geschummelt. */
export const BOT_SETUP_MS = 1500;
/** So lange bleibt das Endergebnis mit aufgedeckten Flotten stehen. */
export const END_DELAY_MS = 6000;

const SeriesSchema = z.object({
  key: z.string(),
  games: z.number().int().min(0),
  wins: z.record(z.string(), z.number().int().min(0)),
});

/** Serie aus der Vorrunde übernehmen, wenn dieselbe Paarung erneut spielt. */
export function seriesFromPrevious(previous: GameResults | null, key: string): Series {
  const parsed = SeriesSchema.safeParse((previous?.data as { series?: unknown } | undefined)?.series);
  if (parsed.success && parsed.data.key === key) return structuredClone(parsed.data);
  return { key, games: 0, wins: {} };
}

export function parseSchiffeSettings(values: Record<string, unknown>): SchiffeSettings {
  const d = values.difficulty;
  const f = values.fleet;
  return {
    difficulty: DIFFICULTIES.includes(d as Difficulty) ? (d as Difficulty) : "mittel",
    fleet: FLEET_KINDS.includes(f as FleetKind) ? (f as FleetKind) : "klassisch",
    extraShot: values.extraShot !== false,
    touching: values.touching === true,
  };
}

type Ctx = GameContext<SchiffeSettings, SchiffeTvState, SchiffePlayerView>;

const EMPTY_WATERS = (lengths: readonly number[]): WatersView => ({ cells: ".".repeat(100), sunk: [], afloat: [...lengths] });

export default defineGame<SchiffeSettings, SchiffeInput, SchiffeTvState, SchiffePlayerView>({
  manifest,
  inputSchema: SchiffeInputSchema,
  parseSettings: parseSchiffeSettings,
  createGame(ctx: Ctx) {
    const [p0, p1] = ctx.players;
    if (!p0) throw new Error("Schiffe versenken braucht mindestens einen Teilnehmer");
    const { settings } = ctx;
    const rules = { extraShot: settings.extraShot, touching: settings.touching };
    const lengths = FLEETS[settings.fleet];

    const human = (p: NonNullable<typeof p0>): Seat => ({ kind: "human", playerId: p.id, name: p.name, avatar: p.avatar, color: p.color });
    const seats: [Seat, Seat] = [human(p0), p1 ? human(p1) : { kind: "bot", difficulty: settings.difficulty }];
    const seatId = (s: Seat): string => (s.kind === "human" ? s.playerId : "bot");
    const seatOfPlayer = (playerId: string): SeatIndex | null => {
      const i = seats.findIndex((s) => s.kind === "human" && s.playerId === playerId);
      return i === 0 || i === 1 ? i : null;
    };

    const seriesKey = p1
      ? `pvp:${[p0.id, p1.id].sort().join(",")}:${settings.fleet}`
      : `bot:${settings.difficulty}:${settings.fleet}:${p0.id}`;
    const series = seriesFromPrevious(ctx.previous, seriesKey);
    const starter: SeatIndex = series.games % 2 === 0 ? 0 : 1;

    // Aufstellung: Entwürfe, im Kampf dann die Gewässer.
    const drafts: [Ship[], Ship[]] = [randomFleet(lengths, rules.touching, ctx.rng), randomFleet(lengths, rules.touching, ctx.rng)];
    const ready: [boolean, boolean] = [false, false];
    let oceans: [Ocean, Ocean] | null = null;

    let phase: GamePhase = "setup";
    let turn: SeatIndex = starter;
    let lastShot: LastShot | null = null;
    let outcome: Outcome | null = null;
    let botTimer: number | null = null;
    const stats: [SeatStats, SeatStats] = [
      { shots: 0, hits: 0 },
      { shots: 0, hits: 0 },
    ];
    const waiting = new Set<string>();
    const left = new Set<string>();
    for (const s of seats) if (s.kind === "human" && !ctx.isConnected(s.playerId)) waiting.add(s.playerId);

    const watersOf = (seat: SeatIndex): WatersView => oceans?.[seat].view() ?? EMPTY_WATERS(lengths);
    const revealed = (): [Ship[], Ship[]] | null => (phase === "over" ? [drafts[0].map((s) => ({ ...s })), drafts[1].map((s) => ({ ...s }))] : null);

    const tvState = (): SchiffeTvState => ({
      phase,
      seats,
      ready: [...ready],
      turn,
      waters: [watersOf(0), watersOf(1)],
      lastShot,
      outcome,
      revealed: revealed(),
      stats: [{ ...stats[0] }, { ...stats[1] }],
      series,
      rules,
      waitingFor: [...waiting],
      botThinking: botTimer !== null,
    });

    const viewFor = (seat: SeatIndex): SchiffePlayerView => {
      const me = seats[seat] as Seat & { kind: "human" };
      const opp = otherSeat(seat);
      const rev = revealed();
      return {
        phase,
        mySeat: seat,
        myColor: me.color,
        opponent: seats[opp],
        fleet: drafts[seat].map((s) => ({ ...s })),
        ready: ready[seat],
        opponentReady: ready[opp],
        own: watersOf(seat),
        target: watersOf(opp),
        myTurn: phase === "battle" && turn === seat,
        lastShot,
        result: outcome ? (outcome.winner === seat ? "win" : "lose") : null,
        forfeit: outcome?.forfeit ?? false,
        revealed: rev ? rev[opp] : null,
        score: { me: series.wins[me.playerId] ?? 0, opponent: series.wins[seatId(seats[opp])] ?? 0 },
        rules,
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

    const cancelBot = (): void => {
      if (botTimer !== null) ctx.timers.clear(botTimer);
      botTimer = null;
    };

    const scheduleBot = (): void => {
      const seat = seats[turn];
      if (phase !== "battle" || seat.kind !== "bot" || botTimer !== null || !oceans) return;
      const shooter = turn;
      botTimer = ctx.timers.setTimeout(() => {
        botTimer = null;
        if (phase !== "battle" || turn !== shooter || !oceans) return;
        fire(shooter, chooseBotShot(oceans[otherSeat(shooter)].view(), rules, seat.difficulty, ctx.rng));
      }, BOT_DELAY_MS);
    };

    const ranking = (): RankingEntry[] =>
      seats.flatMap((s, i): RankingEntry[] =>
        s.kind === "human" ? [{ playerId: s.playerId, score: series.wins[s.playerId] ?? 0, rank: outcome?.winner === i ? 1 : 2 }] : [],
      );

    const finish = (result: Outcome): void => {
      cancelBot();
      phase = "over";
      outcome = result;
      series.games += 1;
      const winnerId = seatId(seats[result.winner]);
      series.wins[winnerId] = (series.wins[winnerId] ?? 0) + 1;
      const data: SchiffeResultData = {
        series,
        outcome: result,
        winnerId,
        players: seats.flatMap((s, i) =>
          s.kind === "human" ? [{ playerId: s.playerId, name: s.name, seat: i as SeatIndex, left: left.has(s.playerId) }] : [],
        ),
        bot: seats[1].kind === "bot" ? { difficulty: seats[1].difficulty } : null,
        stats: [{ ...stats[0] }, { ...stats[1] }],
      };
      publish();
      ctx.timers.setTimeout(() => ctx.end({ ranking: ranking(), data }), END_DELAY_MS);
    };

    const updatePause = (): void => {
      if (phase === "battle" && waiting.size > 0) {
        phase = "paused";
        cancelBot();
      } else if (phase === "paused" && waiting.size === 0) {
        phase = "battle";
        scheduleBot();
      }
    };

    const startBattle = (): void => {
      oceans = [new Ocean(drafts[0], rules.touching), new Ocean(drafts[1], rules.touching)];
      phase = "battle";
      turn = starter;
      updatePause();
      scheduleBot();
    };

    const fire = (shooter: SeatIndex, cell: number): void => {
      const ocean = oceans![otherSeat(shooter)];
      const { result, ship } = ocean.fire(cell);
      stats[shooter].shots += 1;
      if (result !== "miss") stats[shooter].hits += 1;
      lastShot = { by: shooter, cell, result, sunkLen: result === "sunk" ? ship!.len : null };
      if (ocean.allSunk) return finish({ winner: shooter, forfeit: false });
      if (result === "miss" || !rules.extraShot) turn = otherSeat(shooter);
      scheduleBot();
      publish();
    };

    const markReady = (seat: SeatIndex): void => {
      ready[seat] = true;
      if (ready[0] && ready[1]) startBattle();
    };

    // Der Computer ist nach kurzer Zeit mit seiner (zufälligen) Aufstellung fertig.
    if (seats[1].kind === "bot") {
      ctx.timers.setTimeout(() => {
        if (phase !== "setup") return;
        markReady(1);
        publish();
      }, BOT_SETUP_MS);
    }
    publish();

    /** Ungültige Eingabe: Handy auf den echten Stand zurücksetzen. */
    const resync = (playerId: string, seat: SeatIndex, why: string, input: SchiffeInput): void => {
      ctx.log.debug(`Eingabe ignoriert: ${why}`, { playerId, input, phase });
      ctx.sendToPlayer(playerId, viewFor(seat));
    };

    return {
      onPlayerInput(playerId, input) {
        const seat = seatOfPlayer(playerId);
        if (seat === null) return;
        switch (input.type) {
          case "shuffle":
            if (phase !== "setup" || ready[seat]) return resync(playerId, seat, "nicht in der Aufstellung", input);
            drafts[seat] = randomFleet(lengths, rules.touching, ctx.rng);
            break;
          case "move": {
            if (phase !== "setup" || ready[seat]) return resync(playerId, seat, "nicht in der Aufstellung", input);
            const current = drafts[seat][input.ship];
            if (!current) return resync(playerId, seat, "unbekanntes Schiff", input);
            const next = drafts[seat].map((s) => (s.id === input.ship ? { ...s, x: input.x, y: input.y, dir: input.dir } : s));
            if (fleetProblem(next, lengths, rules.touching) !== null) return resync(playerId, seat, "ungültige Lage", input);
            drafts[seat] = next;
            break;
          }
          case "ready":
            if (phase !== "setup" || ready[seat]) return resync(playerId, seat, "schon bereit", input);
            markReady(seat);
            break;
          case "unready":
            if (phase !== "setup" || !ready[seat]) return resync(playerId, seat, "nicht bereit", input);
            ready[seat] = false;
            break;
          case "fire":
            if (phase !== "battle" || turn !== seat || !oceans?.[otherSeat(seat)].canFire(input.cell)) {
              return resync(playerId, seat, "Schuss nicht möglich", input);
            }
            return fire(seat, input.cell);
        }
        publish();
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
        // Wer geht, verliert kampflos – der andere Platz (Mensch oder Computer) gewinnt.
        finish({ winner: otherSeat(seat), forfeit: true });
      },
    };
  },
});
