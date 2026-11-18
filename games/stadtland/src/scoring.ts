// Reine Spielregeln von „Stadt, Land, Fluss“: Wertung einer Kategorie, Auswahl von Kategorien und Buchstaben,
// Auszeichnungen. Ohne ctx – nur ein Rng wird hereingereicht (deterministisch testbar).
import type { Rng } from "@couchplay/game-sdk";
import type { PlayerId } from "@couchplay/protocol";
import { POINTS, type CategoryId } from "./constants.js";
import { answerKey, checkAnswer } from "./normalize.js";
import type { SlAward, SlEntry } from "./shared.js";

export interface RawAnswer {
  playerId: PlayerId;
  text: string;
}

/** Nötige Daumen zum Streichen: einfache Mehrheit der Stimmberechtigten (null = niemand darf anfechten). */
export const neededVotes = (eligible: number): number | null => (eligible > 0 ? Math.floor(eligible / 2) + 1 : null);

/**
 * Wertet eine Kategorie aus.
 * - Automatisch ungültig: leer, zu kurz, falscher Anfangsbuchstabe (siehe checkAnswer).
 * - Gleiche Antworten (gleicher Vergleichsschlüssel) werden gemeinsam angefochten. Stimmberechtigt sind alle
 *   `voters`, die die Antwort nicht selbst gegeben haben; erreicht die Zahl der Daumen deren Mehrheit, ist sie gestrichen.
 * - Punkte: einzige gültige Antwort der Kategorie 20, sonst einzigartig 10, mehrfach 5, ungültig 0.
 * @param answers Antworten der Teilnehmer (Reihenfolge = Anzeige).
 * @param challenges Schlüssel → Spieler, die Daumen runter gegeben haben.
 * @param voters Wer anfechten darf (noch aktive Spieler).
 */
export function scoreCategory(
  answers: readonly RawAnswer[],
  letter: string,
  challenges: ReadonlyMap<string, ReadonlySet<PlayerId>>,
  voters: readonly PlayerId[],
): SlEntry[] {
  const checked = answers.map((a) => ({ ...a, key: answerKey(a.text), auto: checkAnswer(a.text, letter) }));
  const authors = new Map<string, PlayerId[]>();
  for (const a of checked) if (a.auto === "ok") authors.set(a.key, [...(authors.get(a.key) ?? []), a.playerId]);

  const groups = new Map<string, { votes: number; needed: number | null; rejected: boolean }>();
  for (const [key, by] of authors) {
    const eligible = voters.filter((v) => !by.includes(v));
    const needed = neededVotes(eligible.length);
    const set = challenges.get(key);
    const votes = set ? eligible.filter((v) => set.has(v)).length : 0;
    groups.set(key, { votes, needed, rejected: needed !== null && votes >= needed });
  }
  let validPlayers = 0;
  for (const [key, g] of groups) if (!g.rejected) validPlayers += authors.get(key)!.length;

  return checked.map((a): SlEntry => {
    const g = a.auto === "ok" ? groups.get(a.key)! : null;
    if (!g) return { playerId: a.playerId, text: a.text, key: a.key, status: a.auto, votes: 0, needed: null, points: 0, shared: false };
    const size = authors.get(a.key)!.length;
    const valid = !g.rejected;
    const points = !valid ? 0 : validPlayers === 1 ? POINTS.solo : size === 1 ? POINTS.unique : POINTS.shared;
    return {
      playerId: a.playerId,
      text: a.text,
      key: a.key,
      status: valid ? "ok" : "rejected",
      votes: g.votes,
      needed: g.needed,
      points,
      shared: valid && size > 1,
    };
  });
}

/**
 * Wählt `count` Kategorien aus `pool`: die bisher am seltensten gespielten zuerst, bei Gleichstand zufällig.
 * Ergebnis in Pool-Reihenfolge (Klassisch bleibt Stadt, Land, Fluss …).
 */
export function pickCategories(pool: readonly CategoryId[], count: number, usage: ReadonlyMap<CategoryId, number>, rng: Rng): CategoryId[] {
  if (count >= pool.length) return [...pool];
  const chosen = new Set(
    rng
      .shuffle(pool)
      .sort((a, b) => (usage.get(a) ?? 0) - (usage.get(b) ?? 0))
      .slice(0, count),
  );
  return pool.filter((c) => chosen.has(c));
}

/** Zufälliger Buchstabe ohne Wiederholung; `avoid` (z. B. Buchstaben der Vorrunde) nur, wenn nichts anderes bleibt. */
export function pickLetter(letters: readonly string[], used: ReadonlySet<string>, avoid: ReadonlySet<string>, rng: Rng): string | null {
  const fresh = letters.filter((l) => !used.has(l));
  if (fresh.length === 0) return null;
  const preferred = fresh.filter((l) => !avoid.has(l));
  return rng.pick(preferred.length > 0 ? preferred : fresh);
}

export interface AwardStats {
  id: PlayerId;
  solos: number;
  stops: number;
  challenges: number;
}

/** Auszeichnungen: meiste 20er, meiste „Stopp!“-Rufe, meiste Daumen runter (je mindestens 1). */
export function computeAwards(stats: readonly AwardStats[]): SlAward[] {
  const award = (kind: SlAward["kind"], value: (s: AwardStats) => number): SlAward | null => {
    const best = Math.max(0, ...stats.map(value));
    if (best <= 0) return null;
    return { kind, playerIds: stats.filter((s) => value(s) === best).map((s) => s.id), count: best };
  };
  return [award("solo", (s) => s.solos), award("stopper", (s) => s.stops), award("judge", (s) => s.challenges)].filter(
    (a): a is SlAward => a !== null,
  );
}
