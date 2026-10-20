// Auslieferung der gebauten Frontends: tv-web unter /tv/, controller-pwa unter /
// (inkl. /j/:code und SPA-Fallback). Cache-Header: HTML/Service-Worker/Manifest
// immer revalidieren, gehashte Vite-Assets (/assets/) unveränderlich.
import { existsSync } from "node:fs";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import { TV_PATH, WS_PATH } from "@couchplay/protocol/constants";
import { parseJoinPath } from "@couchplay/protocol/util";
import type { FastifyInstance, FastifyReply } from "fastify";

export interface StaticDirs {
  tv: string;
  controller: string;
}

/**
 * Standardpfade relativ zu diesem Modul. Quelltext liegt in server/src/http/, das
 * esbuild-Bundle in server/dist/ – beide Fälle werden geprüft.
 */
export function defaultStaticDirs(): StaticDirs {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "../../.."), resolve(here, "../..")];
  const root = candidates.find((c) => existsSync(resolve(c, "tv-web"))) ?? (candidates[0] as string);
  return { tv: resolve(root, "tv-web/dist"), controller: resolve(root, "controller-pwa/dist") };
}

const NO_CACHE_FILES = new Set(["sw.js", "service-worker.js", "registerSW.js"]);
const IMMUTABLE = "public, max-age=31536000, immutable";

/** Cache-Control/Content-Type pro Datei (wird von @fastify/static vor dem Senden aufgerufen). */
export function cacheHeadersFor(filePath: string): { cacheControl: string; contentType?: string } {
  const name = basename(filePath);
  if (name.endsWith(".webmanifest")) {
    return { cacheControl: "no-cache", contentType: "application/manifest+json; charset=utf-8" };
  }
  if (name.endsWith(".html") || NO_CACHE_FILES.has(name)) return { cacheControl: "no-cache" };
  if (filePath.includes(`${sep}assets${sep}`)) return { cacheControl: IMMUTABLE };
  return { cacheControl: "public, max-age=3600" };
}

function setHeaders(reply: FastifyReply, filePath: string): void {
  const h = cacheHeadersFor(filePath);
  reply.header("Cache-Control", h.cacheControl);
  if (h.contentType) reply.header("Content-Type", h.contentType);
}

const hasIndex = (dir: string): boolean => existsSync(resolve(dir, "index.html"));

/** Letztes Pfadsegment ohne Punkt → Navigations-Request (SPA-Fallback), sonst echte Datei. */
const looksLikeRoute = (path: string): boolean => !(path.split("/").pop() ?? "").includes(".");

export async function registerStatic(app: FastifyInstance, dirs: StaticDirs): Promise<void> {
  const tvOk = hasIndex(dirs.tv);
  const controllerOk = hasIndex(dirs.controller);
  if (!tvOk) app.log.warn({ dir: dirs.tv }, "tv-web ist nicht gebaut – /tv/ liefert 503");
  if (!controllerOk) app.log.warn({ dir: dirs.controller }, "controller-pwa ist nicht gebaut – / liefert 503");

  const common = { cacheControl: false, etag: true, lastModified: true, setHeaders, wildcard: true, index: ["index.html"] };
  // decorateReply nur einmal (reply.sendFile wird für den Fallback gebraucht).
  if (controllerOk) await app.register(fastifyStatic, { ...common, root: dirs.controller, prefix: "/", decorateReply: true });
  if (tvOk) {
    await app.register(fastifyStatic, {
      ...common,
      root: dirs.tv,
      prefix: TV_PATH,
      decorateReply: !controllerOk,
      redirect: false,
    });
  }

  const sendIndex = (reply: FastifyReply, which: "tv" | "controller"): FastifyReply => {
    const ok = which === "tv" ? tvOk : controllerOk;
    if (!ok) {
      return reply.code(503).header("Cache-Control", "no-store").type("text/plain; charset=utf-8").send("Frontend nicht gebaut (npm run build)");
    }
    return reply.sendFile("index.html", which === "tv" ? dirs.tv : dirs.controller);
  };

  app.get("/tv", (_req, reply) => reply.redirect(TV_PATH, 301));
  app.get(WS_PATH, (_req, reply) =>
    reply.code(426).header("Upgrade", "websocket").type("text/plain; charset=utf-8").send("WebSocket-Upgrade erforderlich"),
  );
  // Join-Link aus dem QR-Code → Controller-App (liest den Code selbst aus dem Pfad).
  app.get("/j/:code", (req, reply) => {
    if (parseJoinPath(req.url.split("?")[0] ?? "") === null) return reply.callNotFound();
    return sendIndex(reply, "controller");
  });

  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split("?")[0] ?? "/";
    const isNav = (req.method === "GET" || req.method === "HEAD") && looksLikeRoute(path) && !path.startsWith("/api/");
    if (isNav) return sendIndex(reply, path.startsWith(TV_PATH) ? "tv" : "controller");
    return reply.code(404).header("Cache-Control", "no-store").send({ error: "not_found" });
  });
}
