// WebSocket-Client des TV: Handshake (create/resume), Reconnect mit Backoff,
// Sitzungsspeicher (localStorage), Uhr-Offset per ping/pong.
//
// Eingehende Nachrichten werden nur leichtgewichtig geprüft (JSON-Objekt mit `t`),
// nicht per zod: der Server ist same-origin und vertrauenswürdig, und zod würde das
// TV-Bundle deutlich vergrößern (siehe README).
import { PROTOCOL_VERSION, STORAGE_KEYS, WS_CLOSE, WS_PATH, MAX_MESSAGE_BYTES } from "@couchplay/protocol/constants";
import { SESSION_INVALIDATING_CODES } from "@couchplay/protocol/errors";
import { reconnectDelayMs } from "@couchplay/protocol/util";
import type { ClientMessage, ServerMessage } from "@couchplay/protocol";
import type { Action } from "../state/store.js";

export interface TvSession {
  code: string;
  tvToken: string;
}

/** Minimal benötigte WebSocket-Schnittstelle (für Tests austauschbar). */
export interface SocketLike {
  readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface ClientDeps {
  url: string;
  dispatch: (action: Action) => void;
  createSocket?: (url: string) => SocketLike;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  now?: () => number;
  random?: () => number;
}

const OPEN = 1;
const PING_INTERVAL_MS = 10_000;
/** Kommt nach einem ping so lange nichts zurück, gilt der Socket als tot (halboffene Verbindung). */
export const PONG_TIMEOUT_MS = 4_000;
/** Verbindungsaufbau + Handshake (bis room.created/room.resumed) müssen so schnell gehen. */
export const HANDSHAKE_TIMEOUT_MS_CLIENT = 8_000;
/** Nicht automatisch reconnecten bei diesen Close-Codes. */
const FINAL_CLOSE_CODES: readonly number[] = [
  WS_CLOSE.VERSION_MISMATCH,
  WS_CLOSE.SESSION_REPLACED,
  WS_CLOSE.KICKED,
  WS_CLOSE.ROOM_CLOSED,
];

/** WebSocket-URL aus der Seiten-URL ableiten (tv-web läuft same-origin unter /tv/). */
export function wsUrlFromLocation(loc: Pick<Location, "protocol" | "host">): string {
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}${WS_PATH}`;
}

/** Leichte Prüfung eingehender Nachrichten. */
export function decodeServerMessage(raw: unknown): ServerMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES * 4) return null;
  try {
    const msg: unknown = JSON.parse(raw);
    if (typeof msg === "object" && msg !== null && typeof (msg as { t?: unknown }).t === "string") return msg as ServerMessage;
  } catch {
    // ungültiges JSON ignorieren
  }
  return null;
}

export function loadSession(storage: ClientDeps["storage"]): TvSession | null {
  try {
    const raw = storage?.getItem(STORAGE_KEYS.tvSession);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<TvSession>;
    if (typeof s.code === "string" && /^\d{6}$/.test(s.code) && typeof s.tvToken === "string" && s.tvToken.length >= 22) {
      return { code: s.code, tvToken: s.tvToken };
    }
  } catch {
    // kaputte Daten → wie keine Sitzung
  }
  return null;
}

export class TvClient {
  private socket: SocketLike | null = null;
  private attempt = 0;
  private retryTimer: unknown = null;
  private pingTimer: unknown = null;
  private pongTimer: unknown = null;
  private handshakeTimer: unknown = null;
  private handshakeDone = false;
  private stopped = false;
  /** serverTime - lokale Zeit (ms). */
  private offset = 0;
  private readonly d: Required<Omit<ClientDeps, "storage">> & { storage: ClientDeps["storage"] };

  constructor(deps: ClientDeps) {
    this.d = {
      createSocket: (url) => new WebSocket(url) as unknown as SocketLike,
      storage: null,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
      now: () => Date.now(),
      random: Math.random,
      ...deps,
    };
  }

  /** Geschätzte Serverzeit. */
  serverNow(): number {
    return this.d.now() + this.offset;
  }

  session(): TvSession | null {
    return loadSession(this.d.storage);
  }

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.clearTimers();
    this.dropSocket();
  }

  /** true, solange ein Reconnect-Timer läuft. */
  waiting(): boolean {
    return this.retryTimer !== null;
  }

  /**
   * Verbindung aktiv prüfen (App wieder sichtbar, Netz wieder da): wartet ein Reconnect,
   * sofort verbinden; sieht der Socket offen aus, ping senden – ohne pong in
   * PONG_TIMEOUT_MS wird neu verbunden.
   */
  probe(): void {
    if (this.stopped) return;
    if (this.waiting()) {
      this.retryNow();
      return;
    }
    if (this.socket && this.handshakeDone) this.sendPing();
  }

  /** Sofort neu verbinden (z. B. Taste „Erneut versuchen“). */
  retryNow(): void {
    this.stopped = false;
    this.clearTimers();
    this.dropSocket();
    this.attempt = 0;
    this.open();
  }

  /** Gespeicherte Sitzung verwerfen und neuen Raum erstellen. */
  newRoom(): void {
    this.clearSession();
    this.d.dispatch({ type: "reset" });
    this.retryNow();
  }

  /** Nachricht senden (nur nach erfolgreichem Handshake). */
  send(msg: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== OPEN || !this.handshakeDone) return false;
    this.socket.send(JSON.stringify(msg));
    return true;
  }

  private open(): void {
    if (this.stopped) return;
    this.handshakeDone = false;
    this.d.dispatch({ type: "conn", status: this.attempt === 0 ? "connecting" : "reconnecting", attempt: this.attempt });
    let socket: SocketLike;
    try {
      socket = this.d.createSocket(this.d.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.clearTimer("handshakeTimer");
    this.handshakeTimer = this.d.setTimer(() => {
      this.handshakeTimer = null;
      if (this.socket === socket && !this.handshakeDone) this.fail();
    }, HANDSHAKE_TIMEOUT_MS_CLIENT);
    socket.onopen = () => {
      if (this.socket !== socket) return;
      const s = this.session();
      const hs: ClientMessage = s
        ? { t: "room.resume", v: PROTOCOL_VERSION, code: s.code, tvToken: s.tvToken }
        : { t: "room.create", v: PROTOCOL_VERSION };
      socket.send(JSON.stringify(hs));
    };
    socket.onmessage = (ev) => {
      if (this.socket !== socket) return;
      // Jede Nachricht beweist, dass die Verbindung lebt.
      this.clearTimer("pongTimer");
      const msg = decodeServerMessage(ev.data);
      if (msg) this.onMessage(msg);
    };
    socket.onerror = () => {
      // onclose folgt immer; dort wird entschieden.
    };
    socket.onclose = (ev) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.onClose(ev.code);
    };
  }

  private onMessage(msg: ServerMessage): void {
    switch (msg.t) {
      case "room.created":
        this.saveSession({ code: msg.code, tvToken: msg.tvToken });
        this.onHandshake();
        break;
      case "room.resumed":
        this.onHandshake();
        break;
      case "pong":
        if (typeof msg.ts === "number") {
          const now = this.d.now();
          this.offset = msg.serverTime - (msg.ts + now) / 2;
        }
        break;
      case "room.closed":
        this.clearSession();
        this.stopped = true;
        this.clearTimers();
        break;
      case "error":
        if (!this.handshakeDone) {
          this.onHandshakeError(msg.code, msg.retryAfterMs);
          return; // Handshake-Fehler nicht als Hinweis anzeigen
        }
        if (msg.code === "VERSION_MISMATCH") {
          this.stopped = true;
          this.d.dispatch({ type: "fatal", fatal: { kind: "version" } });
          return;
        }
        break;
      default:
        break;
    }
    this.d.dispatch({ type: "server", msg });
  }

  private onHandshake(): void {
    this.handshakeDone = true;
    this.clearTimer("handshakeTimer");
    this.attempt = 0;
    this.d.dispatch({ type: "conn", status: "online", attempt: 0 });
    this.sendPing();
    this.pingTimer = this.d.setTimer(() => this.pingLoop(), PING_INTERVAL_MS);
  }

  private pingLoop(): void {
    this.sendPing();
    this.pingTimer = this.d.setTimer(() => this.pingLoop(), PING_INTERVAL_MS);
  }

  private sendPing(): void {
    if (!this.send({ t: "ping", ts: this.d.now() })) return;
    if (this.pongTimer !== null) return; // bereits ein ausstehender ping
    this.pongTimer = this.d.setTimer(() => {
      this.pongTimer = null;
      this.fail();
    }, PONG_TIMEOUT_MS);
  }

  /** Socket gilt als tot (kein pong / Handshake hängt): schließen und Reconnect-Pfad starten. */
  private fail(): void {
    this.dropSocket();
    this.clearTimers();
    this.handshakeDone = false;
    this.scheduleReconnect();
  }

  private clearTimer(name: "pongTimer" | "handshakeTimer" | "pingTimer" | "retryTimer"): void {
    const id = this[name];
    if (id !== null) this.d.clearTimer(id);
    this[name] = null;
  }

  private onHandshakeError(code: string, retryAfterMs?: number): void {
    if (code === "VERSION_MISMATCH") {
      this.stopped = true;
      this.dropSocket();
      this.d.dispatch({ type: "fatal", fatal: { kind: "version" } });
      return;
    }
    if ((SESSION_INVALIDATING_CODES as readonly string[]).includes(code)) {
      // Alter Raum ist weg → still einen neuen erstellen.
      this.clearSession();
      this.d.dispatch({ type: "reset" });
      this.dropSocket();
      this.attempt = 0;
      this.open();
      return;
    }
    // Sonst (z. B. RATE_LIMITED, SERVER_FULL): später erneut versuchen.
    this.dropSocket();
    this.scheduleReconnect(retryAfterMs);
  }

  private onClose(code: number): void {
    this.clearTimers();
    this.handshakeDone = false;
    if (this.stopped) return;
    if (FINAL_CLOSE_CODES.includes(code)) {
      this.stopped = true;
      if (code === WS_CLOSE.VERSION_MISMATCH) {
        this.d.dispatch({ type: "fatal", fatal: { kind: "version" } });
      } else if (code === WS_CLOSE.SESSION_REPLACED) {
        this.d.dispatch({ type: "fatal", fatal: { kind: "replaced" } });
      } else {
        this.clearSession();
        this.d.dispatch({ type: "fatal", fatal: { kind: "closed", reason: "unknown" } });
      }
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(minDelay = 0): void {
    if (this.stopped) return;
    const delay = Math.max(minDelay, reconnectDelayMs(this.attempt, this.d.random));
    this.attempt += 1;
    this.d.dispatch({ type: "conn", status: "reconnecting", attempt: this.attempt, retryAt: this.d.now() + delay });
    this.retryTimer = this.d.setTimer(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  private dropSocket(): void {
    const s = this.socket;
    this.socket = null;
    if (s) {
      s.onopen = s.onmessage = s.onerror = null;
      s.onclose = null;
      try {
        s.close(WS_CLOSE.NORMAL);
      } catch {
        // egal
      }
    }
  }

  private clearTimers(): void {
    this.clearTimer("retryTimer");
    this.clearTimer("pingTimer");
    this.clearTimer("pongTimer");
    this.clearTimer("handshakeTimer");
  }

  private saveSession(s: TvSession): void {
    try {
      this.d.storage?.setItem(STORAGE_KEYS.tvSession, JSON.stringify(s));
    } catch {
      // Speicher voll/gesperrt: Reconnect funktioniert dann nur ohne Resume
    }
  }

  private clearSession(): void {
    try {
      this.d.storage?.removeItem(STORAGE_KEYS.tvSession);
    } catch {
      // egal
    }
  }
}
