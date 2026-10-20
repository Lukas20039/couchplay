// Zentrale Konstanten für Server und Clients.
// Diese Datei importiert absichtlich KEIN zod, damit Frontends sie ohne
// Bundle-Kosten nutzen können (`import { ROOM_CODE_LENGTH } from "@couchplay/protocol/constants"`).

/** Protokollversion. Bei inkompatiblen Änderungen erhöhen (siehe docs/protocol.md). */
export const PROTOCOL_VERSION = 1;

/** Pfad des einzigen WebSocket-Endpoints. */
export const WS_PATH = "/ws";

/** Raumcode: 6 Ziffern, führende Nullen erlaubt. */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = /^\d{6}$/;

/** Pfadpräfix für Join-Links / QR-Codes: `${PUBLIC_URL}/j/<code>`. */
export const JOIN_PATH_PREFIX = "/j/";

/** Pfad der TV-Web-UI (wird von der Android-WebView geladen). */
export const TV_PATH = "/tv/";

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 8;

export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 16;

/** Feste Avatar-IDs. Darstellung (Emoji/Grafik) liegt in den Frontends. */
export const AVATAR_IDS = [
  "fuchs",
  "katze",
  "hund",
  "panda",
  "eule",
  "frosch",
  "tiger",
  "einhorn",
  "pinguin",
  "krake",
  "roboter",
  "alien",
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

/** Anzahl Spielerfarben; der Server vergibt `color` = 0..PLAYER_COLOR_COUNT-1, eindeutig im Raum. */
export const PLAYER_COLOR_COUNT = 8;

// ---------------------------------------------------------------------------
// Zeiten (Millisekunden)
// ---------------------------------------------------------------------------

/** Raum wird nach 2 h ohne Client-Nachricht geschlossen. */
export const ROOM_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

/** So lange bleibt der Platz eines getrennten Spielers reserviert. */
export const PLAYER_RECONNECT_GRACE_MS = 2 * 60 * 1000;

/** Server sendet WS-Ping-Frames in diesem Abstand. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Ohne Pong/Nachricht innerhalb dieser Zeit gilt die Verbindung als tot. */
export const HEARTBEAT_TIMEOUT_MS = 35_000;

/** Erste Nachricht (room.create/resume/join/rejoin) muss innerhalb dieser Zeit kommen. */
export const HANDSHAKE_TIMEOUT_MS = 10_000;

/** Client-Reconnect-Backoff: min, max, Faktor (mit Jitter ±20 %). */
export const RECONNECT_BACKOFF_MIN_MS = 500;
export const RECONNECT_BACKOFF_MAX_MS = 10_000;
export const RECONNECT_BACKOFF_FACTOR = 2;

// ---------------------------------------------------------------------------
// Limits / Rate-Limits
// ---------------------------------------------------------------------------

/** Maximale Größe einer eingehenden WS-Nachricht in Bytes. */
export const MAX_MESSAGE_BYTES = 16 * 1024;

/** Join-Versuche (room.join / room.rejoin) pro IP: Token-Bucket. */
export const JOIN_RATE_LIMIT = { capacity: 10, refillPerMinute: 10 } as const;

/** Raum-Erstellungen (room.create) pro IP. */
export const CREATE_RATE_LIMIT = { capacity: 5, refillPerMinute: 5 } as const;

/** Nachrichten pro Verbindung (alle Typen). */
export const MESSAGE_RATE_LIMIT = { capacity: 40, refillPerSecond: 20 } as const;

/** Gleichzeitige WS-Verbindungen pro IP. */
export const MAX_CONNECTIONS_PER_IP = 32;

/** Maximal gleichzeitig offene Räume pro Serverinstanz. */
export const MAX_ROOMS = 1000;

/** Nach so vielen Rate-Limit-Verstößen in Folge trennt der Server die Verbindung. */
export const RATE_LIMIT_STRIKES_BEFORE_CLOSE = 20;

// ---------------------------------------------------------------------------
// WebSocket-Close-Codes (4000–4999 = anwendungsspezifisch)
// ---------------------------------------------------------------------------

export const WS_CLOSE = {
  /** Normales Ende (room.leave, Raum geschlossen). */
  NORMAL: 1000,
  /** Protokollfehler / ungültiger Handshake. */
  PROTOCOL_ERROR: 4000,
  /** Inkompatible Protokollversion – Client soll neu laden, nicht reconnecten. */
  VERSION_MISMATCH: 4001,
  /** Sitzung von neuer Verbindung mit gleichem Token übernommen – nicht reconnecten. */
  SESSION_REPLACED: 4002,
  /** Spieler wurde entfernt – nicht reconnecten. */
  KICKED: 4003,
  /** Raum existiert nicht mehr – nicht reconnecten. */
  ROOM_CLOSED: 4004,
  /** Zu viele Nachrichten / Rate-Limit dauerhaft verletzt. */
  RATE_LIMITED: 4008,
  /** Handshake-Timeout. */
  HANDSHAKE_TIMEOUT: 4009,
} as const;

/** localStorage-Schlüssel für Reconnect-Daten (Controller und TV). */
export const STORAGE_KEYS = {
  playerSession: "couchplay.player.session",
  tvSession: "couchplay.tv.session",
  profile: "couchplay.player.profile",
} as const;
