# CouchPlay – WebSocket-Protokoll v1

Implementierung (verbindlich): `packages/protocol` (`src/messages.ts`, `src/common.ts`).
Diese Datei und der Code müssen übereinstimmen; Änderungen nur über den Architekten (siehe `AGENTS.md`).

## Grundlagen

- Ein Endpoint: `GET /ws` (WebSocket-Upgrade), `ws://` lokal, `wss://` hinter dem Reverse-Proxy.
- Jede Nachricht ist ein JSON-Objekt `{ "t": "<typ>", ... }`, UTF-8, max. 16 KiB.
- Unbekannte Felder werden vom Empfänger verworfen (vorwärtskompatibel).
- **Version:** Jede Handshake-Nachricht (Client) und jede Handshake-Antwort (Server) trägt `v` (= `PROTOCOL_VERSION`, aktuell `1`). Bei Abweichung: `error VERSION_MISMATCH` (fatal), Close 4001. Neue optionale Felder/Nachrichten erhöhen `v` nicht; Umbenennen/Entfernen/Semantikänderung schon.
- **`rid`** (optional, String ≤ 64): Request-ID des Clients; der Server spiegelt sie in der direkten Antwort bzw. im `error`.
- Erste Nachricht jeder Verbindung muss ein Handshake sein (`room.create`, `room.resume`, `room.join`, `room.rejoin`), sonst `error NOT_IN_ROOM`. Timeout 10 s → Close 4009.
- Nach erfolgreichem Handshake sendet der Server immer: Handshake-Antwort → `catalog` → `room.state` → (Phase `game`) gecachte `game.tv` bzw. `game.view`.

## Gemeinsame Typen

```ts
Player     = { id, name, avatar: AvatarId, color: 0..7, connected: boolean, isHost: boolean }
RoomState  = { code, phase: "lobby"|"game"|"results", joinUrl, players: Player[] (≤8), hostId: string|null,
               tvConnected: boolean, selectedGameId: string|null, settings: Record<string, SettingValue>,
               gamePlayerIds: string[], results: GameResults|null }
GameResults = { gameId, ranking: { playerId, score, rank }[], data?: unknown }
SettingValue = string | number | boolean | string[]
GameManifest = { id, name, description, version, minPlayers, maxPlayers, botSupport, settings: SettingField[], accentColor? }
SettingField = { type: "select", key, label, options: {value,label}[], default: string }
             | { type: "multiselect", key, label, options, default: string[], minSelected?, maxSelected? }
             | { type: "number", key, label, min, max, step?, default: number }
             | { type: "toggle", key, label, default: boolean }
```

- `code`: 6 Ziffern (`/^\d{6}$/`, führende Nullen möglich). `token`/`tvToken`: base64url, 22–64 Zeichen.
- `AvatarId`: `fuchs katze hund panda eule frosch tiger einhorn pinguin krake roboter alien`.
- Name: 1–16 Codepoints nach `normalizeName`, eindeutig im Raum (case-insensitive).

## Client → Server

Spalte „Wer/Phase": Berechtigung nach Handshake (`CLIENT_MESSAGE_RULES`). Verstöße → `NOT_ALLOWED` bzw. `INVALID_PHASE`.

| `t` | Felder | Wer / Phase | Antwort |
|---|---|---|---|
| `room.create` | `v` | neue Verbindung (TV) | `room.created` |
| `room.resume` | `v, code, tvToken` | neue Verbindung (TV) | `room.resumed` |
| `room.join` | `v, code, name, avatar` | neue Verbindung (Handy) | `room.joined` |
| `room.rejoin` | `v, code, playerId, token` | neue Verbindung (Handy) | `room.joined` |
| `room.leave` | – | player/host · alle | `room.closed{left}` an sich selbst |
| `room.close` | – | tv · alle | `room.closed{closed_by_tv}` an alle |
| `player.update` | `name?, avatar?` | player/host · lobby, results | `room.state` |
| `player.kick` | `playerId` | tv/host · lobby, results | Ziel: `room.closed{kicked}` + Close 4003; alle: `room.state` |
| `lobby.selectGame` | `gameId` | tv/host · lobby, results | `room.state` (Settings = Defaults, Phase → lobby) |
| `lobby.updateSettings` | `settings` (Teilmenge) | tv/host · lobby, results | `room.state` oder `INVALID_SETTINGS` |
| `lobby.start` | – | tv/host · lobby, results | `room.state{phase:"game"}` + erste `game.tv`/`game.view` |
| `game.input` | `data` (spielspezifisch) | player/host (Teilnehmer) · game | keine (Wirkung über `game.*`), bei Fehler `INVALID_INPUT` |
| `game.abort` | – | tv/host · game | `room.state{phase:"lobby"}` |
| `room.toLobby` | – | tv/host · results | `room.state{phase:"lobby"}` |
| `ping` | `ts?` | alle | `pong` |

