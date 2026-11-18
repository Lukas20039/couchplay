// Reine Rundenlogik von „Wer ist der Spion?“ (ohne ctx): Spion wählen, Zugreihenfolge, Auszählen, Ratewörter,
// Wertung, Auszeichnungen.
import type { Rng } from "@couchplay/game-sdk";
import type { PlayerId } from "@couchplay/protocol";
import { GUESS_OPTIONS, POINTS } from "./constants.js";
import type { Word } from "./data/index.js";
import { normalizeWord } from "./normalize.js";
import { winnerOf, type SpAward, type SpReason } from "./shared.js";

/**
 * Spion der Runde: unter den aktiven Spielern einer, der bisher am seltensten Spion war; wenn möglich nicht
 * derselbe wie in der Vorrunde. Bei Gleichstand entscheidet der Zufall.
 */
export function pickSpy(active: readonly PlayerId[], spyCount: ReadonlyMap<PlayerId, number>, lastSpy: PlayerId | null, rng: Rng): PlayerId {
  const fewest = Math.min(...active.map((id) => spyCount.get(id) ?? 0));
  let pool = active.filter((id) => (spyCount.get(id) ?? 0) === fewest);
  if (pool.length > 1) pool = pool.filter((id) => id !== lastSpy);
  else if (pool[0] === lastSpy && active.length > 1) {
    // Alle anderen waren schon öfter Spion – dann lieber den Nächstseltensten als zweimal hintereinander.
    const rest = active.filter((id) => id !== lastSpy);
    const next = Math.min(...rest.map((id) => spyCount.get(id) ?? 0));
    pool = rest.filter((id) => (spyCount.get(id) ?? 0) === next);
  }
  return rng.pick(pool);
}

/** Zugreihenfolge: Startreihenfolge der Spieler, rotiert ab einem zufälligen Startspieler. */
export function turnOrder(active: readonly PlayerId[], rng: Rng): PlayerId[] {
  const start = rng.int(0, active.length - 1);
  return [...active.slice(start), ...active.slice(0, start)];
}

export interface Tally {
  /** Stimmen je Kandidat, Reihenfolge wie `candidates`. */
  counts: Array<{ playerId: PlayerId; votes: number }>;
  /** Meistgewählte (leer ohne Stimmen; mehrere bei Gleichstand). */
  top: PlayerId[];
  maxVotes: number;
  /** Eindeutig Meistgewählter oder null. */
  accused: PlayerId | null;
  tie: boolean;
}

/** Auszählen. Stimmen für Nicht-Kandidaten und Selbststimmen werden ignoriert. */
export function tallyVotes(candidates: readonly PlayerId[], votes: ReadonlyMap<PlayerId, PlayerId>): Tally {
  const valid = new Set(candidates);
  const count = new Map<PlayerId, number>(candidates.map((id) => [id, 0]));
  for (const [voter, target] of votes) if (valid.has(target) && voter !== target) count.set(target, count.get(target)! + 1);
  const maxVotes = Math.max(0, ...count.values());
  const top = maxVotes > 0 ? candidates.filter((id) => count.get(id) === maxVotes) : [];
  return {
    counts: candidates.map((id) => ({ playerId: id, votes: count.get(id)! })),
    top,
    maxVotes,
    accused: top.length === 1 ? top[0]! : null,
    tie: top.length > 1,
  };
}

/**
 * Ratewörter für den enttarnten Spion: das richtige Wort plus zufällige andere Wörter derselben Kategorie
 * (normalisiert verschieden), gemischt. `pool` = alle Wörter der Kategorie.
 */
export function buildGuessOptions(word: Word, pool: readonly Word[], rng: Rng, n: number = GUESS_OPTIONS): string[] {
  const used = new Set([normalizeWord(word.word)]);
  const out = [word.word];
  for (const w of rng.shuffle(pool)) {
    if (out.length >= n) break;
    const key = normalizeWord(w.word);
    if (used.has(key)) continue;
    used.add(key);
    out.push(w.word);
  }
  return rng.shuffle(out);
}

export interface RoundScore {
  /** Punkte je Spieler (nur > 0). */
  points: Map<PlayerId, number>;
  /** Nicht-Spione, die in der entscheidenden Abstimmung auf den Spion getippt haben. */
  correctVoters: PlayerId[];
}

/**
 * Wertung einer Runde:
 * - Gruppe gewinnt („caught“): jeder aktive Nicht-Spion +100.
 * - Spion gewinnt: unentdeckt („wrong“, „tie“, „none“) +300, enttarnt aber Wort erraten („guessed“) +250.
 * - Unabhängig davon: +50 für jeden Nicht-Spion, der in der entscheidenden Abstimmung auf den Spion tippte.
 * - Spion hat verlassen („left“): niemand bekommt Punkte.
 * `active` in Startreihenfolge; `votes` = Wähler → Ziel der letzten Abstimmung.
 */
export function scoreRound(reason: SpReason, spyId: PlayerId, active: readonly PlayerId[], votes: ReadonlyMap<PlayerId, PlayerId>): RoundScore {
  const points = new Map<PlayerId, number>();
  if (reason === "left") return { points, correctVoters: [] };
  const add = (id: PlayerId, n: number): void => {
    points.set(id, (points.get(id) ?? 0) + n);
  };
  const correctVoters = active.filter((id) => id !== spyId && votes.get(id) === spyId);
  const winner = winnerOf(reason);
  if (winner === "group") for (const id of active) if (id !== spyId) add(id, POINTS.groupWin);
  if (winner === "spy" && active.includes(spyId)) add(spyId, reason === "guessed" ? POINTS.spyGuess : POINTS.spyEscape);
  for (const id of correctVoters) add(id, POINTS.correctVote);
  return { points, correctVoters };
}

/** Auszeichnungen fürs Finale: nur mit mindestens 1, Gleichstand → mehrere Gewinner. */
export function computeAwards(stats: readonly { id: PlayerId; correctVotes: number; spyWins: number }[]): SpAward[] {
  const award = (kind: SpAward["kind"], value: (s: (typeof stats)[number]) => number): SpAward | null => {
    const best = Math.max(0, ...stats.map(value));
    if (best <= 0) return null;
    return { kind, playerIds: stats.filter((s) => value(s) === best).map((s) => s.id), count: best };
  };
  return [award("detective", (s) => s.correctVotes), award("masterspy", (s) => s.spyWins)].filter((a): a is SpAward => a !== null);
}
