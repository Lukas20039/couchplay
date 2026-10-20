// Alle WebSocket-Nachrichten. Format: JSON `{ "t": "<typ>", ... }`.
// Dokumentation mit Beispielen: docs/protocol.md – bei Änderungen beide anpassen.
import { z } from "zod";
import {
  AvatarIdSchema,
  GameIdSchema,
  GameManifestSchema,
  PlayerIdSchema,
  PlayerNameInputSchema,
  ProtocolVersionSchema,
  RequestIdSchema,
  RoomCodeSchema,
  RoomStateSchema,
  SettingsValuesSchema,
  TokenSchema,
  type Actor,
  type RoomPhase,
} from "./common.js";
import { ERROR_CODES } from "./errors.js";

const rid = { rid: RequestIdSchema.optional() };

// ===========================================================================
// Client → Server
// ===========================================================================

// --- Handshake (erste Nachricht jeder Verbindung, enthält Versionsfeld `v`) ---

/** TV erstellt einen neuen Raum. */
export const RoomCreateSchema = z.object({ t: z.literal("room.create"), v: ProtocolVersionSchema, ...rid });
/** TV verbindet sich nach Verbindungsabbruch erneut mit seinem Raum. */
export const RoomResumeSchema = z.object({
  t: z.literal("room.resume"),
  v: ProtocolVersionSchema,
  code: RoomCodeSchema,
  tvToken: TokenSchema,
  ...rid,
});
/** Handy tritt einem Raum bei. */
export const RoomJoinSchema = z.object({
  t: z.literal("room.join"),
  v: ProtocolVersionSchema,
  code: RoomCodeSchema,
  name: PlayerNameInputSchema,
  avatar: AvatarIdSchema,
  ...rid,
});
/** Handy nimmt seinen reservierten Platz per Reconnect-Token wieder ein. */
export const RoomRejoinSchema = z.object({
  t: z.literal("room.rejoin"),
  v: ProtocolVersionSchema,
  code: RoomCodeSchema,
  playerId: PlayerIdSchema,
  token: TokenSchema,
  ...rid,
});

// --- Nach dem Handshake ---

/** Spieler verlässt den Raum endgültig (Platz wird sofort frei). */
export const RoomLeaveSchema = z.object({ t: z.literal("room.leave"), ...rid });
/** TV schließt den Raum (alle Clients erhalten room.closed). */
export const RoomCloseSchema = z.object({ t: z.literal("room.close"), ...rid });
/** Spieler ändert eigenen Namen/Avatar (nur Lobby/Ergebnisse). */
export const PlayerUpdateSchema = z.object({
  t: z.literal("player.update"),
  name: PlayerNameInputSchema.optional(),
  avatar: AvatarIdSchema.optional(),
  ...rid,
});
/** TV oder Host entfernt einen Spieler. */
export const PlayerKickSchema = z.object({ t: z.literal("player.kick"), playerId: PlayerIdSchema, ...rid });
/** TV oder Host wählt ein Spiel aus dem Katalog. Settings werden auf Defaults gesetzt. */
export const LobbySelectGameSchema = z.object({ t: z.literal("lobby.selectGame"), gameId: GameIdSchema, ...rid });
/** TV oder Host ändert Einstellungen (Teilmenge; wird mit aktuellen Werten gemergt). */
export const LobbyUpdateSettingsSchema = z.object({
  t: z.literal("lobby.updateSettings"),
  settings: SettingsValuesSchema,
  ...rid,
});
/** TV oder Host startet das ausgewählte Spiel (in Phase "results" = Revanche). */
export const LobbyStartSchema = z.object({ t: z.literal("lobby.start"), ...rid });
/** Spieleingabe; `data` wird vom Spiel selbst validiert (GameDefinition.inputSchema). */
export const GameInputSchema = z.object({ t: z.literal("game.input"), data: z.unknown() });
/** TV oder Host bricht das laufende Spiel ab → Lobby. */
export const GameAbortSchema = z.object({ t: z.literal("game.abort"), ...rid });
/** TV oder Host: Ergebnis-Screen verlassen → Lobby. */
export const RoomToLobbySchema = z.object({ t: z.literal("room.toLobby"), ...rid });
/** Anwendungs-Ping (Latenzmessung, optional). */
export const PingSchema = z.object({ t: z.literal("ping"), ts: z.number().optional() });

