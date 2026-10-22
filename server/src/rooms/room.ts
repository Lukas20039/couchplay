// Ein Raum: Spieler, Host, Phasen, Settings, Reconnect-Gnadenfrist, laufende
// Spielsitzung und Cache der letzten game.tv/game.view (für Reconnects).
// Berechtigungen (Rolle × Phase) prüft das Gateway vorher per CLIENT_MESSAGE_RULES.
import { createGameSession, randomSeed, systemClock, type GameLogger, type GameSession } from "@couchplay/game-sdk";
import {
  MAX_PLAYERS,
  PLAYER_COLOR_COUNT,
  PROTOCOL_VERSION,
  WS_CLOSE,
  defaultSettings,
  nameKey,
  normalizeName,
  relockSettings,
  resolveParticipants,
  validateSettings,
  type Actor,
  type AvatarId,
  type ErrorCode,
  type GameResults,
  type Player,
  type PlayerId,
  type ProgressValues,
  type RoomClosedReason,
  type RoomPhase,
  type RoomState,
  type ServerMessage,
  type ServerMessageOf,
  type SettingsValues,
} from "@couchplay/protocol";
import type { FastifyBaseLogger } from "fastify";
import type { GameCatalog } from "../catalog.js";
import { newPlayerId, newToken, tokensEqual } from "./ids.js";

/** Verbindung aus Sicht des Raums (implementiert vom WS-Gateway). */
export interface Conn {
  readonly id: number;
  /** Schlüssel der Client-IP (IPv4 exakt, IPv6 /64), siehe ipKey(). */
  readonly ipKey: string;
  send(msg: ServerMessage): void;
  /** Schließt die Verbindung; das Gateway ruft danach KEINE Disconnect-Logik mehr auf, wenn binding null ist. */
  close(code: number, reason: string): void;
  binding: ConnBinding | null;
}

export type ConnBinding = { room: Room; role: "tv" } | { room: Room; role: "player"; playerId: PlayerId };

/** Fehler eines Handlers → `error`-Paket an den Absender. */
export interface HandlerError {
  code: ErrorCode;
  message: string;
  fatal?: boolean;
  closeCode?: number;
  retryAfterMs?: number;
}
export type HandlerResult = HandlerError | undefined;

const fail = (code: ErrorCode, message: string, extra: Partial<HandlerError> = {}): HandlerError => ({ code, message, ...extra });

interface PlayerRecord {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: number;
  token: string;
  connected: boolean;
  conn: Conn | null;
  /** Letzte bekannte IP (für Kick-Sperre während der Gnadenfrist). */
  lastIpKey: string;
  graceTimer: NodeJS.Timeout | null;
  /** Zuletzt per player.progress gemeldeter Fortschritt je Spiel. */
  progress: ProgressValues;
}

export interface RoomDeps {
  code: string;
  joinUrl: string;
  catalog: GameCatalog;
  reconnectGraceMs: number;
  /** room.state höchstens alle … ms (Zwischenstände werden zusammengefasst). */
  stateCoalesceMs: number;
  /** IP-Schlüssel des Erstellers (Limit offener Räume pro IP). */
  ownerKey: string;
  log: FastifyBaseLogger;
  onClosed(room: Room): void;
}

export class Room {
  readonly code: string;
  readonly tvToken = newToken();
  readonly joinUrl: string;
  readonly ownerKey: string;
  lastActivity = Date.now();
  /** Seit wann kein Client (TV/Spieler) verbunden ist; null = mindestens einer verbunden. */
  emptySince: number | null = null;
  closed = false;

  private phase: RoomPhase = "lobby";
  private readonly players: PlayerRecord[] = [];
  private hostId: PlayerId | null = null;
  private tv: Conn | null = null;
  /** IP des (zuletzt) verbundenen TVs – bleibt auch nach TV-Trennung bekannt. */
  private tvIpKey: string | null = null;
  private selectedGameId: string | null = null;
  private settings: SettingsValues = {};
  private gamePlayerIds: PlayerId[] = [];
  private results: GameResults | null = null;
  private readonly lastResults = new Map<string, GameResults>();
  private session: GameSession | null = null;
  /** Wird bei Start/Ende/Absturz/Abbruch erhöht; veraltete Sink-Aufrufe werden ignoriert. */
  private run = 0;
  private seq = 0;
  private tvCache: ServerMessageOf<"game.tv"> | null = null;
  private readonly viewCache = new Map<PlayerId, ServerMessageOf<"game.view">>();
  private readonly log: FastifyBaseLogger;
  /** IP-Schlüssel gekickter Spieler (Sperre für die Lebensdauer des Raums). */
  private readonly bannedIps = new Set<string>();
  private stateDirty = false;
  private stateTimer: NodeJS.Timeout | null = null;
  private lastStateAt = 0;

