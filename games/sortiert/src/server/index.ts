// Serverlogik „Sortiert!“ (server-authoritative), 1–8 Spieler.
// Ablauf: intro → (sort → reveal → standings)* → final → ctx.end(); nach der letzten Runde direkt final.
// Pro Runde ein Set: der Server zieht itemsPerRound Karten (ctx.rng) und mischt sie. Alle sortieren gleichzeitig
// am Handy; jede Änderung kommt als Zwischenstand (order, final=false), „Fertig“ macht die Reihenfolge fix.
// Die Runde endet nach der Sortierzeit oder sobald alle verbundenen Spieler fertig sind. Bei Zeitablauf zählt der
// letzte Zwischenstand (Teilabgabe). Wertung siehe scoring.ts, Sortierrichtung siehe constants.ts (isAscending).
// Sets werden erst gezogen, wenn sie dran sind – Kategorien reihum, darin bevorzugt solche, die noch kein
// Teilnehmer gespielt hat (Handys melden das, siehe seen.ts) und die nicht in der Vorrunde dran waren.
// Überspringbar: Auflösung (komplett), Zwischenstand, Finale. Nicht überspringbar: Intro (Handys melden dort
// ihre gespielten Sets) und Sortierzeit.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { ITEMS_MAX, ITEMS_MIN } from "../constants.js";
import { SETS_BY_CATEGORY, type SortItem, type SortSet } from "../data/index.js";
import { completeOrder, isValidOrder, scoreOrder, solutionOf } from "../scoring.js";
import { unpackSeen } from "../seen.js";
import {
  CATEGORY_IDS,
  TIMING,
  cardRevealOffset,
  revealDurationMs,
  type CategoryId,
  type SoInput,
  type SoPlayerInfo,
  type SoPlayerView,
  type SoResult,
  type SoResultData,
  type SoSettings,
  type SoTvState,
} from "../shared.js";
import { SoInputSchema } from "./input.js";

type Ctx = GameContext<SoSettings, SoTvState, SoPlayerView>;
type Phase = "intro" | "sort" | "reveal" | "standings" | "final" | "done";

export function parseSoSettings(values: SettingsValues): SoSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    categories: categories.length > 0 ? [...new Set(categories)] : [...CATEGORY_IDS],
    rounds: num(values.rounds, 8, 5, 15),
    itemsPerRound: num(values.itemsPerRound, 4, ITEMS_MIN, ITEMS_MAX),
    answerSeconds: num(values.answerSeconds, 35, 20, 60),
  };
}

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  perfects: number;
  left: boolean;
  order: number;
}

/** Laufende Runde: Karten in Auslage-Reihenfolge, Lösung als Kartenindizes. */
interface RoundState {
  set: SortSet;
  cards: SortItem[];
  solution: number[];
}

/** Sets je Kategorie, Kategorien reihum; innerhalb der Kategorie das mit der kleinsten Strafe. */
function createDeck(categories: readonly CategoryId[], ctx: Ctx) {
  const queues = ctx.rng.shuffle([...categories]).map((c) => ctx.rng.shuffle([...SETS_BY_CATEGORY[c]]));
  let turn = 0;
  return (penalty: (id: string) => number): SortSet | null => {
    for (let tries = 0; tries < queues.length; tries++) {
      const queue = queues[turn % queues.length]!;
      turn++;
      if (queue.length === 0) continue;
      let best = 0;
      let bestScore = penalty(queue[0]!.id);
      for (let i = 1; i < queue.length && bestScore > 0; i++) {
        const s = penalty(queue[i]!.id);
        if (s < bestScore) {
          best = i;
          bestScore = s;
        }
      }
      return queue.splice(best, 1)[0]!;
    }
    return null;
  };
}

/**
 * Zieht k Karten zufällig aus dem Set in zufälliger Auslage. Läge die Auslage zufällig schon richtig,
 * wird sie um eins rotiert (bei verschiedenen Werten ist sie danach sicher falsch).
 */
export function dealCards(set: SortSet, k: number, rng: Ctx["rng"]): RoundState {
  let cards = rng.shuffle(set.items).slice(0, Math.min(k, set.items.length));
  let solution = solutionOf(
    cards.map((c) => c.value),
    set.unit,
  );
  if (solution.every((card, pos) => card === pos)) {
    cards = [...cards.slice(1), cards[0]!];
    solution = solutionOf(
      cards.map((c) => c.value),
      set.unit,
    );
  }
  return { set, cards, solution };
}

