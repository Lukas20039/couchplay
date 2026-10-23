# syntax=docker/dockerfile:1.7
# CouchPlay – Game-Server inkl. TV-Web-UI (/tv/) und Controller-PWA (/).
# Multi-Stage: build (alle Workspaces) → deps (nur Produktions-Abhängigkeiten des Servers) → runtime.

# Base-Image per Digest gepinnt (reproduzierbar); Aktualisierung über Renovate/Dependabot.
ARG NODE_IMAGE=node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

# ---------------------------------------------------------------------------
# 1) Build: alle Workspaces installieren und bauen
# ---------------------------------------------------------------------------
# Build- und deps-Stufe laufen nativ auf der Build-Maschine ($BUILDPLATFORM), auch beim
# arm64-Image: npm unter QEMU-Emulation hängt sporadisch. Das ist zulässig, weil das Ergebnis
# plattformunabhängig ist (JS-Bundle, statische Dateien, Abhängigkeiten ohne native Module –
# geprüft: keine *.node / binding.gyp in node_modules der Runtime).
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS build
WORKDIR /app

# Nur Manifeste zuerst → npm-Cache-Layer bleibt bei Code-Änderungen gültig.
COPY package.json package-lock.json ./
COPY packages/protocol/package.json packages/protocol/
COPY packages/game-sdk/package.json packages/game-sdk/
COPY games/quiz/package.json games/quiz/
COPY games/tictactoe/package.json games/tictactoe/
COPY games/wortgarten/package.json games/wortgarten/
COPY games/schiffe/package.json games/schiffe/
COPY server/package.json server/
COPY tv-web/package.json tv-web/
COPY controller-pwa/package.json controller-pwa/
COPY e2e/package.json e2e/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --no-audit --no-fund

COPY . .
# Source Maps der Frontends nicht ausliefern (die Server-Map bleibt intern für Stacktraces).
RUN npm run build \
 && test -f server/dist/index.js \
 && test -f tv-web/dist/index.html \
 && test -f controller-pwa/dist/index.html \
 && find tv-web/dist controller-pwa/dist -name '*.map' -delete

# ---------------------------------------------------------------------------
# 2) Produktions-Abhängigkeiten des Server-Bundles (fastify, ws, zod, …)
#    Workspace-Code (@couchplay/*) ist im esbuild-Bundle eingebettet.
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/protocol/package.json packages/protocol/
COPY --from=build /app/packages/game-sdk/package.json packages/game-sdk/
COPY --from=build /app/games/quiz/package.json games/quiz/
COPY --from=build /app/games/tictactoe/package.json games/tictactoe/
COPY --from=build /app/games/wortgarten/package.json games/wortgarten/
COPY --from=build /app/games/schiffe/package.json games/schiffe/
COPY --from=build /app/server/package.json server/
COPY --from=build /app/tv-web/package.json tv-web/
COPY --from=build /app/controller-pwa/package.json controller-pwa/
COPY --from=build /app/e2e/package.json e2e/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace=@couchplay/server --no-audit --no-fund \
 && rm -rf node_modules/@couchplay node_modules/.package-lock.json

# ---------------------------------------------------------------------------
# 3) Runtime: nur Bundle, statische Builds und Produktions-Abhängigkeiten
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="CouchPlay" \
      org.opencontainers.image.description="Game-Server für CouchPlay: Android TV als Spielkonsole, Smartphones als Controller" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    LOG_LEVEL=info

WORKDIR /app
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /app/package.json ./package.json
COPY --from=build --chown=root:root /app/server/package.json ./server/package.json
COPY --from=build --chown=root:root /app/server/dist ./server/dist
COPY --from=build --chown=root:root /app/tv-web/dist ./tv-web/dist
COPY --from=build --chown=root:root /app/controller-pwa/dist ./controller-pwa/dist

# Dateien gehören root (nur lesbar), Prozess läuft als unprivilegierter Benutzer "node".
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1

# SIGTERM → Graceful Shutdown (Clients erhalten room.closed{server_shutdown}).
STOPSIGNAL SIGTERM
CMD ["node", "--enable-source-maps", "server/dist/index.js"]
