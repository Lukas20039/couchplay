// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Wer würde eher …?“.
// Privatsphäre: Während der Abstimmung kennt der TV nur, WER schon abgestimmt hat; jedes Handy nur die eigene
// Wahl. In der Auflösung gibt es Zuordnungen „wer hat wen gewählt“ nur im offenen Modus, anonym nur Zähler.
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId } from "./constants.js";
import type { SeenPacked } from "./seen.js";

export { CATEGORY_IDS, type CategoryId } from "./constants.js";

/** Dauer der Phasen ohne Spielereingabe (ms). */
export const TIMING = {
  /** Nicht überspringbar: Die Handys melden hier ihre gesehenen Aussagen. */
  introMs: 8_000,
  /** Auflösung inkl. Animation (überspringbar). */
  revealMs: 11_000,
  standingsMs: 5_000,
  finalMs: 14_000,
} as const;

/** Punkte, wenn die eigene Stimme an einen der Meistgewählten ging. */
export const POINTS = { majority: 100 } as const;

/** Zeitplan der Auflösungs-Animation (ms ab revealAt) für n einfliegende Stimmen – TV und Handy nutzen ihn gleich. */
export function revealSchedule(n: number): { firstMs: number; stepMs: number; crownMs: number; pointsMs: number } {
  const firstMs = 900;
  const stepMs = n > 0 ? Math.min(480, Math.floor(3_400 / n)) : 0;
  const crownMs = firstMs + n * stepMs + 700;
  return { firstMs, stepMs, crownMs, pointsMs: crownMs + 900 };
}

export interface WeSettings {
  categories: CategoryId[];
  rounds: number;
  voteSeconds: number;
  /** Setting „anonymous“ = "anonym": keine Zuordnung Wähler → Gewählte an die Clients. */
  anonymous: boolean;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type WeInput =
  /** Stimme für einen Mitspieler (auch sich selbst); fix nach dem Tippen. */
  | { type: "vote"; target: PlayerId }
  /** Schon gestellte Aussagen dieses Handys (seen.ts). */
  | { type: "seen"; ids: SeenPacked };

/** Darstellung eines Spielers (Avatar, Name, Farbe). */
export interface WePerson {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
}

export interface WePlayerInfo extends WePerson {
  score: number;
  rank: number;
  /** Punkte der zuletzt aufgelösten Runde (im anonymen Modus immer 0, siehe Privatsphäre). */
  roundPoints: number;
  left: boolean;
}

/** Eine einfliegende Stimme in der Auflösung. voter ist im anonymen Modus immer null. */
export interface WeFlight {
  target: PlayerId;
  voter: PlayerId | null;
}

/** Titel eines Spielers: die Aussage, bei der er die meisten Stimmen bekam. */
export interface WeTitle {
  promptId: string;
  /** Fortsetzung von „… würde eher“, ohne „?“. */
  text: string;
  votes: number;
}

interface TvBase {
  /** 0-basiert; Gesamtzahl Runden. */
  round: number;
  total: number;
  anonymous: boolean;
  players: WePlayerInfo[];
}

interface TvPrompt extends TvBase {
  category: CategoryId;
  /** Fortsetzung von „Wer würde eher …“, endet auf „?“. */
  text: string;
}

export type WeTvState =
  | (TvBase & { phase: "intro"; endsAt: number; durationMs: number; categories: CategoryId[] })
  | (TvPrompt & {
      phase: "vote";
      endsAt: number;
      durationMs: number;
      /** Wählbare Spieler (nicht ausgeschieden), in Startreihenfolge. */
      candidates: PlayerId[];
      /** Wer schon abgestimmt hat – ohne Ziel. */
      voted: PlayerId[];
    })
  | (TvPrompt & {
      phase: "reveal";
      revealAt: number;
      endsAt: number;
      candidates: PlayerId[];
      /** Stimmen je Kandidat (Reihenfolge wie candidates). */
      counts: Array<{ playerId: PlayerId; votes: number }>;
      /** Einzelne Stimmen in zufälliger Reihenfolge (verrät nicht, wer zuerst getippt hat). */
      flights: WeFlight[];
      /** Meistgewählte (leer, wenn niemand abgestimmt hat). */
      winners: PlayerId[];
      maxVotes: number;
      /** Wer mit der Mehrheit lag (+100); im anonymen Modus null. */
      majority: PlayerId[] | null;
      majorityCount: number;
      voterCount: number;
    })
  | (TvBase & { phase: "standings"; endsAt: number })
  | (TvBase & {
      phase: "final";
      endsAt: number;
      durationMs: number;
      titles: Array<{ playerId: PlayerId; title: WeTitle | null }>;
    });

interface ViewBase {
  round: number;
  total: number;
  score: number;
  rank: number;
  playerCount: number;
}

export type WePlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & {
      phase: "vote";
      promptId: string;
      text: string;
      candidates: WePerson[];
      /** Eigene Stimme (nur die eigene). */
      choice: PlayerId | null;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & {
      phase: "reveal";
      text: string;
      revealAt: number;
      /** Anzahl einfliegender Stimmen (für revealSchedule). */
      voteCount: number;
      winners: WePerson[];
      maxVotes: number;
      choice: WePerson | null;
      withMajority: boolean;
      points: number;
      /** So viele Stimmen hast du selbst bekommen. */
      myVotes: number;
    })
  | (ViewBase & { phase: "standings" })
  | (ViewBase & { phase: "final"; title: WeTitle | null });

export interface WeResultData {
  promptIds: string[];
  total: number;
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; left: boolean; title: WeTitle | null }>;
}

/** „eine Nacht im Baumarkt verbringen?“ → „eine Nacht im Baumarkt verbringen“ */
export const statement = (text: string): string => text.replace(/\s*\?\s*$/, "");
