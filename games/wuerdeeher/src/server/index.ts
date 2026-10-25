// Serverlogik „Wer würde eher …?“ (server-authoritative), 3–8 Spieler.
// Ablauf: intro → (vote → reveal → standings)* → final → ctx.end(); nach der letzten Runde direkt final.
// Pro Runde eine Aussage („Wer würde eher …?“). Alle tippen gleichzeitig auf einen Mitspieler (auch sich selbst),
// die Wahl ist fix. Die Abstimmung endet nach voteSeconds oder sobald alle verbundenen Spieler abgestimmt haben.
// Wertung siehe scoring.ts: Stimme an einen der Meistgewählten = POINTS.majority.
// Privatsphäre: Während der Abstimmung erfährt der TV nur, WER abgestimmt hat, jedes Handy nur die eigene Wahl.
// Im anonymen Modus verlässt auch in der Auflösung keine Zuordnung „wer hat wen gewählt“ den Server.
// Aussagen werden erst gezogen, wenn sie dran sind – Kategorien reihum, darin bevorzugt solche, die noch kein
// Teilnehmer hatte (Handys melden das im Intro, siehe seen.ts) und die nicht in der Vorrunde dran waren.
// Wartezeiten (Auflösung, Zwischenstand, Finale) sind überspringbar; Intro und Abstimmung nicht.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { PROMPTS_BY_CATEGORY, type Prompt } from "../data/index.js";
import { tallyVotes, type Tally } from "../scoring.js";
import { unpackSeen } from "../seen.js";
import {
  CATEGORY_IDS,
  POINTS,
  TIMING,
  statement,
  type CategoryId,
  type WeFlight,
  type WeInput,
  type WePerson,
  type WePlayerInfo,
  type WePlayerView,
  type WeResultData,
  type WeSettings,
  type WeTitle,
  type WeTvState,
} from "../shared.js";
import { WeInputSchema } from "./input.js";

type Ctx = GameContext<WeSettings, WeTvState, WePlayerView>;
type Phase = "intro" | "vote" | "reveal" | "standings" | "final" | "done";

export function parseWeSettings(values: SettingsValues): WeSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    categories: categories.length > 0 ? [...new Set(categories)] : [...CATEGORY_IDS],
    rounds: num(values.rounds, 10, 5, 20),
    voteSeconds: num(values.voteSeconds, 20, 10, 40),
    anonymous: values.anonymous === "anonym",
  };
}

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  title: WeTitle | null;
  left: boolean;
  order: number;
}

