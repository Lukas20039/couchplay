// Von Server, TV- und Controller-View gemeinsam genutzte Typen und Konstanten des Quiz.
// Wichtig: Die richtige Antwort (correctIndex) taucht nur in den Zuständen der Phase
// "reveal" auf – während der Frage kennt sie weder der TV noch ein Handy.
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import { z } from "zod";
import { ANSWER_COUNT, type CategoryId } from "./constants.js";
import { SEEN_MAX } from "./seen.js";

export { ANSWER_COUNT, CATEGORY_IDS, MAX_POINTS, TIMING, pointsForCorrect, type CategoryId } from "./constants.js";

/** Eingaben vom Handy (game.input.data). */
export const QuizInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("answer"), index: z.number().int().min(0).max(ANSWER_COUNT - 1) }),
  /** Schon gesehene Fragen dieses Handys (seen.ts, packSeen) – für die Auswahl neuer Fragen. */
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
export type QuizInput = z.infer<typeof QuizInputSchema>;

/** Typisierte Einstellungen (aus manifest.json). */
export interface QuizSettings {
  categories: CategoryId[];
  rounds: number;
  answerSeconds: number;
}

/** Spieler mit Punktestand, wie ihn der TV anzeigt. */
export interface QuizPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  score: number;
  /** 1 = vorne; Gleichstand = gleicher Rang. */
  rank: number;
  /** Rang vor der letzten Auflösung (für die Ranglisten-Animation), null vor der ersten Frage. */
  previousRank: number | null;
  /** Punkte der zuletzt aufgelösten Frage. */
  roundPoints: number;
  correctCount: number;
  /** Hat das Spiel endgültig verlassen – bleibt mit Punkten in der Wertung. */
  left: boolean;
}

/** Wer was gewählt hat (nur in der Auflösung). */
export interface QuizPick {
  playerId: PlayerId;
  /** null = keine Antwort. */
  choice: number | null;
  correct: boolean;
  points: number;
}

interface TvBase {
  /** Gesamtzahl Fragen dieser Runde. */
  total: number;
  /** Nach Rang sortiert (bei Gleichstand Startreihenfolge). */
  players: QuizPlayerInfo[];
}

interface TvQuestionBase extends TvBase {
  /** 0-basiert. */
  index: number;
  category: CategoryId;
  text: string;
  /** Vier Antworttexte in Anzeige-Reihenfolge (bereits gemischt). */
  answers: string[];
}

export type QuizTvState =
  | (TvBase & { phase: "intro"; categories: CategoryId[]; endsAt: number })
  | (TvQuestionBase & {
      phase: "question";
      endsAt: number;
      durationMs: number;
      /** Spieler, die bereits geantwortet haben (ohne Antwort zu verraten). */
      answered: PlayerId[];
    })
  | (TvQuestionBase & {
      phase: "reveal";
      correctIndex: number;
      /** Anzahl Stimmen je Antwort. */
      distribution: number[];
      picks: QuizPick[];
      endsAt: number;
    })
  | (TvBase & { phase: "standings"; index: number; endsAt: number })
  | (TvBase & { phase: "final"; endsAt: number });

interface ViewBase {
  total: number;
  score: number;
  /** Eigener aktueller Rang (Gleichstand = gleicher Rang). */
  rank: number;
  playerCount: number;
}

export type QuizPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & {
      phase: "question";
      index: number;
      /** Katalog-ID der Frage (das Handy merkt sie sich als gesehen). */
      questionId: string;
      category: CategoryId;
      answers: string[];
      endsAt: number;
      durationMs: number;
      /** Eigene, bereits gesperrte Antwort (oder null). */
      choice: number | null;
    })
  | (ViewBase & {
      phase: "reveal";
      index: number;
      answers: string[];
      choice: number | null;
      correctIndex: number;
      correct: boolean;
      points: number;
    })
  | (ViewBase & { phase: "standings"; index: number; previousRank: number | null })
  | (ViewBase & { phase: "final"; correctCount: number });

/** Ergebnisdaten für ctx.end({ data }) – auch für den Ergebnis-Screen der Apps nutzbar. */
export interface QuizResultData {
  questionIds: string[];
  total: number;
  players: Array<Pick<QuizPlayerInfo, "id" | "name" | "score" | "rank" | "correctCount" | "left">>;
}
