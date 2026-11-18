// Serverlogik „Wer ist der Spion?“ (server-authoritative), 3–8 Spieler.
// Ablauf: intro → (role → clue → vote → reveal [→ vote (Stichwahl) → reveal] [→ guess] → result)* → final → ctx.end().
// role:   Alle sehen am Handy geheim dasselbe Wort, ein Spieler ist der Spion (klassisch: nur die Kategorie;
//         Undercover: ein ähnliches Wort, ohne es zu wissen). Endet, sobald alle verbundenen Spieler „Verstanden“
//         getippt haben (sonst nach TIMING.roleMs).
// clue:   Reihum ab einem zufälligen Startspieler (ctx.rng) tippt jeder EIN Hinweiswort, 1–3 Hinweisrunden.
//         Ein Hinweis, der das eigene Wort verrät (normalisiert gleich, enthält es, Wortteil), wird abgelehnt –
//         geprüft wird nur gegen das EIGENE Wort, damit die Ablehnung nie etwas über fremde Wörter verrät.
//         Auslassen oder Zeitablauf → „—“.
// vote:   Alle verdächtigen gleichzeitig einen Mitspieler (nicht sich selbst), Wahl fix. Endet nach voteSeconds oder
//         sobald alle verbundenen Spieler abgestimmt haben.
// reveal: Schritt 1 Stimmen einfliegen + Beschuldigter, Schritt 2 Urteil (Stempel, ggf. der echte Spion).
//         Gleichstand an der Spitze → einmalige Stichwahl zwischen den Gleichplatzierten (alle stimmen erneut,
//         niemand für sich selbst). Endet auch die Stichwahl unentschieden, gewinnt der Spion: Die Gruppe konnte
//         sich nicht einigen. Ohne jede Stimme gewinnt ebenfalls der Spion.
// guess:  Nur im klassischen Modus: Der enttarnte Spion wählt am Handy aus acht Wörtern der Kategorie.
//         Richtig → der Spion gewinnt trotzdem.
// result: Wort (und Undercover-Wort), Spion, Ausgang, Punkte (siehe round.ts: scoreRound).
// Geheimhaltung siehe shared.ts. Wartezeiten (Auflösung, Ergebnis, Finale) sind überspringbar; Intro, Rolle,
// Hinweise, Abstimmung und Raten nicht.
import { defineGame, type GameContext, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { MIN_ACTIVE, ROUND_OPTIONS } from "../constants.js";
import { WORDS_BY_CATEGORY, type Word } from "../data/index.js";
import { cleanText, isForbiddenClue, isValidClue, normalizeWord } from "../normalize.js";
import { buildGuessOptions, computeAwards, pickSpy, scoreRound, tallyVotes, turnOrder, type Tally } from "../round.js";
import { unpackSeen } from "../seen.js";
import {
  CATEGORY_IDS,
  TIMING,
  voteSchedule,
  winnerOf,
  type CategoryId,
  type SpAward,
  type SpFlight,
  type SpInput,
  type SpPerson,
  type SpPlayerInfo,
  type SpPlayerView,
  type SpReason,
  type SpResultData,
  type SpSecret,
  type SpSettings,
  type SpTvState,
} from "../shared.js";
import { SpInputSchema } from "./input.js";

type Ctx = GameContext<SpSettings, SpTvState, SpPlayerView>;
type Phase = "intro" | "role" | "clue" | "vote" | "reveal" | "guess" | "result" | "final" | "done";

export function parseSpSettings(values: SettingsValues): SpSettings {
  const known = new Set<string>(CATEGORY_IDS);
  const raw = Array.isArray(values.categories) ? values.categories : [];
  const categories = raw.filter((c): c is CategoryId => known.has(c));
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  const rounds = Number(values.rounds);
  return {
    mode: values.mode === "undercover" ? "undercover" : "klassisch",
    categories: categories.length > 0 ? [...new Set(categories)] : [...CATEGORY_IDS],
    rounds: (ROUND_OPTIONS as readonly number[]).includes(rounds) ? rounds : 5,
    clueRounds: num(values.clueRounds, 2, 1, 3),
    clueSeconds: num(values.clueSeconds, 30, 15, 60),
    voteSeconds: num(values.voteSeconds, 60, 30, 120),
  };
}

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  /** So oft schon Spion gewesen (für die Verteilung ohne Wiederholung). */
  spyCount: number;
  /** Runden als Spion gewonnen. */
  spyWins: number;
  /** So oft in der entscheidenden Abstimmung auf den Spion getippt. */
  correctVotes: number;
  left: boolean;
  order: number;
}

