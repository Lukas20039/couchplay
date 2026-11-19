// Serverlogik „Stadt, Land, Fluss“ (server-authoritative), 2–8 Spieler.
// Ablauf: [setup] → intro → (letter → write → timeup → review × Kategorien → standings)* → final → ctx.end();
// nach der letzten Runde direkt final.
// setup:   Nur mit Set „eigene“: Das Host-Handy legt 3–6 eigene Kategorien fest und schickt den Stand laufend
//          (Input `custom`); TV und Handys zeigen ihn live. Der Server kennt den Host nicht (GamePlayer hat kein
//          isHost) und nimmt `custom` daher von jedem Spieler an – nur das Host-Handy zeigt den Editor.
//          „Los geht’s“ (done) mit ≥ CUSTOM_MIN Einträgen beendet setup; sonst nach TIMING.setupMs bzw. per Skip
//          (TV/Host). Dann gilt die zuletzt empfangene Liste, bei weniger als CUSTOM_MIN Einträgen Klassisch.
//          Eigene Namen, die einer eingebauten Kategorie entsprechen („Städte“), werden auf sie abgebildet und
//          bekommen die Lexikon-Prüfung. Mit eigenem Set spielt jede Runde alle eigenen Kategorien.
// letter:  Der Buchstabe (ctx.rng, keiner doppelt pro Partie, möglichst keiner aus der Vorrunde) wird am TV per
//          Walze enthüllt. Die Handys erfahren ihn erst danach.
// write:   Alle tippen ihre Antworten; die Handys schicken sie laufend (entprellt) als Ganzes. Wer alle Felder
//          ausgefüllt hat, darf „Stopp!“ rufen → noch TIMING.stopMs, dann Ende. Sonst endet die Runde per Timer.
// timeup:  „Stifte weg!“ – kurze Gnadenfrist, in der verspätete Eingaben noch angenommen werden.
// review:  Kategorie für Kategorie. Automatisch ungültig: leer, zu kurz, falscher Anfangsbuchstabe. Für die übrigen
//          fragt der Server das Lexikon (nur hier, nie in scoring.ts/Views – die Wortlisten bleiben aus den
//          Bundles): bekannt → gilt; unbekannt → im Modus „streng“ zunächst gestrichen, im Modus „hinweis“ nur
//          markiert; Kategorie ohne Wortliste → wie ohne Lexikon. Wer eine Antwort nicht selbst gegeben hat, stimmt
//          gegen die Voreinstellung (👎 streichen bzw. 👍 retten); die Mehrheit der Stimmberechtigten kippt sie.
//          Überspringbar (TV/Host) und vorzeitig vorbei, wenn alle „Passt“ drücken.
// Wertung (scoring.ts): einzige gültige Antwort der Kategorie 20, einzigartig 10, doppelt 5, sonst 0 –
// gutgeschrieben am Ende der Prüfung einer Runde.
// Nicht überspringbar: Buchstabe, Schreibzeit, „Stifte weg!“. Überspringbar: Setup, Intro, Prüfung, Zwischenstand, Finale.
import { defineGame, type TimerId } from "@couchplay/game-sdk";
import type { PlayerId, SettingsValues } from "@couchplay/protocol";
import manifest from "../../manifest.json" with { type: "json" };
import { cleanCategoryList, matchCategory } from "../custom.js";
import { checkAnswer, cleanAnswer } from "../normalize.js";
import { computeAwards, pickCategories, pickLetter, scoreCategory } from "../scoring.js";
import {
  CHECK_MODES,
  CUSTOM_MIN,
  LETTERS,
  POINTS,
  SET_IDS,
  SETS,
  TIMING,
  type CategoryId,
  type CheckMode,
  type SetId,
  type SlAward,
  type SlCategory,
  type SlEntry,
  type SlInput,
  type SlLexicon,
  type SlPhoneEntry,
  type SlPlayerInfo,
  type SlPlayerView,
  type SlProgress,
  type SlResultData,
  type SlSettings,
  type SlTvState,
} from "../shared.js";
import { SlInputSchema } from "./input.js";
import { lookupAnswer } from "./lexicon/index.js";

type Phase = "setup" | "intro" | "letter" | "write" | "timeup" | "review" | "standings" | "final" | "done";