Beispiele:

```json
{"t":"room.create","v":1,"rid":"1"}
{"t":"room.resume","v":1,"code":"042137","tvToken":"Xc1o7JfS1b2Q9mVnq0aZrT5kLwE3yPdu"}
{"t":"room.join","v":1,"code":"042137","name":"Anna","avatar":"fuchs","rid":"j1"}
{"t":"room.rejoin","v":1,"code":"042137","playerId":"p_k3j9x2","token":"q8V0mZ2pYwL4nB7cR1sT6uX9dE3fG5hJ"}
{"t":"room.leave"}
{"t":"room.close"}
{"t":"player.update","name":"Anni","avatar":"eule"}
{"t":"player.kick","playerId":"p_8hd02k"}
{"t":"lobby.selectGame","gameId":"quiz"}
{"t":"lobby.updateSettings","settings":{"rounds":15,"categories":["sport","geografie"]}}
{"t":"lobby.start","rid":"s1"}
{"t":"game.input","data":{"type":"answer","index":2}}
{"t":"game.abort"}
{"t":"room.toLobby"}
{"t":"ping","ts":1729411200000}
```

## Server → Client

| `t` | Felder | Empfänger / Anlass |
|---|---|---|
| `room.created` | `v, code, joinUrl, tvToken, rid?` | TV nach `room.create` |
| `room.resumed` | `v, code, joinUrl, rid?` | TV nach `room.resume` |
| `room.joined` | `v, code, playerId, token, rid?` | Handy nach `room.join`/`room.rejoin` (token beim Rejoin unverändert) |
| `catalog` | `games: GameManifest[]` | nach jedem Handshake |
| `room.state` | `room: RoomState` | alle Clients des Raums bei jeder Änderung (Spieler, connected, Host, Phase, Spiel, Settings, Ergebnis) |
| `game.tv` | `gameId, seq, state` | TV (nur), aus `ctx.broadcastTv` |
| `game.view` | `gameId, seq, view` | genau ein Spieler, aus `ctx.sendToPlayer` |
| `room.closed` | `reason: idle\|closed_by_tv\|kicked\|left\|server_shutdown` | danach Close (1000/4003/4004); nicht reconnecten |
| `error` | `code, message, fatal?, retryAfterMs?, rid?` | Antwort auf fehlerhafte Anfrage; `fatal` → Server schließt Verbindung |
| `pong` | `ts?, serverTime` | Antwort auf `ping`; `serverTime` für Uhr-Offset |

`seq` ist pro Raum monoton steigend über `game.tv` und `game.view` hinweg; Clients verwerfen Pakete mit kleinerem `seq` als dem zuletzt gesehenen (nach Reconnect zurücksetzen).

Beispiele:

