// Teilnehmerauswahl beim Spielstart (lobby.start) und Zuschauer-Erkennung.
// Server MUSS resolveParticipants verwenden; Clients nutzen isSpectator.
import type { Player, PlayerId, RoomState } from "./common.js";
import type { ErrorCode } from "./errors.js";

export type ParticipantsResult =
  | { ok: true; playerIds: PlayerId[] }
  | { ok: false; code: Extract<ErrorCode, "PLAYER_COUNT" | "PLAYER_NOT_FOUND" | "PLAYER_NOT_CONNECTED" | "BAD_MESSAGE">; message: string };

/**
 * Ermittelt die Teilnehmer einer Runde.
 * - `requested` gesetzt: genau diese IDs (Reihenfolge bleibt), alle müssen existieren,
 *   verbunden und eindeutig sein; Anzahl in [min, max].
 * - `requested` fehlt: alle verbundenen Spieler in Beitrittsreihenfolge (= Reihenfolge
 *   von `players`), gekappt auf max; Anzahl ≥ min.
 */
export function resolveParticipants(
  players: readonly Player[],
  limits: { minPlayers: number; maxPlayers: number },
  requested?: readonly PlayerId[],
): ParticipantsResult {
  const { minPlayers, maxPlayers } = limits;
  let ids: PlayerId[];
  if (requested === undefined) {
    ids = players.filter((p) => p.connected).slice(0, maxPlayers).map((p) => p.id);
  } else {
    if (new Set(requested).size !== requested.length) {
      return { ok: false, code: "BAD_MESSAGE", message: "Doppelte Spieler-IDs" };
    }
    const byId = new Map(players.map((p) => [p.id, p]));
    for (const id of requested) {
      const p = byId.get(id);
      if (!p) return { ok: false, code: "PLAYER_NOT_FOUND", message: `Spieler ${id} unbekannt` };
      if (!p.connected) return { ok: false, code: "PLAYER_NOT_CONNECTED", message: `Spieler ${id} ist getrennt` };
    }
    ids = [...requested];
  }
  if (ids.length < minPlayers || ids.length > maxPlayers) {
    return { ok: false, code: "PLAYER_COUNT", message: `${ids.length} Spieler, erlaubt ${minPlayers}–${maxPlayers}` };
  }
  return { ok: true, playerIds: ids };
}

/** true, wenn der Spieler in der laufenden Runde nur zuschaut (Phase "game", kein Teilnehmer). */
export function isSpectator(room: Pick<RoomState, "phase" | "gamePlayerIds">, playerId: PlayerId): boolean {
  return room.phase === "game" && !room.gamePlayerIds.includes(playerId);
}
