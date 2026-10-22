// Gemeinsame Datentypen (Spieler, Raum, Manifest, Settings, Ergebnisse) als zod-Schemas.
import { z } from "zod";
import {
  AVATAR_IDS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_MAX_LENGTH,
  PLAYER_COLOR_COUNT,
  ROOM_CODE_PATTERN,
} from "./constants.js";

// ---------------------------------------------------------------------------
// Basistypen
// ---------------------------------------------------------------------------

export const RoomCodeSchema = z.string().regex(ROOM_CODE_PATTERN, "Raumcode muss 6 Ziffern haben");
export type RoomCode = z.infer<typeof RoomCodeSchema>;

/** Server-vergebene Spieler-ID (z. B. "p_k3j9x2"). Opak für Clients. */
export const PlayerIdSchema = z.string().min(1).max(32);
export type PlayerId = z.infer<typeof PlayerIdSchema>;

/** Geheimes Token (Reconnect / TV). base64url, 22–64 Zeichen. */
export const TokenSchema = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/, "Ungültiges Token");

/** Spiel-ID: Kleinbuchstaben, Ziffern, Bindestrich. */
export const GameIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,31}$/, "Ungültige Spiel-ID");
export type GameId = z.infer<typeof GameIdSchema>;

export const AvatarIdSchema = z.enum(AVATAR_IDS);

/** Rohname vom Client; Normalisierung + Inhaltsprüfung macht `normalizeName()`. */
export const PlayerNameInputSchema = z.string().max(NAME_MAX_LENGTH * 4);

/** Optionale Request-ID; der Server spiegelt sie in Antwort/Fehler zurück. */
export const RequestIdSchema = z.string().min(1).max(64);

export const ProtocolVersionSchema = z.number().int().positive();

// ---------------------------------------------------------------------------
// Rollen & Phasen
// ---------------------------------------------------------------------------

/** Verbindungsrolle. "host" ist ein Spieler mit isHost=true und keine eigene Verbindungsart. */
export const ROLES = ["tv", "player"] as const;
export type Role = (typeof ROLES)[number];

/** Effektive Rolle für Berechtigungen. */
export type Actor = "tv" | "host" | "player";

export const ROOM_PHASES = ["lobby", "game", "results"] as const;
export const RoomPhaseSchema = z.enum(ROOM_PHASES);
export type RoomPhase = z.infer<typeof RoomPhaseSchema>;

// ---------------------------------------------------------------------------
// Spieler & Raum
// ---------------------------------------------------------------------------

export const PlayerSchema = z.object({
  id: PlayerIdSchema,
  name: z.string().min(1).max(NAME_MAX_LENGTH),
  avatar: AvatarIdSchema,
  /** Spielerfarbe 0..PLAYER_COLOR_COUNT-1, eindeutig im Raum. */
  color: z.number().int().min(0).max(PLAYER_COLOR_COUNT - 1),
  /** false während der Reconnect-Gnadenfrist. */
  connected: z.boolean(),
  isHost: z.boolean(),
});
export type Player = z.infer<typeof PlayerSchema>;

export const SettingValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);
export type SettingValue = z.infer<typeof SettingValueSchema>;

export const SettingsValuesSchema = z.record(z.string(), SettingValueSchema);
export type SettingsValues = z.infer<typeof SettingsValuesSchema>;

/** Obergrenze für gemeldeten Spielfortschritt (Schutz vor Unsinn). */
export const MAX_PROGRESS = 1_000_000_000;
export const ProgressValueSchema = z.number().int().min(0).max(MAX_PROGRESS);
/** Höchster gemeldeter Fortschritt je Spiel-ID (siehe player.progress). */
export const ProgressValuesSchema = z.record(GameIdSchema, ProgressValueSchema);
export type ProgressValues = z.infer<typeof ProgressValuesSchema>;

export const RankingEntrySchema = z.object({
  playerId: PlayerIdSchema,
  score: z.number(),
  /** 1 = bester Platz; Gleichstand = gleicher Rang. */
  rank: z.number().int().min(1),
});
export type RankingEntry = z.infer<typeof RankingEntrySchema>;

export const GameResultsSchema = z.object({
  gameId: GameIdSchema,
  ranking: z.array(RankingEntrySchema),
  /** Spielspezifische Zusatzdaten für den Ergebnis-Screen (JSON). */
  data: z.unknown().optional(),
});
export type GameResults = z.infer<typeof GameResultsSchema>;

