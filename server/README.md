# @couchplay/server

**Zuständig:** Agent A.

Fastify + `ws`, server-authoritative. Protokoll: `docs/protocol.md`, Deployment: `docs/deploy.md`.

| Datei | Inhalt |
|---|---|
| `src/index.ts` | Einstieg: Config, Listen, SIGTERM/SIGINT → Graceful Shutdown |
| `src/config.ts` | ENV (`PUBLIC_URL`, `PORT`, `HOST`, `TRUST_PROXY`, `LOG_LEVEL`, `ALLOWED_ORIGINS`) mit zod |
| `src/app.ts` | Fastify-App: `/healthz`, `/api/catalog`, Static, Sicherheitsheader, Gateway; `app.couchplay` (Runtime) |
| `src/options.ts` | Grenzen/Zeiten (Defaults aus `@couchplay/protocol/constants`, in Tests überschreibbar) |
| `src/ws/gateway.ts` | `/ws`: Origin-Check, Verbindungen/IP, Heartbeat, Handshake-Timeout, Rate-Limits, `parseClientMessage` → `CLIENT_MESSAGE_RULES` → Handler |
| `src/ws/request-info.ts` | Client-IP (`TRUST_PROXY`), Basis-URL aus Request, Origin-Prüfung |
| `src/rooms/manager.ts` | Raumcodes (kryptografisch, kollisionsfrei), Raumlimit, Idle-Ablauf |
| `src/rooms/room.ts` | Spieler, Host-Wechsel, Gnadenfrist, Phasen, Settings, Teilnehmer (`resolveParticipants`), `createGameSession`, Cache `game.tv`/`game.view`, Crash → Lobby |
| `src/http/static.ts` | `tv-web/dist` unter `/tv/`, `controller-pwa/dist` unter `/`, `/j/:code`, SPA-Fallback, Cache-Header |
| `src/http/security.ts` | CSP (inkl. Hashes von Inline-Skripten der index.html), nosniff, Referrer-Policy … |
| `src/games.ts` | Registrierung der eingebauten Spiele |

Tests (`test/`): echter Server auf zufälligem Port, echte `ws`-Clients, Dummy-Spiel `test/fixtures/test-game.ts`.

Scripts: `dev` (tsx watch), `build` (esbuild → `dist/index.js`), `start`, `typecheck`, `test`.