/** Dauer der gesamten Auflösung bei n Stimmen (mit Urteil bzw. nur Auszählen vor einer Stichwahl). */
export const revealDurationMs = (votes: number, withVerdict: boolean): number => voteSchedule(votes).doneMs + (withVerdict ? TIMING.verdictMs : 0);

/** Wörter je Kategorie, Kategorien reihum; innerhalb der Kategorie das mit der kleinsten Strafe. */
function createDeck(categories: readonly CategoryId[], ctx: Ctx) {
  const queues = ctx.rng.shuffle([...categories]).map((c) => ctx.rng.shuffle([...WORDS_BY_CATEGORY[c]]));
  let turn = 0;
  return (penalty: (id: string) => number): Word | null => {
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

export default defineGame<SpSettings, SpInput, SpTvState, SpPlayerView>({
  manifest,
  inputSchema: SpInputSchema,
  parseSettings: parseSpSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const { mode, clueRounds } = settings;
    const clueMs = settings.clueSeconds * 1000;
    const voteMs = settings.voteSeconds * 1000;
    const nextWord = createDeck(settings.categories, ctx);
    const available = settings.categories.reduce((n, c) => n + WORDS_BY_CATEGORY[c].length, 0);
    const total = Math.min(settings.rounds, available);
    const previousIds = new Set(
      ((ctx.previous?.data as Partial<SpResultData> | undefined)?.wordIds ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, spyCount: 0, spyWins: 0, correctVotes: 0, left: false, order }]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;
    const isIn = (id: PlayerId): boolean => players.has(id) && !state(id).left;
    const active = (): PlayerId[] => ctx.players.filter((p) => isIn(p.id)).map((p) => p.id);
    const person = (id: PlayerId): SpPerson => {
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
    let timer: TimerId | null = null;
    let stepTimer: TimerId | null = null;
    // --- Rundenzustand. word/spyId/spyWord verlassen den Server erst in der Auflösung.
    let word: Word | null = null;
    let spyId: PlayerId = "";
    let spyWord: string | null = null;
    let lastSpy: PlayerId | null = null;
    let order: PlayerId[] = [];
    let clues = new Map<PlayerId, Array<string | null>>();
    let turns: Array<{ id: PlayerId; clueRound: number }> = [];
    let turnIndex = 0;
    let ready = new Set<PlayerId>();
    let rejected = new Set<PlayerId>();
    let runoff = false;
    let candidates: PlayerId[] = [];
    /** Wähler → Verdächtiger der laufenden Abstimmung. */
    let votes = new Map<PlayerId, PlayerId>();
    let tally: Tally | null = null;
    let flights: SpFlight[] = [];
    let next: "runoff" | "verdict" = "verdict";
    let stepAt = 0;
    let verdict: { spyId: PlayerId; caught: boolean } | null = null;
    let options: string[] = [];
    let guessChoice: number | null = null;
    let guessText: string | null = null;
    let reason: SpReason = "none";
    let correctVoters: PlayerId[] = [];
    let awards: SpAward[] = [];
    const askedIds: string[] = [];

    const currentTurn = (): { id: PlayerId; clueRound: number } => turns[turnIndex]!;

    const recomputeRanks = (): void => {
      const sorted = [...players.values()].sort((a, b) => b.score - a.score);
      sorted.forEach((s, i) => {
        const prev = sorted[i - 1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): SpPlayerInfo[] =>
      ctx.players
        .map((p) => {
          const s = state(p.id);
          return { ...person(p.id), score: s.score, rank: s.rank, roundPoints: s.roundPoints, clues: [...(clues.get(p.id) ?? [])], left: s.left };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    /** Eigenes Wort (null = klassischer Spion, der keins hat). */
    const ownWord = (id: PlayerId): string | null => (id === spyId ? spyWord : (word?.word ?? null));

    const secretFor = (id: PlayerId): SpSecret | null => {
      if (!word || phase === "intro" || phase === "final" || phase === "done") return null;
      const own = ownWord(id);
      return own === null ? { kind: "spy", category: word.category } : { kind: "word", category: word.category, word: own };
    };

    const tvState = (): SpTvState => {
      const base = { round: Math.max(0, round), total, mode, players: playerInfos() };
      if (phase === "intro") return { ...base, phase, endsAt, durationMs: TIMING.introMs, categories: [...settings.categories] };
      if (phase === "final" || phase === "done") return { ...base, phase: "final", endsAt, durationMs: TIMING.finalMs, awards };
      const w = word!;
      const common = { ...base, category: w.category, clueRounds, order: [...order] };
      switch (phase) {
        case "role":
          return { ...common, phase, endsAt, durationMs: TIMING.roleMs, ready: ctx.players.filter((p) => ready.has(p.id)).map((p) => p.id) };
        case "clue":
          return { ...common, phase, clueRound: currentTurn().clueRound, turn: currentTurn().id, endsAt, durationMs: clueMs };
        case "vote":
          return {
            ...common,
            phase,
            runoff,
            candidates: [...candidates],
            voted: ctx.players.filter((p) => votes.has(p.id)).map((p) => p.id),
            endsAt,
            durationMs: voteMs,
          };
        case "reveal": {
          const t = tally!;
          return {
            ...common,
            phase,
            runoff,
            candidates: [...candidates],
            flights: flights.map((f) => ({ ...f })),
            counts: t.counts.map((c) => ({ ...c })),
            accused: t.accused,
            tie: t.tie,
            next,
            stepAt,
            verdict: verdict ? { ...verdict } : null,
          };
        }
        case "guess":
          return { ...common, phase, spyId, options: [...options], endsAt, durationMs: TIMING.guessMs };
        case "result":
          return {
            ...common,
            phase,
            spyId,
            word: w.word,
            spyWord,
            reason,
            winner: winnerOf(reason),
            guess: guessText,
            correctVoters: [...correctVoters],
            endsAt,
            durationMs: TIMING.resultMs,
            last: round + 1 >= total,
          };
      }
    };

    /** Züge bis man selbst (wieder) dran ist; null = in dieser Runde nicht mehr. */
    const turnsUntil = (id: PlayerId): number | null => {
      let n = 0;
      for (let j = turnIndex + 1; j < turns.length; j++) {
        const t = turns[j]!;
        if (!isIn(t.id)) continue;
        n++;
        if (t.id === id) return n;
      }
      return null;
    };

    const viewFor = (id: PlayerId): SpPlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total, score: s.score, rank: s.rank, playerCount: ctx.players.length, secret: secretFor(id) };
      switch (phase) {
        case "intro":
          return { ...base, phase, endsAt };
        case "role":
          return { ...base, phase, endsAt, durationMs: TIMING.roleMs, ready: ready.has(id) };
        case "clue": {
          const t = currentTurn();
          return {
            ...base,
            phase,
            clueRound: t.clueRound,
            clueRounds,
            turn: person(t.id),
            myTurn: t.id === id,
            turnsUntil: turnsUntil(id),
            myClues: [...(clues.get(id) ?? [])],
            rejected: rejected.has(id),
            endsAt,
            durationMs: clueMs,
          };
        }
        case "vote":
          return {
            ...base,
            phase,
            runoff,
            candidates: candidates.filter((c) => c !== id).map(person),
            choice: votes.get(id) ?? null,
            inRunoff: runoff && candidates.includes(id),
            endsAt,
            durationMs: voteMs,
          };
        case "reveal":
          return { ...base, phase };
        case "guess":
          return {
            ...base,
            phase,
            spy: person(spyId),
            canGuess: id === spyId,
            options: [...options],
            choice: id === spyId ? guessChoice : null,
            endsAt,
            durationMs: TIMING.guessMs,
          };
        case "result": {
          const winner = winnerOf(reason);
          return {
            ...base,
            phase,
            wordId: word!.id,
            word: word!.word,
            spyWord,
            spy: person(spyId),
            wasSpy: id === spyId,
            reason,
            winner,
            guess: guessText,
            won: winner === "group" ? id !== spyId : winner === "spy" ? id === spyId : false,
            votedRight: correctVoters.includes(id),
            points: s.roundPoints,
          };
        }
        case "final":
        case "done":
          return {
            ...base,
            phase: "final",
            correctVotes: s.correctVotes,
            spyWins: s.spyWins,
            awards: awards.filter((a) => a.playerIds.includes(id)).map((a) => a.kind),
          };
      }
    };

    const publish = (): void => {
      ctx.broadcastTv(tvState());
      ctx.sendToAllPlayers((p) => viewFor(p.id));
    };

    const schedule = (ms: number, then: () => void, skippable: boolean): void => {
      if (timer !== null) ctx.timers.clear(timer);
      const cd = ctx.timers.countdown(
        ms,
        () => {
          timer = null;
          then();
        },
        { skippable },
      );
      timer = cd.id;
      endsAt = cd.endsAt;
    };

    const clearStep = (): void => {
      if (stepTimer !== null) ctx.timers.clear(stepTimer);
      stepTimer = null;
    };

    // ---------------------------------------------------------------- Phasen

    const startRound = (): void => {
      if (round + 1 >= total || active().length < MIN_ACTIVE) return showFinal();
      const w = nextWord(penalty);
      if (!w) return showFinal();
      const act = active();
      word = w;
      askedIds.push(w.id);
      const counts = new Map([...players].map(([id, s]) => [id, s.spyCount]));
      spyId = pickSpy(act, counts, lastSpy, ctx.rng);
      state(spyId).spyCount++;
      lastSpy = spyId;
      spyWord = mode === "undercover" ? ctx.rng.pick(w.undercover) : null;
      order = turnOrder(act, ctx.rng);
      clues = new Map(ctx.players.map((p) => [p.id, []]));
      turns = [];
      for (let r = 0; r < clueRounds; r++) for (const id of order) turns.push({ id, clueRound: r });
      turnIndex = 0;
      ready = new Set();
      rejected = new Set();
      runoff = false;
      candidates = [];
      votes = new Map();
      tally = null;
      flights = [];
      verdict = null;
      options = [];
      guessChoice = null;
      guessText = null;
      reason = "none";
      correctVoters = [];
      for (const s of players.values()) s.roundPoints = 0;
      round++;
      phase = "role";
      schedule(TIMING.roleMs, startClues, false);
      publish();
    };

    const startClues = (): void => {
      if (phase !== "role") return;
      turnIndex = -1;
      nextTurn();
    };

    /** Nächster Zug (Ausgeschiedene werden übersprungen); nach dem letzten Zug beginnt die Abstimmung. */
    const nextTurn = (): void => {
      rejected = new Set();
      do turnIndex++;
      while (turnIndex < turns.length && !isIn(turns[turnIndex]!.id));
      if (turnIndex >= turns.length) return startVote(false, active());
      phase = "clue";
      const { id } = currentTurn();
      schedule(
        clueMs,
        () => {
          clues.get(id)!.push(null);
          nextTurn();
        },
        false,
      );
      publish();
    };

    const startVote = (isRunoff: boolean, cands: readonly PlayerId[]): void => {
      phase = "vote";
      runoff = isRunoff;
      candidates = [...cands];
      votes = new Map();
      schedule(voteMs, startReveal, false);
      publish();
    };

    const startReveal = (): void => {
      if (phase !== "vote") return;
      const cands = candidates.filter(isIn);
      // Nur Stimmen von Spielern, die noch dabei sind, für Kandidaten, die noch dabei sind (Startreihenfolge).
      votes = new Map(
        ctx.players.flatMap((x) => {
          const target = votes.get(x.id);
          return target !== undefined && isIn(x.id) && target !== x.id && cands.includes(target) ? [[x.id, target] as const] : [];
        }),
      );
      tally = tallyVotes(cands, votes);
      // Stichwahl, aus der alle anderen ausgeschieden sind: der Übriggebliebene gilt als beschuldigt.
      if (cands.length === 1 && runoff) tally = { ...tally, top: [cands[0]!], accused: cands[0]!, tie: false };
      // Zufällige Reihenfolge, damit die Animation nicht verrät, wer zuerst getippt hat.
      flights = ctx.rng.shuffle([...votes]).map(([voter, target]) => ({ voter, target }));
      next = tally.tie && !runoff ? "runoff" : "verdict";
      candidates = cands;
      phase = "reveal";
      stepAt = ctx.now();
      verdict = null;
      clearStep();
      const countMs = voteSchedule(flights.length).doneMs;
      if (next === "verdict") {
        stepTimer = ctx.timers.setTimeout(() => {
          stepTimer = null;
          showVerdict();
          publish();
        }, countMs);
      }
      // Die ganze Auflösung ist eine überspringbare Wartezeit (der Schritt-Timer selbst nicht).
      schedule(revealDurationMs(flights.length, next === "verdict"), afterReveal, true);
      publish();
    };

    const showVerdict = (): void => {
      if (verdict) return;
      verdict = { spyId, caught: tally!.accused === spyId };
      stepAt = ctx.now();
    };

    const afterReveal = (): void => {
      clearStep();
      const t = tally!;
      if (next === "runoff") return startVote(true, t.top.filter(isIn));
      showVerdict();
      if (t.accused === spyId) {
        if (mode === "klassisch" && isIn(spyId)) startGuess();
        else finishRound("caught");
        return;
      }
      finishRound(t.accused !== null ? "wrong" : t.tie ? "tie" : "none");
    };

    const startGuess = (): void => {
      options = buildGuessOptions(word!, WORDS_BY_CATEGORY[word!.category], ctx.rng);
      guessChoice = null;
      phase = "guess";
      // Keine Wahl in der Zeit → falsch geraten, die Gruppe gewinnt.
      schedule(TIMING.guessMs, () => finishRound("caught"), false);
      publish();
    };

    const finishRound = (r: SpReason): void => {
      if (phase === "result" || phase === "final" || phase === "done") return;
      clearStep();
      reason = r;
      const score = scoreRound(r, spyId, active(), votes);
      for (const s of players.values()) s.roundPoints = 0;
      for (const [id, n] of score.points) {
        const s = state(id);
        s.score += n;
        s.roundPoints = n;
      }
      correctVoters = score.correctVoters;
      for (const id of correctVoters) state(id).correctVotes++;
      if (winnerOf(r) === "spy") state(spyId).spyWins++;
      recomputeRanks();
      phase = "result";
      schedule(TIMING.resultMs, startRound, true);
      publish();
    };

    const showFinal = (): void => {
      if (phase === "final" || phase === "done") return;
      clearStep();
      phase = "final";
      recomputeRanks();
      awards = computeAwards(
        ctx.players
          .filter((p) => !state(p.id).left)
          .map((p) => {
            const s = state(p.id);
            return { id: p.id, correctVotes: s.correctVotes, spyWins: s.spyWins };
          }),
      );
      schedule(TIMING.finalMs, finish, true);
      publish();
    };

    const finish = (): void => {
      if (phase === "done") return;
      phase = "done";
      recomputeRanks();
      const infos = playerInfos();
      const data: SpResultData = {
        wordIds: askedIds,
        total: askedIds.length,
        awards,
        players: infos.map(({ id, name, score, rank, left }) => {
          const s = state(id);
          return { id, name, score, rank, correctVotes: s.correctVotes, spyWins: s.spyWins, left };
        }),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Rolle: weiter, sobald alle verbundenen Spieler „Verstanden“ getippt haben (mindestens einer verbunden). */
    const checkAllReady = (): void => {
      if (phase !== "role") return;
      const connected = active().filter((id) => ctx.isConnected(id));
      if (connected.length > 0 && connected.every((id) => ready.has(id))) startClues();
    };

    /** Abstimmung: vorzeitig auflösen, wenn alle verbundenen Spieler mit Wahlmöglichkeit abgestimmt haben. */
    const checkAllVoted = (): void => {
      if (phase !== "vote") return;
      const voters = active().filter((id) => ctx.isConnected(id) && candidates.some((c) => c !== id));
      if (voters.length > 0 && voters.every((id) => votes.has(id))) startReveal();
    };

    // Intro nicht überspringbar: In dieser Zeit melden die Handys ihre gespielten Wörter (Wiederholungsschutz).
    schedule(TIMING.introMs, startRound, false);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (input.type === "seen") {
          seenBy.set(playerId, new Set(unpackSeen(input.ids)));
          return;
        }
        if (!isIn(playerId)) return;
        switch (input.type) {
          case "ready":
            if (phase !== "role" || ready.has(playerId)) return;
            ready.add(playerId);
            ctx.broadcastTv(tvState());
            ctx.sendToPlayer(playerId, viewFor(playerId));
            checkAllReady();
            return;
          case "clue": {
            if (phase !== "clue" || currentTurn().id !== playerId) return;
            const text = cleanText(input.text);
            if (!isValidClue(text)) return;
            const own = ownWord(playerId);
            if (own !== null && isForbiddenClue(text, own)) {
              // Verrät das eigene Wort: nur der Absender erfährt es (eigener Status statt Fehlercode).
              rejected.add(playerId);
              ctx.sendToPlayer(playerId, viewFor(playerId));
              return;
            }
            clues.get(playerId)!.push(text);
            nextTurn();
            return;
          }
          case "pass":
            if (phase !== "clue" || currentTurn().id !== playerId) return;
            clues.get(playerId)!.push(null);
            nextTurn();
            return;
          case "vote":
            if (phase !== "vote" || votes.has(playerId) || input.target === playerId) return;
            if (!candidates.includes(input.target) || !isIn(input.target)) return;
            votes.set(playerId, input.target);
            ctx.broadcastTv(tvState());
            ctx.sendToPlayer(playerId, viewFor(playerId));
            checkAllVoted();
            return;
          case "guess": {
            if (phase !== "guess" || playerId !== spyId || guessChoice !== null) return;
            const text = options[input.index];
            if (text === undefined) return;
            guessChoice = input.index;
            guessText = text;
            finishRound(normalizeWord(text) === normalizeWord(word!.word) ? "guessed" : "caught");
            return;
          }
        }
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        if (active().length < MIN_ACTIVE) {
          showFinal();
          return;
        }
        const inRound = phase === "role" || phase === "clue" || phase === "vote" || phase === "reveal" || phase === "guess";
        if (inRound && playerId === spyId) {
          finishRound("left");
          return;
        }
        if (phase === "clue" && currentTurn().id === playerId) {
          nextTurn();
          return;
        }
        if (phase === "vote") {
          // Eigene Stimme fällt weg; wer den Ausgeschiedenen verdächtigt hat, darf neu wählen.
          votes.delete(playerId);
          for (const [voter, target] of votes) if (target === playerId) votes.delete(voter);
          candidates = candidates.filter((c) => c !== playerId);
        }
        recomputeRanks();
        publish();
        checkAllReady();
        checkAllVoted();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) {
          checkAllReady();
          checkAllVoted();
        } else {
          // Reconnect: eigene Rolle und aktuellen Stand sofort wieder zeigen.
          ctx.sendToPlayer(playerId, viewFor(playerId));
        }
      },
    };
  },
});
