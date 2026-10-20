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

  const clearAll = (): void => {
    for (const handle of timers.values()) clock.clearTimeout(handle);
    timers.clear();
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
          guard(fn);
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
    },
    clearAll,
    countdown(ms, onDone) {
      return { id: gameTimers.setTimeout(onDone, ms), endsAt: clock.now() + ms };
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
    abort() {
      finish();
    },
  };
}
