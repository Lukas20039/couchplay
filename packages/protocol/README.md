# @couchplay/protocol

**Zuständig:** Architekt. Andere Agents: nur importieren; Änderungen per Antrag (siehe `AGENTS.md`).

Einzige Quelle der Wahrheit für das WebSocket-Protokoll (`docs/protocol.md`).

| Export | Inhalt |
|---|---|
| `@couchplay/protocol` | alles unten + zod-Schemas (`ClientMessageSchema`, `ServerMessageSchema`, `RoomStateSchema`, `GameManifestSchema`, …), Typen (`ClientMessage`, `ServerMessage`, `ClientMessageOf<"room.join">`, `RoomState`, `Player`, …), `parseClientMessage`, `parseServerMessage`, `encodeMessage`, `errorMessage`, `CLIENT_MESSAGE_RULES`, `validateSettings`, `defaultSettings` |
| `@couchplay/protocol/constants` | Konstanten (Code-Länge, max. Spieler, Timeouts, Rate-Limits, Close-Codes, Storage-Keys) – ohne zod |
| `@couchplay/protocol/errors` | `ERROR_CODES`, `ErrorCode`, `SESSION_INVALIDATING_CODES` – ohne zod |
| `@couchplay/protocol/util` | `normalizeName`, `nameKey`, `buildJoinUrl`, `parseJoinPath`, `sanitizeRoomCodeInput`, `reconnectDelayMs` – ohne zod |

Frontends sollten Typen per `import type` und Laufzeitwerte aus den zod-freien Subpfaden holen, um das Bundle klein zu halten.