/** Aussagen je Kategorie, Kategorien reihum; innerhalb der Kategorie die mit der kleinsten Strafe. */
function createDeck(categories: readonly CategoryId[], ctx: Ctx) {
  const queues = ctx.rng.shuffle([...categories]).map((c) => ctx.rng.shuffle([...PROMPTS_BY_CATEGORY[c]]));
  let turn = 0;
  return (penalty: (id: string) => number): Prompt | null => {
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

export default defineGame<WeSettings, WeInput, WeTvState, WePlayerView>({
  manifest,
  inputSchema: WeInputSchema,
  parseSettings: parseWeSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const { anonymous } = settings;
    const durationMs = settings.voteSeconds * 1000;
    const nextPrompt = createDeck(settings.categories, ctx);
    const available = settings.categories.reduce((n, c) => n + PROMPTS_BY_CATEGORY[c].length, 0);
    const total = Math.min(settings.rounds, available);
    const previousIds = new Set(
      ((ctx.previous?.data as Partial<WeResultData> | undefined)?.promptIds ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, title: null, left: false, order }]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;
    const person = (id: PlayerId): WePerson => {
      const p = ctx.players.find((x) => x.id === id)!;
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color };
    };

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
    let prompt: Prompt | null = null;
    /** Wähler → Ziel der laufenden Runde. Verlässt den Server nie als Ganzes (Privatsphäre). */
    let votes = new Map<PlayerId, PlayerId>();
    let tally: Tally | null = null;
    let flights: WeFlight[] = [];
    const askedIds: string[] = [];

    const isIn = (id: PlayerId): boolean => players.has(id) && !state(id).left;
    /** Wählbare Spieler: alle, die noch dabei sind (Startreihenfolge). */
    const candidates = (): PlayerId[] => ctx.players.filter((p) => isIn(p.id)).map((p) => p.id);

    const recomputeRanks = (): void => {
      const sorted = [...players.values()].sort((a, b) => b.score - a.score);
      sorted.forEach((s, i) => {
        const prev = sorted[i - 1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): WePlayerInfo[] =>
      ctx.players
        .map((p) => {
          const s = state(p.id);
          // Anonym: Rundenpunkte nicht einzeln zeigen (sie verraten, wer mit der Mehrheit stimmte).
          return { ...person(p.id), score: s.score, rank: s.rank, roundPoints: anonymous ? 0 : s.roundPoints, left: s.left };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const tvState = (): WeTvState => {
      const base = { round: Math.max(0, round), total, anonymous, players: playerInfos() };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt, durationMs: TIMING.introMs, categories: [...settings.categories] };
        case "vote":
        case "reveal": {
          const p = prompt!;
          const common = { ...base, category: p.category, text: p.text, candidates: candidates() };
          if (phase === "vote") {
            return { ...common, phase, endsAt, durationMs, voted: ctx.players.filter((x) => votes.has(x.id)).map((x) => x.id) };
          }
          const t = tally!;
          return {
            ...common,
            phase,
            revealAt,
            endsAt,
            counts: t.counts.map((c) => ({ ...c })),
            flights: flights.map((f) => ({ ...f })),
            winners: [...t.winners],
            maxVotes: t.maxVotes,
            majority: anonymous ? null : [...t.majority],
            majorityCount: t.majority.length,
            voterCount: flights.length,
          };
        }
        case "standings":
          return { ...base, phase, endsAt };
        case "final":
        case "done":
          return {
            ...base,
            phase: "final",
            endsAt,
            durationMs: TIMING.finalMs,
            titles: base.players.map((p) => ({ playerId: p.id, title: state(p.id).title })),
          };
      }
    };

    const viewFor = (id: PlayerId): WePlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total, score: s.score, rank: s.rank, playerCount: ctx.players.length };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "vote": {
          const p = prompt!;
          return {
            ...base,
            phase,
            promptId: p.id,
            text: p.text,
            candidates: candidates().map(person),
            choice: votes.get(id) ?? null,
            endsAt,
            durationMs,
          };
        }
        case "reveal": {
          const t = tally!;
          const mine = votes.get(id);
          return {
            ...base,
            phase,
            text: prompt!.text,
            revealAt,
            voteCount: flights.length,
            winners: t.winners.map(person),
            maxVotes: t.maxVotes,
            choice: mine !== undefined ? person(mine) : null,
            withMajority: t.majority.includes(id),
            points: s.roundPoints,
            myVotes: t.counts.find((c) => c.playerId === id)?.votes ?? 0,
          };
        }
        case "standings":
          return { ...base, phase };
        case "final":
        case "done":
          return { ...base, phase: "final", title: s.title };
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
      const p = round + 1 < total && candidates().length >= 2 ? nextPrompt(penalty) : null;
      if (!p) return showFinal();
      prompt = p;
      askedIds.push(p.id);
      votes = new Map();
      tally = null;
      flights = [];
      round++;
      phase = "vote";
      schedule(durationMs, reveal, false);
      publish();
    };

    const reveal = (): void => {
      if (phase !== "vote") return;
      const p = prompt!;
      const cands = candidates();
      // Nur Stimmen von Spielern, die noch dabei sind, für Spieler, die noch dabei sind.
      // Startreihenfolge statt Tipp-Reihenfolge (die soll nirgends ablesbar sein).
      votes = new Map(
        ctx.players.flatMap((x) => {
          const target = votes.get(x.id);
          return target !== undefined && isIn(x.id) && isIn(target) ? [[x.id, target] as const] : [];
        }),
      );
      tally = tallyVotes(cands, votes);
      // Zufällige Reihenfolge, damit die Animation nicht verrät, wer zuerst getippt hat.
      flights = ctx.rng.shuffle([...votes]).map(([voter, target]) => ({ target, voter: anonymous ? null : voter }));
      for (const s of players.values()) s.roundPoints = 0;
      for (const voter of tally.majority) {
        const s = state(voter);
        s.score += POINTS.majority;
        s.roundPoints = POINTS.majority;
      }
      // Titel: die Aussage, bei der jemand die meisten Stimmen bekam (bei Gleichstand die frühere).
      for (const c of tally.counts) {
        const s = state(c.playerId);
        if (c.votes > 0 && c.votes > (s.title?.votes ?? 0)) s.title = { promptId: p.id, text: statement(p.text), votes: c.votes };
      }
      recomputeRanks();
      phase = "reveal";
      revealAt = ctx.now();
      schedule(TIMING.revealMs, round + 1 >= total ? showFinal : showStandings, true);
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
      const data: WeResultData = {
        promptIds: askedIds,
        total: askedIds.length,
        players: infos.map(({ id, name, score, rank, left }) => ({ id, name, score, rank, left, title: state(id).title })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Vorzeitig auflösen, wenn alle verbundenen Spieler abgestimmt haben (mindestens einer muss verbunden sein). */
    const checkAllVoted = (): void => {
      if (phase !== "vote") return;
      const connected = candidates().filter((id) => ctx.isConnected(id));
      if (connected.length > 0 && connected.every((id) => votes.has(id))) reveal();
    };

    // Intro nicht überspringbar: In dieser Zeit melden die Handys ihre gesehenen Aussagen (Wiederholungsschutz).
    schedule(TIMING.introMs, startRound, false);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (input.type === "seen") {
          seenBy.set(playerId, new Set(unpackSeen(input.ids)));
          return;
        }
        if (phase !== "vote" || !isIn(playerId) || votes.has(playerId) || !isIn(input.target)) return;
        votes.set(playerId, input.target);
        ctx.broadcastTv(tvState());
        ctx.sendToPlayer(playerId, viewFor(playerId));
        checkAllVoted();
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        if (phase === "vote") {
          // Eigene Stimme fällt weg; wer für den Ausgeschiedenen gestimmt hat, darf neu wählen.
          votes.delete(playerId);
          for (const [voter, target] of votes) if (target === playerId) votes.delete(voter);
        }
        if (candidates().length < 2) {
          showFinal();
          return;
        }
        recomputeRanks();
        publish();
        checkAllVoted();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllVoted();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