  constructor(private readonly deps: RoomDeps) {
    this.code = deps.code;
    this.joinUrl = deps.joinUrl;
    this.ownerKey = deps.ownerKey;
    this.log = deps.log.child({ room: deps.code });
  }

  // -------------------------------------------------------------------------
  // Abfragen
  // -------------------------------------------------------------------------

  get playerCount(): number {
    return this.players.length;
  }

  get currentPhase(): RoomPhase {
    return this.phase;
  }

  actorOf(binding: ConnBinding): Actor {
    if (binding.role === "tv") return "tv";
    return binding.playerId === this.hostId ? "host" : "player";
  }

  touch(now = Date.now()): void {
    this.lastActivity = now;
  }

  checkTvToken(token: string): boolean {
    return tokensEqual(this.tvToken, token);
  }

  snapshot(): RoomState {
    const def = this.selectedGameId ? this.deps.catalog.get(this.selectedGameId) : undefined;
    return {
      code: this.code,
      phase: this.phase,
      joinUrl: this.joinUrl,
      players: this.players.map(
        (p): Player => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          color: p.color,
          connected: p.connected,
          isHost: p.id === this.hostId,
        }),
      ),
      hostId: this.hostId,
      tvConnected: this.tv !== null,
      selectedGameId: this.selectedGameId,
      playerLimits: def ? { minPlayers: def.manifest.minPlayers, maxPlayers: def.manifest.maxPlayers } : null,
      settings: { ...this.settings },
      gamePlayerIds: [...this.gamePlayerIds],
      results: this.results,
      progress: this.roomProgress(),
    };
  }

  /** Höchster Fortschritt aller Spieler im Raum (auch während der Gnadenfrist) je Spiel. */
  private roomProgress(): ProgressValues {
    const out: ProgressValues = {};
    for (const p of this.players) {
      for (const [gameId, v] of Object.entries(p.progress)) out[gameId] = Math.max(out[gameId] ?? 0, v);
    }
    return out;
  }

  private progressOf(gameId: string): number {
    return this.roomProgress()[gameId] ?? 0;
  }

  /** Nach Fortschrittsverlust (Spieler weg) nicht mehr freigeschaltete Settings zurücksetzen. */
  private relock(): void {
    const def = this.selectedGameId ? this.deps.catalog.get(this.selectedGameId) : undefined;
    if (def) this.settings = relockSettings(def.manifest.settings, this.settings, this.progressOf(def.manifest.id));
  }

  // -------------------------------------------------------------------------
  // Versand
  // -------------------------------------------------------------------------

  private forEachConn(fn: (conn: Conn) => void): void {
    if (this.tv) fn(this.tv);
    for (const p of this.players) if (p.conn) fn(p.conn);
  }

  /**
   * room.state an alle – zusammengefasst: höchstens alle stateCoalesceMs ein Paket
   * (erstes sofort, weitere Änderungen im Fenster als ein nachlaufendes Paket).
   */
  broadcastState(): void {
    if (this.closed) return;
    this.updateEmptySince();
    this.stateDirty = true;
    if (this.stateTimer) return;
    const wait = this.lastStateAt + this.deps.stateCoalesceMs - Date.now();
    if (wait <= 0) {
      this.flushState();
    } else {
      this.stateTimer = setTimeout(() => this.flushState(), wait);
      this.stateTimer.unref();
    }
  }

  /** Ausstehenden room.state sofort senden (vor game.*-Paketen, damit die Reihenfolge stimmt). */
  flushState(): void {
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
    if (!this.stateDirty || this.closed) return;
    this.stateDirty = false;
    this.lastStateAt = Date.now();
    const msg: ServerMessage = { t: "room.state", room: this.snapshot() };
    this.forEachConn((c) => c.send(msg));
  }

  private updateEmptySince(): void {
    const anyone = this.tv !== null || this.players.some((p) => p.connected);
    if (anyone) this.emptySince = null;
    else if (this.emptySince === null) this.emptySince = Date.now();
  }

  /** Handshake-Folge: Antwort → catalog → room.state (an alle) → gecachte Spielansicht. */
  private afterHandshake(conn: Conn, response: ServerMessage, cached: ServerMessage | null | undefined): void {
    conn.send(response);
    conn.send(this.deps.catalog.message);
    this.broadcastState();
    this.flushState();
    if (cached && this.phase === "game") conn.send(cached);
  }

  // -------------------------------------------------------------------------
  // TV
  // -------------------------------------------------------------------------

  /** TV nach room.create bzw. room.resume an den Raum binden. */
  attachTv(conn: Conn, kind: "created" | "resumed", rid: string | undefined): void {
    const old = this.tv;
    if (old && old !== conn) {
      old.binding = null;
      old.close(WS_CLOSE.SESSION_REPLACED, "session_replaced");
    }
    this.tv = conn;
    this.tvIpKey = conn.ipKey;
    conn.binding = { room: this, role: "tv" };
    const response: ServerMessage =
      kind === "created"
        ? { t: "room.created", v: PROTOCOL_VERSION, code: this.code, joinUrl: this.joinUrl, tvToken: this.tvToken, ...(rid ? { rid } : {}) }
        : { t: "room.resumed", v: PROTOCOL_VERSION, code: this.code, joinUrl: this.joinUrl, ...(rid ? { rid } : {}) };
    this.log.info({ kind }, kind === "created" ? "Raum erstellt" : "TV wieder verbunden");
    this.afterHandshake(conn, response, this.tvCache);
  }

  tvDisconnected(conn: Conn): void {
    if (this.tv !== conn) return;
    this.tv = null;
    this.log.info("TV getrennt");
    this.broadcastState();
  }

  // -------------------------------------------------------------------------
  // Spieler: Beitritt, Reconnect, Abgang
  // -------------------------------------------------------------------------

  private isNameTaken(name: string, exceptId?: PlayerId): boolean {
    const key = nameKey(name);
    return this.players.some((p) => p.id !== exceptId && nameKey(p.name) === key);
  }

  private freeColor(): number {
    const used = new Set(this.players.map((p) => p.color));
    for (let c = 0; c < PLAYER_COLOR_COUNT; c++) if (!used.has(c)) return c;
    return 0;
  }

  join(conn: Conn, rawName: string, avatar: AvatarId, rid: string | undefined): HandlerResult {
    const name = normalizeName(rawName);
    if (this.bannedIps.has(conn.ipKey)) return fail("NOT_ALLOWED", "Aus diesem Raum entfernt");
    if (!name.ok) return fail("NAME_INVALID", `Name ungültig (${name.reason})`);
    if (this.players.length >= MAX_PLAYERS) return fail("ROOM_FULL", "Raum ist voll");
    if (this.isNameTaken(name.name)) return fail("NAME_TAKEN", "Name bereits vergeben");

    const player: PlayerRecord = {
      id: newPlayerId(new Set(this.players.map((p) => p.id))),
      name: name.name,
      avatar,
      color: this.freeColor(),
      token: newToken(),
      connected: true,
      conn,
      lastIpKey: conn.ipKey,
      graceTimer: null,
      progress: {},
    };
    this.players.push(player);
    if (this.hostId === null) this.hostId = player.id;
    conn.binding = { room: this, role: "player", playerId: player.id };
    this.log.info({ playerId: player.id }, "Spieler beigetreten");
    // Während einer Runde Beitretende sind Zuschauer → keine gecachte game.view.
    this.afterHandshake(conn, this.joinedMessage(player, rid), null);
    return undefined;
  }

  rejoin(conn: Conn, playerId: PlayerId, token: string, rid: string | undefined): HandlerResult {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || !tokensEqual(player.token, token)) {
      return fail("TOKEN_INVALID", "Sitzung ungültig oder abgelaufen", { fatal: true, closeCode: WS_CLOSE.PROTOCOL_ERROR });
    }
    if (player.conn && player.conn !== conn) {
      const old = player.conn;
      old.binding = null;
      old.close(WS_CLOSE.SESSION_REPLACED, "session_replaced");
    }
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
    const wasConnected = player.connected;
    player.conn = conn;
    player.connected = true;
    player.lastIpKey = conn.ipKey;
    conn.binding = { room: this, role: "player", playerId };
    this.log.info({ playerId }, "Spieler wieder verbunden");
    // Erst Handshake-Folge (room.joined → catalog → room.state → gecachte View), dann das Spiel informieren
    // (das evtl. sofort neue game.*-Pakete sendet).
    this.afterHandshake(conn, this.joinedMessage(player, rid), this.viewCache.get(playerId));
    if (!wasConnected) this.session?.connectionChanged(playerId, true);
    return undefined;
  }

  private joinedMessage(player: PlayerRecord, rid: string | undefined): ServerMessage {
    return { t: "room.joined", v: PROTOCOL_VERSION, code: this.code, playerId: player.id, token: player.token, ...(rid ? { rid } : {}) };
  }

  /** Verbindung eines Spielers abgebrochen → Platz für die Gnadenfrist reservieren. */
  playerDisconnected(conn: Conn, playerId: PlayerId): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.conn !== conn) return;
    player.conn = null;
    player.connected = false;
    player.graceTimer = setTimeout(() => {
      player.graceTimer = null;
      this.log.info({ playerId }, "Gnadenfrist abgelaufen, Spieler entfernt");
      this.removePlayer(playerId);
    }, this.deps.reconnectGraceMs);
    player.graceTimer.unref?.();
    this.log.info({ playerId }, "Spieler getrennt (Platz reserviert)");
    this.session?.connectionChanged(playerId, false);
    this.broadcastState();
  }

  /** Entfernt einen Spieler endgültig (leave, kick, Gnadenfrist). */
  private removePlayer(playerId: PlayerId): void {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx < 0) return;
    const [player] = this.players.splice(idx, 1);
    if (player?.graceTimer) clearTimeout(player.graceTimer);
    this.viewCache.delete(playerId);
    if (this.hostId === playerId) {
      // Am längsten anwesender Spieler (Beitrittsreihenfolge), verbundene bevorzugt.
      const next = this.players.find((p) => p.connected) ?? this.players[0];
      this.hostId = next?.id ?? null;
    }
    if (this.session && this.gamePlayerIds.includes(playerId)) this.session.playerLeft(playerId);
    // Während des Spiels bleiben die gestarteten Settings; beim nächsten Lobby-Wechsel greift relock().
    if (this.phase !== "game") this.relock();
    this.broadcastState();
  }

  leave(playerId: PlayerId): HandlerResult {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return fail("NOT_IN_ROOM", "Nicht im Raum");
    const conn = player.conn;
    player.conn = null;
    if (conn) {
      conn.binding = null;
      conn.send({ t: "room.closed", reason: "left" });
      conn.close(WS_CLOSE.NORMAL, "left");
    }
    this.log.info({ playerId }, "Spieler hat den Raum verlassen");
    this.removePlayer(playerId);
    return undefined;
  }

  kick(targetId: PlayerId): HandlerResult {
    const player = this.players.find((p) => p.id === targetId);
    if (!player) return fail("PLAYER_NOT_FOUND", "Spieler unbekannt");
    const conn = player.conn ?? null;
    // Sperre für die Lebensdauer des Raums: das Reconnect-Token wird mit dem Spieler ungültig;
    // zusätzlich die IP – außer sie ist die des TVs (gleiches Heim-WLAN, sonst wären alle gesperrt).
    const ip = conn?.ipKey ?? player.lastIpKey;
    if (ip && ip !== this.tv?.ipKey && ip !== this.tvIpKey) this.bannedIps.add(ip);
    player.conn = null;
    if (conn) {
      conn.binding = null;
      conn.send({ t: "room.closed", reason: "kicked" });
      conn.close(WS_CLOSE.KICKED, "kicked");
    }
    this.log.info({ playerId: targetId }, "Spieler entfernt (kick)");
    this.removePlayer(targetId);
    return undefined;
  }

  updatePlayer(playerId: PlayerId, rawName: string | undefined, avatar: AvatarId | undefined): HandlerResult {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return fail("NOT_IN_ROOM", "Nicht im Raum");
    let name = player.name;
    if (rawName !== undefined) {
      const n = normalizeName(rawName);
      if (!n.ok) return fail("NAME_INVALID", `Name ungültig (${n.reason})`);
      if (this.isNameTaken(n.name, playerId)) return fail("NAME_TAKEN", "Name bereits vergeben");
      name = n.name;
    }
    const nextAvatar = avatar ?? player.avatar;
    if (name === player.name && nextAvatar === player.avatar) return undefined; // keine Änderung → kein Broadcast
    player.name = name;
    player.avatar = nextAvatar;
    this.broadcastState();
    return undefined;
  }

  /** player.progress: nur Spiele mit progressKey; ersetzt die bisherigen Werte des Spielers. */
  updateProgress(playerId: PlayerId, input: ProgressValues): HandlerResult {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return fail("NOT_IN_ROOM", "Nicht im Raum");
    const next: ProgressValues = {};
    for (const [gameId, v] of Object.entries(input)) {
      if (v > 0 && this.deps.catalog.get(gameId)?.manifest.progressKey) next[gameId] = v;
    }
    const before = JSON.stringify(this.roomProgress());
    player.progress = next;
    if (JSON.stringify(this.roomProgress()) === before) return undefined; // keine Änderung → kein Broadcast
    this.relock();
    this.broadcastState();
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Lobby
  // -------------------------------------------------------------------------

  selectGame(gameId: string): HandlerResult {
    const def = this.deps.catalog.get(gameId);
    if (!def) return fail("GAME_NOT_FOUND", `Spiel ${gameId} unbekannt`);
    this.selectedGameId = gameId;
    this.settings = defaultSettings(def.manifest.settings);
    this.phase = "lobby";
    this.results = null;
    this.broadcastState();
    return undefined;
  }

  updateSettings(input: SettingsValues): HandlerResult {
    const def = this.selectedGameId ? this.deps.catalog.get(this.selectedGameId) : undefined;
    if (!def) return fail("INVALID_SETTINGS", "Kein Spiel ausgewählt");
    const result = validateSettings(def.manifest.settings, input, this.settings, this.progressOf(def.manifest.id));
    if (!result.ok) {
      return fail("INVALID_SETTINGS", result.errors.map((e) => `${e.key}: ${e.message}`).join("; "));
    }
    this.settings = result.settings;
    this.broadcastState();
    return undefined;
  }

  start(requested: readonly PlayerId[] | undefined): HandlerResult {
    const def = this.selectedGameId ? this.deps.catalog.get(this.selectedGameId) : undefined;
    if (!def) return fail("NO_GAME_SELECTED", "Kein Spiel ausgewählt");
    const participants = resolveParticipants(this.snapshot().players, def.manifest, requested);
    if (!participants.ok) return fail(participants.code, participants.message);
    this.relock();

    // parseSettings läuft im SDK außerhalb des Crash-Guards → vorab prüfen, bevor die Phase wechselt.
    try {
      def.parseSettings?.(this.settings);
    } catch (err) {
      this.log.warn({ err, gameId: def.manifest.id }, "parseSettings abgelehnt");
      return fail("INVALID_SETTINGS", "Einstellungen passen nicht zum Spiel");
    }

    const gameId = def.manifest.id;
    const byId = new Map(this.players.map((p) => [p.id, p]));
    const gamePlayers = participants.playerIds.map((id) => {
      const p = byId.get(id) as PlayerRecord;
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color };
    });

    const run = ++this.run;
    this.phase = "game";
    this.gamePlayerIds = participants.playerIds;
    this.results = null;
    this.tvCache = null;
    this.viewCache.clear();
    const seed = randomSeed();
    const gameLog = this.log.child({ gameId, seed });
    gameLog.info({ players: participants.playerIds }, "Spiel gestartet");
    // Erst room.state{phase:"game"}, danach die ersten game.tv/game.view.
    this.broadcastState();

    let session: GameSession;
    try {
      session = createGameSession(def, {
        players: gamePlayers,
        settings: this.settings,
        seed,
        clock: systemClock,
        previous: this.lastResults.get(gameId) ?? null,
        isConnected: (id) => byId.get(id)?.connected === true && this.players.includes(byId.get(id) as PlayerRecord),
        log: toGameLogger(gameLog),
        sink: {
          tv: (state) => {
            if (run !== this.run) return;
            const msg: ServerMessageOf<"game.tv"> = { t: "game.tv", gameId, seq: ++this.seq, state };
            // Serialisierbarkeit früh prüfen: Fehler landen im Guard des SDK (→ crash).
            JSON.stringify(msg);
            this.tvCache = msg;
            this.flushState();
            this.tv?.send(msg);
          },
          player: (playerId, view) => {
            if (run !== this.run) return;
            const msg: ServerMessageOf<"game.view"> = { t: "game.view", gameId, seq: ++this.seq, view };
            JSON.stringify(msg);
            this.viewCache.set(playerId, msg);
            this.flushState();
            this.players.find((p) => p.id === playerId)?.conn?.send(msg);
          },
          end: (results) => {
            if (run !== this.run) return;
            this.finishGame(results, gameLog);
          },
          crash: (error) => {
            if (run !== this.run) return;
            this.crashGame(error, gameLog);
          },
        },
      });
    } catch (error) {
      // Synchrone Exception außerhalb des SDK-Guards: Raum darf nicht ohne Session in "game" hängen.
      if (run === this.run) this.crashGame(error, gameLog);
      return undefined;
    }
    // Spiel kann schon in createGame() beendet worden oder abgestürzt sein.
    if (run === this.run && !session.ended) this.session = session;
    return undefined;
  }

  private resetGameState(): void {
    this.run++;
    this.session = null;
    this.tvCache = null;
    this.viewCache.clear();
    this.relock();
  }

  private finishGame(results: GameResults, log: FastifyBaseLogger): void {
    this.resetGameState();
    this.phase = "results";
    this.results = results;
    this.lastResults.set(results.gameId, results);
    log.info("Spiel beendet");
    this.broadcastState();
  }

  private crashGame(error: unknown, log: FastifyBaseLogger): void {
    this.resetGameState();
    this.phase = "lobby";
    this.results = null;
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, "Spiel abgestürzt – Raum zurück in die Lobby");
    this.flushState();
    const msg: ServerMessage = { t: "error", code: "INTERNAL", message: "Das Spiel wurde wegen eines Fehlers beendet" };
    this.forEachConn((c) => c.send(msg));
    this.broadcastState();
  }

  abortGame(): HandlerResult {
    const session = this.session;
    this.resetGameState();
    session?.abort();
    this.phase = "lobby";
    this.results = null;
    this.log.info("Spiel abgebrochen");
    this.broadcastState();
    return undefined;
  }

  toLobby(): HandlerResult {
    this.phase = "lobby";
    this.results = null;
    this.broadcastState();
    return undefined;
  }

  input(playerId: PlayerId, data: unknown): HandlerResult {
    if (!this.gamePlayerIds.includes(playerId)) return fail("NOT_ALLOWED", "Zuschauer dürfen nicht mitspielen");
    if (!this.session) return fail("INVALID_PHASE", "Kein laufendes Spiel");
    const result = this.session.input(playerId, data);
    return result.ok ? undefined : fail(result.code, result.message);
  }

  // -------------------------------------------------------------------------
  // Schließen
  // -------------------------------------------------------------------------

  close(reason: RoomClosedReason): void {
    if (this.closed) return;
    const session = this.session;
    this.resetGameState();
    session?.abort();
    const msg: ServerMessage = { t: "room.closed", reason };
    const conns: Conn[] = [];
    this.forEachConn((c) => conns.push(c));
    this.closed = true;
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
    for (const p of this.players) {
      if (p.graceTimer) clearTimeout(p.graceTimer);
      p.graceTimer = null;
      p.conn = null;
    }
    this.tv = null;
    for (const c of conns) {
      c.binding = null;
      c.send(msg);
      c.close(WS_CLOSE.ROOM_CLOSED, reason);
    }
    this.log.info({ reason }, "Raum geschlossen");
    this.deps.onClosed(this);
  }
}

function toGameLogger(log: FastifyBaseLogger): GameLogger {
  return {
    debug: (msg, data) => log.debug(data ?? {}, msg),
    info: (msg, data) => log.info(data ?? {}, msg),
    warn: (msg, data) => log.warn(data ?? {}, msg),
    error: (msg, data) => log.error(data ?? {}, msg),
  };
}
