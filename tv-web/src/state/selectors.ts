// Abgeleitete Werte für die Lobby (rein, getestet in test/selectors.test.ts).
import type { GameManifest, Player, RoomState } from "@couchplay/protocol";

export type StartCheck =
  /** Kein Spiel gewählt. */
  | { kind: "noGame" }
  /** Zu wenige verbundene Spieler. */
  | { kind: "tooFew"; missing: number; min: number }
  /** Alle verbundenen Spieler spielen mit → direkt starten (ohne playerIds). */
  | { kind: "ready"; count: number }
  /** Mehr verbundene Spieler als erlaubt → Teilnehmerauswahl. */
  | { kind: "choose"; max: number; min: number; connected: number };

export function selectedGame(room: RoomState | null, catalog: readonly GameManifest[]): GameManifest | null {
  if (!room?.selectedGameId) return null;
  return catalog.find((g) => g.id === room.selectedGameId) ?? null;
}

export function connectedPlayers(room: RoomState | null): Player[] {
  return room ? room.players.filter((p) => p.connected) : [];
}

/** Ob/wie gestartet werden kann. Grenzen aus room.playerLimits, sonst aus dem Manifest. */
export function startCheck(room: RoomState | null, catalog: readonly GameManifest[]): StartCheck {
  const game = selectedGame(room, catalog);
  if (!room || !room.selectedGameId) return { kind: "noGame" };
  const min = room.playerLimits?.minPlayers ?? game?.minPlayers ?? 1;
  const max = room.playerLimits?.maxPlayers ?? game?.maxPlayers ?? 8;
  const connected = connectedPlayers(room).length;
  if (connected < min) return { kind: "tooFew", missing: min - connected, min };
  if (connected > max) return { kind: "choose", max, min, connected };
  return { kind: "ready", count: connected };
}

/**
 * Vorauswahl für die Teilnehmerauswahl: Teilnehmer der letzten Runde (falls noch
 * verbunden), aufgefüllt in Beitrittsreihenfolge, gekappt auf max.
 */
export function defaultSelection(room: RoomState, max: number): string[] {
  const connected = connectedPlayers(room);
  const ids = new Set(connected.map((p) => p.id));
  const picked = room.gamePlayerIds.filter((id) => ids.has(id)).slice(0, max);
  for (const p of connected) {
    if (picked.length >= max) break;
    if (!picked.includes(p.id)) picked.push(p.id);
  }
  return picked;
}

/** Auswahl umschalten; über max wird nicht hinzugefügt. Reihenfolge = Beitrittsreihenfolge. */
export function toggleSelection(room: RoomState, selection: readonly string[], id: string, max: number): string[] {
  const has = selection.includes(id);
  if (!has && selection.length >= max) return [...selection];
  const next = has ? selection.filter((x) => x !== id) : [...selection, id];
  const order = room.players.map((p) => p.id);
  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/**
 * Teilnehmer für „Nochmal“ (Revanche): dieselben wie zuletzt, wenn alle noch
 * verbunden sind und die Anzahl passt; sonst undefined (Server wählt nach Regel).
 */
export function rematchPlayerIds(room: RoomState): string[] | undefined {
  const connected = new Set(connectedPlayers(room).map((p) => p.id));
  const ids = room.gamePlayerIds;
  if (ids.length === 0 || !ids.every((id) => connected.has(id))) return undefined;
  const lim = room.playerLimits;
  if (lim && (ids.length < lim.minPlayers || ids.length > lim.maxPlayers)) return undefined;
  return [...ids];
}

/** Teilnehmer der laufenden Runde, die gerade getrennt sind. */
export function disconnectedParticipants(room: RoomState | null): Player[] {
  if (!room || room.phase !== "game") return [];
  return room.players.filter((p) => !p.connected && room.gamePlayerIds.includes(p.id));
}
