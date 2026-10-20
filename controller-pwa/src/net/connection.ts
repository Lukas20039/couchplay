// WebSocket-Verbindung des Controllers inkl. Handshake (room.join / room.rejoin),
// automatischem Reconnect mit Backoff, Lebendigkeitsprüfung (iOS lässt tote Sockets
// gern minutenlang „offen“) und Uhr-Offset aus pong.serverTime.
//
// Zustände:
//   idle ──join()──▶ connecting ──room.joined──▶ joined ──Abbruch──▶ reconnecting
//     ▲                 │ Fehler/Abbruch                ▲                │
//     └─────────────────┘                               └──room.joined───┘
//   joined/reconnecting ──room.closed / Close 4001–4004 / SESSION_INVALIDATING_CODES──▶ closed
//
// Alle Abhängigkeiten (WebSocket, Timer, Zufall, Speicher) sind injizierbar → Tests ohne Netz.
import type { ClientMessage, RoomClosedReason, ServerMessage } from "@couchplay/protocol";
import { PROTOCOL_VERSION, WS_CLOSE, type AvatarId } from "@couchplay/protocol/constants";
import { SESSION_INVALIDATING_CODES, type ErrorCode } from "@couchplay/protocol/errors";
import { reconnectDelayMs } from "@couchplay/protocol/util";
import type { PlayerSession } from "../lib/storage.js";

export type ConnStatus = "idle" | "connecting" | "joined" | "reconnecting" | "closed";

/** Warum die Sitzung endgültig vorbei ist (→ Meldung auf der Startseite). */
export type EndReason = RoomClosedReason | "expired" | "replaced" | "version";

/** Teilmenge der Browser-WebSocket-API, die wir nutzen (für Mocks). */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}
export type WebSocketFactory = (url: string) => WebSocketLike;

export interface ConnectionEvents {
  /** Jede gültige Servernachricht (nach interner Verarbeitung). */
  message(msg: ServerMessage): void;
  status(status: ConnStatus): void;
  /** room.join wurde abgelehnt (Code bleibt auf der Join-Seite sichtbar). */
  joinError(code: ErrorCode | "connect"): void;
  /** Sitzung endgültig beendet. */
  ended(reason: EndReason): void;
}

export interface ConnectionDeps {
  url: string;
  createSocket: WebSocketFactory;
  events: ConnectionEvents;
  loadSession(): PlayerSession | null;
  saveSession(s: PlayerSession | null): void;
  now?: () => number;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

const OPEN = 1;
/** Ohne Verbindungsaufbau bis hierhin gilt der Versuch als gescheitert. */
export const CONNECT_TIMEOUT_MS = 8_000;
/** Antwortet der Server so lange nicht auf ping, wird neu verbunden. */
export const LIVENESS_TIMEOUT_MS = 4_000;
/** Regelmäßiger Ping (Uhr-Offset + tote Verbindungen erkennen). */
export const PING_INTERVAL_MS = 20_000;
/** room.leave: so lange auf room.closed warten, dann lokal beenden. */
export const LEAVE_TIMEOUT_MS = 2_000;

type Mode = { kind: "join"; code: string; name: string; avatar: AvatarId } | { kind: "rejoin"; session: PlayerSession };

/** Dekodiert eine Servernachricht ohne zod (Bundle klein; der Server ist die Autorität). */
export function decodeServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    const v = JSON.parse(data) as unknown;
    if (typeof v === "object" && v !== null && typeof (v as { t?: unknown }).t === "string") return v as ServerMessage;
  } catch {
    // ignorieren
  }
  return null;
}

export class Connection {
  private status: ConnStatus = "idle";
  private ws: WebSocketLike | null = null;
  private mode: Mode | null = null;
  private attempt = 0;
  private reconnectTimer: unknown = null;
  private connectTimer: unknown = null;
  private livenessTimer: unknown = null;
  private pingTimer: unknown = null;
  private leaveTimer: unknown = null;
  private closedReason: RoomClosedReason | null = null;
  private offset = 0;
  private ridCounter = 0;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;

  constructor(private readonly deps: ConnectionDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.random = deps.random ?? Math.random;
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  }

  getStatus(): ConnStatus {
    return this.status;
  }

  /** Geschätzte Serverzeit (ms). */
  serverNow(): number {
    return this.now() + this.offset;
  }

