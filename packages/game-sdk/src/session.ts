// Laufzeit, die eine GameDefinition ausführt. Wird vom Server UND vom Test-Harness
// benutzt, damit sich Spiele in Tests exakt wie in Produktion verhalten.
import type { GameResults, PlayerId, SettingsValues } from "@couchplay/protocol";
import type { Clock, ClockHandle } from "./clock.js";
import type {
  AnyGameDefinition,
  GameContext,
  GameEndResults,
  GameInstance,
  GameLogger,
  GamePlayer,
  GameTimers,
  TimerId,
} from "./definition.js";
import { createRng } from "./rng.js";

/** Wohin die Session ihre Ausgaben schickt (Server: an WS-Clients + Cache). */
export interface GameSessionSink {
  tv(state: unknown): void;
  player(playerId: PlayerId, view: unknown): void;
  /** Spiel regulär beendet. */
  end(results: GameResults): void;
  /** Spielcode hat eine Exception geworfen; Session ist danach beendet. Server → Lobby + Log. */
  crash(error: unknown): void;
  /** Optional: überspringbare Wartezeit geändert (ID für skip() bzw. null = nichts zu überspringen). */
  skippable?(skipId: number | null): void;
}

export interface GameSessionOptions {
  players: readonly GamePlayer[];
  /** Bereits gegen manifest.settings validierte Werte. */
  settings: SettingsValues;
  seed: number;
  clock: Clock;
  /** Letztes Ergebnis desselben Spiels im Raum (Revanche/Serie), sonst weglassen. */
  previous?: GameResults | null;
  sink: GameSessionSink;
  isConnected?: (playerId: PlayerId) => boolean;
  log?: GameLogger;
}

export type InputResult = { ok: true } | { ok: false; code: "INVALID_INPUT" | "NOT_ALLOWED" | "INVALID_PHASE"; message: string };

export interface GameSession {
  readonly gameId: string;
  readonly seed: number;
  readonly ended: boolean;
  /** Rohe game.input-Daten eines Spielers; validiert gegen inputSchema. */
  input(playerId: PlayerId, data: unknown): InputResult;
  /** Spieler endgültig weg (leave/kick/Gnadenfrist). */
  playerLeft(playerId: PlayerId): void;
  connectionChanged(playerId: PlayerId, connected: boolean): void;
  /** Aktuell überspringbare Wartezeit (frühester skippable-Countdown) oder null. */
  readonly skipId: number | null;
  /**
   * Wartezeit sofort beenden (game.skip). Nur wenn `skipId` noch die aktuelle ist – so überspringt
   * ein doppelter Klick nicht gleich die nächste Wartezeit mit. true = übersprungen.
   */
  skip(skipId: number): boolean;
  /** Abbruch von außen (game.abort, Raum geschlossen). Ruft sink.end NICHT auf. */
  abort(): void;
}

const noopLogger: GameLogger = { debug() {}, info() {}, warn() {}, error() {} };

