// Serverlogik „Zeichnen & Raten“ (server-authoritative), 2–8 Spieler.
// Ablauf: intro → (choose → draw → reveal → standings)* → final → ctx.end().
// Reihum (gemischte Reihenfolge, `turns` Mal pro Person) zeichnet eine Person: Sie wählt am Handy einen von
// drei Begriffen und malt ihn; die Striche gehen gedrosselt an den TV. Alle anderen raten per Freitext.
// Punkte: Rater nach Reihenfolge (GUESS_POINTS), der Zeichner je richtigem Rater (gedeckelt).
// Begriffe werden erst gezogen, wenn sie dran sind – bevorzugt solche, die kein Teilnehmer kennt (seen.ts).
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { DIFFICULTIES, DIFFICULTY_LEVELS, DRAW_LIMITS, GUESS_LIMITS, type Difficulty } from "../constants.js";
import { WORDS_BY_CATEGORY, type Word } from "../data/index.js";
import { unpackSeen } from "../seen.js";
import {
  CATEGORY_IDS,
  DRAWER_POINTS,
  GUESS_POINTS,
  HINT_AT,
  TIMING,
  type Bubble,
  type CategoryId,
  type Drawer,
  type OwnGuess,
  type RevealReason,
  type Stroke,
  type ZgInput,
  type ZgPlayerInfo,
  type ZgPlayerView,
  type ZgResultData,
  type ZgSettings,
  type ZgTvState,
} from "../shared.js";
import { ZgInputSchema } from "./input.js";
import { acceptedKeys, buildHint, cleanGuess, hiddenLetters, judgeGuess, maxReveals } from "./match.js";

type Ctx = GameContext<ZgSettings, ZgTvState, ZgPlayerView>;
type Phase = "intro" | "choose" | "draw" | "reveal" | "standings" | "final" | "done";

/** So viele Sprechblasen zeigt der TV, so viele eigene Tipps das Handy. */
const MAX_BUBBLES = 6;
const MAX_OWN_GUESSES = 8;

export function parseZgSettings(values: SettingsValues): ZgSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  const difficulty = (DIFFICULTIES as readonly string[]).includes(String(values.difficulty)) ? (values.difficulty as Difficulty) : "gemischt";
  return {
    categories: categories.length > 0 ? categories : [...CATEGORY_IDS],
    difficulty,
    drawSeconds: num(values.drawSeconds, 80, 30, 180),
    turns: num(values.turns, 1, 1, 3),
    hints: typeof values.hints === "boolean" ? values.hints : true,
  };
}

/** Punkte eines Raters, der als `index`-ter (0-basiert) richtig liegt. */
export const guessPoints = (index: number): number => GUESS_POINTS[Math.min(index, GUESS_POINTS.length - 1)]!;

/**
 * Begriffe je Kategorie (gemischt, nach Schwierigkeit gefiltert). Je Zug drei Vorschläge aus möglichst
 * unterschiedlichen Kategorien; innerhalb der Kategorie der Begriff mit der kleinsten Strafe.
 */
function createDeck(settings: ZgSettings, ctx: Ctx) {
  const levels = new Set<number>(DIFFICULTY_LEVELS[settings.difficulty]);
  const cats = ctx.rng.shuffle([...new Set(settings.categories)]);
  const queues = new Map<CategoryId, Word[]>(
    cats.map((c) => {
      const all = WORDS_BY_CATEGORY[c];
      const fitting = all.filter((w) => levels.has(w.difficulty));
      return [c, ctx.rng.shuffle(fitting.length >= 3 ? fitting : all)];
    }),
  );
  let turn = 0;
  return {
    draw(penalty: (w: Word) => number): Word[] {
      const picked: Word[] = [];
      for (let i = 0; picked.length < 3 && i < cats.length * 3; i++) {
        const queue = queues.get(cats[(turn + i) % cats.length]!)!;
        if (queue.length === 0) continue;
        let best = 0;
        let bestScore = penalty(queue[0]!);
        for (let j = 1; j < queue.length && bestScore > 0; j++) {
          const s = penalty(queue[j]!);
          if (s < bestScore) {
            best = j;
            bestScore = s;
          }
        }
        picked.push(queue.splice(best, 1)[0]!);
      }
      turn += 3;
      return picked;
    },
    /** Nicht gewählte Vorschläge kommen hinten wieder in ihre Kategorie. */
    giveBack(words: readonly Word[]): void {
      for (const w of words) queues.get(w.category)?.push(w);
    },
  };
}

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  guessed: boolean;
  /** Wie oft richtig geraten (Statistik fürs Ergebnis). */
  hits: number;
  left: boolean;
  order: number;
  lastGuessAt: number;
  guesses: OwnGuess[];
  guessSeq: number;
}