export const ClientMessageSchema = z.discriminatedUnion("t", [
  RoomCreateSchema,
  RoomResumeSchema,
  RoomJoinSchema,
  RoomRejoinSchema,
  RoomLeaveSchema,
  RoomCloseSchema,
  PlayerUpdateSchema,
  PlayerKickSchema,
  LobbySelectGameSchema,
  LobbyUpdateSettingsSchema,
  LobbyStartSchema,
  GameInputSchema,
  GameAbortSchema,
  RoomToLobbySchema,
  PingSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ClientMessageType = ClientMessage["t"];
export type ClientMessageOf<T extends ClientMessageType> = Extract<ClientMessage, { t: T }>;

export const HANDSHAKE_TYPES = ["room.create", "room.resume", "room.join", "room.rejoin"] as const;
export type HandshakeMessage = ClientMessageOf<(typeof HANDSHAKE_TYPES)[number]>;

export function isHandshakeMessage(msg: ClientMessage): msg is HandshakeMessage {
  return (HANDSHAKE_TYPES as readonly string[]).includes(msg.t);
}

/**
 * Berechtigungen nach dem Handshake: welche Akteure dürfen welche Nachricht
 * in welcher Phase senden. Der Server MUSS diese Tabelle verwenden
 * (Fehler NOT_ALLOWED bzw. INVALID_PHASE).
 */
export const CLIENT_MESSAGE_RULES: Record<
  Exclude<ClientMessageType, HandshakeMessage["t"]>,
  { actors: readonly Actor[]; phases: readonly RoomPhase[] }
> = {
  "room.leave": { actors: ["player", "host"], phases: ["lobby", "game", "results"] },
  "room.close": { actors: ["tv"], phases: ["lobby", "game", "results"] },
  "player.update": { actors: ["player", "host"], phases: ["lobby", "results"] },
  "player.kick": { actors: ["tv", "host"], phases: ["lobby", "results"] },
  "lobby.selectGame": { actors: ["tv", "host"], phases: ["lobby", "results"] },
  "lobby.updateSettings": { actors: ["tv", "host"], phases: ["lobby", "results"] },
  "lobby.start": { actors: ["tv", "host"], phases: ["lobby", "results"] },
  "game.input": { actors: ["player", "host"], phases: ["game"] },
  "game.abort": { actors: ["tv", "host"], phases: ["game"] },
  "room.toLobby": { actors: ["tv", "host"], phases: ["results"] },
  ping: { actors: ["tv", "player", "host"], phases: ["lobby", "game", "results"] },
};

// ===========================================================================
// Server → Client
// ===========================================================================

/** Antwort auf room.create (nur TV). tvToken für room.resume speichern. */
export const RoomCreatedSchema = z.object({
  t: z.literal("room.created"),
  v: ProtocolVersionSchema,
  code: RoomCodeSchema,
  joinUrl: z.string(),
  tvToken: TokenSchema,
  ...rid,
});
/** Antwort auf room.resume (nur TV). */
export const RoomResumedSchema = z.object({
  t: z.literal("room.resumed"),
  v: ProtocolVersionSchema,
  code: RoomCodeSchema,
  joinUrl: z.string(),
  ...rid,
});
/** Antwort auf room.join / room.rejoin. token + playerId im localStorage speichern. */
export const RoomJoinedSchema = z.object({
  t: z.literal("room.joined"),
  v: ProtocolVersionSchema,
  code: RoomCodeSchema,
  playerId: PlayerIdSchema,
  token: TokenSchema,
  ...rid,
});
/** Vollständiger Raumzustand; nach jeder Änderung an alle Clients des Raums. */
export const RoomStateMessageSchema = z.object({ t: z.literal("room.state"), room: RoomStateSchema });
/** Spielkatalog; direkt nach erfolgreichem Handshake. */
export const CatalogSchema = z.object({ t: z.literal("catalog"), games: z.array(GameManifestSchema) });
/** Spielzustand für den TV (ctx.broadcastTv). */
export const GameTvSchema = z.object({
  t: z.literal("game.tv"),
  gameId: GameIdSchema,
  /** Pro Raum monoton steigend; ältere Pakete verwerfen. */
  seq: z.number().int().nonnegative(),
  state: z.unknown(),
});
/** Private Ansicht für genau einen Spieler (ctx.sendToPlayer). */
export const GameViewSchema = z.object({
  t: z.literal("game.view"),
  gameId: GameIdSchema,
  seq: z.number().int().nonnegative(),
  view: z.unknown(),
});
export const ROOM_CLOSED_REASONS = ["idle", "closed_by_tv", "kicked", "left", "server_shutdown"] as const;
/** Raum für diesen Client beendet; danach schließt der Server die Verbindung. Nicht reconnecten. */
export const RoomClosedSchema = z.object({ t: z.literal("room.closed"), reason: z.enum(ROOM_CLOSED_REASONS) });
/** Fehlerantwort. `fatal: true` → Server schließt die Verbindung anschließend. */
export const ErrorMessageSchema = z.object({
  t: z.literal("error"),
  code: z.enum(ERROR_CODES),
  message: z.string(),
  fatal: z.boolean().optional(),
  /** Nur bei RATE_LIMITED. */
  retryAfterMs: z.number().int().nonnegative().optional(),
  ...rid,
});
export const PongSchema = z.object({ t: z.literal("pong"), ts: z.number().optional(), serverTime: z.number() });

export const ServerMessageSchema = z.discriminatedUnion("t", [
  RoomCreatedSchema,
  RoomResumedSchema,
  RoomJoinedSchema,
  RoomStateMessageSchema,
  CatalogSchema,
  GameTvSchema,
  GameViewSchema,
  RoomClosedSchema,
  ErrorMessageSchema,
  PongSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ServerMessageType = ServerMessage["t"];
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { t: T }>;
export type RoomClosedReason = (typeof ROOM_CLOSED_REASONS)[number];
