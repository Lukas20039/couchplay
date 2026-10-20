// Fehlercodes des Protokolls. Ohne zod-Import, damit Frontends sie billig nutzen können.
// Die Clients übersetzen Codes in UI-Texte (zentral in ihrer i18n-Datei);
// das Feld `message` im error-Paket ist nur ein Entwickler-Hinweis.

export const ERROR_CODES = [
  /** Nachricht kein gültiges JSON, unbekannter Typ oder Felder ungültig. */
  "BAD_MESSAGE",
  /** Nachricht größer als MAX_MESSAGE_BYTES. */
  "MESSAGE_TOO_LARGE",
  /** Client spricht eine andere Protokollversion (fatal). */
  "VERSION_MISMATCH",
  /** Nachricht erfordert Handshake (create/resume/join/rejoin), der fehlt. */
  "NOT_IN_ROOM",
  /** Zweiter Handshake auf derselben Verbindung. */
  "ALREADY_IN_ROOM",
  /** Raumcode unbekannt oder abgelaufen. */
  "ROOM_NOT_FOUND",
  /** Raum hat bereits MAX_PLAYERS Spieler. */
  "ROOM_FULL",
  /** Server hat MAX_ROOMS erreicht. */
  "SERVER_FULL",
  /** Name leer, zu lang oder mit unzulässigen Zeichen. */
  "NAME_INVALID",
  /** Name im Raum schon vergeben (Groß-/Kleinschreibung egal). */
  "NAME_TAKEN",
  /** Reconnect-/TV-Token ungültig oder Sitzung abgelaufen (fatal). */
  "TOKEN_INVALID",
  /** Rate-Limit überschritten; Feld `retryAfterMs` gesetzt. */
  "RATE_LIMITED",
  /** Rolle darf diese Aktion nicht (z. B. Nicht-Host startet Spiel). */
  "NOT_ALLOWED",
  /** Aktion in der aktuellen Raumphase nicht möglich. */
  "INVALID_PHASE",
  /** Unbekannte Spiel-ID. */
  "GAME_NOT_FOUND",
  /** lobby.start ohne ausgewähltes Spiel. */
  "NO_GAME_SELECTED",
  /** Spieleranzahl passt nicht zu minPlayers/maxPlayers des Spiels. */
  "PLAYER_COUNT",
  /** Einstellungen passen nicht zum Settings-Schema des Spiels. */
  "INVALID_SETTINGS",
  /** game.input vom Spiel abgelehnt (Schema). */
  "INVALID_INPUT",
  /** Ziel-Spieler (z. B. bei player.kick, lobby.start.playerIds) existiert nicht. */
  "PLAYER_NOT_FOUND",
  /** Ausgewählter Teilnehmer (lobby.start.playerIds) ist gerade getrennt. */
  "PLAYER_NOT_CONNECTED",
  /** Unerwarteter Serverfehler. */
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Antwortet der Server auf room.rejoin / room.resume mit einem dieser Codes,
 * muss der Client seine gespeicherte Sitzung (localStorage) verwerfen und darf
 * nicht erneut automatisch reconnecten.
 */
export const SESSION_INVALIDATING_CODES: readonly ErrorCode[] = ["VERSION_MISMATCH", "TOKEN_INVALID", "ROOM_NOT_FOUND"];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}