export default defineGame<SoSettings, SoInput, SoTvState, SoPlayerView>({
  manifest,
  inputSchema: SoInputSchema,
  parseSettings: parseSoSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const durationMs = settings.answerSeconds * 1000;
    const nextSet = createDeck(settings.categories, ctx);
    const available = settings.categories.reduce((n, c) => n + SETS_BY_CATEGORY[c].length, 0);
    const total = Math.min(settings.rounds, available);
    const previousIds = new Set(
      ((ctx.previous?.data as Partial<SoResultData> | undefined)?.setIds ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, perfects: 0, left: false, order }]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;

    const seenBy = new Map<PlayerId, Set<string>>();
    const penalty = (id: string): number => {
      let n = previousIds.has(id) ? 1 : 0;
      for (const [pid, seen] of seenBy) if (!state(pid).left && seen.has(id)) n += 2;
      return n;
    };

    let phase: Phase = "intro";
    let round = -1;
    let endsAt = 0;
    let revealAt = 0;
    let timer: TimerId | null = null;
    let current: RoundState | null = null;
    const solo = ctx.players.length === 1;
    /** Aktueller Stand je Spieler (Zwischenstand oder Abgabe). */
    let drafts = new Map<PlayerId, number[]>();
    let submitted = new Set<PlayerId>();
    let results: SoResult[] = [];
    const playedIds: string[] = [];

    const recomputeRanks = (): void => {
      const sorted = [...players.values()].sort((a, b) => b.score - a.score);
      sorted.forEach((s, i) => {
        const prev = sorted[i - 1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): SoPlayerInfo[] =>
      ctx.players
        .map((p) => {
          const s = state(p.id);
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            color: p.color,
            score: s.score,
            rank: s.rank,
            roundPoints: s.roundPoints,
            perfects: s.perfects,
            left: s.left,
          };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const resultAt = (): number => revealAt + cardRevealOffset(current?.cards.length ?? 0);

    const tvState = (): SoTvState => {
      const base = { round: Math.max(0, round), total, solo, players: playerInfos() };
      switch (phase) {
        case "intro":
          return {
            ...base,
            phase,
            endsAt,
            durationMs: TIMING.introMs,
            categories: [...settings.categories],
            itemsPerRound: settings.itemsPerRound,
          };
        case "sort":
        case "reveal": {
          const { set, cards, solution } = current!;
          const common = { ...base, category: set.category, prompt: set.prompt, top: set.top, bottom: set.bottom };
          if (phase === "sort") {
            return {
              ...common,
              phase,
              cards: cards.map((c) => ({ label: c.label })),
              endsAt,
              durationMs,
              done: ctx.players.filter((p) => submitted.has(p.id)).map((p) => p.id),
            };
          }
          return {
            ...common,
            phase,
            unit: set.unit,
            items: solution.map((i) => ({ label: cards[i]!.label, value: cards[i]!.value, note: cards[i]!.note ?? null })),
            correctBy: solution.map((_, pos) => results.filter((r) => r.marks[pos] === "exact").map((r) => r.playerId)),
            results,
            revealAt,
            resultAt: resultAt(),
            endsAt,
          };
        }
        case "standings":
          return { ...base, phase, endsAt };
        case "final":
        case "done":
          return { ...base, phase: "final", endsAt, durationMs: TIMING.finalMs };
      }
    };

    const viewFor = (id: PlayerId): SoPlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total, score: s.score, rank: s.rank, playerCount: ctx.players.length, solo };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "sort": {
          const { set, cards } = current!;
          return {
            ...base,
            phase,
            setId: set.id,
            prompt: set.prompt,
            top: set.top,
            bottom: set.bottom,
            cards: cards.map((c) => ({ label: c.label })),
            order: [...(drafts.get(id) ?? [])],
            submitted: submitted.has(id),
            endsAt,
            durationMs,
          };
        }
        case "reveal": {
          const { set, cards, solution } = current!;
          const mine = results.find((r) => r.playerId === id);
          const order = drafts.get(id) ?? [];
          return {
            ...base,
            phase,
            prompt: set.prompt,
            unit: set.unit,
            top: set.top,
            bottom: set.bottom,
            revealAt,
            resultAt: resultAt(),
            items: solution.map((i) => ({ label: cards[i]!.label, value: cards[i]!.value, note: cards[i]!.note ?? null })),
            mine: solution.map((_, pos) => {
              const card = mine ? completeOrder(order, cards.length)[pos] : undefined;
              return { label: card === undefined ? null : cards[card]!.label, mark: mine?.marks[pos] ?? "none" };
            }),
            points: mine?.points ?? 0,
            perfect: mine?.perfect ?? false,
            submitted: mine?.submitted ?? false,
          };
        }
        case "standings":
          return { ...base, phase };
        case "final":
        case "done":
          return { ...base, phase: "final", perfects: s.perfects };
      }
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      ctx.sendToAllPlayers((p) => viewFor(p.id));
    };

    const schedule = (ms: number, next: () => void, skippable: boolean): void => {
      if (timer !== null) ctx.timers.clear(timer);
      const cd = ctx.timers.countdown(
        ms,
        () => {
          timer = null;
          next();
        },
        { skippable },
      );
      timer = cd.id;
      endsAt = cd.endsAt;
    };

    // ---------------------------------------------------------------- Phasen

    const startRound = (): void => {
      const set = round + 1 < total && ctx.activePlayerIds().length > 0 ? nextSet(penalty) : null;
      if (!set) return showFinal();
      current = dealCards(set, settings.itemsPerRound, ctx.rng);
      playedIds.push(set.id);
      drafts = new Map();
      submitted = new Set();
      results = [];
      round++;
      phase = "sort";
      schedule(durationMs, reveal, false);
      publish();
    };

    const reveal = (): void => {
      if (phase !== "sort") return;
      const { solution } = current!;
      for (const s of players.values()) s.roundPoints = 0;
      results = ctx.activePlayerIds().map((id) => {
        const r = scoreOrder(drafts.get(id) ?? [], solution);
        const s = state(id);
        s.score += r.points;
        s.roundPoints = r.points;
        if (r.perfect) s.perfects++;
        return { playerId: id, marks: r.marks, points: r.points, perfect: r.perfect, submitted: submitted.has(id) };
      });
      recomputeRanks();
      phase = "reveal";
      revealAt = ctx.now();
      const next = round + 1 >= total ? showFinal : showStandings;
      // Die ganze Auflösung (Aufbau + Lesezeit) ist eine reine Wartezeit.
      schedule(revealDurationMs(solution.length), next, true);
      publish();
    };

    const showStandings = (): void => {
      phase = "standings";
      schedule(TIMING.standingsMs, startRound, true);
      publish();
    };

    const showFinal = (): void => {
      if (phase === "final" || phase === "done") return;
      phase = "final";
      recomputeRanks();
      schedule(TIMING.finalMs, finish, true);
      publish();
    };

    const finish = (): void => {
      if (phase === "done") return;
      phase = "done";
      recomputeRanks();
      const infos = playerInfos();
      const data: SoResultData = {
        setIds: playedIds,
        total: playedIds.length,
        players: infos.map(({ id, name, score, rank, perfects, left }) => ({ id, name, score, rank, perfects, left })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Vorzeitig auflösen, wenn alle verbundenen Spieler fertig sind (mindestens einer muss verbunden sein). */
    const checkAllDone = (): void => {
      if (phase !== "sort") return;
      const connected = ctx.activePlayerIds().filter((id) => ctx.isConnected(id));
      if (connected.length > 0 && connected.every((id) => submitted.has(id))) reveal();
    };

    // Intro nicht überspringbar: In dieser Zeit melden die Handys ihre gespielten Sets (Wiederholungsschutz).
    schedule(TIMING.introMs, startRound, false);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (input.type === "seen") {
          seenBy.set(playerId, new Set(unpackSeen(input.ids)));
          return;
        }
        if (phase !== "sort" || state(playerId).left || submitted.has(playerId)) return;
        const n = current!.cards.length;
        if (!isValidOrder(input.order, n)) return;
        if (input.final && input.order.length !== n) return;
        drafts.set(playerId, [...input.order]);
        // Eigene Ansicht aktuell halten: Der Server cached sie für Reconnect/Neuladen.
        if (input.final) {
          submitted.add(playerId);
          ctx.broadcastTv(tvState());
        }
        ctx.sendToPlayer(playerId, viewFor(playerId));
        if (input.final) checkAllDone();
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        drafts.delete(playerId);
        submitted.delete(playerId);
        if (ctx.activePlayerIds().length === 0) {
          showFinal();
          return;
        }
        recomputeRanks();
        publish();
        checkAllDone();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllDone();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