export default defineGame<ZgSettings, ZgInput, ZgTvState, ZgPlayerView>({
  manifest,
  inputSchema: ZgInputSchema,
  parseSettings: parseZgSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const durationMs = settings.drawSeconds * 1000;
    const deck = createDeck(settings, ctx);
    const previousIds = new Set(
      ((ctx.previous?.data as Partial<ZgResultData> | undefined)?.wordIds ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [
        p.id,
        { score: 0, rank: 1, roundPoints: 0, guessed: false, hits: 0, left: false, order, lastGuessAt: -Infinity, guesses: [], guessSeq: 0 },
      ]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;
    const gamePlayer = (id: PlayerId) => ctx.players.find((p) => p.id === id)!;

    // Reihenfolge der Zeichner: gemischt, jede Runde gleiche Reihenfolge.
    const order = ctx.rng.shuffle(ctx.players.map((p) => p.id));
    const turns: PlayerId[] = [];
    for (let t = 0; t < settings.turns; t++) turns.push(...order);

    const seenBy = new Map<PlayerId, Set<string>>();
    const offered = new Set<string>();
    const penalty = (w: Word): number => {
      let n = previousIds.has(w.id) ? 1 : 0;
      if (offered.has(w.id)) n += 1;
      for (const [pid, seen] of seenBy) if (!state(pid).left && seen.has(w.id)) n += 2;
      return n;
    };

    let phase: Phase = "intro";
    let round = -1;
    let pos = -1;
    let endsAt = 0;
    let timer: TimerId | null = null;
    let hintTimers: TimerId[] = [];
    let options: Word[] = [];
    let word: Word | null = null;
    let keys: string[] = [];
    let drawerId: PlayerId | null = null;
    let reason: RevealReason = "time";
    let revealed = new Set<number>();
    let correctCount = 0;
    let strokes: Stroke[] = [];
    let usedStrokeIds = new Set<number>();
    let nextStrokeId = 0;
    let pointCount = 0;
    let rev = 0;
    let bubbles: Bubble[] = [];
    let bubbleSeq = 0;
    const playedIds: string[] = [];

    const active = (id: PlayerId): boolean => !state(id).left;
    /** Gespielte + noch ausstehende Züge (deren Zeichner noch da ist). */
    const total = (): number => round + 1 + turns.slice(pos + 1).filter(active).length;

    const recomputeRanks = (): void => {
      const sorted = [...players].sort(([, a], [, b]) => b.score - a.score);
      sorted.forEach(([, s], i) => {
        const prev = sorted[i - 1]?.[1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): ZgPlayerInfo[] =>
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
            guessed: s.guessed,
            left: s.left,
          };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const drawer = (): Drawer => {
      const p = gamePlayer(drawerId!);
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color };
    };
    const copyStrokes = (): Stroke[] => strokes.map((s) => ({ ...s, points: s.points.slice() }));
    const hint = () => buildHint(word!.word, revealed);
    /** Rater dieser Runde, die noch dabei sind. */
    const guessers = (): PlayerId[] => ctx.activePlayerIds().filter((id) => id !== drawerId);

    const tvState = (): ZgTvState => {
      const base = { round: Math.max(0, round), total: total(), players: playerInfos() };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "choose":
          return { ...base, phase, drawer: drawer(), endsAt };
        case "draw":
          return { ...base, phase, drawer: drawer(), strokes: copyStrokes(), rev, hint: hint(), endsAt, durationMs, bubbles: bubbles.slice() };
        case "reveal":
          return { ...base, phase, drawer: drawer(), strokes: copyStrokes(), rev, word: word!.word, reason, endsAt };
        case "standings":
          return { ...base, phase, endsAt };
        case "final":
        case "done":
          return { ...base, phase: "final", endsAt };
      }
    };

    const viewFor = (id: PlayerId): ZgPlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total: total(), score: s.score, rank: s.rank, playerCount: ctx.players.length };
      const isDrawer = id === drawerId;
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "choose":
          return isDrawer
            ? { ...base, phase, role: "draw", options: options.map((w) => ({ word: w.word, category: w.category })), endsAt, durationMs: TIMING.chooseMs }
            : { ...base, phase, role: "guess", drawer: drawer() };
        case "draw":
          return isDrawer
            ? {
                ...base,
                phase,
                role: "draw",
                word: word!.word,
                wordId: word!.id,
                strokes: copyStrokes(),
                nextStrokeId,
                endsAt,
                durationMs,
                guessed: correctCount,
                guessers: guessers().length,
                roundPoints: s.roundPoints,
              }
            : {
                ...base,
                phase,
                role: "guess",
                drawer: drawer(),
                hint: hint(),
                endsAt,
                durationMs,
                correct: s.guessed,
                roundPoints: s.roundPoints,
                guesses: s.guesses.slice(),
                guessSeq: s.guessSeq,
              };
        case "reveal":
          return {
            ...base,
            phase,
            role: isDrawer ? "draw" : "guess",
            word: word!.word,
            wordId: word!.id,
            drawer: drawer(),
            correct: s.guessed,
            roundPoints: s.roundPoints,
            guessed: correctCount,
            reason,
          };
        case "standings":
          return { ...base, phase };
        case "final":
        case "done":
          return { ...base, phase: "final" };
      }
    };

    /**
     * Gedrosselte Ausgabe: `soon()` sendet höchstens alle `intervalMs` (der letzte Stand kommt garantiert an),
     * `now()` sofort.
     */
    const throttled = (intervalMs: number, send: () => void) => {
      let last = -Infinity;
      let pending: TimerId | null = null;
      const now = (): void => {
        if (pending !== null) ctx.timers.clear(pending);
        pending = null;
        last = ctx.now();
        send();
      };
      return {
        now,
        soon(): void {
          if (pending !== null) return;
          const wait = last + intervalMs - ctx.now();
          if (wait <= 0) now();
          else pending = ctx.timers.setTimeout(now, wait);
        },
      };
    };
    const tvOut = throttled(TIMING.tvThrottleMs, () => ctx.broadcastTv(tvState()));
    // Sicherung für Reconnects: die gecachte Ansicht des Zeichners enthält regelmäßig seine Striche.
    const drawerBackup = throttled(TIMING.drawerBackupMs, () => {
      if (phase === "draw" && drawerId) ctx.sendToPlayer(drawerId, viewFor(drawerId));
    });

    const publish = (): void => {
      tvOut.now();
      ctx.sendToAllPlayers((p) => viewFor(p.id));
    };

    const clearTimers = (): void => {
      if (timer !== null) ctx.timers.clear(timer);
      timer = null;
      for (const id of hintTimers) ctx.timers.clear(id);
      hintTimers = [];
    };

    /** Phasen-Countdown. `skippable` nur für reine Wartezeiten (nie Wortwahl/Zeichenzeit). */
    const schedule = (ms: number, next: () => void, skippable: boolean): void => {
      clearTimers();
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

    const startTurn = (): void => {
      // Nächster Zeichner, der noch dabei ist; ohne mindestens einen Rater ist das Spiel aus.
      do pos++;
      while (pos < turns.length && !active(turns[pos]!));
      if (pos >= turns.length || ctx.activePlayerIds().length < 2) return showFinal();
      const picked = deck.draw(penalty);
      if (picked.length === 0) return showFinal();
      options = picked;
      for (const w of picked) offered.add(w.id);
      drawerId = turns[pos]!;
      word = null;
      round++;
      for (const s of players.values()) {
        s.roundPoints = 0;
        s.guessed = false;
        s.guesses = [];
        s.lastGuessAt = -Infinity;
      }
      correctCount = 0;
      strokes = [];
      usedStrokeIds = new Set();
      nextStrokeId = 0;
      pointCount = 0;
      rev = 0;
      bubbles = [];
      phase = "choose";
      schedule(TIMING.chooseMs, () => choose(ctx.rng.int(0, options.length - 1)), false);
      publish();
    };

    const choose = (index: number): void => {
      if (phase !== "choose") return;
      word = options[index]!;
      deck.giveBack(options.filter((w) => w !== word));
      options = [];
      keys = acceptedKeys(word);
      playedIds.push(word.id);
      revealed = new Set();
      phase = "draw";
      schedule(durationMs, () => reveal("time"), false);
      if (settings.hints) {
        HINT_AT.slice(0, maxReveals(word.word)).forEach((f) => hintTimers.push(ctx.timers.setTimeout(revealLetter, Math.round(durationMs * f))));
      }
      publish();
    };

    const revealLetter = (): void => {
      if (phase !== "draw") return;
      const hidden = hiddenLetters(word!.word, revealed);
      if (hidden.length <= 1) return;
      revealed.add(ctx.rng.pick(hidden));
      tvOut.now();
      for (const id of guessers()) ctx.sendToPlayer(id, viewFor(id));
    };

    const reveal = (why: RevealReason): void => {
      if (phase !== "draw") return;
      reason = why;
      phase = "reveal";
      recomputeRanks();
      const last = turns.slice(pos + 1).filter(active).length === 0 || ctx.activePlayerIds().length < 2;
      schedule(TIMING.revealMs, last ? showFinal : showStandings, true);
      publish();
    };

    const showStandings = (): void => {
      phase = "standings";
      schedule(TIMING.standingsMs, startTurn, true);
      publish();
    };

    const showFinal = (): void => {
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
      const data: ZgResultData = {
        wordIds: playedIds,
        total: playedIds.length,
        players: infos.map(({ id, name, score, rank, left }) => ({ id, name, score, rank, guessed: state(id).hits, left })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Vorzeitig auflösen, wenn alle verbundenen Rater den Begriff haben. */
    const checkAllGuessed = (): void => {
      if (phase !== "draw") return;
      const connected = guessers().filter((id) => ctx.isConnected(id));
      if (connected.length > 0 && connected.every((id) => state(id).guessed)) reveal("all");
    };

    const addBubble = (playerId: PlayerId, text: string, correct: boolean): void => {
      bubbles.push({ n: ++bubbleSeq, playerId, text, correct });
      if (bubbles.length > MAX_BUBBLES) bubbles = bubbles.slice(-MAX_BUBBLES);
    };

    // ---------------------------------------------------------------- Eingaben

    const onGuess = (playerId: PlayerId, raw: string): void => {
      const s = state(playerId);
      if (phase !== "draw" || playerId === drawerId || s.guessed) return;
      const now = ctx.now();
      if (now - s.lastGuessAt < GUESS_LIMITS.minIntervalMs) return;
      const text = cleanGuess(raw);
      if (text.length === 0) return;
      s.lastGuessAt = now;
      s.guessSeq++;
      const result = judgeGuess(text, keys);
      if (result === "correct") {
        const points = guessPoints(correctCount);
        correctCount++;
        s.guessed = true;
        s.hits++;
        s.score += points;
        s.roundPoints = points;
        const d = state(drawerId!);
        const bonus = Math.max(0, Math.min(DRAWER_POINTS.perGuesser, DRAWER_POINTS.max - d.roundPoints));
        d.score += bonus;
        d.roundPoints += bonus;
        recomputeRanks();
        addBubble(playerId, "", true);
        tvOut.now();
        ctx.sendToPlayer(playerId, viewFor(playerId));
        ctx.sendToPlayer(drawerId!, viewFor(drawerId!));
        checkAllGuessed();
        return;
      }
      s.guesses = [{ text, close: result === "close" }, ...s.guesses].slice(0, MAX_OWN_GUESSES);
      if (result === "wrong") {
        addBubble(playerId, text, false);
        tvOut.now();
      }
      ctx.sendToPlayer(playerId, viewFor(playerId));
    };

    const onDraw = (input: Extract<ZgInput, { type: "stroke" | "undo" | "clear" }>): void => {
      if (input.type === "undo") {
        const removed = strokes.pop();
        if (!removed) return;
        pointCount -= removed.points.length / 2;
        rev++;
      } else if (input.type === "clear") {
        if (strokes.length === 0) return;
        strokes = [];
        pointCount = 0;
        rev++;
      } else {
        const room = DRAW_LIMITS.drawingPoints - pointCount;
        if (room <= 0) return;
        const pts = input.points.length / 2 > room ? input.points.slice(0, room * 2) : input.points;
        const last = strokes.at(-1);
        if (last && last.id === input.id) last.points.push(...pts);
        else {
          // Folge-Chunks eines älteren (z. B. rückgängig gemachten) Strichs werden ignoriert.
          if (usedStrokeIds.has(input.id)) return;
          usedStrokeIds.add(input.id);
          nextStrokeId = Math.max(nextStrokeId, input.id + 1);
          strokes.push({ id: input.id, color: input.color, size: input.size, points: pts.slice() });
        }
        pointCount += pts.length / 2;
      }
      tvOut.soon();
      drawerBackup.soon();
    };

    // Intro bewusst NICHT überspringbar: In dieser Zeit melden die Handys ihre gespielten Begriffe (seen),
    // die die Auswahl des ersten Begriffs schon braucht.
    schedule(TIMING.introMs, startTurn, false);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (state(playerId).left) return;
        switch (input.type) {
          case "seen":
            seenBy.set(playerId, new Set(unpackSeen(input.ids)));
            return;
          case "choose":
            if (phase === "choose" && playerId === drawerId && input.index < options.length) choose(input.index);
            return;
          case "guess":
            onGuess(playerId, input.text);
            return;
          default:
            if (phase === "draw" && playerId === drawerId) onDraw(input);
        }
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        if (ctx.activePlayerIds().length < 2) {
          if (phase !== "final" && phase !== "done") showFinal();
          return;
        }
        if (playerId === drawerId && phase === "choose") {
          // Noch nichts gezeichnet: gleich weiter zum nächsten Zeichner.
          deck.giveBack(options);
          options = [];
          round--; // Der ausgefallene Zug zählt nicht als Runde.
          startTurn();
        } else if (playerId === drawerId && phase === "draw") {
          // Zeichner weg: sofort auflösen, keine weiteren Punkte.
          reveal("left");
        } else {
          publish();
          checkAllGuessed();
        }
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllGuessed();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
