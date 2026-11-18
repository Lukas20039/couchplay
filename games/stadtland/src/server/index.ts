// Serverlogik „Stadt, Land, Fluss“ (server-authoritative), 2–8 Spieler.
// Ablauf: intro → (letter → write → timeup → review × Kategorien → standings)* → final → ctx.end();
// nach der letzten Runde direkt final.
// letter:  Der Buchstabe (ctx.rng, keiner doppelt pro Partie, möglichst keiner aus der Vorrunde) wird am TV per
//          Walze enthüllt. Die Handys erfahren ihn erst danach.
// write:   Alle tippen ihre Antworten; die Handys schicken sie laufend (entprellt) als Ganzes. Wer alle Felder
//          ausgefüllt hat, darf „Stopp!“ rufen → noch TIMING.stopMs, dann Ende. Sonst endet die Runde per Timer.
// timeup:  „Stifte weg!“ – kurze Gnadenfrist, in der verspätete Eingaben noch angenommen werden.
// review:  Kategorie für Kategorie. Automatisch ungültig: leer, zu kurz, falscher Anfangsbuchstabe. Gültige
//          Antworten kann jeder anfechten, der sie nicht selbst gegeben hat (Daumen runter); die Mehrheit der
//          Stimmberechtigten streicht sie. Überspringbar (TV/Host) und vorzeitig vorbei, wenn alle „Passt“ drücken.
// Wertung (scoring.ts): einzige gültige Antwort der Kategorie 20, einzigartig 10, doppelt 5, sonst 0 –
// gutgeschrieben am Ende der Prüfung einer Runde.
// Nicht überspringbar: Buchstabe, Schreibzeit, „Stifte weg!“. Überspringbar: Intro, Prüfung, Zwischenstand, Finale.
import { defineGame, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { cleanAnswer } from "../normalize.js";
import { computeAwards, pickCategories, pickLetter, scoreCategory } from "../scoring.js";
import {
  LETTERS,
  POINTS,
  SET_IDS,
  SETS,
  TIMING,
  type CategoryId,
  type SetId,
  type SlAward,
  type SlEntry,
  type SlInput,
  type SlPhoneEntry,
  type SlPlayerInfo,
  type SlPlayerView,
  type SlProgress,
  type SlResultData,
  type SlSettings,
  type SlTvState,
} from "../shared.js";
import { SlInputSchema } from "./input.js";

type Phase = "intro" | "letter" | "write" | "timeup" | "review" | "standings" | "final" | "done";

export function parseSlSettings(values: SettingsValues): SlSettings {
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  const set = (SET_IDS as readonly string[]).includes(values.set as string) ? (values.set as SetId) : "klassisch";
  return {
    set,
    rounds: num(values.rounds, 5, 1, 7),
    roundSeconds: num(values.roundSeconds, 90, 30, 180),
    categoryCount: num(values.categoryCount, 6, 5, 6),
  };
}

interface PlayerState {
  score: number;
  rank: number;
  roundPoints: number;
  /** Gültige Antworten insgesamt. */
  valid: number;
  /** 20-Punkte-Antworten. */
  solos: number;
  stops: number;
  /** Abgegebene Daumen runter (Stand am Ende jeder Kategorie). */
  challenges: number;
  left: boolean;
  order: number;
}

export default defineGame<SlSettings, SlInput, SlTvState, SlPlayerView>({
  manifest,
  inputSchema: SlInputSchema,
  parseSettings: parseSlSettings,
  createGame(ctx) {
    const { settings } = ctx;
    const roundMs = settings.roundSeconds * 1000;
    const total = Math.min(settings.rounds, LETTERS.length);
    const pool = SETS[settings.set];
    const previousLetters = new Set(
      ((ctx.previous?.data as Partial<SlResultData> | undefined)?.letters ?? []).filter((x) => typeof x === "string"),
    );

    const players = new Map<PlayerId, PlayerState>(
      ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, valid: 0, solos: 0, stops: 0, challenges: 0, left: false, order }]),
    );
    const state = (id: PlayerId): PlayerState => players.get(id)!;
    const nameOf = (id: PlayerId): string => ctx.players.find((p) => p.id === id)?.name ?? "?";

    let phase: Phase = "intro";
    let round = -1;
    let endsAt = 0;
    let timer: TimerId | null = null;
    let letter = "";
    let categories: CategoryId[] = [];
    const usedLetters: string[] = [];
    const usage = new Map<CategoryId, number>();
    /** Antworten je Spieler (Index = Kategorie). Verlassen den Server erst in der Prüfung. */
    let answers = new Map<PlayerId, string[]>();
    let stopBy: PlayerId | null = null;
    /** Index der geprüften Kategorie. */
    let index = 0;
    /** Kategorie → Vergleichsschlüssel → wer Daumen runter gegeben hat. */
    let challenges = new Map<number, Map<string, Set<PlayerId>>>();
    let ready = new Set<PlayerId>();
    /** Endgültige Wertung der schon geprüften Kategorien. */
    let frozen: SlEntry[][] = [];
    let reviewMs = 0;
    let awards: SlAward[] = [];

    const isIn = (id: PlayerId): boolean => players.has(id) && !state(id).left;
    const activeIds = (): PlayerId[] => ctx.players.filter((p) => isIn(p.id)).map((p) => p.id);
    const answersOf = (id: PlayerId): string[] => answers.get(id) ?? categories.map(() => "");
    const filled = (id: PlayerId): number => answersOf(id).filter((a) => a !== "").length;

    const recomputeRanks = (): void => {
      const sorted = [...players.values()].sort((a, b) => b.score - a.score);
      sorted.forEach((s, i) => {
        const prev = sorted[i - 1];
        s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
      });
    };

    const playerInfos = (): SlPlayerInfo[] =>
      ctx.players
        .map((p) => {
          const s = state(p.id);
          return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, score: s.score, rank: s.rank, roundPoints: s.roundPoints, left: s.left };
        })
        .sort((a, b) => a.rank - b.rank || state(a.id).order - state(b.id).order);

    /** Live-Wertung der aktuell geprüften Kategorie (nur aktive Spieler; deren Stimmen zählen). */
    const currentEntries = (): SlEntry[] => {
      const ids = activeIds();
      return scoreCategory(
        ids.map((id) => ({ playerId: id, text: answersOf(id)[index] ?? "" })),
        letter,
        challenges.get(index) ?? new Map(),
        ids,
      );
    };

    const progress = (): SlProgress[] => activeIds().map((id) => ({ playerId: id, filled: filled(id) }));

    const tvState = (): SlTvState => {
      const base = { round: Math.max(0, round), total, players: playerInfos() };
      const r = { ...base, letter, categories: [...categories] };
      switch (phase) {
        case "intro":
          return {
            ...base,
            phase,
            endsAt,
            durationMs: TIMING.introMs,
            set: settings.set,
            categoryCount: Math.min(settings.categoryCount, pool.length),
            durationSeconds: settings.roundSeconds,
          };
        case "letter":
          return { ...r, phase, endsAt, durationMs: TIMING.letterMs };
        case "write":
          return { ...r, phase, endsAt, durationMs: roundMs, progress: progress(), stop: stopBy ? { by: stopBy, endsAt } : null };
        case "timeup":
          return { ...r, phase, progress: progress(), stoppedBy: stopBy };
        case "review":
          return { ...r, phase, index, entries: currentEntries(), ready: activeIds().filter((id) => ready.has(id)), endsAt, durationMs: reviewMs };
        case "standings":
          return { ...r, phase, endsAt, durationMs: TIMING.standingsMs };
        case "final":
        case "done":
          return { ...base, phase: "final", endsAt, durationMs: TIMING.finalMs, awards, letters: [...usedLetters] };
      }
    };

    const phoneEntries = (me: PlayerId): SlPhoneEntry[] => {
      const votes = challenges.get(index);
      const entries = currentEntries();
      return entries.map((e) => {
        const p = ctx.players.find((x) => x.id === e.playerId)!;
        const mine = e.playerId === me;
        const coAuthor = entries.some((o) => o.playerId === me && o.key === e.key && e.needed !== null && o.needed !== null);
        return {
          ...e,
          name: p.name,
          avatar: p.avatar,
          color: p.color,
          mine,
          canVote: !mine && !coAuthor && e.needed !== null && isIn(me),
          voted: votes?.get(e.key)?.has(me) ?? false,
        };
      });
    };

    const viewFor = (id: PlayerId): SlPlayerView => {
      const s = state(id);
      const base = { round: Math.max(0, round), total, score: s.score, rank: s.rank, playerCount: ctx.players.length };
      const r = { ...base, letter, categories: [...categories] };
      switch (phase) {
        case "intro":
        case "letter":
          return { ...base, phase, endsAt };
        case "write":
          return { ...r, phase, answers: answersOf(id), endsAt, durationMs: roundMs, stop: stopBy ? { by: nameOf(stopBy), mine: stopBy === id, endsAt } : null };
        case "timeup":
          return { ...r, phase, answers: answersOf(id) };
        case "review":
          return { ...r, phase, index, entries: phoneEntries(id), ready: ready.has(id), endsAt, durationMs: reviewMs };
        case "standings":
          return { ...r, phase, roundPoints: s.roundPoints };
        case "final":
        case "done":
          return {
            ...base,
            phase: "final",
            solos: s.solos,
            valid: s.valid,
            awards: awards.filter((a) => a.playerIds.includes(id)).map((a) => a.kind),
          };
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
      const next = round + 1 < total && activeIds().length >= 2 ? pickLetter(LETTERS, new Set(usedLetters), previousLetters, ctx.rng) : null;
      if (next === null) return showFinal();
      letter = next;
      usedLetters.push(next);
      categories = pickCategories(pool, settings.categoryCount, usage, ctx.rng);
      for (const c of categories) usage.set(c, (usage.get(c) ?? 0) + 1);
      answers = new Map();
      stopBy = null;
      index = 0;
      challenges = new Map();
      ready = new Set();
      frozen = [];
      for (const s of players.values()) s.roundPoints = 0;
      round++;
      phase = "letter";
      schedule(TIMING.letterMs, startWrite, false);
      publish();
    };

    const startWrite = (): void => {
      phase = "write";
      schedule(roundMs, timeUp, false);
      publish();
    };

    const timeUp = (): void => {
      if (phase !== "write") return;
      phase = "timeup";
      schedule(TIMING.timeUpMs, () => startReview(0), false);
      publish();
    };

    const startReview = (i: number): void => {
      phase = "review";
      index = i;
      ready = new Set();
      reviewMs = currentEntries().some((e) => e.needed !== null) ? TIMING.reviewMs : TIMING.reviewEmptyMs;
      schedule(reviewMs, nextCategory, true);
      publish();
    };

    /** Aktuelle Kategorie festschreiben, nächste prüfen bzw. Runde werten. */
    const nextCategory = (): void => {
      if (phase !== "review") return;
      const entries = currentEntries();
      frozen.push(entries);
      // Daumen zählen, die auf gültige Gruppen dieser Kategorie abgegeben wurden.
      const groups = new Set(entries.filter((e) => e.needed !== null).map((e) => e.key));
      for (const [key, voters] of challenges.get(index) ?? []) {
        if (!groups.has(key)) continue;
        for (const v of voters) if (isIn(v)) state(v).challenges++;
      }
      if (index + 1 < categories.length) return startReview(index + 1);
      finishRound();
    };

    const finishRound = (): void => {
      for (const entries of frozen) {
        for (const e of entries) {
          if (!isIn(e.playerId)) continue;
          const s = state(e.playerId);
          s.score += e.points;
          s.roundPoints += e.points;
          if (e.status === "ok") s.valid++;
          if (e.points === POINTS.solo) s.solos++;
        }
      }
      recomputeRanks();
      // Letzte Runde oder zu wenige Mitspieler übrig: direkt ins Finale.
      if (round + 1 >= total || activeIds().length < 2) return showFinal();
      phase = "standings";
      schedule(TIMING.standingsMs, startRound, true);
      publish();
    };

    const showFinal = (): void => {
      if (phase === "final" || phase === "done") return;
      phase = "final";
      recomputeRanks();
      awards = computeAwards(
        ctx.players
          .filter((p) => isIn(p.id))
          .map((p) => {
            const s = state(p.id);
            return { id: p.id, solos: s.solos, stops: s.stops, challenges: s.challenges };
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
      const data: SlResultData = {
        letters: [...usedLetters],
        set: settings.set,
        total: usedLetters.length,
        awards,
        players: infos.map(({ id, name, score, rank, left }) => {
          const s = state(id);
          return { id, name, score, rank, valid: s.valid, solos: s.solos, stops: s.stops, left };
        }),
      };
      ctx.end({ ranking: infos.map((p) => ({ playerId: p.id, score: p.score, rank: p.rank })), data });
    };

    /** Prüfung vorzeitig weiter, wenn alle verbundenen Spieler „Passt“ gedrückt haben. */
    const checkAllReady = (): void => {
      if (phase !== "review") return;
      const connected = activeIds().filter((id) => ctx.isConnected(id));
      if (connected.length > 0 && connected.every((id) => ready.has(id))) nextCategory();
    };

    schedule(TIMING.introMs, startRound, true);
    publish();

    return {
      onPlayerInput(playerId, input) {
        if (!isIn(playerId) || input.round !== round) return;
        switch (input.type) {
          case "answers": {
            // Auch in der Gnadenfrist „Stifte weg!“ – so geht beim Rundenende nichts verloren.
            if (phase !== "write" && phase !== "timeup") return;
            const before = filled(playerId);
            answers.set(
              playerId,
              categories.map((_, i) => cleanAnswer(input.answers[i] ?? "")),
            );
            if (filled(playerId) !== before) ctx.broadcastTv(tvState());
            ctx.sendToPlayer(playerId, viewFor(playerId));
            return;
          }
          case "stop": {
            if (phase !== "write" || stopBy !== null || filled(playerId) < categories.length) return;
            stopBy = playerId;
            state(playerId).stops++;
            // Läuft die Zeit ohnehin früher ab, bleibt es dabei.
            if (endsAt - ctx.now() > TIMING.stopMs) schedule(TIMING.stopMs, timeUp, false);
            publish();
            return;
          }
          case "challenge": {
            if (phase !== "review" || input.category !== index) return;
            const entries = currentEntries();
            const target = entries.filter((e) => e.key === input.key && e.needed !== null);
            if (target.length === 0 || target.some((e) => e.playerId === playerId)) return;
            let byKey = challenges.get(index);
            if (!byKey) challenges.set(index, (byKey = new Map()));
            const voters = byKey.get(input.key) ?? new Set<PlayerId>();
            if (input.on === voters.has(playerId)) return;
            if (input.on) voters.add(playerId);
            else voters.delete(playerId);
            byKey.set(input.key, voters);
            publish();
            return;
          }
          case "ready": {
            if (phase !== "review" || input.category !== index || ready.has(playerId)) return;
            ready.add(playerId);
            ctx.broadcastTv(tvState());
            ctx.sendToPlayer(playerId, viewFor(playerId));
            checkAllReady();
            return;
          }
        }
      },

      onPlayerLeave(playerId) {
        const s = players.get(playerId);
        if (!s || s.left) return;
        s.left = true;
        // Antworten und Stimmen des Spielers zählen ab sofort nicht mehr (currentEntries filtert).
        ready.delete(playerId);
        if (activeIds().length === 0) {
          showFinal();
          return;
        }
        publish();
        checkAllReady();
      },

      onPlayerConnectionChange(playerId, connected) {
        if (!connected) checkAllReady();
        else ctx.sendToPlayer(playerId, viewFor(playerId));
      },
    };
  },
});
