// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Zeichnen & Raten“.
// Der gesuchte Begriff steht nur in der Ansicht des Zeichners – TV und Rater sehen ihn erst in "reveal".
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId, Difficulty } from "./constants.js";

export { CATEGORY_IDS, type CategoryId } from "./constants.js";

/** Dauer der Phasen (ms). Nur reveal/standings/final sind überspringbare Wartezeiten (Intro nicht: seen-Meldungen). */
export const TIMING = {
  introMs: 7_000,
  chooseMs: 10_000,
  revealMs: 7_000,
  standingsMs: 5_000,
  finalMs: 8_000,
  /** Höchstens so oft geht während des Zeichnens ein TV-Zustand raus. */
  tvThrottleMs: 120,
  /** So oft wird die Ansicht des Zeichners (mit seinen Strichen, für Reconnects) aufgefrischt. */
  drawerBackupMs: 2_000,
} as const;

/** Punkte der Rater nach Reihenfolge (ab dem 5. bleibt es beim letzten Wert). */
export const GUESS_POINTS = [100, 80, 70, 60, 50] as const;
/** Zeichner: je richtigem Rater, gedeckelt. */
export const DRAWER_POINTS = { perGuesser: 50, max: 200 } as const;
/** Hinweise: Anteil der Zeichenzeit, nach dem je ein Buchstabe aufgedeckt wird. */
export const HINT_AT = [0.5, 0.75] as const;

export interface ZgSettings {
  categories: CategoryId[];
  difficulty: Difficulty;
  drawSeconds: number;
  /** Wie oft jede Person zeichnet. */
  turns: number;
  hints: boolean;
}

/** Ein Strich: Farbe/Größe als Index (PALETTE/SIZES), Punkte flach [x, y, x, y, …] in 0–1000. */
export interface Stroke {
  id: number;
  color: number;
  size: number;
  points: number[];
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type ZgInput =
  | { type: "choose"; index: number }
  | { type: "stroke"; id: number; color: number; size: number; points: number[] }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "guess"; text: string }
  /** Schon gespielte Begriffe dieses Handys (seen.ts). */
  | { type: "seen"; ids: Record<string, number[]> };

export interface ZgPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  rank: number;
  /** Punkte der laufenden bzw. zuletzt aufgelösten Runde. */
  roundPoints: number;
  /** Hat den Begriff in dieser Runde erraten. */
  guessed: boolean;
  left: boolean;
}

export interface Drawer {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
}

/**
 * Sprechblase am TV: Fehltipp mit Text oder „Anna hat's! ✅“ (`correct`, Text leer – der richtige Tipp
 * erscheint nie im Klartext). „Knapp daneben“-Tipps erscheinen gar nicht, sonst könnten andere abschreiben.
 */
export interface Bubble {
  /** Laufende Nummer (stabiler Key für Animationen). */
  n: number;
  playerId: PlayerId;
  text: string;
  correct: boolean;
}

/**
 * Wortlücken: je Zeichen des Begriffs; `null` = verdeckter Buchstabe, sonst das sichtbare Zeichen
 * (Leerzeichen, Bindestrich, aufgedeckter Buchstabe).
 */
export type Hint = (string | null)[];

interface TvBase {
  /** 0-basiert; Gesamtzahl Zeichenrunden. */
  round: number;
  total: number;
  players: ZgPlayerInfo[];
}

interface TvDrawing extends TvBase {
  drawer: Drawer;
  strokes: Stroke[];
  /** Erhöht sich bei undo/clear → TV zeichnet komplett neu. */
  rev: number;
}

export type RevealReason = "time" | "all" | "left";

export type ZgTvState =
  | (TvBase & { phase: "intro"; endsAt: number })
  | (TvBase & { phase: "choose"; drawer: Drawer; endsAt: number })
  | (TvDrawing & { phase: "draw"; hint: Hint; endsAt: number; durationMs: number; bubbles: Bubble[] })
  | (TvDrawing & { phase: "reveal"; word: string; reason: RevealReason; endsAt: number })
  | (TvBase & { phase: "standings"; endsAt: number })
  | (TvBase & { phase: "final"; endsAt: number });

interface ViewBase {
  round: number;
  total: number;
  score: number;
  rank: number;
  playerCount: number;
}

export interface WordOption {
  word: string;
  category: CategoryId;
}

/** Eigener Tipp in der Liste am Handy. */
export interface OwnGuess {
  text: string;
  /** „Knapp daneben!“ (nur privat). */
  close: boolean;
}

export type ZgPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & { phase: "choose"; role: "draw"; options: WordOption[]; endsAt: number; durationMs: number })
  | (ViewBase & { phase: "choose"; role: "guess"; drawer: Drawer })
  | (ViewBase & {
      phase: "draw";
      role: "draw";
      word: string;
      wordId: string;
      /** Bisherige Striche (stellt die Canvas nach einem Reload wieder her). */
      strokes: Stroke[];
      /** Kleinste Strich-ID, die der Server noch nicht kennt (IDs nach einem Reload nicht wiederverwenden). */
      nextStrokeId: number;
      endsAt: number;
      durationMs: number;
      guessed: number;
      guessers: number;
      roundPoints: number;
    })
  | (ViewBase & {
      phase: "draw";
      role: "guess";
      drawer: Drawer;
      hint: Hint;
      endsAt: number;
      durationMs: number;
      /** Erraten → Erfolgsbildschirm. */
      correct: boolean;
      roundPoints: number;
      /** Eigene Tipps, neueste zuerst. */
      guesses: OwnGuess[];
      /** Laufende Nummer des letzten Tipps (Handy erkennt neue „Knapp daneben!“). */
      guessSeq: number;
    })
  | (ViewBase & {
      phase: "reveal";
      role: "draw" | "guess";
      word: string;
      wordId: string;
      drawer: Drawer;
      correct: boolean;
      roundPoints: number;
      guessed: number;
      reason: RevealReason;
    })
  | (ViewBase & { phase: "standings" })
  | (ViewBase & { phase: "final" });

export interface ZgResultData {
  /** Gespielte Begriffe (für ctx.previous bei der Revanche). */
  wordIds: string[];
  total: number;
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; guessed: number; left: boolean }>;
}
