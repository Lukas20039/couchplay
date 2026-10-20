// Serverseitige Spielmodul-Schnittstelle. Spiellogik ist server-authoritative:
// Handys senden nur Eingaben (game.input), der Server berechnet den Zustand
// und verteilt ihn über ctx.broadcastTv / ctx.sendToPlayer.
import {
  GameManifestSchema,
  defaultSettings,
  validateSettings,
  type AvatarId,
  type GameManifest,
  type GameResults,
  type PlayerId,
  type RankingEntry,
  type SettingsValues,
} from "@couchplay/protocol";
import type { z } from "zod";
import type { Rng } from "./rng.js";

/** Teilnehmer eines Spiels (Momentaufnahme bei Spielstart). */
export interface GamePlayer {
  readonly id: PlayerId;
  readonly name: string;
  readonly avatar: AvatarId;
  readonly color: number;
}

export type TimerId = number;

/** Timer, die automatisch bei ctx.end()/Abbruch aufgeräumt werden. */
export interface GameTimers {
  setTimeout(fn: () => void, ms: number): TimerId;
  setInterval(fn: () => void, ms: number): TimerId;
  clear(id: TimerId): void;
  clearAll(): void;
  /**
   * Countdown: ruft onDone nach ms auf. `endsAt` (Clock-Zeit, ms) an den TV
   * schicken, damit er lokal herunterzählen kann.
   */
  countdown(ms: number, onDone: () => void): { id: TimerId; endsAt: number };
}

export interface GameLogger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

/** Ergebnis, das ein Spiel an ctx.end() übergibt (gameId ergänzt der Server). */
export interface GameEndResults {
  ranking: RankingEntry[];
  /** Spielspezifische Daten für Ergebnis-Screens (JSON-serialisierbar). */
  data?: unknown;
}

export interface GameContext<TSettings = SettingsValues, TTvState = unknown, TPlayerView = unknown> {
  readonly gameId: string;
  /** Teilnehmer bei Spielstart, in Beitrittsreihenfolge. Ändert sich nicht. */
  readonly players: readonly GamePlayer[];
  /** Validierte Einstellungen (Defaults ergänzt). */
  readonly settings: TSettings;
  /**
   * Ergebnis der letzten beendeten Runde DESSELBEN Spiels in diesem Raum (oder null).
   * Für Serien-Spielstände bei Revanche: z. B. Siege aus previous.data übernehmen.
   */
  readonly previous: GameResults | null;
  /** Deterministischer RNG – statt Math.random verwenden. */
  readonly rng: Rng;
  readonly timers: GameTimers;
  readonly log: GameLogger;
  /** Aktuelle Zeit der Spiel-Uhr (ms). Statt Date.now() verwenden. */
  now(): number;
  /** Spieler ist noch Teilnehmer (nicht verlassen/entfernt). */
  isActive(playerId: PlayerId): boolean;
  /** Spieler hat gerade eine Verbindung (false während Reconnect-Gnadenfrist). */
  isConnected(playerId: PlayerId): boolean;
  /** IDs der noch aktiven Teilnehmer. */
  activePlayerIds(): PlayerId[];
  /** Kompletten TV-Zustand senden (ersetzt den vorherigen; Server cached ihn für Reconnects). */
  broadcastTv(state: TTvState): void;
  /** Private Ansicht für einen Spieler (ersetzt die vorherige; wird gecached). */
  sendToPlayer(playerId: PlayerId, view: TPlayerView): void;
  /** Komfort: für jeden aktiven Spieler eine eigene Ansicht berechnen und senden. */
  sendToAllPlayers(viewFor: (player: GamePlayer) => TPlayerView): void;
  /** Spiel beenden → Raumphase "results". Danach sind alle ctx-Aufrufe wirkungslos. */
  end(results: GameEndResults): void;
  /** true nach end() oder Abbruch. */
  readonly ended: boolean;
}

export interface GameInstance<TInput = unknown> {
  /** Validierte Eingabe eines aktiven Teilnehmers. */
  onPlayerInput(playerId: PlayerId, input: TInput): void;
  /** Teilnehmer hat das Spiel endgültig verlassen (room.leave, kick, Gnadenfrist abgelaufen). */
  onPlayerLeave(playerId: PlayerId): void;
  /** Optional: Verbindungsstatus geändert (z. B. Spiel pausieren). Letzte Ansichten sendet der Server selbst neu. */
  onPlayerConnectionChange?(playerId: PlayerId, connected: boolean): void;
  /** Optional: periodischer Tick, wenn GameDefinition.tickIntervalMs gesetzt ist. */
  tick?(dtMs: number): void;
  /** Optional: Aufräumen bei end()/Abbruch (Timer räumt das SDK selbst auf). */
  dispose?(): void;
}

export interface GameDefinition<
  TSettings = SettingsValues,
  TInput = unknown,
  TTvState = unknown,
  TPlayerView = unknown,
> {
  /** Inhalt von manifest.json, validiert. */
  readonly manifest: GameManifest;
  /** Schema für game.input.data. Ungültige Eingaben → Fehler INVALID_INPUT, Spiel sieht sie nie. */
  readonly inputSchema: z.ZodType<TInput>;
  /**
   * Optional: wandelt die (gegen manifest.settings validierten) Rohwerte in den
   * Settings-Typ des Spiels. Standard: unveränderte Übernahme.
   */
  readonly parseSettings?: (values: SettingsValues) => TSettings;
  /** Optional: Tick-Intervall in ms (z. B. 100 für Echtzeitspiele). Rundenspiele nutzen Timer. */
  readonly tickIntervalMs?: number;
  /** Neue Spielinstanz für eine Runde. Darf ctx sofort benutzen (broadcastTv etc.). */
  createGame(ctx: GameContext<TSettings, TTvState, TPlayerView>): GameInstance<TInput>;
}

/** Typneutrale Form für Registries (Server-Katalog). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any, any>;

/**
 * Definiert ein Spiel und validiert das Manifest sofort (Fehler beim Laden statt zur Laufzeit).
 * Beispiel: `export default defineGame({ manifest, inputSchema, createGame(ctx) { ... } })`
 */
export function defineGame<TSettings = SettingsValues, TInput = unknown, TTvState = unknown, TPlayerView = unknown>(
  def: Omit<GameDefinition<TSettings, TInput, TTvState, TPlayerView>, "manifest"> & { manifest: unknown },
): GameDefinition<TSettings, TInput, TTvState, TPlayerView> {
  const manifest = GameManifestSchema.parse(def.manifest);
  const check = validateSettings(manifest.settings, defaultSettings(manifest.settings));
  if (!check.ok) {
    throw new Error(`Spiel ${manifest.id}: ungültige Default-Settings: ${JSON.stringify(check.errors)}`);
  }
  return { ...def, manifest };
}