/** Lexikon-Abfrage (injizierbar für Tests und die Vorschau). */
export type LexiconLookup = (category: CategoryId, text: string) => SlLexicon;

export function parseSlSettings(values: SettingsValues): SlSettings {
  const num = (v: unknown, fallback: number, min: number, max: number): number =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  const set = (SET_IDS as readonly string[]).includes(values.set as string) ? (values.set as SetId) : "klassisch";
  const check = (CHECK_MODES as readonly string[]).includes(values.check as string) ? (values.check as CheckMode) : "streng";
  return {
    set,
    rounds: num(values.rounds, 5, 1, 7),
    roundSeconds: num(values.roundSeconds, 90, 30, 180),
    categoryCount: num(values.categoryCount, 6, 5, 6),
    check,
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
  /** Abgegebene Daumen runter (nur 👎, keine 👍-Rettungen; Stand am Ende jeder Kategorie). */
  challenges: number;
  left: boolean;
  order: number;
}

const builtin = (id: CategoryId): SlCategory => ({ id, custom: null });

/** Spieldefinition mit austauschbarer Lexikon-Abfrage (Standard: echte Wortlisten). */
export function createStadtlandGame(lookup: LexiconLookup = lookupAnswer) {
  return defineGame<SlSettings, SlInput, SlTvState, SlPlayerView>({
    manifest,
    inputSchema: SlInputSchema,
    parseSettings: parseSlSettings,
    createGame(ctx) {
      const { settings } = ctx;
      const roundMs = settings.roundSeconds * 1000;
      const total = Math.min(settings.rounds, LETTERS.length);
      const isCustom = settings.set === "eigene";
      const pool = SETS[settings.set === "eigene" ? "klassisch" : settings.set];
      const previousLetters = new Set(
        ((ctx.previous?.data as Partial<SlResultData> | undefined)?.letters ?? []).filter((x) => typeof x === "string"),
      );

      const players = new Map<PlayerId, PlayerState>(
        ctx.players.map((p, order) => [p.id, { score: 0, rank: 1, roundPoints: 0, valid: 0, solos: 0, stops: 0, challenges: 0, left: false, order }]),
      );
      const state = (id: PlayerId): PlayerState => players.get(id)!;
      const nameOf = (id: PlayerId): string => ctx.players.find((p) => p.id === id)?.name ?? "?";

      let phase: Phase = isCustom ? "setup" : "intro";
      let round = -1;
      let endsAt = 0;
      let timer: TimerId | null = null;
      let letter = "";
      let categories: SlCategory[] = [];
      /** Eigene Kategorien: laufender Stand in setup (bereinigt) bzw. danach festgelegt (null = eingebautes Set). */
      let customDraft: string[] = [];
      let custom: SlCategory[] | null = null;
      const usedLetters: string[] = [];
      const usage = new Map<CategoryId, number>();
      /** Antworten je Spieler (Index = Kategorie). Verlassen den Server erst in der Prüfung. */
      let answers = new Map<PlayerId, string[]>();
      let stopBy: PlayerId | null = null;
      /** Index der geprüften Kategorie. */
      let index = 0;
      /** Kategorie → Vergleichsschlüssel → wer gegen die Voreinstellung gestimmt hat. */
      let challenges = new Map<number, Map<string, Set<PlayerId>>>();
      let ready = new Set<PlayerId>();
      /** Endgültige Wertung der schon geprüften Kategorien. */
      let frozen: SlEntry[][] = [];
      let reviewMs = 0;
      let awards: SlAward[] = [];
      /** Lexikon-Ergebnisse je „Kategorie|Text“ (die Wertung wird bei jedem Publish neu berechnet). */
      const lexiconCache = new Map<string, SlLexicon>();

      const isIn = (id: PlayerId): boolean => players.has(id) && !state(id).left;
      const activeIds = (): PlayerId[] => ctx.players.filter((p) => isIn(p.id)).map((p) => p.id);
      const answersOf = (id: PlayerId): string[] => answers.get(id) ?? categories.map(() => "");
      const filled = (id: PlayerId): number => answersOf(id).filter((a) => a !== "").length;

      /** Lexikon nur für automatisch gültige Antworten in prüfbaren Kategorien, nie im Modus „aus“. */
      const lexiconOf = (category: SlCategory | undefined, text: string): SlLexicon => {
        if (!category || category.id === null || settings.check === "aus" || checkAnswer(text, letter) !== "ok") return null;
        const k = `${category.id}|${text}`;
        if (!lexiconCache.has(k)) lexiconCache.set(k, lookup(category.id, text));
        return lexiconCache.get(k) ?? null;
      };

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
        const category = categories[index];
        return scoreCategory(
          ids.map((id) => {
            const text = answersOf(id)[index] ?? "";
            return { playerId: id, text, lexicon: lexiconOf(category, text) };
          }),
          letter,
          challenges.get(index) ?? new Map(),
          ids,
          settings.check,
        );
      };

      const progress = (): SlProgress[] => activeIds().map((id) => ({ playerId: id, filled: filled(id) }));

      const tvState = (): SlTvState => {
        const base = { round: Math.max(0, round), total, players: playerInfos() };
        const r = { ...base, letter, categories: [...categories] };
        switch (phase) {
          case "setup":
            return { ...base, phase, endsAt, durationMs: TIMING.setupMs, categories: [...customDraft] };
          case "intro":
            return {
              ...base,
              phase,
              endsAt,
              durationMs: TIMING.introMs,
              set: settings.set,
              categoryCount: custom ? custom.length : Math.min(settings.categoryCount, pool.length),
              durationSeconds: settings.roundSeconds,
              check: settings.check,
              custom: custom ? [...custom] : null,
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
          case "setup":
            return { ...base, phase, endsAt, durationMs: TIMING.setupMs, categories: [...customDraft] };
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

      /** Eigene Kategorien festschreiben (zu wenige → Klassisch) und zum Intro. */
      const finishSetup = (): void => {
        if (phase !== "setup") return;
        custom = customDraft.length >= CUSTOM_MIN ? customDraft.map((name) => ({ id: matchCategory(name), custom: name })) : SETS.klassisch.map(builtin);
        startIntro();
      };

      const startIntro = (): void => {
        phase = "intro";
        schedule(TIMING.introMs, startRound, true);
        publish();
      };

      const startRound = (): void => {
        const next = round + 1 < total && activeIds().length >= 2 ? pickLetter(LETTERS, new Set(usedLetters), previousLetters, ctx.rng) : null;
        if (next === null) return showFinal();
        letter = next;
        usedLetters.push(next);
        if (custom) {
          categories = [...custom];
        } else {
          const ids = pickCategories(pool, settings.categoryCount, usage, ctx.rng);
          for (const c of ids) usage.set(c, (usage.get(c) ?? 0) + 1);
          categories = ids.map(builtin);
        }
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
        // Kurz, wenn es nichts zu entscheiden gibt (keine anfechtbare oder rettbare Antwort).
        reviewMs = currentEntries().some((e) => e.needed !== null) ? TIMING.reviewMs : TIMING.reviewEmptyMs;
        schedule(reviewMs, nextCategory, true);
        publish();
      };

      /** Aktuelle Kategorie festschreiben, nächste prüfen bzw. Runde werten. */
      const nextCategory = (): void => {
        if (phase !== "review") return;
        const entries = currentEntries();
        frozen.push(entries);
        // 👎 zählen, die auf gültig voreingestellte Gruppen dieser Kategorie abgegeben wurden (keine 👍-Rettungen).
        const groups = new Set(entries.filter((e) => e.needed !== null && e.preset).map((e) => e.key));
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
          check: settings.check,
          ...(isCustom && custom ? { custom: custom.map((c) => c.custom ?? c.id ?? "") } : {}),
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

      if (phase === "setup") {
        schedule(TIMING.setupMs, finishSetup, true);
        publish();
      } else {
        startIntro();
      }

      return {
        onPlayerInput(playerId, input) {
          if (!isIn(playerId)) return;
          if (input.type === "custom") {
            if (phase !== "setup") return;
            const next = cleanCategoryList(input.categories);
            const changed = next.length !== customDraft.length || next.some((c, i) => c !== customDraft[i]);
            customDraft = next;
            if (input.done && next.length >= CUSTOM_MIN) return finishSetup();
            if (changed) publish();
            return;
          }
          if (input.round !== round) return;
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
}

export default createStadtlandGame();
