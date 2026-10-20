// Laufzeit-Grenzen des Servers. Defaults kommen aus @couchplay/protocol/constants;
// Tests können einzelne Werte überschreiben (z. B. kurze Gnadenfrist).
import {
  CREATE_RATE_LIMIT,
  GLOBAL_JOIN_FAILURE_RATE,
  HANDSHAKE_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  JOIN_ATTEMPT_RATE,
  JOIN_FAILURE_BACKOFF,
  MAX_BUFFERED_BYTES,
  MAX_CONNECTIONS_PER_IP,
  MAX_MESSAGE_BYTES,
  MAX_ROOMS,
  MAX_ROOMS_PER_IP,
  MESSAGE_RATE_LIMIT,
  ORPHAN_ROOM_TIMEOUT_MS,
  PLAYER_RECONNECT_GRACE_MS,
  PLAYER_UPDATE_RATE_LIMIT,
  RATE_LIMIT_STRIKES_BEFORE_CLOSE,
  ROOM_IDLE_TIMEOUT_MS,
  STATE_COALESCE_MS,
} from "@couchplay/protocol/constants";
import { perMinute, perSecond, type BucketSpec, type FailureBackoffSpec } from "./rate-limit.js";

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
  orphanRoomTimeoutMs: number;
  maxRoomsPerIp: number;
  maxBufferedBytes: number;
  stateCoalesceMs: number;
  /** Eigenes, engeres Limit für player.update pro Verbindung. */
  playerUpdateRate: BucketSpec;
  /** Backoff pro IP nach Fehlversuchen (ROOM_NOT_FOUND / TOKEN_INVALID): 5/min frei, danach exponentiell. */
  joinFailureBackoff: FailureBackoffSpec;
  /** Globaler Bucket über alle IPs für Fehlversuche; leer → Sperrphase für IPs mit Fehlversuchen. */
  globalFailureRate: BucketSpec;
  globalLockdownMs: number;
}

export const DEFAULT_LIMITS: ServerLimits = {
  roomIdleTimeoutMs: ROOM_IDLE_TIMEOUT_MS,
  sweepIntervalMs: 60_000,
  reconnectGraceMs: PLAYER_RECONNECT_GRACE_MS,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  heartbeatTimeoutMs: HEARTBEAT_TIMEOUT_MS,
  handshakeTimeoutMs: HANDSHAKE_TIMEOUT_MS,
  joinRate: perMinute(JOIN_ATTEMPT_RATE.capacity, JOIN_ATTEMPT_RATE.refillPerMinute),
  createRate: perMinute(CREATE_RATE_LIMIT.capacity, CREATE_RATE_LIMIT.refillPerMinute),
  messageRate: perSecond(MESSAGE_RATE_LIMIT.capacity, MESSAGE_RATE_LIMIT.refillPerSecond),
  rateLimitStrikesBeforeClose: RATE_LIMIT_STRIKES_BEFORE_CLOSE,
  maxConnectionsPerIp: MAX_CONNECTIONS_PER_IP,
  maxRooms: MAX_ROOMS,
  maxMessageBytes: MAX_MESSAGE_BYTES,
  hardMaxPayloadBytes: 4 * MAX_MESSAGE_BYTES,
  shutdownGraceMs: 2_000,
  orphanRoomTimeoutMs: ORPHAN_ROOM_TIMEOUT_MS,
  maxRoomsPerIp: MAX_ROOMS_PER_IP,
  maxBufferedBytes: MAX_BUFFERED_BYTES,
  stateCoalesceMs: STATE_COALESCE_MS,
  playerUpdateRate: perSecond(PLAYER_UPDATE_RATE_LIMIT.capacity, PLAYER_UPDATE_RATE_LIMIT.refillPerSecond),
  joinFailureBackoff: { ...JOIN_FAILURE_BACKOFF },
  globalFailureRate: perSecond(GLOBAL_JOIN_FAILURE_RATE.capacity, GLOBAL_JOIN_FAILURE_RATE.refillPerSecond),
  globalLockdownMs: GLOBAL_JOIN_FAILURE_RATE.lockdownMs,
};
