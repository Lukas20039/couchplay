// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Schätzen!“.
// Die Lösung taucht erst in der Phase "reveal" auf.
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId } from "./constants.js";
import type { SeenPacked } from "./seen.js";

export { CATEGORY_IDS, type CategoryId } from "./constants.js";

/** Dauer der Phasen ohne Spielereingabe (ms). */
export const TIMING = {
  introMs: 7_000,
  /** Auflösungs-Animation am TV (Pins, Trommelwirbel, Lösung zählt hoch) – nicht überspringbar. */
  revealAnimMs: 4_500,
  /** Danach bleibt die Auflösung zum Lesen stehen – überspringbar. */
  revealHoldMs: 8_000,
  standingsMs: 5_000,
  finalMs: 8_000,
} as const;

/** Zeitpunkte innerhalb der Auflösungs-Animation (ms ab revealAt), für TV und Handy. */
export const REVEAL_STEPS = {
  /** Pins fallen nacheinander ein. */
  pinsMs: 0,
  /** „Und die Lösung ist …“ */
  drumMs: 1_300,
  /** Lösung fährt ein und zählt hoch. */
  countFromMs: 2_000,
  countToMs: 3_800,
  /** Abstände, Punkte und „Am nächsten dran“. */
  resultMs: 4_000,
} as const;

export interface EsSettings {
  categories: CategoryId[];
  rounds: number;
  answerSeconds: number;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type EsInput =
  /** Endgültiger Tipp (nach „Fertig“). */
  | { type: "guess"; value: number }
  /** Schon gestellte Fragen dieses Handys (seen.ts). */
  | { type: "seen"; ids: SeenPacked };

export interface EsPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  rank: number;
  /** Punkte der zuletzt aufgelösten Frage. */
  roundPoints: number;
  bullseyes: number;
  left: boolean;
}

/** Ein Tipp in der Auflösung. */
export interface EsGuess {
  playerId: PlayerId;
  value: number | null;
  distance: number | null;
  /** Platz bei dieser Frage (Gleichstand = gleicher Platz). */
  place: number | null;
  bullseye: boolean;
  points: number;
}

interface TvBase {
  /** 0-basiert; Gesamtzahl Fragen der Runde. */
  round: number;
  total: number;
  /** Nur ein Teilnehmer: Wertung nach Genauigkeit. */
  solo: boolean;
  players: EsPlayerInfo[];
}

interface TvQuestion extends TvBase {
  category: CategoryId;
  text: string;
  /** Einheit der Antwort ("" = Anzahl, "Jahr" = Jahreszahl). */
  unit: string;
}

export type EsTvState =
  | (TvBase & { phase: "intro"; endsAt: number; durationMs: number; categories: CategoryId[] })
  | (TvQuestion & {
      phase: "question";
      endsAt: number;
      durationMs: number;
      /** Spieler, die schon „Fertig“ gedrückt haben (ohne Tipp). */
      answered: PlayerId[];
    })
  | (TvQuestion & {
      phase: "reveal";
      answer: number;
      fact: string | null;
      /** Serverzeit, ab der die Animation läuft (REVEAL_STEPS relativ dazu). */
      revealAt: number;
      endsAt: number;
      /** Alle aktiven Teilnehmer, in Startreihenfolge. */
      guesses: EsGuess[];
      /** Spieler mit dem kleinsten Abstand (Gleichstand: mehrere). */
      nearest: PlayerId[];
    })
  | (TvBase & { phase: "standings"; endsAt: number })
  | (TvBase & { phase: "final"; endsAt: number; durationMs: number });

interface ViewBase {
  round: number;
  total: number;
  score: number;
  rank: number;
  playerCount: number;
  solo: boolean;
}

export type EsPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & {
      phase: "question";
      questionId: string;
      text: string;
      unit: string;
      /** Eigener Tipp, sobald „Fertig“ gedrückt wurde. */
      guess: number | null;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & {
      phase: "reveal";
      text: string;
      unit: string;
      answer: number;
      revealAt: number;
      guess: number | null;
      distance: number | null;
      place: number | null;
      bullseye: boolean;
      points: number;
    })
  | (ViewBase & { phase: "standings" })
  | (ViewBase & { phase: "final"; bullseyes: number });

export interface EsResultData {
  questionIds: string[];
  total: number;
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; bullseyes: number; left: boolean }>;
}
