// Reine Spielregeln von „Stadt, Land, Fluss“: Wertung einer Kategorie, Auswahl von Kategorien und Buchstaben,
// Auszeichnungen. Ohne ctx – nur ein Rng wird hereingereicht (deterministisch testbar).
import type { Rng } from "@couchplay/game-sdk";
import type { PlayerId } from "@couchplay/protocol";
import { POINTS, type CategoryId, type CheckMode } from "./constants.js";
import { answerKey, checkAnswer } from "./normalize.js";
import type { SlAward, SlEntry, SlLexicon } from "./shared.js";

export interface RawAnswer {
  playerId: PlayerId;
  text: string;
  /**
   * Lexikon-Ergebnis, vom Server ermittelt (scoring.ts kennt die Wortlisten nicht). Fehlt/null = nicht prüfbar.
   * Wird nur bei automatisch gültigen Antworten beachtet.
   */
  lexicon?: SlLexicon;
}

/** Nötige Stimmen zum Kippen: einfache Mehrheit der Stimmberechtigten (null = niemand darf abstimmen). */
export const neededVotes = (eligible: number): number | null => (eligible > 0 ? Math.floor(eligible / 2) + 1 : null);

/**
 * Wertet eine Kategorie aus.
 * - Automatisch ungültig: leer, zu kurz, falscher Anfangsbuchstabe (siehe checkAnswer).
 * - Gleiche Antworten (gleicher Vergleichsschlüssel) bilden eine Gruppe mit gemeinsamer Voreinstellung:
 *   gültig – außer im Modus „streng“, wenn das Lexikon die Antwort nicht kennt („unknown“): dann zunächst gestrichen.
 *   Im Modus „hinweis“ wird „unknown“ nur markiert, im Modus „aus“ das Lexikon ganz ignoriert.
 * - Stimmberechtigt sind alle `voters`, die die Antwort nicht selbst gegeben haben. Erreichen die Stimmen gegen die
 *   Voreinstellung deren Mehrheit, kippt sie (gültig → gestrichen per 👎, gestrichen → gerettet per 👍).
 *   Ohne Stimmberechtigte bleibt es bei der Voreinstellung.
 * - Punkte nach dem Endergebnis: einzige gültige Antwort der Kategorie 20, sonst einzigartig 10, mehrfach 5, sonst 0.
 * @param answers Antworten der Teilnehmer (Reihenfolge = Anzeige).
 * @param challenges Schlüssel → Spieler, die gegen die Voreinstellung gestimmt haben.
 * @param voters Wer abstimmen darf (noch aktive Spieler).
 * @param mode Lexikon-Prüfung (Standard „streng“).
 */
export function scoreCategory(
  answers: readonly RawAnswer[],
  letter: string,
  challenges: ReadonlyMap<string, ReadonlySet<PlayerId>>,
  voters: readonly PlayerId[],
  mode: CheckMode = "streng",
): SlEntry[] {
  const checked = answers.map((a) => ({ ...a, key: answerKey(a.text), auto: checkAnswer(a.text, letter) }));
  const authors = new Map<string, PlayerId[]>();
  /** Lexikon je Gruppe: „known“, sobald eine Schreibweise bekannt ist; sonst „unknown“, sonst null. */
  const lexicons = new Map<string, SlLexicon>();
  for (const a of checked) {
    if (a.auto !== "ok") continue;
    authors.set(a.key, [...(authors.get(a.key) ?? []), a.playerId]);
    const lex = mode === "aus" ? null : (a.lexicon ?? null);
    const prev = lexicons.get(a.key) ?? null;
    lexicons.set(a.key, prev === "known" || lex === "known" ? "known" : (prev ?? lex));
  }

  const groups = new Map<string, { votes: number; needed: number | null; preset: boolean; valid: boolean }>();
  for (const [key, by] of authors) {
    const eligible = voters.filter((v) => !by.includes(v));
    const needed = neededVotes(eligible.length);
    const set = challenges.get(key);
    const votes = set ? eligible.filter((v) => set.has(v)).length : 0;
    const preset = !(mode === "streng" && lexicons.get(key) === "unknown");
    const flipped = needed !== null && votes >= needed;
    groups.set(key, { votes, needed, preset, valid: preset !== flipped });
  }
  let validPlayers = 0;
  for (const [key, g] of groups) if (g.valid) validPlayers += authors.get(key)!.length;

  return checked.map((a): SlEntry => {
    const g = a.auto === "ok" ? groups.get(a.key)! : null;
    if (!g) {
      return { playerId: a.playerId, text: a.text, key: a.key, status: a.auto, preset: true, lexicon: null, votes: 0, needed: null, points: 0, shared: false };
    }
    const size = authors.get(a.key)!.length;
    const points = !g.valid ? 0 : validPlayers === 1 ? POINTS.solo : size === 1 ? POINTS.unique : POINTS.shared;
    return {
      playerId: a.playerId,
      text: a.text,
      key: a.key,
      status: g.valid ? "ok" : g.preset ? "rejected" : "unlisted",
      preset: g.preset,
      lexicon: lexicons.get(a.key) ?? null,
      votes: g.votes,
      needed: g.needed,
      points,
      shared: g.valid && size > 1,
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

/**
 * Auszeichnungen: meiste 20er, meiste „Stopp!“-Rufe, meiste Daumen runter (je mindestens 1).
 * `challenges` zählt nur 👎 (Stimmen gegen gültig voreingestellte Antworten), keine 👍-Rettungen –
 * „Strengste Jury“ ist, wer am meisten streichen wollte.
 */
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
