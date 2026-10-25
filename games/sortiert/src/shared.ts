// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Sortiert!“.
// Werte, Anmerkungen und die richtige Reihenfolge tauchen erst in der Phase "reveal" auf;
// fremde Reihenfolgen sieht niemand vor der Auflösung (TV nur: wer ist fertig).
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId } from "./constants.js";
import type { Mark } from "./scoring.js";
import type { SeenPacked } from "./seen.js";

export { CATEGORY_IDS, type CategoryId } from "./constants.js";
export type { Mark } from "./scoring.js";

/** Dauer der Phasen ohne Spielereingabe (ms). */
export const TIMING = {
  /** Nicht überspringbar: Handys melden hier ihre gespielten Sets. */
  introMs: 8_000,
  /** Auflösung: kurzer Vorlauf, dann je Karte ein Schritt (Platz 1 zuerst) … */
  revealLeadMs: 1_200,
  revealStepMs: 1_200,
  /** … dann Punkte und „Perfekt!“, danach Lesezeit. Die ganze Auflösung ist überspringbar. */
  revealHoldMs: 7_500,
  standingsMs: 5_000,
  finalMs: 8_000,
} as const;

/** Gesamtdauer der Auflösung bei n Karten. */
export const revealDurationMs = (n: number): number => TIMING.revealLeadMs + n * TIMING.revealStepMs + TIMING.revealHoldMs;
/** Ab hier (relativ zu revealAt) ist Karte i (0 = oben) aufgedeckt. */
export const cardRevealOffset = (i: number): number => TIMING.revealLeadMs + i * TIMING.revealStepMs;

export interface SoSettings {
  categories: CategoryId[];
  rounds: number;
  itemsPerRound: number;
  answerSeconds: number;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type SoInput =
  /**
   * Aktuelle Reihenfolge als Kartenindizes (Platz 0 = oben). final=false: Zwischenstand (zählt bei
   * Zeitablauf), final=true: „Fertig“ – nur vollständig, danach fix.
   */
  | { type: "order"; order: number[]; final: boolean }
  /** Schon gespielte Sets dieses Handys (seen.ts). */
  | { type: "seen"; ids: SeenPacked };

export interface SoPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  rank: number;
  /** Punkte der zuletzt aufgelösten Runde. */
  roundPoints: number;
  perfects: number;
  left: boolean;
}

/** Karte vor der Auflösung: nur der Text. */
export interface SoCard {
  label: string;
}

/** Karte in der Auflösung (richtige Reihenfolge). */
export interface SoRevealItem {
  label: string;
  value: number;
  note: string | null;
}

/** Ergebnis eines Spielers in einer Runde. */
export interface SoResult {
  playerId: PlayerId;
  /** Bewertung je Platz (Länge = Kartenzahl). */
  marks: Mark[];
  points: number;
  perfect: boolean;
  /** „Fertig“ gedrückt (sonst Zwischenstand bei Zeitablauf). */
  submitted: boolean;
}

interface TvBase {
  /** 0-basiert; Gesamtzahl Runden. */
  round: number;
  total: number;
  solo: boolean;
  players: SoPlayerInfo[];
}

interface TvRound extends TvBase {
  category: CategoryId;
  prompt: string;
  /** Beschriftung oben (Platz 1) und unten (letzter Platz). */
  top: string;
  bottom: string;
}

export type SoTvState =
  | (TvBase & { phase: "intro"; endsAt: number; durationMs: number; categories: CategoryId[]; itemsPerRound: number })
  | (TvRound & {
      phase: "sort";
      /** Gemischte Auslage ohne Werte. */
      cards: SoCard[];
      endsAt: number;
      durationMs: number;
      /** Spieler, die „Fertig“ gedrückt haben (ohne ihre Reihenfolge). */
      done: PlayerId[];
    })
  | (TvRound & {
      phase: "reveal";
      unit: string;
      /** Richtige Reihenfolge, Platz 0 = oben. */
      items: SoRevealItem[];
      /** Je Platz: Spieler, die die richtige Karte genau dort hatten. */
      correctBy: PlayerId[][];
      /** Alle aktiven Teilnehmer, in Startreihenfolge. */
      results: SoResult[];
      /** Serverzeit, ab der die Aufbau-Animation läuft (cardRevealOffset relativ dazu). */
      revealAt: number;
      /** Ab hier stehen alle Karten: Punkte und „Perfekt!“. */
      resultAt: number;
      endsAt: number;
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

export type SoPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & {
      phase: "sort";
      setId: string;
      prompt: string;
      top: string;
      bottom: string;
      cards: SoCard[];
      /** Eigener Stand beim Server (für Reconnect). */
      order: number[];
      /** „Fertig“ gedrückt – Reihenfolge fix. */
      submitted: boolean;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & {
      phase: "reveal";
      prompt: string;
      unit: string;
      top: string;
      bottom: string;
      revealAt: number;
      resultAt: number;
      /** Richtige Reihenfolge. */
      items: SoRevealItem[];
      /** Eigene Reihenfolge je Platz: Text der gelegten Karte (null = leer) und Bewertung. */
      mine: Array<{ label: string | null; mark: Mark }>;
      points: number;
      perfect: boolean;
      submitted: boolean;
    })
  | (ViewBase & { phase: "standings" })
  | (ViewBase & { phase: "final"; perfects: number });

export interface SoResultData {
  setIds: string[];
  total: number;
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; perfects: number; left: boolean }>;
}
