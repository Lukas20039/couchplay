// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Flunkern“.
// Privatsphäre: Während des Schreibens kennt niemand fremde Lügen oder die Wahrheit; beim Wählen gibt es nur
// die gemischten Antworttexte (ohne Autoren, ohne Markierung der Wahrheit). Aufgedeckt wird erst in der
// Auflösung – und auch dort nur Schritt für Schritt (der TV-Zustand enthält nur die schon gezeigten Schritte).
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId } from "./constants.js";
import type { SeenPacked } from "./seen.js";

export { CATEGORY_IDS, type CategoryId } from "./constants.js";

/** Dauer der Phasen ohne Spielereingabe (ms). */
export const TIMING = {
  /** Nicht überspringbar: die Handys melden hier ihre schon gesehenen Fragen. */
  introMs: 8_000,
  /** Ein Schritt der Auflösung je gewählter Lüge (Kachel → Reingefallene → Stempel mit Autor). */
  revealLieMs: 3_000,
  /** Schlussschritt: Trommelwirbel, Wahrheit, Richtige, Fakt – inkl. Lesezeit. */
  revealTruthMs: 6_500,
  standingsMs: 6_000,
  finalMs: 12_000,
} as const;

/** Zeitpunkte innerhalb eines Auflösungsschritts (ms ab stepAt), für die TV-Animation. */
export const STEP_TIMES = {
  /** Lüge: Avatare der Reingefallenen fliegen ein (gestaffelt). */
  avatarsMs: 350,
  avatarStaggerMs: 140,
  /** Lüge: Stempel „GELOGEN!“ und Autor. */
  stampMs: 1_500,
  /** Wahrheit: Trommelwirbel bis hier, dann Stempel „WAHR!“ und die Richtigen. */
  drumMs: 1_600,
  /** Wahrheit: Fakt erscheint. */
  factMs: 2_600,
} as const;

export interface FlSettings {
  categories: CategoryId[];
  rounds: number;
  writeSeconds: number;
  chooseSeconds: number;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type FlInput =
  /** Eigene Lüge (endgültig). */
  | { type: "lie"; text: string }
  /** Gewählte Antwort (Index in options, endgültig). */
  | { type: "choose"; index: number }
  /** Schon gestellte Fragen dieses Handys (seen.ts). */
  | { type: "seen"; ids: SeenPacked };

export interface FlPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  rank: number;
  /** Punkte der zuletzt aufgelösten Runde. */
  roundPoints: number;
  /** So oft sind Mitspieler insgesamt auf eigene Lügen reingefallen. */
  fooled: number;
  /** So oft die Wahrheit gefunden. */
  truths: number;
  left: boolean;
}

/** Ein Schritt der Auflösung (am TV nacheinander). */
export type FlRevealStep =
  | {
      kind: "lie";
      /** Index in options. */
      option: number;
      text: string;
      /** Wer darauf reingefallen ist (mindestens einer). */
      fooled: PlayerId[];
      /** Autoren (mehrere bei gleicher Lüge); leer = Hauslüge. */
      authors: PlayerId[];
      /** Lüge wurde automatisch zugeteilt (Autor hat nichts abgeschickt). */
      auto: boolean;
      /** Punkte je Autor aus dieser Lüge. */
      points: number;
    }
  | {
      kind: "truth";
      option: number;
      text: string;
      /** Wer die Wahrheit gefunden hat. */
      finders: PlayerId[];
      /** Punkte je Finder. */
      points: number;
      fact: string | null;
    };

export type FlAwardKind = "baron" | "finder" | "gullible";

/** Auszeichnung im Finale (Gleichstand: mehrere Gewinner). */
export interface FlAward {
  kind: FlAwardKind;
  playerIds: PlayerId[];
  count: number;
}

interface TvBase {
  /** 0-basiert; Gesamtzahl Runden. */
  round: number;
  total: number;
  players: FlPlayerInfo[];
}

interface TvQuestion extends TvBase {
  category: CategoryId;
  text: string;
  /** Letzte Runde: alles zählt doppelt. */
  double: boolean;
}

export type FlTvState =
  | (TvBase & { phase: "intro"; endsAt: number; durationMs: number; categories: CategoryId[] })
  | (TvQuestion & {
      phase: "write";
      endsAt: number;
      durationMs: number;
      /** Spieler, die ihre Lüge schon abgeschickt haben. */
      done: PlayerId[];
    })
  | (TvQuestion & {
      phase: "choose";
      /** Gemischte Antworten (ohne Autoren, ohne Markierung der Wahrheit). */
      options: string[];
      endsAt: number;
      durationMs: number;
      /** Spieler, die schon gewählt haben (nicht was). */
      chosen: PlayerId[];
    })
  | (TvQuestion & {
      phase: "reveal";
      options: string[];
      /** Bisher gezeigte Schritte; der letzte ist der aktuelle. */
      steps: FlRevealStep[];
      /** Gesamtzahl Schritte (inkl. Wahrheit). */
      stepCount: number;
      /** Serverzeit, zu der der aktuelle Schritt begann (STEP_TIMES relativ dazu). */
      stepAt: number;
    })
  | (TvBase & { phase: "standings"; endsAt: number; durationMs: number; nextDouble: boolean })
  | (TvBase & { phase: "final"; endsAt: number; durationMs: number; awards: FlAward[] });

interface ViewBase {
  round: number;
  total: number;
  score: number;
  rank: number;
  playerCount: number;
  double: boolean;
}

/** Eigenes Ergebnis einer Runde (erst nach dem Aufdecken der Wahrheit). */
export interface FlRoundResult {
  truth: string;
  /** Gewählte Antwort (Text) oder null. */
  choice: string | null;
  foundTruth: boolean;
  /** Reingefallen auf: Namen der Autoren; [] = Hauslüge; null = nicht reingefallen. */
  fooledBy: string[] | null;
  /** Eigene Lüge (oder null) und wer darauf reingefallen ist. */
  lie: string | null;
  fooledNames: string[];
  points: number;
}

export type FlPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & {
      phase: "write";
      questionId: string;
      text: string;
      endsAt: number;
      durationMs: number;
      /** Eigene, abgeschickte Lüge (fix) oder null. */
      lie: string | null;
      /** Letzter Versuch war zu nah an der Wahrheit. */
      rejected: boolean;
    })
  | (ViewBase & {
      phase: "choose";
      text: string;
      options: string[];
      /** Index der eigenen Lüge (nicht wählbar) oder null. */
      own: number | null;
      /** Eigene Lüge wurde automatisch zugeteilt. */
      auto: boolean;
      choice: number | null;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & { phase: "reveal"; text: string; result: FlRoundResult | null })
  | (ViewBase & { phase: "standings" })
  | (ViewBase & { phase: "final"; fooled: number; truths: number; awards: FlAwardKind[] });

export interface FlResultData {
  questionIds: string[];
  total: number;
  awards: FlAward[];
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; fooled: number; truths: number; left: boolean }>;
}
