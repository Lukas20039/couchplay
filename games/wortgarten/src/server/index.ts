// Serverlogik Wortgarten (server-authoritative).
// Ablauf: intro → (round → roundEnd)* → final → ctx.end().
// Im Intro melden die Handys ihre gespeicherte Garten-Erfahrung (hello); daraus ergibt sich die
// Gartenstufe des Raums und damit, welches Raster, welcher Modus und wie viele Tipps freigeschaltet sind.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import {
  MAX_XP,
  MODES,
  TIMING,
  isValidPath,
  levelInfo,
  newUnlocks,
  resolveConfig,
  scoreWord,
  type Board,
  type Feedback,
  type FeedbackResult,
  type FoundWord,
  type GridSetting,
  type LockedChoice,
  type Mode,
  type RoundConfig,
  type RoundPlayerResult,
  type RoundWord,
  type Tip,
  type WgInput,
  type WgPlayerInfo,
  type WgPlayerView,
  type WgResultData,
  type WgSettings,
  type WgTvState,
} from "../shared.js";
import { germanDictionary, type Dictionary } from "./dictionary.js";
import { WgInputSchema } from "./input.js";
import { generateBoard, type Solution } from "./grid.js";

type Ctx = GameContext<WgSettings, WgTvState, WgPlayerView>;
type Phase = "intro" | "round" | "roundEnd" | "final" | "done";

interface Found {
  word: string;
  points: number;
  at: number;
}

interface PlayerState {
  order: number;
  score: number;
  rank: number;
  left: boolean;
  /** Erfahrung bei Spielbeginn (max aus Handy-Speicher und Vorrunde im Raum). */
  xpStart: number;
  helloReceived: boolean;
  // Laufende Runde
  found: Found[];
  foundSet: Set<string>;
  roundPoints: number;
  streak: number;
  lastAt: number;
  tipsLeft: number;
  tip: (Tip & { word: string }) | null;
  tipped: Set<string>;
  seq: number;
  last: Feedback | null;
  // Statistik über alle Runden
  wordCount: number;
  longest: string | null;
}

const GRID_SETTINGS: readonly GridSetting[] = ["auto", "4", "5", "6"];

/** Rohwerte (bereits gegen das Manifest validiert) → typisierte Settings. Defensiv gegen Fremdwerte. */
export function parseWgSettings(values: SettingsValues): WgSettings {
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  const mode = MODES.includes(values.mode as Mode) ? (values.mode as Mode) : "klassisch";
  const gridSize = GRID_SETTINGS.includes(values.gridSize as GridSetting) ? (values.gridSize as GridSetting) : "auto";
  return { mode, gridSize, rounds: num(values.rounds, 3, 1, 5), roundSeconds: num(values.roundSeconds, 120, 30, 300) };
}

function previousXp(ctx: Ctx): Record<string, number> {
  const data = ctx.previous?.data as Partial<WgResultData> | undefined;
  const xp = data?.xp;
  if (!xp || typeof xp !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(xp)) if (typeof v === "number" && Number.isFinite(v)) out[id] = clampXp(v);
  return out;
}

const clampXp = (v: number): number => Math.min(MAX_XP, Math.max(0, Math.floor(v)));

/** Rang nach Punkten; Gleichstand = gleicher Rang. */
function rankScores(entries: Array<{ id: PlayerId; score: number }>): Map<PlayerId, number> {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const out = new Map<PlayerId, number>();
  sorted.forEach((e, i) => {
    const prev = sorted[i - 1];
    out.set(e.id, prev && prev.score === e.score ? out.get(prev.id)! : i + 1);
  });
  return out;
}

export interface WgGameOptions {
  /** Für Tests: eigenes (kleines) Wörterbuch. */
  dictionary?: () => Dictionary;
}

