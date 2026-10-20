# CouchPlay – Architektur

Verbindlich ergänzend zu `docs/PLAN.md`. Protokolldetails: `docs/protocol.md`.

## 1. Komponenten

```
 Android TV (Kotlin-Shell)            Smartphones (Browser / PWA)
 ┌───────────────────────┐            ┌─────────────────────────┐
 │ WebView → /tv/        │            │ controller-pwa → /, /j/ │
 │  tv-web (Preact)      │            │  (Preact)               │
 │  + Spiel-TV-Views     │            │  + Spiel-Controller-Views│
 └──────────┬────────────┘            └────────────┬────────────┘
            │ WebSocket /ws (JSON)                  │ WebSocket /ws (JSON)
            └──────────────┬────────────────────────┘
                 ┌─────────┴──────────────────────────────┐
                 │ server (Node 22, Fastify + ws)         │
                 │  HTTP: /tv/*, /, /j/:code, /healthz    │
                 │  RoomManager → Room → GameSession      │
                 │  Spiele: games/* (GameDefinition)      │
                 └────────────────────────────────────────┘
```

| Paket | Inhalt |
|---|---|
| `packages/protocol` | zod-Schemas + Typen aller WS-Nachrichten, Konstanten, Fehlercodes, Parser, Settings-Validierung. Einzige Quelle der Wahrheit für das Protokoll. |
| `packages/game-sdk` | Spielmodul-Schnittstelle (Server: `GameDefinition`/`GameContext`; Client: `GameTvView`/`GameControllerView`), Laufzeit `createGameSession`, RNG, Uhr, Test-Harness, Preact-Adapter. |
| `server` | Fastify-HTTP, WS-Endpoint, Raumverwaltung, Rate-Limits, Auslieferung der gebauten Frontends. |
| `tv-web` | TV-UI (10-Fuß, D-Pad): Start, Code + QR, Lobby, Spielauswahl, Ergebnis, Host-Funktionen per Fernbedienung. |
| `controller-pwa` | Handy-UI: Code/QR-Join, Name + Avatar, Lobby, Host-Einstellungen, Controller-View des Spiels. |
| `games/quiz`, `games/tictactoe` | je `manifest.json` + `src/server` + `src/tv` + `src/controller` + `src/shared.ts`. |
| `android-tv` | Kotlin-Shell (kein npm-Workspace). |
| `e2e` | Playwright-Browser-E2E, später Emulator-E2E. |

**Warum `packages/game-sdk` getrennt von `packages/protocol`:** `protocol` beschreibt nur das Drahtformat und ist für jeden Client Pflicht (klein, zod-only). Das SDK enthält Laufzeitcode (Timer, RNG, Session, Test-Harness) und DOM/Preact-Typen, die weder der Server-Netzwerkcode noch das Protokoll brauchen. Spiele hängen nur vom SDK (+ Typen aus `protocol`) ab; der Server benutzt dieselbe `createGameSession` wie das Test-Harness → Spiele verhalten sich in Tests exakt wie in Produktion.

**Quelltext-Pakete:** Workspace-Pakete exportieren TypeScript direkt (`exports → ./src/*.ts`). Vite/Vitest/tsx verarbeiten das nativ; der Server wird per esbuild gebündelt (Workspace-Code eingebettet, npm-Abhängigkeiten extern). Es gibt keinen Build-Schritt für Bibliotheken.

## 2. HTTP-Routen (Server)

| Route | Inhalt |
|---|---|
| `GET /healthz` | `{ ok: true }` (Docker-Healthcheck) |
| `GET /tv/*` | `tv-web/dist` (Vite `base: "/tv/"`) |
| `GET /j/:code` | `controller-pwa/dist/index.html` (Code aus Pfad, `parseJoinPath`) |
| `GET /*` | `controller-pwa/dist` (SPA-Fallback auf `index.html`) |
| `GET /ws` (Upgrade) | WebSocket, siehe Protokoll |

Dev: Server auf 8080, `tv-web` Vite 5173, `controller-pwa` Vite 5174; Vite proxyt `/ws` → 8080.

## 3. Rollen

- **tv** – eine Verbindung pro Raum, erstellt den Raum, hält `tvToken`. Darf Spiel wählen, Settings ändern, starten, abbrechen, kicken, Raum schließen. Empfängt `game.tv`.
- **player** – Handy, bis zu 8 pro Raum. Sendet `game.input`, empfängt nur die eigene `game.view`.
- **host** – der Spieler mit `isHost=true` (zuerst beigetreten). Hat zusätzlich die Lobby-Rechte des TV (Tabelle `CLIENT_MESSAGE_RULES`). Verlässt der Host den Raum endgültig, wird der am längsten anwesende Spieler Host. Während der Gnadenfrist bleibt er Host.

## 4. Raum-Lebenszyklus

