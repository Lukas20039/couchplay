// Auszählung einer Runde (rein, ohne Abhängigkeiten): Stimmen je Kandidat, Meistgewählte, wer mit der Mehrheit lag.
// Wertung: Ging deine Stimme an einen der Meistgewählten (Gleichstand an der Spitze: alle), gibt es POINTS.majority.
// Gewählt werden bringt keine Punkte. Selbstwahl zählt wie jede andere Stimme.
import type { PlayerId } from "@couchplay/protocol";

export interface Tally {
  /** Stimmen je Kandidat, Reihenfolge wie `candidates`. */
  counts: Array<{ playerId: PlayerId; votes: number }>;
  /** Meistgewählte (leer, wenn niemand abgestimmt hat). */
  winners: PlayerId[];
  maxVotes: number;
  /** Wähler, deren Stimme an einen der Meistgewählten ging. */
  majority: PlayerId[];
}

/**
 * @param candidates wählbare Spieler (nur diese zählen als Ziel)
 * @param votes Wähler → Ziel; Stimmen für Nicht-Kandidaten werden ignoriert
 */
export function tallyVotes(candidates: readonly PlayerId[], votes: ReadonlyMap<PlayerId, PlayerId>): Tally {
  const valid = new Set(candidates);
  const count = new Map<PlayerId, number>(candidates.map((id) => [id, 0]));
  for (const target of votes.values()) if (valid.has(target)) count.set(target, count.get(target)! + 1);
  const maxVotes = Math.max(0, ...count.values());
  const winners = maxVotes > 0 ? candidates.filter((id) => count.get(id) === maxVotes) : [];
  const top = new Set(winners);
  const majority = [...votes].filter(([, target]) => top.has(target)).map(([voter]) => voter);
  return { counts: candidates.map((id) => ({ playerId: id, votes: count.get(id)! })), winners, maxVotes, majority };
}
