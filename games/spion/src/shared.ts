// Von Server, TV- und Controller-View gemeinsam genutzte Typen von „Wer ist der Spion?“.
// Geheimhaltung (wichtigste Regel dieses Spiels):
// - Der TV-Zustand enthält das geheime Wort, das Undercover-Wort und die Spion-ID NIE vor der Auflösung:
//   die Spion-ID erst im Urteil (reveal.verdict), die Wörter erst im Rundenergebnis (result). Beim Raten sieht
//   der TV nur die acht Auswahlwörter (ohne Markierung des richtigen).
// - Jedes Handy bekommt nur das eigene Geheimnis (`secret`). Die Ansicht eines Nicht-Spions verrät nicht, wer
//   der Spion ist; im Undercover-Modus sieht die Ansicht des Spions genauso aus wie alle anderen (nur ein anderes
//   Wort) – er weiß also nicht, dass er der Spion ist.
// - Die Wort-ID (für das Gedächtnis gegen Wiederholung) gibt es erst im Rundenergebnis (sonst könnte ein
//   neugieriger Spion sie nachschlagen).
import type { AvatarId, PlayerId } from "@couchplay/protocol";
import type { CategoryId, SpMode } from "./constants.js";
import type { SeenPacked } from "./seen.js";

export { CATEGORY_IDS, MODES, type CategoryId, type SpMode } from "./constants.js";

/** Dauer der Phasen ohne Spielereingabe (ms). */
export const TIMING = {
  /** Nicht überspringbar: die Handys melden hier ihre schon gespielten Wörter. */
  introMs: 8_000,
  /** Geheime Rolle anschauen; endet vorzeitig, sobald alle verbundenen Spieler „Verstanden“ getippt haben. */
  roleMs: 20_000,
  /** Urteil in der Auflösung (Trommelwirbel, Stempel, ggf. der echte Spion). */
  verdictMs: 6_500,
  /** Der enttarnte Spion rät das Wort (nicht überspringbar). */
  guessMs: 30_000,
  /** Rundenergebnis mit Wort und Punkten (überspringbar). */
  resultMs: 12_000,
  finalMs: 14_000,
} as const;

/** Zeitplan der Stimmen-Auflösung (ms ab stepAt) für n einfliegende Stimmen – TV und Server nutzen ihn gleich. */
export function voteSchedule(n: number): { firstMs: number; stepMs: number; accuseMs: number; doneMs: number } {
  const firstMs = 900;
  const stepMs = n > 0 ? Math.min(500, Math.floor(3_000 / n)) : 0;
  const accuseMs = firstMs + n * stepMs + 700;
  return { firstMs, stepMs, accuseMs, doneMs: accuseMs + 2_600 };
}

/** Zeitpunkte im Urteil (ms ab stepAt). */
export const VERDICT_TIMES = {
  /** Trommelwirbel bis hier, dann Stempel auf dem Beschuldigten. */
  stampMs: 1_800,
  /** Bei falschem Verdacht: jetzt wird der echte Spion aufgedeckt. */
  spyMs: 3_400,
} as const;

export interface SpSettings {
  mode: SpMode;
  categories: CategoryId[];
  rounds: number;
  clueRounds: number;
  clueSeconds: number;
  voteSeconds: number;
}

/** Eingaben vom Handy (game.input.data); Schema in server/input.ts. */
export type SpInput =
  /** Geheime Rolle gesehen. */
  | { type: "ready" }
  /** Eigener Hinweis (nur wenn man dran ist). */
  | { type: "clue"; text: string }
  /** Zug auslassen. */
  | { type: "pass" }
  /** Verdacht (nicht man selbst), fix nach dem Tippen. */
  | { type: "vote"; target: PlayerId }
  /** Enttarnter Spion rät das Wort (Index in options). */
  | { type: "guess"; index: number }
  /** Schon gespielte Wörter dieses Handys (seen.ts). */
  | { type: "seen"; ids: SeenPacked };

/** Darstellung eines Spielers (Avatar, Name, Farbe). */
export interface SpPerson {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
}

export interface SpPlayerInfo extends SpPerson {
  score: number;
  rank: number;
  /** Punkte der zuletzt aufgelösten Runde. */
  roundPoints: number;
  /** Hinweise dieser Runde in Reihenfolge; null = ausgelassen bzw. Zeit abgelaufen. */
  clues: Array<string | null>;
  left: boolean;
}

/** Eine einfliegende Stimme in der Auflösung. */
export interface SpFlight {
  voter: PlayerId;
  target: PlayerId;
}

/** Wie die Runde ausging. */
export type SpReason =
  /** Spion enttarnt (und Wort nicht erraten bzw. Undercover-Modus). */
  | "caught"
  /** Spion enttarnt, hat aber das Wort erraten. */
  | "guessed"
  /** Ein Unschuldiger wurde beschuldigt. */
  | "wrong"
  /** Auch die Stichwahl endete unentschieden. */
  | "tie"
  /** Niemand hat abgestimmt. */
  | "none"
  /** Der Spion hat das Spiel verlassen – Runde ohne Wertung. */
  | "left";

export type SpWinner = "group" | "spy" | "none";

export const winnerOf = (reason: SpReason): SpWinner => (reason === "caught" ? "group" : reason === "left" ? "none" : "spy");

export type SpAwardKind = "detective" | "masterspy";