```
 room.create ─▶ LOBBY ──lobby.start──▶ GAME ──ctx.end()──▶ RESULTS
                  ▲  ▲                  │                    │  │
                  │  └──game.abort──────┘                    │  │
                  │  └──Spiel-Exception (error INTERNAL)     │  │
                  └──────────────room.toLobby────────────────┘  │
                           GAME ◀──lobby.start (Revanche)───────┘
 jede Phase ──room.close / 2 h Inaktivität / Server-Stop──▶ CLOSED
```

- **create:** Server vergibt zufälligen, freien 6-stelligen Code (`000000`–`999999`, kryptografisch zufällig) und `tvToken`. Antwort `room.created`, dann `catalog`, `room.state`.
- **lobby:** Spieler treten bei (`room.join`). TV/Host wählt Spiel (`lobby.selectGame` → Settings = Defaults) und ändert Settings (`lobby.updateSettings`, validiert mit `validateSettings`).
- **game:** `lobby.start` prüft: Spiel gewählt, dann Teilnehmer per `resolveParticipants(players, playerLimits, msg.playerIds)`: ohne `playerIds` alle verbundenen Spieler in Beitrittsreihenfolge, gekappt auf `maxPlayers`; mit `playerIds` genau die gewählten (existent, verbunden, eindeutig); Anzahl in `[minPlayers, maxPlayers]` (sonst `PLAYER_COUNT`). Ergebnis → `room.state.gamePlayerIds`. Server erstellt `createGameSession(def, { players: nur Teilnehmer, settings, seed, clock, previous, sink })`. `room.state.playerLimits` liefert min/max des gewählten Spiels für die Auswahl-UI des Hosts.
- **Zuschauer:** alle Nicht-Teilnehmer (auch während der Runde Beitretende). Signal: `phase === "game"` und eigene ID ∉ `gamePlayerIds` (`isSpectator`). Sie bekommen keine `game.view`, `game.input` → `NOT_ALLOWED`; Controller zeigt Zuschauer-Screen. Ein Teilnehmer, der die Gnadenfrist überschreitet, wird entfernt (`onPlayerLeave`) und ist nach erneutem `room.join` Zuschauer bis zur nächsten Runde.
- **results:** `ctx.end(results)` → `room.state.results`. `lobby.start` = Revanche (gleiches Spiel/Settings, `ctx.previous` = letztes Ergebnis), `room.toLobby` → Lobby.
- **closed:** `room.closed{reason}` an alle, Verbindungen schließen (Close-Code 4004), Code wird frei.
- **Inaktivität:** jeder eingehende Client-Frame setzt `lastActivity`. Nach `ROOM_IDLE_TIMEOUT_MS` (2 h) → `closed(idle)`.

## 5. Datenfluss im Spiel (server-authoritative)

1. Handy: `game.input {data}` → Server prüft Rolle/Phase/Rate-Limit → `session.input(playerId, data)` → `inputSchema.safeParse` → `instance.onPlayerInput`.
2. Spiel ruft `ctx.broadcastTv(state)` / `ctx.sendToPlayer(id, view)` → Server verpackt als `game.tv` / `game.view` mit `seq` (pro Raum monoton) und **cached den letzten TV-State und die letzte View pro Spieler**.
3. Clients rendern nur, was sie bekommen. Kein Client berechnet Spielregeln.
4. Zeit: Spiele nutzen `ctx.timers` / `ctx.now()`; Countdowns senden `endsAt` (Serverzeit), Clients rechnen mit `serverNow()` (Offset aus `pong.serverTime`).

## 6. Reconnect

- **Handy:** nach `room.joined` speichert der Controller `{code, playerId, token}` unter `STORAGE_KEYS.playerSession`. Bei Abbruch: Spieler `connected=false`, Platz + Host-Status bleiben `PLAYER_RECONNECT_GRACE_MS` (2 min) reserviert, Spiel erhält `onPlayerConnectionChange(id,false)`. Client reconnectet mit Backoff (`reconnectDelayMs`) und sendet `room.rejoin`. Erfolgreich → `room.joined`, `catalog`, `room.state`, und in Phase game die gecachte letzte `game.view`. Gnadenfrist abgelaufen → Spieler entfernt (`onPlayerLeave`), Token ungültig.
- **TV:** speichert `{code, tvToken}` unter `STORAGE_KEYS.tvSession`; `room.resume` → `room.resumed`, `catalog`, `room.state`, gecachter `game.tv`. Der Raum lebt ohne TV weiter (bis Idle-Timeout); Spiele laufen weiter.
- **Doppelte Verbindung** mit gleichem Token: alte Verbindung wird mit Close-Code 4002 (`SESSION_REPLACED`) geschlossen.
- **Nicht reconnecten** bei Close-Codes 4001/4002/4003/4004 oder Fehlercodes aus `SESSION_INVALIDATING_CODES` → gespeicherte Sitzung löschen, Startbildschirm.
- **Heartbeat:** Server sendet WS-Ping alle 15 s; ohne Lebenszeichen 35 s → Verbindung terminiert (gilt als Abbruch).