  /** Neuer Beitritt per Code/Name/Avatar. */
  join(code: string, name: string, avatar: AvatarId): void {
    this.teardown();
    this.mode = { kind: "join", code, name, avatar };
    this.attempt = 0;
    this.setStatus("connecting");
    this.open();
  }

  /** Gespeicherte Sitzung wieder aufnehmen (App-Start, Reload). */
  resume(session: PlayerSession): void {
    this.teardown();
    this.mode = { kind: "rejoin", session };
    this.attempt = 0;
    this.setStatus("reconnecting");
    this.open();
  }

  /** Nachricht senden (nur nach erfolgreichem Handshake). */
  send(msg: ClientMessage): boolean {
    if (this.status !== "joined" || !this.ws || this.ws.readyState !== OPEN) return false;
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  /** Raum endgültig verlassen. */
  leave(): void {
    if (this.send({ t: "room.leave" })) {
      this.leaveTimer = this.setTimer(() => this.end("left", true), LEAVE_TIMEOUT_MS);
    } else {
      this.end("left", true);
    }
  }

  /** Wartende Wiederverbindung abbrechen und Sitzung verwerfen (Nutzer will anderen Code). */
  abandon(): void {
    this.teardown();
    this.deps.saveSession(null);
    this.mode = null;
    this.setStatus("idle");
  }

  /**
   * Nach visibilitychange/pageshow/online: Verbindung prüfen. Geschlossene Sockets
   * sofort neu aufbauen, offene per ping prüfen (iOS-bfcache / Standby).
   */
  checkAlive(): void {
    if (this.status === "reconnecting") {
      if (!this.ws || this.ws.readyState !== OPEN) this.reconnectNow();
      return;
    }
    if (this.status !== "joined") return;
    if (!this.ws || this.ws.readyState !== OPEN) {
      this.reconnectNow();
      return;
    }
    this.probe();
  }

  // -------------------------------------------------------------------------

  private setStatus(s: ConnStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.deps.events.status(s);
  }

  private open(): void {
    const mode = this.mode;
    if (!mode) return;
    let ws: WebSocketLike;
    try {
      ws = this.deps.createSocket(this.deps.url);
    } catch {
      this.onSocketGone(1006);
      return;
    }
    this.ws = ws;
    this.connectTimer = this.setTimer(() => {
      if (this.ws === ws && ws.readyState !== OPEN) this.dropSocket(ws);
    }, CONNECT_TIMEOUT_MS);
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.clear("connectTimer");
      const rid = `h${++this.ridCounter}`;
      const hs: ClientMessage =
        mode.kind === "join"
          ? { t: "room.join", v: PROTOCOL_VERSION, code: mode.code, name: mode.name, avatar: mode.avatar, rid }
          : {
              t: "room.rejoin",
              v: PROTOCOL_VERSION,
              code: mode.session.code,
              playerId: mode.session.playerId,
              token: mode.session.token,
              rid,
            };
      ws.send(JSON.stringify(hs));
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      const msg = decodeServerMessage(ev.data);
      if (msg) this.onMessage(msg);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.onSocketGone(ev.code);
    };
    ws.onerror = () => {
      // close folgt
    };
  }