export const RoomStateSchema = z.object({
  code: RoomCodeSchema,
  phase: RoomPhaseSchema,
  /** `${PUBLIC_URL}/j/<code>` – Inhalt des QR-Codes. */
  joinUrl: z.string(),
  players: z.array(PlayerSchema).max(MAX_PLAYERS),
  hostId: PlayerIdSchema.nullable(),
  tvConnected: z.boolean(),
  selectedGameId: GameIdSchema.nullable(),
  /**
   * min/max-Spieler des ausgewählten Spiels (aus dem Manifest), null ohne Auswahl.
   * Hat der Raum mehr verbundene Spieler als maxPlayers, bietet der Host eine
   * Teilnehmerauswahl an (lobby.start.playerIds).
   */
  playerLimits: z.object({ minPlayers: z.number().int(), maxPlayers: z.number().int() }).nullable(),
  /** Validierte Einstellungen für das ausgewählte Spiel (inkl. Defaults). */
  settings: SettingsValuesSchema,
  /**
   * Teilnehmer des laufenden/letzten Spiels (Startreihenfolge); leer in der Lobby ohne
   * vorheriges Spiel. Zuschauer-Signal: in Phase "game" ist jeder Spieler, dessen ID
   * hier fehlt, Zuschauer (siehe isSpectator()).
   */
  gamePlayerIds: z.array(PlayerIdSchema),
  /** Nur in Phase "results" gesetzt. */
  results: GameResultsSchema.nullable(),
  /** Höchster Fortschritt der Spieler im Raum je Spiel (player.progress); fehlt = 0. */
  progress: ProgressValuesSchema,
});
export type RoomState = z.infer<typeof RoomStateSchema>;

// ---------------------------------------------------------------------------
// Settings-Schema (deklarativ, JSON-serialisierbar – wird im Katalog an Clients
// geschickt, damit der Host-Controller/TV daraus ein Formular bauen kann)
// ---------------------------------------------------------------------------

const SettingKeySchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/);
const OptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  /**
   * Option erst ab diesem Spielfortschritt freigeschaltet (siehe Manifest `progressKey`).
   * Gesperrte Optionen zeigen TV und Handy nicht an, der Server lehnt sie ab.
   */
  minProgress: ProgressValueSchema.optional(),
});

const SelectFieldSchema = z.object({
  type: z.literal("select"),
  key: SettingKeySchema,
  label: z.string(),
  options: z.array(OptionSchema).min(1),
  default: z.string(),
});
const MultiSelectFieldSchema = z.object({
  type: z.literal("multiselect"),
  key: SettingKeySchema,
  label: z.string(),
  options: z.array(OptionSchema).min(1),
  default: z.array(z.string()),
  minSelected: z.number().int().min(0).optional(),
  maxSelected: z.number().int().min(1).optional(),
});
const NumberFieldSchema = z.object({
  type: z.literal("number"),
  key: SettingKeySchema,
  label: z.string(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().optional(),
  default: z.number(),
});
const ToggleFieldSchema = z.object({
  type: z.literal("toggle"),
  key: SettingKeySchema,
  label: z.string(),
  default: z.boolean(),
});

export const SettingFieldSchema = z.discriminatedUnion("type", [
  SelectFieldSchema,
  MultiSelectFieldSchema,
  NumberFieldSchema,
  ToggleFieldSchema,
]);
export type SettingField = z.infer<typeof SettingFieldSchema>;

// ---------------------------------------------------------------------------
// Spiel-Manifest (Inhalt von games/<id>/manifest.json)
// ---------------------------------------------------------------------------

function hasLockedDefault(field: SettingField): boolean {
  if (field.type !== "select" && field.type !== "multiselect") return false;
  const defaults = Array.isArray(field.default) ? field.default : [field.default];
  return field.options.some((o) => (o.minProgress ?? 0) > 0 && defaults.includes(o.value));
}

export const GameManifestSchema = z
  .object({
    id: GameIdSchema,
    name: z.string().min(1).max(40),
    description: z.string().max(200),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    minPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS),
    maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS),
    /** true = Spiel stellt selbst Bot-Gegner, wenn Menschen fehlen (z. B. TicTacToe 1 Spieler). */
    botSupport: z.boolean(),
    settings: z.array(SettingFieldSchema),
    /**
     * localStorage-Schlüssel, unter dem die Handys den Fortschritt (ganze Zahl ≥ 0) dieses Spiels
     * speichern. Sie melden ihn in Lobby/Ergebnissen per player.progress; Optionen mit
     * `minProgress` werden erst ab diesem Wert angezeigt.
     */
    progressKey: z.string().min(1).max(64).optional(),
    /** Icon für die Katalog-Kachel: Emoji, wird nur als Text gerendert (nie als HTML). */
    icon: z.string().min(1).max(16).optional(),
    /** Akzentfarbe für Katalog-Kachel (#rrggbb). */
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .refine((m) => m.minPlayers <= m.maxPlayers, { message: "minPlayers > maxPlayers" })
  .refine((m) => new Set(m.settings.map((s) => s.key)).size === m.settings.length, {
    message: "Doppelte Settings-Keys",
  })
  .refine((m) => m.settings.every((f) => !hasLockedDefault(f)), { message: "Default-Option darf nicht gesperrt sein" });
export type GameManifest = z.infer<typeof GameManifestSchema>;
