// WebSocket-Endpoint /ws: Upgrade (Origin, Verbindungen/IP), Heartbeat, Handshake-Timeout,
// Rate-Limits, Parsen (parseClientMessage) → CLIENT_MESSAGE_RULES → Handler im Raum.
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import {
  CLIENT_MESSAGE_RULES,
  PROTOCOL_VERSION,
  WS_CLOSE,
  WS_PATH,
  errorMessage,
  isHandshakeMessage,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type HandshakeMessage,
  type ServerMessage,
} from "@couchplay/protocol";
import type { FastifyBaseLogger } from "fastify";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import type { GameCatalog } from "../catalog.js";
import type { ServerConfig } from "../config.js";
import type { ServerLimits } from "../options.js";
import { ipKey } from "../net.js";
import { FailureBackoff, KeyedRateLimiter, TokenBucket } from "../rate-limit.js";
import type { RoomManager } from "../rooms/manager.js";
import type { Conn, ConnBinding, HandlerResult } from "../rooms/room.js";
import { clientIp, compileTrust, isOriginAllowed, publicBaseUrl, untrustedXffWarner, type TrustFn } from "./request-info.js";

let nextConnId = 1;

class Connection implements Conn {
  readonly id = nextConnId++;
  readonly ipKey: string;
  binding: ConnBinding | null = null;
  /** Letztes Lebenszeichen – NUR Pong-Frames zählen (ein nur sendender, nicht lesender Client fliegt). */
  lastSeen = Date.now();
  strikes = 0;
  handshakeTimer: NodeJS.Timeout | null = null;
  private killTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly ws: WebSocket,
    readonly ip: string,
    readonly req: IncomingMessage,
    readonly bucket: TokenBucket,
    readonly updateBucket: TokenBucket,
    private readonly closeGraceMs: number,
    private readonly maxBufferedBytes: number,
    private readonly onOverflow: (conn: Connection) => void,
  ) {
    this.ipKey = ipKey(ip);
  }

  /** Backpressure: liest der Client nicht und staut sich der Puffer, wird getrennt statt weiter gepuffert. */
  send(msg: ServerMessage): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    if (this.ws.bufferedAmount > this.maxBufferedBytes) {
      this.onOverflow(this);
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  close(code: number, reason: string): void {
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
    this.handshakeTimer = null;
    if (this.ws.readyState === WebSocket.CLOSED) return;
    if (this.ws.readyState !== WebSocket.CLOSING) this.ws.close(code, reason);
    // Antwortet der Client nicht auf den Close-Frame: hart trennen.
    if (!this.killTimer) {
      this.killTimer = setTimeout(() => this.ws.terminate(), this.closeGraceMs);
      this.killTimer.unref();
    }
  }

  clearTimers(): void {
    if (this.handshakeTimer) clearTimeout(this.handshakeTimer);
    if (this.killTimer) clearTimeout(this.killTimer);
    this.handshakeTimer = null;
    this.killTimer = null;
  }
}

export interface GatewayDeps {
  config: ServerConfig;
  limits: ServerLimits;
  rooms: RoomManager;
  catalog: GameCatalog;
  log: FastifyBaseLogger;
  /** Gemeinsamer „X-Forwarded-For trotz TRUST_PROXY=false"-Warner (einmalig pro Prozess). */
  warnXff?: (req: IncomingMessage) => void;
}

