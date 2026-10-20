// Teilnehmerauswahl des Hosts (wenn mehr Spieler verbunden sind als das Spiel erlaubt).
// Regeln des Servers: resolveParticipants in @couchplay/protocol – hier nur die UI-Auswahl.
//
// Solange der Host nichts anfasst, gilt "auto": immer die ersten maxPlayers verbundenen
// Spieler (füllt nach, wenn jemand geht/kommt). Nach dem ersten Antippen "manual": die
// gewählten IDs bleiben gespeichert – auch kurz getrennte Spieler fallen nicht dauerhaft
// heraus, sondern zählen nur, solange sie verbunden sind.
import type { Player } from "@couchplay/protocol";

export interface Limits {
  minPlayers: number;
  maxPlayers: number;
}

export type Selection = { mode: "auto" } | { mode: "manual"; ids: readonly string[] };

export const AUTO: Selection = { mode: "auto" };

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

/** Gewählte und aktuell verbundene IDs in Beitrittsreihenfolge. */
export function reconcileSelection(selected: readonly string[], players: readonly Player[]): string[] {
  const set = new Set(selected);
  return connectedPlayers(players)
    .filter((p) => set.has(p.id))
    .map((p) => p.id);
}

/** Die tatsächlich wirksame Auswahl (verbunden, Beitrittsreihenfolge, höchstens maxPlayers). */
export function effectiveSelection(sel: Selection, players: readonly Player[], limits: Limits): string[] {
  if (sel.mode === "auto") return defaultSelection(players, limits);
  return reconcileSelection(sel.ids, players).slice(0, limits.maxPlayers);
}

/** An-/abwählen (wechselt in "manual"); über maxPlayers hinaus wird nicht ausgewählt. */
export function toggleSelection(sel: Selection, id: string, players: readonly Player[], limits: Limits): Selection {
  const current = effectiveSelection(sel, players, limits);
  const kept = sel.mode === "manual" ? sel.ids : current;
  if (current.includes(id)) return { mode: "manual", ids: kept.filter((x) => x !== id) };
  if (current.length >= limits.maxPlayers) return sel;
  return { mode: "manual", ids: [...kept.filter((x) => x !== id), id] };
}

export type StartCheck = { ok: true; playerIds?: string[] } | { ok: false; reason: "noGame" | "count" };

/** Darf der Host starten – und mit welchen playerIds? */
export function startCheck(players: readonly Player[], limits: Limits | null, sel: Selection): StartCheck {
  if (!limits) return { ok: false, reason: "noGame" };
  if (needsPicker(players, limits)) {
    const ids = effectiveSelection(sel, players, limits);
    return ids.length >= limits.minPlayers ? { ok: true, playerIds: ids } : { ok: false, reason: "count" };
  }
  const n = connectedPlayers(players).length;
  return n >= limits.minPlayers ? { ok: true } : { ok: false, reason: "count" };
}
