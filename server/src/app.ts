// Fastify-App. GERÜST (Phase 1): nur /healthz. WS-Endpoint /ws, Raumverwaltung,
// statische Auslieferung von tv-web (/tv/) und controller-pwa (/, /j/:code)
// implementiert Agent A (siehe server/README.md).
import Fastify, { type FastifyInstance } from "fastify";
import type { ServerConfig } from "./config.js";

export async function buildApp(config: ServerConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    // Zahl = Anzahl vertrauenswürdiger Proxy-Hops (Fastify-Typen kennen nur die Funktionsform).
    trustProxy:
      typeof config.trustProxy === "number"
        ? ((hops: number) => (_addr: string, i: number) => i < hops)(config.trustProxy)
        : config.trustProxy,
  });

  app.get("/healthz", async () => ({ ok: true }));

  return app;
}