export class Gateway {
  private readonly wss: WebSocketServer;
  private readonly conns = new Set<Connection>();
  private readonly perIp = new Map<string, number>();
  private readonly joinLimiter: KeyedRateLimiter;
  private readonly createLimiter: KeyedRateLimiter;
  private readonly failures: FailureBackoff;
  private readonly globalFailures: TokenBucket;
  /** Bis wann IPs mit Fehlversuchen komplett gesperrt sind (globaler Fehlversuchs-Bucket leer). */
  private lockdownUntil = 0;
  private readonly trust: TrustFn;
  private readonly warnXff: (req: IncomingMessage) => void;
  private heartbeat: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(private readonly deps: GatewayDeps) {
    this.trust = compileTrust(deps.config.trustProxy);
    this.joinLimiter = new KeyedRateLimiter(deps.limits.joinRate);
    this.createLimiter = new KeyedRateLimiter(deps.limits.createRate);
    this.failures = new FailureBackoff(deps.limits.joinFailureBackoff);
    this.globalFailures = new TokenBucket(deps.limits.globalFailureRate);
    this.warnXff = deps.warnXff ?? untrustedXffWarner(deps.config, deps.log);
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: deps.limits.hardMaxPayloadBytes,
      perMessageDeflate: false,
    });
  }

  get connectionCount(): number {
    return this.conns.size;
  }

  attach(server: Server): void {
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => this.onUpgrade(req, socket, head));
    this.heartbeat = setInterval(() => this.tickHeartbeat(), this.deps.limits.heartbeatIntervalMs);
    this.heartbeat.unref();
  }

  /** Periodisches Aufräumen der IP-Buckets. */
  sweep(): void {
    this.joinLimiter.sweep();
    this.createLimiter.sweep();
    this.failures.sweep();
  }

  // -------------------------------------------------------------------------
  // Upgrade
  // -------------------------------------------------------------------------

  private reject(socket: Duplex, status: number, text: string): void {
    socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  private onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    socket.on("error", () => socket.destroy());
    let pathname: string;
    try {
      pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    } catch {
      return this.reject(socket, 400, "Bad Request");
    }
    if (pathname !== WS_PATH) return this.reject(socket, 404, "Not Found");
    if (this.shuttingDown) return this.reject(socket, 503, "Service Unavailable");
    const { config, limits, log } = this.deps;
    if (!isOriginAllowed(config, req, this.trust)) {
      log.warn({ origin: req.headers.origin }, "WS-Upgrade: Origin abgelehnt");
      return this.reject(socket, 403, "Forbidden");
    }
    this.warnXff(req);
    const ip = clientIp(req, this.trust);
    const key = ipKey(ip);
    const count = this.perIp.get(key) ?? 0;
    if (count >= limits.maxConnectionsPerIp) {
      log.warn({ ip: key }, "WS-Upgrade: zu viele Verbindungen pro IP");
      return this.reject(socket, 429, "Too Many Requests");
    }
    this.perIp.set(key, count + 1);
    let accepted = false;
    socket.once("close", () => {
      if (!accepted) this.releaseIp(key);
    });
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      accepted = true;
      this.onConnection(ws, req, ip);
    });
  }

  private releaseIp(key: string): void {
    const n = (this.perIp.get(key) ?? 1) - 1;
    if (n <= 0) this.perIp.delete(key);
    else this.perIp.set(key, n);
  }

  private onConnection(ws: WebSocket, req: IncomingMessage, ip: string): void {
    const { limits } = this.deps;
    const conn = new Connection(
      ws,
      ip,
      req,
      new TokenBucket(limits.messageRate),
      new TokenBucket(limits.playerUpdateRate),
      limits.shutdownGraceMs,
      limits.maxBufferedBytes,
      (c) => {
        this.deps.log.warn({ ip: c.ipKey, buffered: c.ws.bufferedAmount }, "Client liest nicht (Sendepuffer voll) – Verbindung getrennt");
        c.ws.terminate();
      },
    );
    this.conns.add(conn);
    if (this.shuttingDown) {
      conn.close(1001, "server_shutdown");
    }
    conn.handshakeTimer = setTimeout(() => {
      conn.handshakeTimer = null;
      if (!conn.binding) conn.close(WS_CLOSE.HANDSHAKE_TIMEOUT, "handshake_timeout");
    }, limits.handshakeTimeoutMs);
    conn.handshakeTimer.unref();

    ws.on("pong", () => {
      conn.lastSeen = Date.now();
    });
    ws.on("message", (data: RawData) => {
      try {
        this.onMessage(conn, data);
      } catch (err) {
        this.deps.log.error({ err }, "Unerwarteter Fehler bei der Nachrichtenverarbeitung");
        conn.send(errorMessage("INTERNAL", "Interner Serverfehler"));
      }
    });
    ws.on("error", (err) => {
      this.deps.log.debug({ err }, "WS-Fehler");
    });
    ws.on("close", () => {
      conn.clearTimers();
      this.conns.delete(conn);
      this.releaseIp(conn.ipKey);
      const binding = conn.binding;
      conn.binding = null;
      if (!binding || binding.room.closed) return;
      if (binding.role === "tv") binding.room.tvDisconnected(conn);
      else binding.room.playerDisconnected(conn, binding.playerId);
    });
  }

  private tickHeartbeat(): void {
    const now = Date.now();
    for (const conn of this.conns) {
      if (now - conn.lastSeen > this.deps.limits.heartbeatTimeoutMs) {
        conn.ws.terminate();
      } else if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.ping();
      }
    }
  }

  // -------------------------------------------------------------------------
  // Nachrichten
  // -------------------------------------------------------------------------

  private sendError(
    conn: Conn,
    code: ErrorCode,
    message: string,
    extra: { rid?: string | undefined; fatal?: boolean; retryAfterMs?: number } = {},
  ): void {
    conn.send(errorMessage(code, message, extra));
  }

  private onMessage(conn: Connection, data: RawData): void {
    const { limits } = this.deps;
    // 1. Nachrichten-Rate pro Verbindung.
    const rate = conn.bucket.take();
    if (!rate.ok) {
      conn.strikes++;
      if (conn.strikes >= limits.rateLimitStrikesBeforeClose) {
        this.sendError(conn, "RATE_LIMITED", "Zu viele Nachrichten", { fatal: true, retryAfterMs: rate.retryAfterMs });
        conn.close(WS_CLOSE.RATE_LIMITED, "rate_limited");
      } else {
        this.sendError(conn, "RATE_LIMITED", "Zu viele Nachrichten", { retryAfterMs: rate.retryAfterMs });
      }
      return;
    }
    conn.strikes = 0;

    // 3. Parsen + Schema.
    const parsed = parseClientMessage(data);
    if (!parsed.ok) {
      this.sendError(conn, parsed.code, parsed.message, { rid: parsed.rid });
      return;
    }
    const msg = parsed.msg;
    const rid = "rid" in msg ? msg.rid : undefined;

    // 4. Handshake-Pflicht.
    if (isHandshakeMessage(msg)) {
      if (conn.binding) {
        this.sendError(conn, "ALREADY_IN_ROOM", "Verbindung ist bereits einem Raum zugeordnet", { rid });
        return;
      }
      this.onHandshake(conn, msg);
      return;
    }
    const binding = conn.binding;
    if (!binding) {
      this.sendError(conn, "NOT_IN_ROOM", "Zuerst room.create/resume/join/rejoin senden", { rid });
      return;
    }

    // Inaktivitäts-Uhr des Raums: jede gültige Nachricht außer ping (Keep-alive hält Räume nicht ewig offen).
    const room = binding.room;
    if (msg.t !== "ping") room.touch();

    // 5. Rolle × Phase.
    const rule = CLIENT_MESSAGE_RULES[msg.t];
    if (!rule.actors.includes(room.actorOf(binding))) {
      this.sendError(conn, "NOT_ALLOWED", `${msg.t} ist für diese Rolle nicht erlaubt`, { rid });
      return;
    }
    if (!rule.phases.includes(room.currentPhase)) {
      this.sendError(conn, "INVALID_PHASE", `${msg.t} ist in Phase ${room.currentPhase} nicht möglich`, { rid });
      return;
    }

    // 6. Handler.
    const result = this.dispatch(conn, binding, msg);
    if (result) {
      this.sendError(conn, result.code, result.message, {
        rid,
        ...(result.retryAfterMs !== undefined ? { retryAfterMs: result.retryAfterMs } : {}),
      });
    }
  }

  private dispatch(conn: Connection, binding: ConnBinding, msg: Exclude<ClientMessage, HandshakeMessage>): HandlerResult {
    const room = binding.room;
    const playerId = binding.role === "player" ? binding.playerId : null;
    switch (msg.t) {
      case "ping":
        conn.send({ t: "pong", ...(msg.ts !== undefined ? { ts: msg.ts } : {}), serverTime: Date.now() });
        return undefined;
      case "room.leave":
        return playerId ? room.leave(playerId) : undefined;
      case "room.close":
        room.close("closed_by_tv");
        return undefined;
      case "player.update": {
        const rate = conn.updateBucket.take();
        if (!rate.ok) return { code: "RATE_LIMITED", message: "Zu viele Profiländerungen", retryAfterMs: rate.retryAfterMs };
        return playerId ? room.updatePlayer(playerId, msg.name, msg.avatar) : undefined;
      }
      case "player.progress": {
        const rate = conn.updateBucket.take();
        if (!rate.ok) return { code: "RATE_LIMITED", message: "Zu viele Fortschrittsmeldungen", retryAfterMs: rate.retryAfterMs };
        return playerId ? room.updateProgress(playerId, msg.progress) : undefined;
      }
      case "player.kick":
        return room.kick(msg.playerId);
      case "lobby.selectGame":
        return room.selectGame(msg.gameId);
      case "lobby.updateSettings":
        return room.updateSettings(msg.settings);
      case "lobby.start":
        return room.start(msg.playerIds);
      case "game.input":
        return playerId ? room.input(playerId, msg.data) : undefined;
      case "game.abort":
        return room.abortGame();
      case "room.toLobby":
        return room.toLobby();
    }
  }

  private onHandshake(conn: Connection, msg: HandshakeMessage): void {
    const { rooms, config } = this.deps;
    const rid = msg.rid;
    if (msg.v !== PROTOCOL_VERSION) {
      this.sendError(conn, "VERSION_MISMATCH", `Server spricht Protokoll v${PROTOCOL_VERSION}`, { rid, fatal: true });
      conn.close(WS_CLOSE.VERSION_MISMATCH, "version_mismatch");
      return;
    }

    if (msg.t === "room.create") {
      const limit = this.createLimiter.take(conn.ipKey);
      if (!limit.ok) {
        this.sendError(conn, "RATE_LIMITED", "Zu viele Räume erstellt", { rid, retryAfterMs: limit.retryAfterMs });
        return;
      }
      const room = rooms.create(publicBaseUrl(config, conn.req, this.trust), conn.ipKey);
      if (room === "owner_limit") {
        this.sendError(conn, "RATE_LIMITED", "Zu viele offene Räume von dieser Adresse", {
          rid,
          retryAfterMs: this.deps.limits.orphanRoomTimeoutMs,
        });
        return;
      }
      if (room === "server_full") {
        this.sendError(conn, "SERVER_FULL", "Server ist ausgelastet", { rid });
        return;
      }
      this.handshakeDone(conn);
      room.attachTv(conn, "created", rid);
      return;
    }

    // join / rejoin / resume: Schutz gegen Code-Raten (Schlüssel = IP bzw. IPv6-/64).
    // Bestraft werden nur Fehlversuche (ROOM_NOT_FOUND, TOKEN_INVALID): 5/min frei, danach
    // exponentieller Backoff; bei globaler Häufung Sperrphase für verdächtige IPs.
    // Zusätzlich ein großzügiger Bucket für alle Versuche (60/min) nur gegen Missbrauch.
    const key = conn.ipKey;
    const now = Date.now();
    const backoff = this.failures.check(key);
    if (!backoff.ok) {
      this.sendError(conn, "RATE_LIMITED", "Zu viele Fehlversuche", { rid, retryAfterMs: backoff.retryAfterMs });
      return;
    }
    if (now < this.lockdownUntil && this.failures.isSuspicious(key)) {
      this.sendError(conn, "RATE_LIMITED", "Zu viele Fehlversuche", { rid, retryAfterMs: this.lockdownUntil - now });
      return;
    }
    const limit = this.joinLimiter.take(key);
    if (!limit.ok) {
      this.sendError(conn, "RATE_LIMITED", "Zu viele Beitrittsversuche", { rid, retryAfterMs: limit.retryAfterMs });
      return;
    }
    const room = rooms.get(msg.code);
    if (!room || room.closed) {
      this.failures.recordFailure(key);
      if (!this.globalFailures.take().ok) {
        // Viele Fehlversuche serverweit → wahrscheinlich verteiltes Code-Raten: kurz alle
        // Adressen mit Fehlversuchen sperren und keine Auskunft mehr geben.
        this.lockdownUntil = now + this.deps.limits.globalLockdownMs;
        this.deps.log.warn("Viele fehlgeschlagene Beitrittsversuche – Sperrphase aktiv");
        this.sendError(conn, "RATE_LIMITED", "Zu viele Fehlversuche", { rid, retryAfterMs: this.deps.limits.globalLockdownMs });
        return;
      }
      this.sendError(conn, "ROOM_NOT_FOUND", "Raum nicht gefunden", { rid });
      return;
    }

    let result: HandlerResult;
    switch (msg.t) {
      case "room.resume":
        if (!room.checkTvToken(msg.tvToken)) {
          result = { code: "TOKEN_INVALID", message: "TV-Token ungültig", fatal: true, closeCode: WS_CLOSE.PROTOCOL_ERROR };
        } else {
          this.handshakeDone(conn);
          room.touch();
          room.attachTv(conn, "resumed", rid);
        }
        break;
      case "room.join":
        result = room.join(conn, msg.name, msg.avatar, rid);
        break;
      case "room.rejoin":
        result = room.rejoin(conn, msg.playerId, msg.token, rid);
        break;
    }
    if (result) {
      if (result.code === "TOKEN_INVALID") this.failures.recordFailure(key);
      this.sendError(conn, result.code, result.message, { rid, ...(result.fatal ? { fatal: true } : {}) });
      if (result.closeCode !== undefined) conn.close(result.closeCode, result.code.toLowerCase());
      return;
    }
    this.handshakeDone(conn);
    room.touch();
  }

  private handshakeDone(conn: Connection): void {
    if (conn.handshakeTimer) clearTimeout(conn.handshakeTimer);
    conn.handshakeTimer = null;
  }

  // -------------------------------------------------------------------------
  // Shutdown
  // -------------------------------------------------------------------------

  /** Neue Upgrades ablehnen, alle Räume schließen (room.closed{server_shutdown}), Sockets schließen. */
  async shutdown(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.deps.rooms.closeAll("server_shutdown");
    for (const conn of this.conns) conn.close(1001, "server_shutdown");
    const deadline = Date.now() + this.deps.limits.shutdownGraceMs;
    while (this.conns.size > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    for (const conn of this.conns) conn.ws.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}