/** Auszeichnung im Finale (Gleichstand: mehrere Gewinner). */
export interface SpAward {
  kind: SpAwardKind;
  playerIds: PlayerId[];
  count: number;
}

interface TvBase {
  /** 0-basiert; Gesamtzahl Runden. */
  round: number;
  total: number;
  mode: SpMode;
  players: SpPlayerInfo[];
}

interface TvRound extends TvBase {
  category: CategoryId;
  clueRounds: number;
  /** Zugreihenfolge dieser Runde (Startspieler zufällig). */
  order: PlayerId[];
}

export type SpTvState =
  | (TvBase & { phase: "intro"; endsAt: number; durationMs: number; categories: CategoryId[] })
  | (TvRound & { phase: "role"; endsAt: number; durationMs: number; ready: PlayerId[] })
  | (TvRound & {
      phase: "clue";
      /** 0-basiert. */
      clueRound: number;
      /** Wer gerade dran ist. */
      turn: PlayerId;
      endsAt: number;
      durationMs: number;
    })
  | (TvRound & {
      phase: "vote";
      /** Stichwahl nach Gleichstand. */
      runoff: boolean;
      candidates: PlayerId[];
      /** Wer schon abgestimmt hat – ohne Ziel. */
      voted: PlayerId[];
      endsAt: number;
      durationMs: number;
    })
  | (TvRound & {
      phase: "reveal";
      runoff: boolean;
      candidates: PlayerId[];
      /** Einzelne Stimmen in zufälliger Reihenfolge (verrät nicht, wer zuerst getippt hat). */
      flights: SpFlight[];
      counts: Array<{ playerId: PlayerId; votes: number }>;
      /** Meistgewählter (null bei Gleichstand oder ohne Stimmen). */
      accused: PlayerId | null;
      tie: boolean;
      /** Was nach dem Auszählen kommt. */
      next: "runoff" | "verdict";
      /** Serverzeit, zu der der aktuelle Schritt begann. */
      stepAt: number;
      /** Erst im zweiten Schritt: Urteil mit dem echten Spion. */
      verdict: { spyId: PlayerId; caught: boolean } | null;
    })
  | (TvRound & {
      phase: "guess";
      spyId: PlayerId;
      /** Acht Wörter der Kategorie (eins davon ist richtig – ohne Markierung). */
      options: string[];
      endsAt: number;
      durationMs: number;
    })
  | (TvRound & {
      phase: "result";
      spyId: PlayerId;
      word: string;
      /** Undercover-Modus: das Wort des Spions. */
      spyWord: string | null;
      reason: SpReason;
      winner: SpWinner;
      /** Geratenes Wort des Spions (oder null). */
      guess: string | null;
      /** Wer in der entscheidenden Abstimmung auf den Spion getippt hat. */
      correctVoters: PlayerId[];
      endsAt: number;
      durationMs: number;
      /** Danach kommt das Finale. */
      last: boolean;
    })
  | (TvBase & { phase: "final"; endsAt: number; durationMs: number; awards: SpAward[] });

/** Eigenes Geheimnis. Im Undercover-Modus bekommt auch der Spion „word“ (mit seinem ähnlichen Wort). */
export type SpSecret = { kind: "spy"; category: CategoryId } | { kind: "word"; category: CategoryId; word: string };

interface ViewBase {
  round: number;
  total: number;
  score: number;
  rank: number;
  playerCount: number;
  /** Eigene geheime Rolle (null in Intro und Finale). */
  secret: SpSecret | null;
}

export type SpPlayerView =
  | (ViewBase & { phase: "intro"; endsAt: number })
  | (ViewBase & { phase: "role"; endsAt: number; durationMs: number; ready: boolean })
  | (ViewBase & {
      phase: "clue";
      clueRound: number;
      clueRounds: number;
      /** Wer gerade dran ist. */
      turn: SpPerson;
      myTurn: boolean;
      /** So viele Züge, bis man selbst (wieder) dran ist; null = in dieser Runde nicht mehr. */
      turnsUntil: number | null;
      myClues: Array<string | null>;
      /** Letzter Versuch verriet das eigene Wort zu direkt. */
      rejected: boolean;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & {
      phase: "vote";
      runoff: boolean;
      /** Wählbar (ohne einen selbst). */
      candidates: SpPerson[];
      choice: PlayerId | null;
      /** Man ist selbst in der Stichwahl. */
      inRunoff: boolean;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & { phase: "reveal" })
  | (ViewBase & {
      phase: "guess";
      spy: SpPerson;
      /** Man ist der enttarnte Spion und darf raten. */
      canGuess: boolean;
      options: string[];
      choice: number | null;
      endsAt: number;
      durationMs: number;
    })
  | (ViewBase & {
      phase: "result";
      /** Für das Gedächtnis gegen Wiederholung (erst jetzt). */
      wordId: string;
      word: string;
      spyWord: string | null;
      spy: SpPerson;
      wasSpy: boolean;
      reason: SpReason;
      winner: SpWinner;
      guess: string | null;
      /** Eigene Seite hat gewonnen. */
      won: boolean;
      votedRight: boolean;
      points: number;
    })
  | (ViewBase & { phase: "final"; correctVotes: number; spyWins: number; awards: SpAwardKind[] });

export interface SpResultData {
  wordIds: string[];
  total: number;
  awards: SpAward[];
  players: Array<{ id: PlayerId; name: string; score: number; rank: number; correctVotes: number; spyWins: number; left: boolean }>;
}