export function createGameSession(def: AnyGameDefinition, opts: GameSessionOptions): GameSession {
  const { clock, sink } = opts;
  const gameId = def.manifest.id;
  const log = opts.log ?? noopLogger;
  const participants = new Set(opts.players.map((p) => p.id));
  const active = new Set(participants);
  const timers = new Map<TimerId, ClockHandle>();
  /** Überspringbare Countdowns: ID → Callback und Fälligkeit. */
  const skippable = new Map<TimerId, { fn: () => void; dueAt: number }>();
  let lastSkipId: number | null = null;
  let timerSeq = 0;
  let ended = false;
  let instance: GameInstance | null = null;

  /** Führt Spielcode aus; Exceptions beenden die Session kontrolliert. */
  const guard = (fn: () => void): void => {
    if (ended) return;
    try {
      fn();
    } catch (error) {
      log.error("Spiel-Exception", { gameId, error: String(error) });
      finish();
      sink.crash(error);
    }
  };

  const currentSkipId = (): number | null => {
    if (ended) return null;
    let best: [TimerId, number] | null = null;
    for (const [id, { dueAt }] of skippable) if (!best || dueAt < best[1]) best = [id, dueAt];
    return best?.[0] ?? null;
  };

  /** Meldet Änderungen der überspringbaren Wartezeit an den Sink. */
  const notifySkip = (): void => {
    const next = currentSkipId();
    if (next === lastSkipId) return;
    lastSkipId = next;
    sink.skippable?.(next);
  };

  const clearAll = (): void => {
    for (const handle of timers.values()) clock.clearTimeout(handle);
    timers.clear();
    skippable.clear();
    notifySkip();
  };

  const finish = (): void => {
    if (ended) return;
    ended = true;
    clearAll();
    try {
      instance?.dispose?.();
    } catch (error) {
      log.warn("dispose() warf Exception", { gameId, error: String(error) });
    }
  };

  const gameTimers: GameTimers = {
    setTimeout(fn, ms) {
      const id = ++timerSeq;
      if (ended) return id;
      timers.set(
        id,
        clock.setTimeout(() => {
          timers.delete(id);
          const wasSkippable = skippable.delete(id);
          guard(fn);
          if (wasSkippable) notifySkip();
        }, ms),
      );
      return id;
    },
    setInterval(fn, ms) {
      const id = ++timerSeq;
      const interval = Math.max(1, ms);
      const schedule = (): void => {
        if (ended) return;
        timers.set(
          id,
          clock.setTimeout(() => {
            schedule();
            guard(fn);
          }, interval),
        );
      };
      schedule();
      return id;
    },
    clear(id) {
      const handle = timers.get(id);
      if (handle !== undefined) clock.clearTimeout(handle);
      timers.delete(id);
      if (skippable.delete(id)) notifySkip();
    },
    clearAll,
    countdown(ms, onDone, opts) {
      const id = gameTimers.setTimeout(onDone, ms);
      const endsAt = clock.now() + ms;
      if (opts?.skippable && !ended) {
        skippable.set(id, { fn: onDone, dueAt: endsAt });
        notifySkip();
      }
      return { id, endsAt };
    },
  };

  const ctx: GameContext<unknown, unknown, unknown> = {
    gameId,
    players: opts.players,
    settings: def.parseSettings ? def.parseSettings(opts.settings) : opts.settings,
    previous: opts.previous ?? null,
    rng: createRng(opts.seed),
    timers: gameTimers,
    log,
    now: () => clock.now(),
    isActive: (id) => active.has(id),
    isConnected: (id) => active.has(id) && (opts.isConnected ? opts.isConnected(id) : true),
    activePlayerIds: () => opts.players.filter((p) => active.has(p.id)).map((p) => p.id),
    broadcastTv(state) {
      if (!ended) sink.tv(state);
    },
    sendToPlayer(id, view) {
      if (!ended && active.has(id)) sink.player(id, view);
    },
    sendToAllPlayers(viewFor) {
      for (const p of opts.players) if (!ended && active.has(p.id)) sink.player(p.id, viewFor(p));
    },
    end(results: GameEndResults) {
      if (ended) return;
      finish();
      sink.end({ gameId, ranking: results.ranking, ...(results.data !== undefined ? { data: results.data } : {}) });
    },
    get ended() {
      return ended;
    },
  };

  guard(() => {
    instance = def.createGame(ctx);
  });

  if (def.tickIntervalMs !== undefined && def.tickIntervalMs > 0) {
    let last = clock.now();
    gameTimers.setInterval(() => {
      const now = clock.now();
      instance?.tick?.(now - last);
      last = now;
    }, def.tickIntervalMs);
  }

  return {
    gameId,
    seed: opts.seed,
    get ended() {
      return ended;
    },
    input(playerId, data) {
      if (ended) return { ok: false, code: "INVALID_PHASE", message: "Spiel ist beendet" };
      if (!active.has(playerId)) return { ok: false, code: "NOT_ALLOWED", message: "Kein Teilnehmer dieses Spiels" };
      const parsed = def.inputSchema.safeParse(data);
      if (!parsed.success) return { ok: false, code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
      guard(() => instance?.onPlayerInput(playerId, parsed.data));
      return { ok: true };
    },
    playerLeft(playerId) {
      if (!active.delete(playerId)) return;
      guard(() => instance?.onPlayerLeave(playerId));
    },
    connectionChanged(playerId, connected) {
      if (!active.has(playerId)) return;
      guard(() => instance?.onPlayerConnectionChange?.(playerId, connected));
    },
    get skipId() {
      return currentSkipId();
    },
    skip(skipId) {
      if (ended || skipId !== currentSkipId()) return false;
      const entry = skippable.get(skipId);
      if (!entry) return false;
      const handle = timers.get(skipId);
      if (handle !== undefined) clock.clearTimeout(handle);
      timers.delete(skipId);
      skippable.delete(skipId);
      guard(entry.fn);
      notifySkip();
      return true;
    },
    abort() {
      finish();
    },
  };
}