## 7. Sicherheit & Rate-Limits

Alle Grenzen als Konstanten in `packages/protocol/src/constants.ts`.

| Was | Grenze | Reaktion |
|---|---|---|
| Nachrichtengröße | 16 KiB (`maxPayload` in ws + Parser) | `MESSAGE_TOO_LARGE` |
| Nachrichten / Verbindung | Token-Bucket 40, +20/s | `RATE_LIMITED` (+`retryAfterMs`), nach 20 Verstößen Close 4008 |
| `room.join`/`room.rejoin` / IP | Bucket 10, +10/min (zählt auch Fehlversuche) | `RATE_LIMITED` – verhindert Code-Raten |
| `room.create` / IP | Bucket 5, +5/min | `RATE_LIMITED` |
| Verbindungen / IP | 32 | Upgrade mit 429 ablehnen |
| Räume / Instanz | 1000 | `SERVER_FULL` |
| Handshake | erste Nachricht ≤ 10 s | Close 4009 |

- Client-IP über Fastify `request.ip` (respektiert `TRUST_PROXY`).
- Tokens: 24 Byte `crypto.randomBytes` → base64url; Vergleich mit `timingSafeEqual`.
- Namen: `normalizeName` (NFC, Steuer-/Bidi-Zeichen entfernt, 1–16 Codepoints), eindeutig per `nameKey`. Clients rendern Namen nur als Text (kein `innerHTML`).
- Jede eingehende Nachricht: `parseClientMessage` → Handshake-Pflicht → `CLIENT_MESSAGE_RULES` (Rolle/Phase) → Handler. Unbekannte Felder werden verworfen.
- `Origin`-Prüfung beim Upgrade gegen `PUBLIC_URL`-Host (+ localhost in Dev).

## 8. Fehlerfälle

| Fall | Verhalten |
|---|---|
| Ungültiges JSON / Schema | `error BAD_MESSAGE`, Verbindung bleibt |
| Falsche Protokollversion | `error VERSION_MISMATCH fatal`, Close 4001 → Client lädt neu |
| Falscher Code beim Join | `error ROOM_NOT_FOUND`, Verbindung bleibt (Retry, rate-limitiert) |
| Raum voll / Name vergeben | `ROOM_FULL` / `NAME_TAKEN` |
| Spiel wirft Exception | Session beendet (`sink.crash`), Log mit Seed, Raum → Lobby, `error INTERNAL` an TV + Spieler |
| Alle Teilnehmer weg | Spiel entscheidet (`onPlayerLeave`), typischerweise `ctx.end` |
| Spieler fällt unter `minPlayers` | Spiel entscheidet (z. B. TicTacToe: Bot übernimmt oder Sieg kampflos) |
| TV getrennt | Raum/Spiel laufen weiter, `tvConnected=false`, Handys zeigen Hinweis |
| Server-Neustart | Räume weg (In-Memory). Clients bekommen beim Rejoin `ROOM_NOT_FOUND` → Startbildschirm |

## 9. Konfiguration (ENV)

`PUBLIC_URL` (Basis für Join-Links/QR, Default `http://localhost:$PORT`), `PORT` (8080), `TRUST_PROXY` (`false`/`true`/Hop-Anzahl/IP-Liste), `LOG_LEVEL` (`info`), `HOST` (`0.0.0.0`). Logs: pino-JSON, pro Raum `room`-Feld, Spiel-Seed bei Spielstart.

## 10. Verzeichnisstruktur & Zuständigkeit

```
couchplay/
├─ package.json, tsconfig.base.json, tsconfig.web.json   Architekt
├─ AGENTS.md, docs/                                       Architekt
├─ packages/protocol/    Protokoll                        Architekt (Änderung nur per Antrag)
├─ packages/game-sdk/    Spiel-Schnittstelle + Laufzeit   Architekt (Änderung nur per Antrag)
├─ server/               Game-Server                      Agent A
├─ tv-web/               TV-UI                            Agent B
├─ android-tv/           Kotlin-Shell                     Agent B
├─ controller-pwa/       Handy-UI                         Agent C
├─ games/quiz/           Quiz                             Spiele-Agent (Phase 3)
├─ games/tictactoe/      TicTacToe                        Spiele-Agent (Phase 3)
└─ e2e/                  Playwright / Emulator            Test-Agent
```

Registrierungen der eingebauten Spiele (`server/src/games.ts`, `tv-web/src/games.ts`, `controller-pwa/src/games.ts`) sind bereits angelegt; Spiele-Agents müssen diese Dateien nicht anfassen.

Deployment (Dockerfile, GitHub Actions → GHCR) folgt nach Phase 2 im Root (`Dockerfile`, `.github/workflows/`), Zuständigkeit Agent A.
