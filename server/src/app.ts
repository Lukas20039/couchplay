// Fastify-App: HTTP-Routen (/healthz, /api/catalog, statische Frontends),
// WebSocket-Gateway /ws und Raumverwaltung. Graceful Shutdown über app.close().
import { join } from "node:path";
import type { AnyGameDefinition } from "@couchplay/game-sdk";
import Fastify, { type FastifyInstance } from "fastify";
import { GameCatalog } from "./catalog.js";
import { configWarnings, type ServerConfig } from "./config.js";
import { BUILTIN_GAMES } from "./games.js";
import { inlineScriptHashes, registerSecurityHeaders } from "./http/security.js";
import { defaultStaticDirs, registerStatic, type StaticDirs } from "./http/static.js";
import { DEFAULT_LIMITS, type ServerLimits } from "./options.js";
import { tokensEqual } from "./rooms/ids.js";
import { RoomManager } from "./rooms/manager.js";
import { Gateway } from "./ws/gateway.js";
import { untrustedXffWarner } from "./ws/request-info.js";

export interface AppOptions {
  /** Registrierte Spiele (Standard: eingebaute Spiele). */
  games?: readonly AnyGameDefinition[];
  /** Verzeichnisse der gebauten Frontends (Standard: ../tv-web/dist, ../controller-pwa/dist). */
  staticDirs?: StaticDirs;
  /** Einzelne Grenzen überschreiben (Tests). */
  limits?: Partial<ServerLimits>;
  /** Ziel der Logs (Standard: stdout); Tests lesen Warnungen mit. */
  logStream?: NodeJS.WritableStream;
}

export interface CouchPlayRuntime {
  rooms: RoomManager;
  gateway: Gateway;
  catalog: GameCatalog;
  limits: ServerLimits;
}

declare module "fastify" {
  interface FastifyInstance {
    couchplay: CouchPlayRuntime;
  }
}

function trustProxyOption(trust: ServerConfig["trustProxy"]): boolean | string | ((addr: string, hop: number) => boolean) {
  // Zahl = Anzahl vertrauenswürdiger Proxy-Hops (Fastify-Typen kennen nur die Funktionsform).
  if (typeof trust === "number") return (_addr: string, hop: number) => hop < trust;
  return trust;
}

export async function buildApp(config: ServerConfig, options: AppOptions = {}): Promise<FastifyInstance> {
  const limits: ServerLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const app = Fastify({
    logger: options.logStream ? { level: config.logLevel, stream: options.logStream } : { level: config.logLevel },
    trustProxy: trustProxyOption(config.trustProxy),
    // Upgrade-Sockets nicht künstlich offen halten; Shutdown schließt sie selbst.
    forceCloseConnections: true,
  });

  for (const warning of configWarnings(config)) app.log.warn(warning);
  const warnXff = untrustedXffWarner(config, app.log);
  app.addHook("onRequest", async (req) => warnXff(req.raw));

  const catalog = new GameCatalog(options.games ?? BUILTIN_GAMES);
  const rooms = new RoomManager({
    catalog,
    maxRooms: limits.maxRooms,
    maxRoomsPerIp: limits.maxRoomsPerIp,
    roomIdleTimeoutMs: limits.roomIdleTimeoutMs,
    orphanRoomTimeoutMs: limits.orphanRoomTimeoutMs,
    reconnectGraceMs: limits.reconnectGraceMs,
    stateCoalesceMs: limits.stateCoalesceMs,
    log: app.log,
  });
  const gateway = new Gateway({ config, limits, rooms, catalog, log: app.log, warnXff });
  gateway.attach(app.server);
  app.decorate("couchplay", { rooms, gateway, catalog, limits });

  const sweeper = setInterval(() => {
    rooms.sweepIdle();
    gateway.sweep();
  }, limits.sweepIntervalMs);
  sweeper.unref();

  // Vor dem Schließen des HTTP-Servers: Clients informieren, Sockets schließen.
  app.addHook("preClose", async () => {
    clearInterval(sweeper);
    await gateway.shutdown();
  });

  const staticDirs = options.staticDirs ?? defaultStaticDirs();
  registerSecurityHeaders(
    app,
    inlineScriptHashes([join(staticDirs.tv, "index.html"), join(staticDirs.controller, "index.html")]),
  );

  // Öffentlich nur {ok:true}; Auslastung nur mit METRICS_TOKEN (Authorization: Bearer …).
  app.get("/healthz", { logLevel: "warn" }, async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const auth = req.headers.authorization;
    const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (config.metricsToken && token && tokensEqual(config.metricsToken, token)) {
      return { ok: true, rooms: rooms.size, connections: gateway.connectionCount };
    }
    return { ok: true };
  });

  app.get("/api/catalog", async (_req, reply) => {
    reply.header("Cache-Control", "no-cache");
    return { games: catalog.manifests };
  });

  await registerStatic(app, staticDirs, { serveSourceMaps: config.devMode });

  return app;
}
