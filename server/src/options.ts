// Laufzeit-Grenzen des Servers. Defaults kommen aus @couchplay/protocol/constants;
// Tests können einzelne Werte überschreiben (z. B. kurze Gnadenfrist).
import {
  CREATE_RATE_LIMIT,
  HANDSHAKE_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  JOIN_RATE_LIMIT,
  MAX_CONNECTIONS_PER_IP,
  MAX_MESSAGE_BYTES,
  MAX_ROOMS,
  MESSAGE_RATE_LIMIT,
  PLAYER_RECONNECT_GRACE_MS,
  RATE_LIMIT_STRIKES_BEFORE_CLOSE,
  ROOM_IDLE_TIMEOUT_MS,
} from "@couchplay/protocol/constants";
import { perMinute, perSecond, type BucketSpec } from "./rate-limit.js";

export interface ServerLimits {
  roomIdleTimeoutMs: number;
  /** Abstand der Prüfung auf inaktive Räume / Aufräumen der Rate-Limit-Buckets. */
  sweepIntervalMs: number;
  reconnectGraceMs: number;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  handshakeTimeoutMs: number;
  joinRate: BucketSpec;
  createRate: BucketSpec;
  messageRate: BucketSpec;
  rateLimitStrikesBeforeClose: number;
  maxConnectionsPerIp: number;
  maxRooms: number;
  /** Protokollgrenze; größere Nachrichten → MESSAGE_TOO_LARGE. */
  maxMessageBytes: number;
  /** Harte Grenze im ws-Server (darüber trennt ws mit 1009, ohne Fehlerpaket). */
  hardMaxPayloadBytes: number;
  /** Wartezeit beim Herunterfahren, bis Sockets hart getrennt werden. */
  shutdownGraceMs: number;
}

export const DEFAULT_LIMITS: ServerLimits = {
  roomIdleTimeoutMs: ROOM_IDLE_TIMEOUT_MS,
  sweepIntervalMs: 60_000,
  reconnectGraceMs: PLAYER_RECONNECT_GRACE_MS,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
  handshakeTimeoutMs: HANDSHAKE_TIMEOUT_MS,
  joinRate: perMinute(JOIN_RATE_LIMIT.capacity, JOIN_RATE_LIMIT.refillPerMinute),
  createRate: perMinute(CREATE_RATE_LIMIT.capacity, CREATE_RATE_LIMIT.refillPerMinute),
  messageRate: perSecond(MESSAGE_RATE_LIMIT.capacity, MESSAGE_RATE_LIMIT.refillPerSecond),
  rateLimitStrikesBeforeClose: RATE_LIMIT_STRIKES_BEFORE_CLOSE,
  maxConnectionsPerIp: MAX_CONNECTIONS_PER_IP,
  maxRooms: MAX_ROOMS,
  maxMessageBytes: MAX_MESSAGE_BYTES,
  hardMaxPayloadBytes: 4 * MAX_MESSAGE_BYTES,
  shutdownGraceMs: 2_000,
};
