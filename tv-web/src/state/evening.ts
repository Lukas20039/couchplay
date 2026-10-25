// Spieleabend aus Sicht des TVs: aufbereitete Tabellen für Lobby, Ergebnis und Siegerehrung.
import type { Evening, EveningAward, GameManifest, Player, RoomState } from "@couchplay/protocol";
import { EVENING_MAX_GAMES, TEAM_EMOJI } from "@couchplay/protocol/constants";
import { eveningCurrentGame, eveningFinished, teamOfKey } from "@couchplay/protocol/evening";

/** Eine Zeile der Abendwertung (Team oder Spieler), fertig zum Anzeigen. */
export interface EveningRow {
  key: string;
  rank: number;
  points: number;
  /** Teamnummer oder null (Spieler). */
  team: number | null;
  /** Spieler (falls noch im Raum) – für Farbe/Avatar. */
  player: Player | null;
  name: string | null;
  avatar: string | null;
}

export function eveningRows(room: RoomState): EveningRow[] {
  const e = room.evening;
  if (!e) return [];
  return e.standings.map((s) => {
    const team = teamOfKey(s.key);
    const player = team === null ? (room.players.find((p) => p.id === s.key) ?? null) : null;
    return { key: s.key, rank: s.rank, points: s.points, team, player, name: player?.name ?? s.name ?? null, avatar: player?.avatar ?? s.avatar ?? null };
  });
}

/** Abend-Punkte je Spieler (jeder für sich) für die Spielerliste der Lobby. */
export function playerPoints(evening: Evening | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!evening || evening.teams) return out;
  for (const s of evening.standings) out.set(s.key, s.points);
  return out;
}

/** Punkte je Team (Index = Teamnummer). */
export function teamPoints(evening: Evening): number[] {
  return (evening.teams ?? []).map((_, i) => evening.standings.find((s) => teamOfKey(s.key) === i)?.points ?? 0);
}

export const teamEmoji = (team: number): string => TEAM_EMOJI[team] ?? "⭐";
/** CSS-Farbe eines Teams (Spielerfarben 0–3: Rot, Blau, Grün, Gelb). */
export const teamColorVar = (team: number): string => `var(--p${team % 4})`;

/** Wertung der zuletzt gespielten Runde (Ergebnis-Screen). */
export function lastAwards(room: RoomState): EveningAward[] {
  return room.evening?.rounds.at(-1)?.awards ?? [];
}

/** Nächstes Spiel des Plans (nach dem Ergebnis) als Manifest. */
export function nextGame(room: RoomState, catalog: readonly GameManifest[]): GameManifest | null {
  const id = room.evening ? eveningCurrentGame(room.evening) : null;
  return (id && catalog.find((g) => g.id === id)) || null;
}

/** Siegerehrung zeigen: Abend fertig und wieder in der Lobby. */
export function showFinale(room: RoomState | null): boolean {
  return !!room?.evening && room.phase === "lobby" && eveningFinished(room.evening);
}

/** Auswahl im Planer umschalten (Reihenfolge = Klickreihenfolge). */
export function toggleGame(selection: readonly string[], id: string): string[] {
  if (selection.includes(id)) return selection.filter((x) => x !== id);
  return selection.length >= EVENING_MAX_GAMES ? [...selection] : [...selection, id];
}

/** Startvorschlag für den Planer: bis zu 5 Spiele, die zur Spielerzahl passen (Katalogreihenfolge). */
export function suggestGames(catalog: readonly GameManifest[], players: number): string[] {
  const n = Math.max(1, players);
  const fitting = catalog.filter((g) => g.minPlayers <= n && g.maxPlayers >= Math.min(n, 2));
  return (fitting.length >= 2 ? fitting : catalog).slice(0, 5).map((g) => g.id);
}
