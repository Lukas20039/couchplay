// Serverlogik „Alles oder nichts“ (server-authoritative).
// Ablauf je Frage: pick (tippen oder enthalten) → spin (Lauflicht streicht eine falsche Antwort)
// → decide (aussteigen oder weiter) → spin → decide → spin → reveal → standings.
// Gestrichen wird immer eine zufällige falsche Antwort (ctx.rng); nach der dritten bleibt nur die
// richtige übrig. Wer aussteigt, sichert so viele Punkte, wie er Eliminationen überstanden hat
// (1 oder 2); wer bis zum Schluss drinbleibt, bekommt 3. Fliegt die eigene Antwort in Elimination k
// raus, gibt es −k. Ist niemand mehr drin, folgt sofort die Auflösung.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { QUESTIONS_BY_CATEGORY } from "../data/index.js";
import { unpackSeen } from "../seen.js";
import {
  AonInputSchema,
  CATEGORY_IDS,
  SOLO_BONUS,
  STAGES,
  TIMING,
  cashValue,
  lossValue,
  type AonInput,
  type AonPick,
  type AonPlayerInfo,
  type AonPlayerView,
  type AonResultData,
  type AonSettings,
  type AonStatus,
  type AonTvState,
  type CategoryId,
} from "../shared.js";
import { buildSpinPath } from "../spin.js";
import { createDeck, type RoundQuestion } from "./questions.js";
import { rankScores } from "./ranking.js";

type Ctx = GameContext<AonSettings, AonTvState, AonPlayerView>;
type Phase = "intro" | "pick" | "spin" | "decide" | "reveal" | "standings" | "final" | "done";

interface PlayerState {
  score: number;
  rank: number;
  previousRank: number | null;
  jackpots: number;
  left: boolean;
  order: number;
  // ---- aktuelle Frage
  /** Getippte Antwort (null = keine/enthalten). */
  choice: number | null;
  /** Hat getippt oder sich enthalten. */
  locked: boolean;
  /** null während der Tipp-Phase. */
  status: AonStatus | null;
  stage: number;
  decision: "stay" | "cash" | null;
  roundPoints: number;
}

/** Rohwerte (bereits gegen das Manifest validiert) → typisierte Settings. Defensiv gegen Fremdwerte. */
export function parseAonSettings(values: SettingsValues): AonSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  return {
    categories: categories.length > 0 ? categories : [...CATEGORY_IDS],
    rounds: num(values.rounds, 10, 1, 50),
    answerSeconds: num(values.answerSeconds, 25, 5, 120),
  };
}

function previousQuestionIds(ctx: Ctx): Set<string> {
  const data = ctx.previous?.data as Partial<AonResultData> | undefined;
  return new Set(Array.isArray(data?.questionIds) ? data.questionIds.filter((x) => typeof x === "string") : []);
}