```json
{"t":"room.created","v":1,"code":"042137","joinUrl":"https://play.example.org/j/042137","tvToken":"Xc1o7JfS1b2Q9mVnq0aZrT5kLwE3yPdu","rid":"1"}
{"t":"room.resumed","v":1,"code":"042137","joinUrl":"https://play.example.org/j/042137"}
{"t":"room.joined","v":1,"code":"042137","playerId":"p_k3j9x2","token":"q8V0mZ2pYwL4nB7cR1sT6uX9dE3fG5hJ","rid":"j1"}
{"t":"catalog","games":[{"id":"tictactoe","name":"TicTacToe","description":"Drei in einer Reihe …","version":"0.1.0","minPlayers":1,"maxPlayers":2,"botSupport":true,"accentColor":"#00c2a8","settings":[{"type":"select","key":"difficulty","label":"Computer-Stärke (1 Spieler)","options":[{"value":"leicht","label":"Leicht"},{"value":"mittel","label":"Mittel"},{"value":"unbesiegbar","label":"Unbesiegbar"}],"default":"mittel"}]}]}
{"t":"room.state","room":{"code":"042137","phase":"lobby","joinUrl":"https://play.example.org/j/042137","players":[{"id":"p_k3j9x2","name":"Anna","avatar":"fuchs","color":0,"connected":true,"isHost":true}],"hostId":"p_k3j9x2","tvConnected":true,"selectedGameId":"tictactoe","settings":{"difficulty":"mittel"},"gamePlayerIds":[],"results":null}}
{"t":"game.tv","gameId":"quiz","seq":12,"state":{"phase":"question","text":"Hauptstadt von Australien?","endsAt":1729411230000}}
{"t":"game.view","gameId":"quiz","seq":13,"view":{"phase":"answer","choices":4}}
{"t":"room.closed","reason":"kicked"}
{"t":"error","code":"RATE_LIMITED","message":"Zu viele Join-Versuche","retryAfterMs":6000,"rid":"j1"}
{"t":"pong","ts":1729411200000,"serverTime":1729411200042}
```

## Fehlercodes

| Code | Bedeutung | Typische Auslöser |
|---|---|---|
| `BAD_MESSAGE` | kein JSON / unbekannter Typ / Felder ungültig | alle |
| `MESSAGE_TOO_LARGE` | > 16 KiB | alle |
| `VERSION_MISMATCH` | falsches `v` (fatal) | Handshake |
| `NOT_IN_ROOM` | Nachricht vor Handshake | alle außer Handshake |
| `ALREADY_IN_ROOM` | zweiter Handshake auf derselben Verbindung | Handshake |
| `ROOM_NOT_FOUND` | Code unbekannt/abgelaufen | join, rejoin, resume |
| `ROOM_FULL` | 8 Spieler erreicht | join |
| `SERVER_FULL` | Raumlimit der Instanz | create |
| `NAME_INVALID` / `NAME_TAKEN` | Name leer/zu lang / vergeben | join, player.update |
| `TOKEN_INVALID` | Token falsch oder Gnadenfrist abgelaufen | rejoin, resume |
| `RATE_LIMITED` | Limit überschritten, `retryAfterMs` | alle |
| `NOT_ALLOWED` | Rolle darf das nicht / kein Teilnehmer | Lobby-/Spielaktionen |
| `INVALID_PHASE` | falsche Raumphase | Lobby-/Spielaktionen |
| `GAME_NOT_FOUND` | unbekannte `gameId` | selectGame |
| `NO_GAME_SELECTED` | Start ohne Spiel | start |
| `PLAYER_COUNT` | Spieleranzahl außerhalb min/max | start |
| `INVALID_SETTINGS` | Settings passen nicht zum Manifest | updateSettings |
| `INVALID_INPUT` | `game.input.data` vom Spielschema abgelehnt | game.input |
| `PLAYER_NOT_FOUND` | Ziel-Spieler unbekannt | kick |
| `INTERNAL` | Serverfehler / Spiel-Exception | alle |

Bei `room.rejoin`/`room.resume` bedeuten `VERSION_MISMATCH`, `TOKEN_INVALID`, `ROOM_NOT_FOUND` (`SESSION_INVALIDATING_CODES`): gespeicherte Sitzung löschen, nicht erneut versuchen.

## WebSocket-Close-Codes

`1000` normal · `4000` Protokollfehler · `4001` Versionskonflikt · `4002` Sitzung übernommen · `4003` gekickt · `4004` Raum geschlossen · `4008` Rate-Limit · `4009` Handshake-Timeout. Bei 4001–4004 nicht automatisch reconnecten; sonst Backoff `reconnectDelayMs(attempt)` (0,5 s … 10 s, ±20 % Jitter).
