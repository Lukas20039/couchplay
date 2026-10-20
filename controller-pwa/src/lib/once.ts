// Einmal-Aktionen pro Browser-Tab (sessionStorage): Ergebnis-Vibration, Chunk-Reload-Guard.
import type { RoomState } from "@couchplay/protocol";

const RESULTS_PREFIX = "couchplay.player.vibrated.";
const CHUNK_RELOAD_KEY = "couchplay.player.chunkReload";

function storage(): Storage | null {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
}

/** true beim ersten Aufruf mit diesem Schlüssel (pro Tab), danach false. */
export function firstTime(key: string, store: Storage | null = storage()): boolean {
  if (!store) return true;
  try {
    if (store.getItem(key) !== null) return false;
    store.setItem(key, "1");
  } catch {
    // Speicher voll/gesperrt: lieber einmal zu viel als gar nicht.
  }
  return true;
}

/** Schlüssel einer konkreten Runde: Raum + Spiel + Teilnehmer + Ranking. */
export function resultsKey(room: Pick<RoomState, "code" | "gamePlayerIds" | "results">): string {
  const r = room.results;
  const ranking = r ? r.ranking.map((e) => `${e.playerId}:${e.rank}:${e.score}`).join(",") : "";
  return `${RESULTS_PREFIX}${room.code}|${r?.gameId ?? ""}|${room.gamePlayerIds.join(",")}|${ranking}`;
}

/**
 * Nachladen eines Spiel-Chunks ist fehlgeschlagen (typisch: neues Deployment, alter Hash weg).
 * Einmal neu laden – der Guard verhindert Endlosschleifen, falls der Fehler bleibt.
 * Rückgabe: true = Reload ausgelöst.
 */
export function reloadOnceForChunkError(reload: () => void = () => location.reload(), store: Storage | null = storage()): boolean {
  if (!store) return false;
  try {
    if (store.getItem(CHUNK_RELOAD_KEY) !== null) return false;
    store.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  reload();
  return true;
}

/** Nach erfolgreichem Laden eines Chunks: Guard zurücksetzen. */
export function clearChunkReloadGuard(store: Storage | null = storage()): void {
  try {
    store?.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // ignorieren
  }
}
