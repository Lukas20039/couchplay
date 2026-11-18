// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Alles oder nichts“.
// Wichtig: Die richtige Antwort (correctIndex) taucht nur in der Phase "reveal" auf. Welche Antwort
// als Nächstes gestrichen wird, kennt nur der TV (für das Lauflicht) – die Handys erfahren es erst danach.
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import { z } from "zod";
import { ANSWER_COUNT, type CategoryId } from "./constants.js";
import { SEEN_MAX } from "./seen.js";

export { ANSWER_COUNT, CATEGORY_IDS, SOLO_BONUS, STAGES, TIMING, cashValue, lossValue, type CategoryId } from "./constants.js";
export { spinStepAt } from "./spin.js";

/** Eingaben vom Handy (game.input.data). */
export const AonInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pick"), index: z.number().int().min(0).max(ANSWER_COUNT - 1) }),
  z.object({ type: z.literal("abstain") }),
  /** stay: true = weiterzocken, false = aussteigen und Punkte sichern. */
  z.object({ type: z.literal("decide"), stay: z.boolean() }),
  /** Schon gesehene Fragen dieses Handys (seen.ts, packSeen) – für die Auswahl neuer Fragen. */
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,3}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
export type AonInput = z.infer<typeof AonInputSchema>;

/** Typisierte Einstellungen (aus manifest.json). */
export interface AonSettings {
  categories: CategoryId[];
  rounds: number;
  answerSeconds: number;
}

/**
 * Stand eines Spielers in der laufenden Frage.
 * in = Antwort steht noch · abstain = enthalten · cashed = ausgestiegen · out = Antwort gestrichen · won = bis zum Ende richtig.
 */
export type AonStatus = "in" | "abstain" | "cashed" | "out" | "won";

/** Spieler mit Punktestand, wie ihn der TV anzeigt. */
export interface AonPlayerInfo {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  /** Darf negativ sein. */
  score: number;
  /** 1 = vorne; Gleichstand = gleicher Rang. */
  rank: number;
  /** Rang vor der aktuellen Frage (für die Ranglisten-Animation), null vor der ersten Frage. */
  previousRank: number | null;
  /** Punkte der aktuellen bzw. zuletzt aufgelösten Frage (auch negativ). */
  roundPoints: number;
  /** Status in der aktuellen Frage; null, solange noch getippt wird (verrät nichts). */
  status: AonStatus | null;
  /** Elimination, in der der Status entstand (ausgestiegen/raus), sonst 0. */
  stage: number;
  /** Anzahl Fragen, bei denen der Spieler bis zum Schluss richtig lag. */
  jackpots: number;
  /** Hat das Spiel endgültig verlassen – bleibt mit Punkten in der Wertung. */
  left: boolean;
}

/** Wer was getippt hat (nur in der Auflösung). */
export interface AonPick {
  playerId: PlayerId;
  /** null = enthalten bzw. keine Antwort. */
  choice: number | null;
  status: AonStatus;
  stage: number;
  points: number;
}

interface TvBase {
  /** Gesamtzahl Fragen dieser Partie. */
  total: number;
  /** Nach Rang sortiert (bei Gleichstand Startreihenfolge). */
  players: AonPlayerInfo[];
}

interface TvQuestionBase extends TvBase {
  /** 0-basiert. */
  index: number;
  category: CategoryId;
  text: string;
  /** Vier Antworttexte in Anzeige-Reihenfolge (bereits gemischt). */
  answers: string[];
  /** Bereits gestrichene Antworten in Reihenfolge der Elimination. */
  struck: number[];
}

export type AonTvState =
  | (TvBase & { phase: "intro"; categories: CategoryId[]; endsAt: number })
  | (TvQuestionBase & {
      phase: "pick";
      endsAt: number;
      durationMs: number;
      /** Spieler, die schon getippt oder sich enthalten haben (ohne zu verraten, was). */
      answered: PlayerId[];
    })
  | (TvQuestionBase & {
      phase: "spin";
      /** Laufende Elimination (1-basiert). */
      stage: number;
      /** Lauflicht: besuchte Antworten der Reihe nach; das letzte Element wird gestrichen. */
      path: number[];
      startedAt: number;
      runMs: number;
      endsAt: number;
    })
  | (TvQuestionBase & {
      phase: "decide";
      /** Gerade überstandene Elimination (1-basiert). */
      stage: number;
      endsAt: number;
      durationMs: number;
      /** Spieler (noch drin), die sich schon entschieden haben – ohne zu verraten, wie. */
      decided: PlayerId[];
    })
  | (TvQuestionBase & {
      phase: "reveal";
      correctIndex: number;
      picks: AonPick[];
      /** Bekommt den Bonus fürs Durchhalten als Einziger (oder null). */
      soloBonus: PlayerId | null;
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

interface ViewQuestionBase extends ViewBase {
  index: number;
  answers: string[];
  struck: number[];
  /** Eigener Tipp (null = enthalten/keiner). */
  choice: number | null;
  status: AonStatus;
  /** Bisherige Punkte dieser Frage. */
  points: number;
}

export type AonPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & {
      phase: "pick";
      index: number;
      /** Katalog-ID der Frage (das Handy merkt sie sich als gesehen). */
      questionId: string;
      category: CategoryId;
      answers: string[];
      endsAt: number;
      durationMs: number;
      /** true = getippt oder enthalten (dann choice null). */
      locked: boolean;
      choice: number | null;
    })
  | (ViewQuestionBase & { phase: "spin"; stage: number })
  | (ViewQuestionBase & {
      phase: "decide";
      stage: number;
      endsAt: number;
      durationMs: number;
      /** Eigene Entscheidung, solange noch drin (null = noch offen). */
      decision: "stay" | "cash" | null;
    })
  | (ViewQuestionBase & { phase: "reveal"; correctIndex: number; bonus: boolean })
  | (ViewBase & { phase: "standings"; index: number; previousRank: number | null })
  | (ViewBase & { phase: "final"; jackpots: number });

/** Ergebnisdaten für ctx.end({ data }). */
export interface AonResultData {
  questionIds: string[];
  total: number;
  players: Array<Pick<AonPlayerInfo, "id" | "name" | "score" | "rank" | "jackpots" | "left">>;
}
