# @couchplay/server

**Zuständig:** Agent A.

Fastify + `ws`, server-authoritative. Gerüst vorhanden: `src/config.ts` (ENV), `src/app.ts` (`/healthz`), `src/games.ts` (eingebaute Spiele), `build.mjs` (esbuild-Bundle → `dist/index.js`).

Zu implementieren (Vorschlag für die Struktur):

- `src/ws/` – Upgrade auf `/ws` (Origin-Check, `maxPayload`, Verbindungen/IP), Heartbeat, Handshake-Timeout, `parseClientMessage` → `CLIENT_MESSAGE_RULES` → Handler.
- `src/rooms/` – `RoomManager` (Codes, Idle-Timeout, Limits), `Room` (Spieler, Host-Übergabe, Phasen, Settings, Reconnect-Gnadenfrist, Cache letzter `game.tv`/`game.view`, `seq`).
- `src/game-runner.ts` – Brücke zu `createGameSession` aus `@couchplay/game-sdk` (`systemClock`, `randomSeed()`, `previous`).
- `src/rate-limit.ts` – Token-Buckets laut `@couchplay/protocol/constants`.
- `src/static.ts` – `@fastify/static`: `../tv-web/dist` unter `/tv/`, `../controller-pwa/dist` unter `/` inkl. `/j/:code` und SPA-Fallback.
- Integrationstests mit echten WS-Clients (`ws`) in `test/`.
- Später: `Dockerfile` (multi-arch, non-root, HEALTHCHECK) + GitHub-Actions-Workflow → GHCR.

Scripts: `dev` (tsx watch), `build`, `start`, `typecheck`, `test`.