export default defineGame<AonSettings, AonInput, AonTvState, AonPlayerView>({
  manifest,
  inputSchema: AonInputSchema,
  parseSettings: parseAonSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const deck = createDeck(QUESTIONS_BY_CATEGORY, settings.categories, ctx.rng);
    const questions: RoundQuestion[] = [];
    const total = Math.min(settings.rounds, deck.size);
    const previousIds = previousQuestionIds(ctx);
    /** Gesehene Fragen je Teilnehmer (vom Handy gemeldet). */
    const seenBy = new Map<PlayerId, Set<string>>();
    /** Je Teilnehmer, der sie kennt, +2; aus der Vorrunde dieses Raums +1. */
    const penalty = (id: string): number => {
      let n = previousIds.has(id) ? 1 : 0;
      for (const [pid, seen] of seenBy) if (!state(pid).left && seen.has(id)) n += 2;
      return n;
    };
    const pickMs = settings.answerSeconds * 1000;

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [
        p.id,
        {
          score: 0,
          rank: 1,
          previousRank: null,
          jackpots: 0,
          left: false,
          order,
          choice: null,
          locked: false,
          status: null,
          stage: 0,
          decision: null,
          roundPoints: 0,
        },
      ]),
    );

    let phase: Phase = "intro";
    let index = -1;
    let endsAt = 0;
    let timer: TimerId | null = null;
    /** Laufende bzw. zuletzt überstandene Elimination (1-basiert, 0 = noch keine). */
    let stage = 0;
    /** Noch nicht gestrichene Antworten (Anzeige-Indizes). */
    let remaining: number[] = [];
    let struck: number[] = [];
    let path: number[] = [];
    let spinStartedAt = 0;
    let soloBonus: PlayerId | null = null;

    // ---------------------------------------------------------------- Hilfen

    const state = (id: PlayerId): PlayerState => players.get(id)!;
    const current = (): RoundQuestion => questions[index]!;
    const stillIn = (): PlayerId[] => ctx.players.filter((p) => state(p.id).status === "in").map((p) => p.id);

    const recomputeRanks = (): void => {
      const ranked = rankScores([...players].map(([id, s]) => ({ id, score: s.score, order: s.order })));
      for (const r of ranked) state(r.id).rank = r.rank;
    };

    const addPoints = (s: PlayerState, points: number): void => {
      s.score += points;
      s.roundPoints += points;
    };

    /** Spielerliste für den TV, sortiert nach Rang (Gleichstand: Startreihenfolge). */
    const playerInfos = (): AonPlayerInfo[] =>
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
            previousRank: s.previousRank,
            roundPoints: s.roundPoints,
            status: phase === "pick" ? null : s.status,
            stage: s.stage,
            jackpots: s.jackpots,
            left: s.left,
          };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    const base = (id: PlayerId) => ({
      total,
      score: state(id).score,
      rank: state(id).rank,
      playerCount: ctx.players.length,
    });

    /** `skippable` = reine Wartezeit (Auflösung, Zwischenstand, Finale) – nie Antwort-, Entscheidungs- oder Lauflichtzeit. */
    const schedule = (ms: number, next: () => void, skippable = false): void => {
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

    // --------------------------------------------------------------- Ausgabe

    const tvState = (): AonTvState => {
      const players = playerInfos();
      const question = () => {
        const q = current();
        return { total, players, index, category: q.category, text: q.text, answers: [...q.answers], struck: [...struck] };
      };
      switch (phase) {
        case "intro":
          return { phase, total, players, categories: [...settings.categories], endsAt };
        case "pick":
          return {
            ...question(),
            phase,
            endsAt,
            durationMs: pickMs,
            // In Startreihenfolge, nicht in Tipp-Reihenfolge → verrät nichts.
            answered: ctx.players.filter((p) => state(p.id).locked).map((p) => p.id),
          };
        case "spin":
          return { ...question(), phase, stage, path: [...path], startedAt: spinStartedAt, runMs: TIMING.spinRunMs, endsAt };
        case "decide":
          return {
            ...question(),
            phase,
            stage,
            endsAt,
            durationMs: TIMING.decideMs,
            decided: stillIn().filter((id) => state(id).decision !== null),
          };
        case "reveal":
          return {
            ...question(),
            phase,
            correctIndex: current().correctIndex,
            picks: ctx.players.map((p): AonPick => {
              const s = state(p.id);
              return { playerId: p.id, choice: s.choice, status: s.status ?? "abstain", stage: s.stage, points: s.roundPoints };
            }),
            soloBonus,
            endsAt,
          };
        case "standings":
          return { phase, total, players, index, endsAt };
        case "final":
        case "done":
          return { phase: "final", total, players, endsAt };
      }
    };

    const viewFor = (id: PlayerId): AonPlayerView => {
      const b = base(id);
      const s = state(id);
      const question = () => ({
        ...b,
        index,
        answers: [...current().answers],
        struck: [...struck],
        choice: s.choice,
        status: s.status ?? "abstain",
        points: s.roundPoints,
      });
      switch (phase) {
        case "intro":
          return { ...b, phase, endsAt };
        case "pick": {
          const q = current();
          return {
            ...b,
            phase,
            index,
            questionId: q.id,
            category: q.category,
            answers: [...q.answers],
            endsAt,
            durationMs: pickMs,
            locked: s.locked,
            choice: s.choice,
          };
        }
        case "spin":
          return { ...question(), phase, stage };
        case "decide":
          return { ...question(), phase, stage, endsAt, durationMs: TIMING.decideMs, decision: s.decision };
        case "reveal":
          return { ...question(), phase, correctIndex: current().correctIndex, bonus: soloBonus === id };
        case "standings":
          return { ...b, phase, index, previousRank: s.previousRank };
        case "final":
        case "done":
          return { ...b, phase: "final", jackpots: s.jackpots };
      }
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      ctx.sendToAllPlayers((p) => viewFor(p.id));
    };

    // ---------------------------------------------------------------- Phasen

    const startQuestion = (i: number): void => {
      const q = deck.next(penalty);
      if (!q) return showFinal(); // kann wegen total ≤ deck.size nicht passieren
      questions.push(q);
      index = i;
      for (const s of players.values()) {
        s.previousRank = s.rank;
        s.choice = null;
        s.locked = false;
        s.status = null;
        s.stage = 0;
        s.decision = null;
        s.roundPoints = 0;
      }
      stage = 0;
      remaining = [0, 1, 2, 3];
      struck = [];
      path = [];
      soloBonus = null;
      phase = "pick";
      schedule(pickMs, endPick);
      publish();
    };

    const endPick = (): void => {
      if (phase !== "pick") return;
      // Wer nicht getippt hat, gilt als enthalten (0 Punkte).
      for (const s of players.values()) s.status = s.locked && s.choice !== null ? "in" : "abstain";
      startSpin();
    };

    const startSpin = (): void => {
      if (stillIn().length === 0) return reveal();
      stage++;
      const correct = current().correctIndex;
      const target = ctx.rng.pick(remaining.filter((i) => i !== correct));
      path = buildSpinPath(remaining, target, ctx.rng.int(0, remaining.length - 1), ctx.rng.int(0, 1));
      phase = "spin";
      schedule(TIMING.spinMs, afterSpin);
      spinStartedAt = endsAt - TIMING.spinMs;
      publish();
    };

    const afterSpin = (): void => {
      if (phase !== "spin") return;
      const gone = path[path.length - 1]!;
      remaining = remaining.filter((i) => i !== gone);
      struck.push(gone);
      for (const s of players.values()) {
        if (s.status !== "in" || s.choice !== gone) continue;
        s.status = "out";
        s.stage = stage;
        addPoints(s, lossValue(stage));
      }
      if (stage >= STAGES) {
        // Nur noch die richtige Antwort übrig: Wer noch drin ist, hat alles gewonnen.
        const winners = stillIn();
        for (const id of winners) {
          const s = state(id);
          s.status = "won";
          s.stage = stage;
          s.jackpots++;
          addPoints(s, cashValue(STAGES));
        }
        if (winners.length === 1 && ctx.players.length > 1) {
          soloBonus = winners[0]!;
          addPoints(state(soloBonus), SOLO_BONUS);
        }
        return reveal();
      }
      if (stillIn().length === 0) return reveal();
      for (const s of players.values()) s.decision = null;
      phase = "decide";
      schedule(TIMING.decideMs, endDecide);
      publish();
    };

    const endDecide = (): void => {
      if (phase !== "decide") return;
      // Ohne Entscheidung (auch bei Verbindungsabbruch) wird sicher ausgestiegen.
      for (const id of stillIn()) {
        const s = state(id);
        if (s.decision === "stay") continue;
        s.status = "cashed";
        s.stage = stage;
        addPoints(s, cashValue(stage));
      }
      startSpin();
    };

    const reveal = (): void => {
      recomputeRanks();
      phase = "reveal";
      const isLast = index >= total - 1;
      schedule(TIMING.revealMs, isLast ? showFinal : showStandings, true);
      publish();
    };

    const showStandings = (): void => {
      phase = "standings";
      schedule(TIMING.standingsMs, () => startQuestion(index + 1), true);
      publish();
    };

    const showFinal = (): void => {
      phase = "final";
      schedule(TIMING.finalMs, finish, true);
      publish();
    };

    const finish = (): void => {
      if (phase === "done") return;
      phase = "done";
      recomputeRanks();
      const infos = playerInfos();
      const data: AonResultData = {
        questionIds: questions.map((q) => q.id),
        total,
        players: infos.map(({ id, name, score, rank, jackpots, left }) => ({ id, name, score, rank, jackpots, left })),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /**
     * Phase vorzeitig beenden, wenn alle Betroffenen fertig sind. Sind alle Betroffenen gegangen,
     * sofort; ist gerade nur niemand verbunden, läuft die Zeit normal ab (kein Durchrauschen).
     */
    const checkAllDone = (): void => {
      if (phase === "pick") {
        const active = ctx.activePlayerIds();
        const relevant = active.filter((id) => ctx.isConnected(id));
        if (active.length === 0 || (relevant.length > 0 && relevant.every((id) => state(id).locked))) endPick();
      } else if (phase === "decide") {
        const active = stillIn().filter((id) => ctx.isActive(id));
        const relevant = active.filter((id) => ctx.isConnected(id));
        if (active.length === 0 || (relevant.length > 0 && relevant.every((id) => state(id).decision !== null))) endDecide();
      }
    };

    // ---------------------------------------------------------------- Start

    if (total === 0) {
      // Kann mit gültigen Settings nicht passieren (≥ 190 Fragen je Kategorie), aber nie hängen bleiben.
      ctx.log.error("Alles oder nichts: keine Fragen für die gewählten Kategorien", { categories: settings.categories });
      finish();
      return { onPlayerInput() {}, onPlayerLeave() {} };
    }

    // Intro bleibt fest: Die Handys melden hier ihre schon gesehenen Fragen (Wiederholungsschutz).
    schedule(TIMING.introMs, () => startQuestion(0));
    publish();

    return {
      onPlayerInput(playerId, input) {
        const s = state(playerId);
        if (input.type === "seen") {
          // Jederzeit erlaubt (auch nach Reconnect); ersetzt die vorige Meldung dieses Handys.
          seenBy.set(playerId, new Set(unpackSeen(input.ids)));
          return;
        }
        if (s.left) return;
        if (input.type === "decide") {
          if (phase !== "decide" || s.status !== "in" || s.decision !== null) return;
          s.decision = input.stay ? "stay" : "cash";
        } else {
          // pick/abstain: nur während der Tipp-Phase und nur einmal.
          if (phase !== "pick" || s.locked || endsAt - ctx.now() < 0) return;
          s.locked = true;
          s.choice = input.type === "pick" ? input.index : null;
        }
        ctx.broadcastTv(tvState());
        ctx.sendToPlayer(playerId, viewFor(playerId));
        checkAllDone();
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
        checkAllDone();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllDone();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
