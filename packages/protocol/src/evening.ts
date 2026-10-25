// Spieleabend: Wertung eines Spiels und Hilfen für Clients. Der Server MUSS scoreEveningRound
// verwenden; Clients nutzen die Abfragen (aktuelles Spiel, fertig, Team eines Spielers).
import type { Evening, EveningAward, PlayerId, RankingEntry } from "./common.js";
import { EVENING_POINTS } from "./constants.js";

const TEAM_PREFIX = "team:";

/** Wertungsschlüssel eines Teams. */
export const teamKey = (team: number): string => `${TEAM_PREFIX}${team}`;

/** Teamnummer aus einem Wertungsschlüssel, null für Spieler. */
export function teamOfKey(key: string): number | null {
  if (!key.startsWith(TEAM_PREFIX)) return null;
  const n = Number(key.slice(TEAM_PREFIX.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Abend-Punkte für einen Platz. */
export const eveningPoints = (place: number): number => EVENING_POINTS[Math.min(place, EVENING_POINTS.length) - 1] ?? 0;

/** Alle geplanten Spiele gewertet. */
export const eveningFinished = (e: Pick<Evening, "games" | "rounds">): boolean => e.rounds.length >= e.games.length;

/** Spiel, das als Nächstes dran ist (null, wenn der Abend fertig ist). */
export const eveningCurrentGame = (e: Pick<Evening, "games" | "rounds">): string | null => e.games[e.rounds.length] ?? null;

/** Ist das nächste Spiel das (doppelt zählende) Finale? */
export const eveningIsFinal = (e: Pick<Evening, "games" | "rounds" | "doubleFinal">): boolean =>
  e.doubleFinal && e.rounds.length === e.games.length - 1;

/** Teamnummer eines Spielers oder null. */
export function teamOfPlayer(e: Pick<Evening, "teams">, playerId: PlayerId): number | null {
  const i = e.teams?.findIndex((members) => members.includes(playerId)) ?? -1;
  return i >= 0 ? i : null;
}

/** Plätze vergeben: absteigend nach Wert, Gleichstand = gleicher Platz. */
function placeBy<T>(items: readonly T[], value: (item: T) => number): Array<{ item: T; place: number }> {
  const sorted = [...items].sort((a, b) => value(b) - value(a));
  const out: Array<{ item: T; place: number }> = [];
  sorted.forEach((item, i) => {
    const prev = out[i - 1];
    out.push({ item, place: prev && value(prev.item) === value(item) ? prev.place : i + 1 });
  });
  return out;
}

/**
 * Wertet ein beendetes Spiel für den Abend.
 * - Jeder für sich: Platz = Rang im Spiel, Punkte nach EVENING_POINTS.
 * - Teams: Teams mit Teilnehmern werden nach dem durchschnittlichen Rang ihrer Teilnehmer
 *   platziert (niedriger = besser; robust für jede Punkteskala). Teams ohne Teilnehmer gehen leer aus.
 * `double` verdoppelt alle Punkte (Finale).
 */
export function scoreEveningRound(
  ranking: readonly RankingEntry[],
  teams: readonly (readonly PlayerId[])[] | null,
  double: boolean,
): EveningAward[] {
  const factor = double ? 2 : 1;
  if (!teams) {
    return ranking.map((r) => ({ key: r.playerId, place: r.rank, points: eveningPoints(r.rank) * factor }));
  }
  const rankOf = new Map(ranking.map((r) => [r.playerId, r.rank]));
  const teamAverages: Array<{ team: number; avg: number }> = [];
  teams.forEach((members, team) => {
    const ranks = members.map((id) => rankOf.get(id)).filter((r): r is number => r !== undefined);
    if (ranks.length > 0) teamAverages.push({ team, avg: ranks.reduce((a, b) => a + b, 0) / ranks.length });
  });
  // Kleinerer Durchschnittsrang = besser → negieren für absteigende Sortierung.
  return placeBy(teamAverages, (t) => -t.avg).map(({ item, place }) => ({
    key: teamKey(item.team),
    place,
    points: eveningPoints(place) * factor,
  }));
}
