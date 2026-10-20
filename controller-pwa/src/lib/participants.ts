// Teilnehmerauswahl des Hosts (wenn mehr Spieler verbunden sind als das Spiel erlaubt).
// Regeln des Servers: resolveParticipants in @couchplay/protocol – hier nur UI-Vorauswahl.
import type { Player } from "@couchplay/protocol";

export interface Limits {
  minPlayers: number;
  maxPlayers: number;
}

export function connectedPlayers(players: readonly Player[]): Player[] {
  return players.filter((p) => p.connected);
}

/** Auswahl nötig, wenn mehr verbundene Spieler als maxPlayers. */
export function needsPicker(players: readonly Player[], limits: Limits | null): boolean {
  return !!limits && connectedPlayers(players).length > limits.maxPlayers;
}

/** Vorauswahl = Serververhalten ohne playerIds: die ersten maxPlayers verbundenen. */
export function defaultSelection(players: readonly Player[], limits: Limits): string[] {
  return connectedPlayers(players)
    .slice(0, limits.maxPlayers)
    .map((p) => p.id);
}

/**
 * Hält eine bestehende Auswahl gültig, wenn sich die Spielerliste ändert:
 * Getrennte/entfernte fallen raus, Reihenfolge = Beitrittsreihenfolge.
 */
export function reconcileSelection(selected: readonly string[], players: readonly Player[]): string[] {
  const set = new Set(selected);
  return connectedPlayers(players)
    .filter((p) => set.has(p.id))
    .map((p) => p.id);
}

/** An-/abwählen; über maxPlayers hinaus wird nicht ausgewählt. */
export function toggleSelection(selected: readonly string[], id: string, players: readonly Player[], limits: Limits): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  if (selected.length >= limits.maxPlayers) return [...selected];
  return reconcileSelection([...selected, id], players);
}

export type StartCheck = { ok: true; playerIds?: string[] } | { ok: false; reason: "noGame" | "count" };

/** Darf der Host starten – und mit welchen playerIds? */
export function startCheck(players: readonly Player[], limits: Limits | null, selection: readonly string[]): StartCheck {
  if (!limits) return { ok: false, reason: "noGame" };
  if (needsPicker(players, limits)) {
    const ids = reconcileSelection(selection, players);
    return ids.length >= limits.minPlayers && ids.length <= limits.maxPlayers ? { ok: true, playerIds: ids } : { ok: false, reason: "count" };
  }
  const n = connectedPlayers(players).length;
  return n >= limits.minPlayers ? { ok: true } : { ok: false, reason: "count" };
}
