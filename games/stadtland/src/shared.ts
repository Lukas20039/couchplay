// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Stadt, Land, Fluss“.
// Privatsphäre: Während des Schreibens kennt der TV nur, WIE VIELE Felder jeder ausgefüllt hat, jedes Handy nur
// die eigenen Antworten. Den Buchstaben erfahren die Handys erst, wenn die Walze am TV steht.
// In der Prüfung sind die Antworten der aktuellen Kategorie für alle sichtbar.
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId, SetId } from "./constants.js";
import type { AutoCheck } from "./normalize.js";

export { ANSWER_MAX, CATEGORY_IDS, LETTERS, POINTS, SET_IDS, SETS, type CategoryId, type Letter, type SetId } from "./constants.js";

/** Dauer der Phasen (ms). */
export const TIMING = {
  /** Überspringbar. */
  introMs: 8_000,
  /** Buchstabe wird enthüllt (nicht überspringbar, die Handys warten mit). */
  letterMs: 4_500,
  /** Walzenlauf innerhalb von letterMs (danach rastet der Buchstabe ein). */
  reelMs: 2_800,
  /** Countdown nach „Stopp!“. */
  stopMs: 5_000,
  /** „Stifte weg!“: Die Handys schicken hier ihre letzten Eingaben (nicht überspringbar). */
  timeUpMs: 2_000,
  /** Prüfung je Kategorie (überspringbar; endet vorzeitig, wenn alle „Passt“ gedrückt haben). */
  reviewMs: 25_000,
  /** Prüfung einer Kategorie ohne anfechtbare Antworten. */
  reviewEmptyMs: 5_000,
  standingsMs: 8_000,
  finalMs: 12_000,
} as const;

/** Entprellzeit der Eingaben am Handy (ms). */
export const SEND_DEBOUNCE_MS = 350;

export interface SlSettings {
  set: SetId;
  rounds: number;
  roundSeconds: number;
  categoryCount: number;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. `round` verwirft verspätete Eingaben. */
export type SlInput =
  /** Alle eigenen Antworten der Runde (Index = Kategorie), laufend und entprellt. */
  | { type: "answers"; round: number; answers: string[] }
  /** „Stopp!“ – nur mit allen Feldern ausgefüllt. */
  | { type: "stop"; round: number }
  /** Daumen runter (on) bzw. zurücknehmen für eine Antwort (Vergleichsschlüssel) in Kategorie `category`. */
  | { type: "challenge"; round: number; category: number; key: string; on: boolean }
  /** „Passt – weiter“ in der Prüfung von Kategorie `category`. */
  | { type: "ready"; round: number; category: number };

/** Prüfergebnis einer Antwort: automatisch (empty/letter/short) oder per Mehrheit gestrichen (rejected). */
export type SlStatus = AutoCheck | "rejected";

export interface SlPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  rank: number;
  /** Punkte der zuletzt gewerteten Runde. */
  roundPoints: number;
  left: boolean;
}

/** Antwort eines Spielers in der Prüfung (TV und Handy). */
export interface SlEntry {
  playerId: PlayerId;
  /** Angezeigter Text ("" = leer). */
  text: string;
  /** Vergleichsschlüssel (normalisiert); gleiche Schlüssel = gleiche Antwort. */
  key: string;
  status: SlStatus;
  /** Daumen runter auf diese Antwort (gleiche Antworten zählen gemeinsam). */
  votes: number;
  /** Nötige Daumen zum Streichen (Mehrheit der Nicht-Autoren); null = nicht anfechtbar. */
  needed: number | null;
  /** Punkte nach aktuellem Stand (ändern sich, solange angefochten wird). */
  points: number;
  /** Mehrere haben (normalisiert) dasselbe gültig geantwortet. */
  shared: boolean;
}

export interface SlPhoneEntry extends SlEntry {
  name: string;
  avatar: AvatarId;
  color: number;
  mine: boolean;
  /** Ich darf anfechten (fremde, gültige oder gestrichene Antwort, an der ich nicht beteiligt bin). */
  canVote: boolean;
  voted: boolean;
}

/** Fortschritt beim Schreiben (ohne Inhalte). */
export interface SlProgress {
  playerId: PlayerId;
  filled: number;
}

export type SlAwardKind = "solo" | "stopper" | "judge";

/** Auszeichnung im Finale (Gleichstand: mehrere Gewinner). */
export interface SlAward {
  kind: SlAwardKind;
  playerIds: PlayerId[];
  count: number;
}

interface TvBase {
  /** 0-basiert; Gesamtzahl Runden. */
  round: number;
  total: number;
  players: SlPlayerInfo[];
}

interface TvRound extends TvBase {
  letter: string;
  categories: CategoryId[];
}

export type SlTvState =
  | (TvBase & { phase: "intro"; endsAt: number; durationMs: number; set: SetId; categoryCount: number; durationSeconds: number })
  | (TvRound & { phase: "letter"; endsAt: number; durationMs: number })
  | (TvRound & {
      phase: "write";
      endsAt: number;
      durationMs: number;
      progress: SlProgress[];
      /** Wer Stopp gerufen hat und wann die Runde dadurch endet; sonst null. */
      stop: { by: PlayerId; endsAt: number } | null;
    })
  | (TvRound & { phase: "timeup"; progress: SlProgress[]; stoppedBy: PlayerId | null })
  | (TvRound & {
      phase: "review";
      /** Index der Kategorie in categories. */
      index: number;
      entries: SlEntry[];
      /** Wer „Passt“ gedrückt hat. */
      ready: PlayerId[];
      endsAt: number;
      durationMs: number;
    })
  | (TvRound & { phase: "standings"; endsAt: number; durationMs: number })
  | (TvBase & { phase: "final"; endsAt: number; durationMs: number; awards: SlAward[]; letters: string[] });

interface ViewBase {
  round: number;
  total: number;
  score: number;
  rank: number;
  playerCount: number;
}

interface ViewRound extends ViewBase {
  letter: string;
  categories: CategoryId[];
}

export type SlPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  /** Buchstabe wird am TV enthüllt – das Handy kennt ihn noch nicht. */
  | (ViewBase & { phase: "letter"; endsAt: number })
  | (ViewRound & {
      phase: "write";
      /** Vom Server gespeicherte Antworten (für Reconnect). */
      answers: string[];
      endsAt: number;
      durationMs: number;
      /** Stopp-Rufer (Name), ob ich es war, und wann die Runde dadurch endet; sonst null. */
      stop: { by: string; mine: boolean; endsAt: number } | null;
    })
  | (ViewRound & { phase: "timeup"; answers: string[] })
  | (ViewRound & {
      phase: "review";
      index: number;
      entries: SlPhoneEntry[];
      ready: boolean;
      endsAt: number;
      durationMs: number;
    })
  | (ViewRound & { phase: "standings"; roundPoints: number })
  | (ViewBase & { phase: "final"; solos: number; valid: number; awards: SlAwardKind[] });

export interface SlResultData {
  letters: string[];
  set: SetId;
  total: number;
  awards: SlAward[];
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; valid: number; solos: number; stops: number; left: boolean }>;
}