export function createWortgarten(options: WgGameOptions = {}) {
  const getDictionary = options.dictionary ?? germanDictionary;
  return defineGame<WgSettings, WgInput, WgTvState, WgPlayerView>({
    manifest,
    inputSchema: WgInputSchema,
    parseSettings: parseWgSettings,
    createGame(ctx) {
      const { settings } = ctx;
      const dict = getDictionary();
      const prevXp = previousXp(ctx);
      const players = new Map<PlayerId, PlayerState>(
        ctx.players.map((p, order) => [
          p.id,
          {
            order,
            score: 0,
            rank: 1,
            left: false,
            xpStart: prevXp[p.id] ?? 0,
            helloReceived: false,
            found: [],
            foundSet: new Set(),
            roundPoints: 0,
            streak: 0,
            lastAt: -Infinity,
            tipsLeft: 0,
            tip: null,
            tipped: new Set(),
            seq: 0,
            last: null,
            wordCount: 0,
            longest: null,
          },
        ]),
      );
      const state = (id: PlayerId): PlayerState => players.get(id)!;

      let phase: Phase = "intro";
      let round = -1;
      let endsAt = 0;
      let durationMs = 0;
      let timer: TimerId | null = null;
      let board: Board | null = null;
      let solution: Solution | null = null;
      let roundResults: RoundPlayerResult[] = [];
      let missed: string[] = [];
      let longest: { word: string; playerIds: PlayerId[] } | null = null;
      let uniqueBonus = false;
      // Erst am Ende des Intros festgelegt (Handys melden ihre Erfahrung im Intro).
      let roomXp = 0;
      let config: RoundConfig;
      let locked: LockedChoice;
      let levelBefore = 1;
      let xpAfter = new Map<PlayerId, number>();

      const recomputeLevel = (): void => {
        roomXp = Math.max(0, ...[...players.values()].map((s) => s.xpStart));
        levelBefore = levelInfo(roomXp).level;
        ({ config, locked } = resolveConfig(settings, levelBefore));
      };
      recomputeLevel();

      const recomputeRanks = (): void => {
        const ranks = rankScores([...players].map(([id, s]) => ({ id, score: s.score })));
        for (const [id, r] of ranks) state(id).rank = r;
      };

      const playerInfos = (): WgPlayerInfo[] =>
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
              blooms: phase === "round" ? s.found.map((f) => [...f.word].length) : [],
              left: s.left,
            };
          })
          .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

      const schedule = (ms: number, next: () => void): void => {
        if (timer !== null) ctx.timers.clear(timer);
        const cd = ctx.timers.countdown(ms, () => {
          timer = null;
          next();
        });
        timer = cd.id;
        endsAt = cd.endsAt;
        durationMs = ms;
      };

      // --------------------------------------------------------------- Ausgabe

      const tvState = (): WgTvState => {
        const base = { rounds: settings.rounds, players: playerInfos() };
        switch (phase) {
          case "intro":
            return { ...base, phase, endsAt, durationMs, level: levelInfo(roomXp), config, locked };
          case "round":
            return { ...base, phase, round, board: board!, config, endsAt, durationMs };
          case "roundEnd":
            return {
              ...base,
              phase,
              round,
              board: board!,
              results: roundResults,
              missed,
              possible: solution?.words.size ?? 0,
              longest,
              uniqueBonus,
              endsAt,
              durationMs,
            };
          case "final":
          case "done": {
            const after = Math.max(roomXp, ...xpAfter.values());
            const level = levelInfo(after);
            return {
              ...base,
              phase: "final",
              levelBefore,
              level,
              newUnlocks: newUnlocks(levelBefore, level.level),
              endsAt,
              durationMs,
            };
          }
        }
      };

      const viewFor = (id: PlayerId): WgPlayerView => {
        const s = state(id);
        const base = { rounds: settings.rounds, score: s.score, rank: s.rank, playerCount: ctx.players.length };
        switch (phase) {
          case "intro":
            return { ...base, phase, endsAt, helloReceived: s.helloReceived, level: levelInfo(roomXp), config, locked };
          case "round":
            return {
              ...base,
              phase,
              round,
              board: board!,
              config,
              endsAt,
              durationMs,
              found: s.found.map((f): FoundWord => ({ word: f.word, points: f.points })).reverse(),
              last: s.last,
              tipsLeft: s.tipsLeft,
              tip: s.tip ? { start: s.tip.start, length: s.tip.length, prefix: s.tip.prefix } : null,
              streak: s.streak,
              streakEndsAt: s.lastAt + config.comboWindowMs,
            };
          case "roundEnd": {
            const r = roundResults.find((x) => x.playerId === id);
            return {
              ...base,
              phase,
              round,
              roundPoints: r?.points ?? 0,
              words: r?.words ?? [],
              possible: solution?.words.size ?? 0,
              uniqueBonus,
            };
          }
          case "final":
          case "done": {
            const after = xpAfter.get(id) ?? s.xpStart + s.score;
            return {
              ...base,
              phase: "final",
              xpBefore: s.xpStart,
              xpAfter: after,
              level: levelInfo(after),
              newUnlocks: newUnlocks(levelInfo(s.xpStart).level, levelInfo(after).level),
              wordCount: s.wordCount,
              longest: s.longest,
            };
          }
        }
      };

      const publish = (): void => {
        ctx.broadcastTv(tvState());
        ctx.sendToAllPlayers((p) => viewFor(p.id));
      };

      // ---------------------------------------------------------------- Phasen

      const startRound = (i: number): void => {
        if (i === 0) recomputeLevel();
        round = i;
        const gen = generateBoard(config.size, ctx.rng, dict, { minLen: config.minLen, gold: config.gold });
        board = gen.board;
        solution = gen.solution;
        for (const s of players.values()) {
          s.found = [];
          s.foundSet = new Set();
          s.roundPoints = 0;
          s.streak = 0;
          s.lastAt = -Infinity;
          s.tipsLeft = config.tipsPerRound;
          s.tip = null;
          s.tipped = new Set();
          s.last = null;
        }
        phase = "round";
        schedule(config.roundMs, endRound);
        publish();
      };

      const endRound = (): void => {
        if (phase !== "round") return;
        if (timer !== null) ctx.timers.clear(timer);
        // Wer hat welches Wort gefunden?
        const finders = new Map<string, PlayerId[]>();
        for (const p of ctx.players) {
          for (const f of state(p.id).found) finders.set(f.word, [...(finders.get(f.word) ?? []), p.id]);
        }
        uniqueBonus = ctx.players.length >= 2;
        roundResults = ctx.players.map((p) => {
          const s = state(p.id);
          const words: RoundWord[] = s.found
            .map((f) => {
              const unique = uniqueBonus && finders.get(f.word)!.length === 1;
              return { word: f.word, points: unique ? f.points * 2 : f.points, unique };
            })
            .sort((a, b) => b.points - a.points || b.word.length - a.word.length || a.word.localeCompare(b.word, "de"));
          const points = words.reduce((sum, w) => sum + w.points, 0);
          // Vorläufige Rundenpunkte durch die endgültigen (mit Bonus) ersetzen.
          s.score += points - s.roundPoints;
          s.roundPoints = points;
          s.wordCount += words.length;
          for (const w of words) if (!s.longest || [...w.word].length > [...s.longest].length) s.longest = w.word;
          return { playerId: p.id, points, words };
        });
        // Längstes Wort der Runde
        let best: string | null = null;
        for (const w of finders.keys()) if (!best || [...w].length > [...best].length) best = w;
        longest = best ? { word: best, playerIds: finders.get(best)! } : null;
        // Verpasste lange Wörter (Grundformen zuerst – die sind am verständlichsten)
        const notFound = [...solution!.words.keys()].filter((w) => !finders.has(w));
        missed = notFound
          .sort((a, b) => Number(dict.isBase(b)) - Number(dict.isBase(a)) || [...b].length - [...a].length || a.localeCompare(b, "de"))
          .slice(0, 6);
        recomputeRanks();
        phase = "roundEnd";
        schedule(TIMING.roundEndMs, round + 1 >= settings.rounds ? showFinal : () => startRound(round + 1));
        publish();
      };

      const showFinal = (): void => {
        xpAfter = new Map(ctx.players.map((p) => [p.id, clampXp(state(p.id).xpStart + state(p.id).score)]));
        phase = "final";
        schedule(TIMING.finalMs, finish);
        publish();
      };

      const finish = (): void => {
        if (phase === "done") return;
        if (xpAfter.size === 0) {
          xpAfter = new Map(ctx.players.map((p) => [p.id, clampXp(state(p.id).xpStart + state(p.id).score)]));
        }
        phase = "done";
        recomputeRanks();
        const infos = playerInfos();
        const data: WgResultData = {
          xp: Object.fromEntries(xpAfter),
          level: levelInfo(Math.max(roomXp, ...xpAfter.values())).level,
          players: infos.map(({ id, name, score, rank, left }) => ({
            id,
            name,
            score,
            rank,
            left,
            words: state(id).wordCount,
            longest: state(id).longest,
          })),
        };
        ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
      };

      // --------------------------------------------------------------- Eingaben

      const feedback = (s: PlayerState, word: string, result: FeedbackResult, points = 0, multiplier = 1): void => {
        s.seq++;
        s.last = { seq: s.seq, word, result, points, multiplier };
      };

      const submitWord = (id: PlayerId, path: number[]): void => {
        const s = state(id);
        const b = board!;
        const word = isValidPath(path, b.size) ? path.map((c) => b.letters[c]).join("") : null;
        if (word === null) feedback(s, "", "bad");
        else if (path.length < config.minLen) feedback(s, word, "short");
        else if (s.foundSet.has(word)) feedback(s, word, "dup");
        else if (!dict.has(word)) {
          s.streak = 0;
          feedback(s, word, "unknown");
        } else {
          const now = ctx.now();
          s.streak = now - s.lastAt <= config.comboWindowMs ? s.streak + 1 : 1;
          s.lastAt = now;
          const gold = path.some((c) => b.gold.includes(c));
          const sc = scoreWord(word, { gold, streak: s.streak, mode: config.mode });
          s.found.push({ word, points: sc.points, at: now });
          s.foundSet.add(word);
          s.roundPoints += sc.points;
          s.score += sc.points;
          if (s.tip?.word === word) s.tip = null;
          feedback(s, word, "ok", sc.points, sc.multiplier);
          recomputeRanks();
          ctx.broadcastTv(tvState());
        }
        ctx.sendToPlayer(id, viewFor(id));
      };

      const giveTip = (id: PlayerId): void => {
        const s = state(id);
        if (s.tipsLeft <= 0 || s.tip !== null || !solution) return;
        const open = [...solution.words].filter(([w]) => !s.foundSet.has(w) && !s.tipped.has(w));
        if (open.length === 0) return;
        // Bevorzugt mittellange Grundformen – gut zu erraten, aber kein Geschenk.
        const nice = open.filter(([w]) => dict.isBase(w) && w.length >= 4 && w.length <= 6);
        const [word, path] = ctx.rng.pick(nice.length > 0 ? nice : open);
        s.tipsLeft--;
        s.tipped.add(word);
        s.tip = { word, start: path[0]!, length: path.length, prefix: path.slice(0, 2).map((c) => board!.letters[c]).join("") };
        ctx.sendToPlayer(id, viewFor(id));
      };

      // ---------------------------------------------------------------- Start

      schedule(TIMING.introMs, () => startRound(0));
      publish();

      return {
        onPlayerInput(playerId, input) {
          const s = state(playerId);
          if (s.left) return;
          switch (input.type) {
            case "hello":
              if (phase !== "intro" || s.helloReceived) return;
              s.helloReceived = true;
              s.xpStart = Math.max(s.xpStart, clampXp(input.xp));
              recomputeLevel();
              publish();
              return;
            case "word":
              if (phase !== "round" || ctx.now() > endsAt) return;
              submitWord(playerId, input.path);
              return;
            case "tip":
              if (phase !== "round") return;
              giveTip(playerId);
              return;
          }
        },

        onPlayerLeave(playerId) {
          const s = players.get(playerId);
          if (!s || s.left) return;
          s.left = true;
          if (ctx.activePlayerIds().length === 0) {
            finish();
            return;
          }
          ctx.broadcastTv(tvState());
        },

        onPlayerConnectionChange(playerId, connected) {
          if (connected) ctx.sendToPlayer(playerId, viewFor(playerId));
        },
      };
    },
  });
}

export default createWortgarten();