  private onMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case "room.joined": {
        const session = { code: msg.code, playerId: msg.playerId, token: msg.token };
        this.deps.saveSession(session);
        this.mode = { kind: "rejoin", session };
        this.attempt = 0;
        this.closedReason = null;
        this.setStatus("joined");
        this.deps.events.message(msg);
        this.startPing();
        return;
      }
      case "pong": {
        this.clear("livenessTimer");
        if (msg.ts !== undefined) {
          const rtt = this.now() - msg.ts;
          if (rtt >= 0 && rtt < 10_000) this.offset = msg.serverTime + rtt / 2 - this.now();
        }
        this.deps.events.message(msg);
        return;
      }
      case "room.closed":
        this.closedReason = msg.reason;
        this.end(msg.reason, true);
        return;
      case "error":
        if (this.status !== "joined") {
          this.onHandshakeError(msg.code, msg.retryAfterMs);
          return;
        }
        this.deps.events.message(msg);
        return;
      default:
        if (this.status === "joined") this.deps.events.message(msg);
    }
  }

  private onHandshakeError(code: ErrorCode, retryAfterMs: number | undefined): void {
    const mode = this.mode;
    if (code === "VERSION_MISMATCH") {
      this.end("version", true);
      return;
    }
    if (mode?.kind === "join") {
      // Join abgelehnt: Verbindung schließen, Nutzer korrigiert Code/Name.
      this.teardown();
      this.mode = null;
      this.setStatus("idle");
      this.deps.events.joinError(code);
      return;
    }
    if (SESSION_INVALIDATING_CODES.includes(code)) {
      this.end("expired", true);
      return;
    }
    // Vorübergehend (RATE_LIMITED, INTERNAL, …): später erneut versuchen.
    if (this.ws) this.detach(this.ws);
    this.setStatus("reconnecting");
    this.schedule(retryAfterMs ?? reconnectDelayMs(this.attempt++, this.random));
  }

  private onSocketGone(code: number): void {
    this.clear("connectTimer");
    this.clear("livenessTimer");
    this.clear("pingTimer");
    if (this.status === "idle" || this.status === "closed") return;
    switch (code) {
      case WS_CLOSE.VERSION_MISMATCH:
        this.end("version", true);
        return;
      case WS_CLOSE.SESSION_REPLACED:
        // Gleiches Token in anderem Tab/Gerät aktiv – Sitzung dort weiterspielen lassen.
        this.end("replaced", false);
        return;
      case WS_CLOSE.KICKED:
        this.end("kicked", true);
        return;
      case WS_CLOSE.ROOM_CLOSED:
        this.end(this.closedReason ?? "expired", true);
        return;
    }
    if (this.status === "connecting") {
      // Erstbeitritt gescheitert (Server nicht erreichbar) – kein Endlos-Retry.
      this.mode = null;
      this.setStatus("idle");
      this.deps.events.joinError("connect");
      return;
    }
    this.setStatus("reconnecting");
    this.schedule(reconnectDelayMs(this.attempt++, this.random));
  }

  private schedule(ms: number): void {
    this.clear("reconnectTimer");
    this.reconnectTimer = this.setTimer(() => {
      this.reconnectTimer = null;
      this.open();
    }, ms);
  }

  private reconnectNow(): void {
    this.clear("reconnectTimer");
    if (this.ws) this.detach(this.ws);
    this.attempt = 0;
    this.setStatus("reconnecting");
    this.open();
  }

  private probe(): void {
    if (this.livenessTimer !== null) return;
    if (!this.sendRaw({ t: "ping", ts: this.now() })) {
      this.reconnectNow();
      return;
    }
    this.livenessTimer = this.setTimer(() => {
      this.livenessTimer = null;
      if (this.status === "joined") this.reconnectNow();
    }, LIVENESS_TIMEOUT_MS);
  }

  private startPing(): void {
    this.clear("pingTimer");
    this.probe();
    const tick = (): void => {
      this.pingTimer = this.setTimer(() => {
        if (this.status !== "joined") return;
        this.probe();
        tick();
      }, PING_INTERVAL_MS);
    };
    tick();
  }

  private sendRaw(msg: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== OPEN) return false;
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  private end(reason: EndReason, clearSession: boolean): void {
    this.teardown();
    if (clearSession) this.deps.saveSession(null);
    this.mode = null;
    this.setStatus("closed");
    this.deps.events.ended(reason);
  }

  /** Socket verwerfen, ohne dass seine Events noch wirken; Status bleibt. */
  private detach(ws: WebSocketLike): void {
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try {
      ws.close(WS_CLOSE.NORMAL);
    } catch {
      // ignorieren
    }
    if (this.ws === ws) this.ws = null;
    this.clear("connectTimer");
    this.clear("livenessTimer");
    this.clear("pingTimer");
  }

  /** Socket hängt (Connect-Timeout): wie einen Abbruch behandeln. */
  private dropSocket(ws: WebSocketLike): void {
    this.detach(ws);
    this.onSocketGone(1006);
  }

  private teardown(): void {
    for (const k of ["reconnectTimer", "connectTimer", "livenessTimer", "pingTimer", "leaveTimer"] as const) this.clear(k);
    if (this.ws) this.detach(this.ws);
  }

  private clear(key: "reconnectTimer" | "connectTimer" | "livenessTimer" | "pingTimer" | "leaveTimer"): void {
    if (this[key] !== null) {
      this.clearTimer(this[key]);
      this[key] = null;
    }
  }
}
