// Serverlogik Blockblast (server-authoritative), 1–8 Spieler gleichzeitig.
// Jeder legt am eigenen 8 × 8-Feld Teile aus seiner Hand (3 Stück); volle Reihen/Spalten verschwinden.
// Alle ziehen dieselbe Teile-Reihenfolge (fair). Große Räumungen und Combos schicken dem führenden
// Gegner Steine aufs Feld. Wer kein Teil mehr legen kann, ist raus. Nach Ablauf der Zeit (oder wenn
// niemand mehr legen kann) gewinnt die höchste Punktzahl.
import { createRng, defineGame, type GameContext, type GamePlayer, type Rng, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, RankingEntry } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import {
  EMPTY,
  HAND,
  SHAPES,
  SIZE,
  STONE,
  attackStones,
  comboMultiplier,
  emptyBoard,
  fits,
  fitsAnywhere,
  linePoints,
  place,
  type BlockblastInput,
  type BlockblastPlayerView,
  type BlockblastResultData,
  type BlockblastSettings,
  type BlockblastTvState,
  type Board,
  type BoardInfo,
  type GamePhase,
  type Incoming,
  type LastMove,
} from "../shared.js";
import { BlockblastInputSchema } from "./input.js";

export const COUNTDOWN_MS = 3000;
export const END_DELAY_MS = 6000;
const DURATIONS = [120, 180, 300];

export function parseBlockblastSettings(values: Record<string, unknown>): BlockblastSettings {
  const secs = Number(values.duration);
  return { durationMs: (DURATIONS.includes(secs) ? secs : 180) * 1000, attacks: values.attacks !== false };
}

/** Teile-Reihenfolge, für alle gleich; wird bei Bedarf verlängert. */
export class PieceSequence {
  private readonly items: number[] = [];
  private readonly total = SHAPES.reduce((s, x) => s + x.weight, 0);
  constructor(private readonly rng: Rng) {}

  at(i: number): number {
    while (this.items.length <= i) {
      let r = this.rng.next() * this.total;
      const shape = SHAPES.find((s) => (r -= s.weight) < 0) ?? SHAPES[0]!;
      this.items.push(shape.id);
    }
    return this.items[i]!;
  }
}

interface PlayerState {
  player: GamePlayer;
  board: Board;
  hand: (number | null)[];
  /** Wie viele Hände schon gezogen wurden. */
  hands: number;
  score: number;
  streak: number;
  alive: boolean;
  left: boolean;
  moves: number;
  lines: number;
  rank: number;
  seq: number;
  last: LastMove | null;
  incoming: Incoming | null;
}

type Ctx = GameContext<BlockblastSettings, BlockblastTvState, BlockblastPlayerView>;

