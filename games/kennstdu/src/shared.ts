// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Wie gut kennst du mich?“.
// Die Antwort der Hauptperson (hotseatChoice) taucht erst in der Phase "reveal" auf.
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId } from "./constants.js";

export { CATEGORY_IDS, type CategoryId } from "./constants.js";

/** Dauer der Phasen ohne Spielereingabe (ms). */
export const TIMING = {
  introMs: 7_000,
  revealMs: 8_000,
  standingsMs: 5_000,
  finalMs: 6_000,
} as const;

/** Punkte für richtiges Raten bzw. für die Hauptperson je richtigem Rater. */
export const POINTS = { guess: 100, perGuesser: 50 } as const;

export interface KdSettings {
  categories: CategoryId[];
  /** Fragen pro Person (wie oft jede Person Hauptperson ist). */
  turns: number;
  answerSeconds: number;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type KdInput =
  | { type: "answer"; index: number }
  /** Schon gestellte Fragen dieses Handys (seen.ts). */
  | { type: "seen"; ids: Record<string, number[]> };

export interface KdPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  rank: number;
  /** Punkte der zuletzt aufgelösten Frage. */
  roundPoints: number;
  left: boolean;
}

export interface Hotseat {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
}

export interface KdGuess {
  playerId: PlayerId;
  choice: number | null;
  correct: boolean;
}

interface TvBase {
  /** 0-basiert; Gesamtzahl Fragen der Runde. */
  round: number;
  total: number;
  players: KdPlayerInfo[];
}

interface TvQuestion extends TvBase {
  hotseat: Hotseat;
  category: CategoryId;
  /** Frage mit eingesetztem Namen. */
  text: string;
  answers: string[];
}

export type KdTvState =
  | (TvBase & { phase: "intro"; endsAt: number })
  | (TvQuestion & {
      phase: "ask";
      endsAt: number;
      durationMs: number;
      hotseatAnswered: boolean;
      /** Rater, die schon getippt haben (ohne Antwort). */
      guessed: PlayerId[];
    })
  | (TvQuestion & {
      phase: "reveal";
      endsAt: number;
      /** Antwort der Hauptperson; null = keine Antwort gegeben. */
      hotseatChoice: number | null;
      guesses: KdGuess[];
      /** Anzahl Tipps je Antwort. */
      distribution: number[];
    })
  | (TvBase & { phase: "standings"; endsAt: number })
  | (TvBase & { phase: "final"; endsAt: number });

interface ViewBase {
  round: number;
  total: number;
  score: number;
  rank: number;
  playerCount: number;
}

export type KdPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & {
      phase: "ask";
      role: "hotseat" | "guess";
      questionId: string;
      /** du-Form für die Hauptperson, sonst 3. Person mit Namen. */
      text: string;
      answers: string[];
      hotseat: Hotseat;
      choice: number | null;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & {
      phase: "reveal";
      role: "hotseat" | "guess";
      answers: string[];
      hotseat: Hotseat;
      hotseatChoice: number | null;
      choice: number | null;
      /** Rater: richtig geraten; Hauptperson: mindestens einer hat richtig geraten. */
      correct: boolean;
      points: number;
      /** Hauptperson: so viele haben richtig geraten. */
      rightGuessers: number;
    })
  | (ViewBase & { phase: "standings" })
  | (ViewBase & { phase: "final"; matches: number });

export interface KdResultData {
  questionIds: string[];
  total: number;
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; matches: number; left: boolean }>;
}