export default defineGame<BlockblastSettings, BlockblastInput, BlockblastTvState, BlockblastPlayerView>({
  manifest,
  inputSchema: BlockblastInputSchema,
  parseSettings: parseBlockblastSettings,
  createGame(ctx: Ctx) {
    const { settings } = ctx;
    const sequence = new PieceSequence(createRng(ctx.rng.int(1, 2 ** 31 - 2)));
    const states = new Map<PlayerId, PlayerState>();

    const drawHand = (s: PlayerState): void => {
      s.hand = Array.from({ length: HAND }, (_, i) => sequence.at(s.hands * HAND + i));
      s.hands += 1;
    };
    for (const p of ctx.players) {
      const s: PlayerState = {
        player: p,
        board: emptyBoard(),
        hand: [],
        hands: 0,
        score: 0,
        streak: 0,
        alive: true,
        left: false,
        moves: 0,
        lines: 0,
        rank: 1,
        seq: 0,
        last: null,
        incoming: null,
      };
      drawHand(s);
      states.set(p.id, s);
    }

    let phase: GamePhase = "countdown";
    let endsAt = 0;
    let durationMs = COUNTDOWN_MS;
    let clock: TimerId | null = null;

    const all = (): PlayerState[] => [...states.values()];
    const canMove = (s: PlayerState): boolean => s.hand.some((id) => id !== null && fitsAnywhere(s.board, SHAPES[id]!));

    const recomputeRanks = (): void => {
      const sorted = all().sort((a, b) => b.score - a.score);
      sorted.forEach((s, i) => {
        const prev = sorted[i - 1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const info = (s: PlayerState): BoardInfo => ({
      id: s.player.id,
      name: s.player.name,
      avatar: s.player.avatar,
      color: s.player.color,
      board: s.board,
      score: s.score,
      rank: s.rank,
      streak: s.streak,
      alive: s.alive,
      left: s.left,
      moves: s.moves,
      lines: s.lines,
      last: s.last,
      incoming: s.incoming,
    });

    const publish = (): void => {
      const boards = ctx.players.map((p) => info(states.get(p.id)!));
      ctx.broadcastTv({ phase, endsAt, durationMs, players: boards, attacks: settings.attacks });
      for (const s of all()) {
        if (!ctx.isActive(s.player.id)) continue;
        ctx.sendToPlayer(s.player.id, {
          phase,
          endsAt,
          durationMs,
          me: info(s),
          hand: [...s.hand],
          rivals: all()
            .filter((o) => o !== s)
            .sort((a, b) => b.score - a.score)
            .map((o) => ({ id: o.player.id, name: o.player.name, color: o.player.color, score: o.score, alive: o.alive })),
          playerCount: states.size,
          attacks: settings.attacks,
        });
      }
    };

    const ranking = (): RankingEntry[] => all().map((s) => ({ playerId: s.player.id, score: s.score, rank: s.rank }));

    const finish = (): void => {
      if (phase === "over") return;
      if (clock !== null) ctx.timers.clear(clock);
      clock = null;
      phase = "over";
      recomputeRanks();
      const data: BlockblastResultData = {
        players: all().map((s) => ({
          playerId: s.player.id,
          name: s.player.name,
          score: s.score,
          lines: s.lines,
          moves: s.moves,
          alive: s.alive,
          left: s.left,
        })),
      };
      const cd = ctx.timers.countdown(END_DELAY_MS, () => ctx.end({ ranking: ranking(), data }));
      endsAt = cd.endsAt;
      durationMs = END_DELAY_MS;
      publish();
    };

    /** Niemand kann mehr legen → vorzeitig zu Ende (true = beendet, finish() hat schon veröffentlicht). */
    const checkEnd = (): boolean => {
      if (phase !== "playing" || !all().every((s) => !s.alive)) return false;
      finish();
      return true;
    };

    const knockOutIfStuck = (s: PlayerState): void => {
      if (s.alive && !canMove(s)) s.alive = false;
    };

    /** Steine aufs Feld des Ziels: führender, noch aktiver Gegner. */
    const sendAttack = (from: PlayerState, stones: number): LastMove["attack"] => {
      const targets = all().filter((s) => s !== from && s.alive);
      if (stones <= 0 || targets.length === 0) return null;
      const best = Math.max(...targets.map((s) => s.score));
      const target = ctx.rng.pick(targets.filter((s) => s.score === best));
      const free = [...target.board].flatMap((c, i) => (c === EMPTY ? [i] : []));
      const cells = ctx.rng.shuffle(free).slice(0, stones);
      const next = [...target.board];
      for (const c of cells) next[c] = STONE;
      target.board = next.join("");
      target.incoming = { seq: (target.incoming?.seq ?? 0) + 1, from: from.player.id, cells };
      knockOutIfStuck(target);
      return { to: target.player.id, stones: cells.length };
    };

    const start = (): void => {
      phase = "playing";
      const cd = ctx.timers.countdown(settings.durationMs, finish);
      clock = cd.id;
      endsAt = cd.endsAt;
      durationMs = settings.durationMs;
      publish();
    };

    {
      const cd = ctx.timers.countdown(COUNTDOWN_MS, start);
      clock = cd.id;
      endsAt = cd.endsAt;
    }
    recomputeRanks();
    publish();

    return {
      onPlayerInput(playerId, input) {
        const s = states.get(playerId);
        if (!s) return;
        const id = s.hand[input.slot];
        const shape = id === null || id === undefined ? null : SHAPES[id]!;
        if (phase !== "playing" || !s.alive || !shape || !fits(s.board, shape, input.x, input.y)) {
          ctx.log.debug("Zug ignoriert", { playerId, input, phase });
          publish(); // Handy auf den echten Stand zurücksetzen
          return;
        }
        const res = place(s.board, shape, input.x, input.y);
        const lines = res.rows.length + res.cols.length;
        s.streak = lines > 0 ? s.streak + 1 : 0;
        const points = shape.cells.length + linePoints(lines) * comboMultiplier(s.streak);
        s.board = res.board;
        s.score += points;
        s.moves += 1;
        s.lines += lines;
        s.hand[input.slot] = null;
        if (s.hand.every((h) => h === null)) drawHand(s);
        const attack = settings.attacks ? sendAttack(s, attackStones(lines, s.streak)) : null;
        s.seq += 1;
        s.last = {
          seq: s.seq,
          placed: shape.cells.map(([dx, dy]) => (input.y + dy) * SIZE + input.x + dx),
          cleared: res.cleared,
          lines,
          points,
          streak: s.streak,
          attack,
        };
        knockOutIfStuck(s);
        recomputeRanks();
        if (!checkEnd()) publish();
      },

      onPlayerLeave(playerId) {
        const s = states.get(playerId);
        if (!s) return;
        s.left = true;
        s.alive = false;
        if (phase === "over") return;
        if (all().every((x) => x.left)) return finish();
        if (!checkEnd()) publish();
      },
    };
  },
});
