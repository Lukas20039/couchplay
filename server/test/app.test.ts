import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { BUILTIN_GAMES } from "../src/games.js";
import { cacheHeadersFor } from "../src/http/static.js";
import type { FastifyInstance } from "fastify";

describe("Spielregistrierung", () => {
  it("registriert eingebaute Spiele mit eindeutigen IDs", () => {
    const ids = BUILTIN_GAMES.map((g) => g.manifest.id);
    expect(ids).toEqual(["quiz", "tictactoe", "wortgarten", "schiffe", "blockblast"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("HTTP", () => {
  let dir: string;
  let app: FastifyInstance;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "couchplay-static-"));
    const ctrl = join(dir, "controller");
    const tv = join(dir, "tv");
    mkdirSync(join(ctrl, "assets"), { recursive: true });
    mkdirSync(join(tv, "assets"), { recursive: true });
    writeFileSync(join(ctrl, "index.html"), "<!doctype html><title>controller</title>");
    writeFileSync(join(ctrl, "assets", "index-abc123.js"), "console.log(1)");
    writeFileSync(join(ctrl, "manifest.webmanifest"), "{}");
    writeFileSync(join(ctrl, "sw.js"), "self.addEventListener('install',()=>{})");
    writeFileSync(join(ctrl, "icon-192.png"), "png");
    writeFileSync(join(tv, "index.html"), "<!doctype html><title>tv</title><script nomodule>alert(1)</script>");
    writeFileSync(join(tv, "assets", "index-def456.css"), "body{}");
    app = await buildApp({ ...loadConfig({}), logLevel: "silent" }, { staticDirs: { tv, controller: ctrl } });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("antwortet auf /healthz", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("meldet sich unter /api/discover für die TV-App", async () => {
    const res = await app.inject({ method: "GET", url: "/api/discover" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ service: "couchplay", protocol: 1, publicUrl: null });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("liefert den Spielkatalog unter /api/catalog", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { games: Array<{ id: string; minPlayers: number }> };
    expect(body.games.map((g) => g.id)).toEqual(["quiz", "tictactoe", "wortgarten", "schiffe", "blockblast"]);
  });

  it("liefert Controller unter / mit no-cache und Sicherheitsheadern", async () => {
    const res = await app.inject({ method: "GET", url: "/", headers: { host: "play.example.org" } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("controller");
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    const csp = String(res.headers["content-security-policy"]);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self' ws://play.example.org wss://play.example.org");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });

  it("gehashte Assets sind immutable", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/index-abc123.js" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    const tvAsset = await app.inject({ method: "GET", url: "/tv/assets/index-def456.css" });
    expect(tvAsset.statusCode).toBe(200);
    expect(tvAsset.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });

  it("webmanifest mit richtigem Content-Type, Service-Worker no-cache", async () => {
    const m = await app.inject({ method: "GET", url: "/manifest.webmanifest" });
    expect(m.headers["content-type"]).toBe("application/manifest+json; charset=utf-8");
    expect(m.headers["cache-control"]).toBe("no-cache");
    const sw = await app.inject({ method: "GET", url: "/sw.js" });
    expect(sw.headers["cache-control"]).toBe("no-cache");
    const icon = await app.inject({ method: "GET", url: "/icon-192.png" });
    expect(icon.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("/j/:code und SPA-Routen liefern die Controller-index.html", async () => {
    for (const url of ["/j/042137", "/lobby", "/irgendwas/tief"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).toContain("controller");
      expect(res.headers["cache-control"], url).toBe("no-cache");
    }
  });

  it("/tv/ und TV-SPA-Routen liefern die TV-index.html", async () => {
    for (const url of ["/tv/", "/tv/lobby"]) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, url).toBe(200);
      expect(res.body, url).toContain("<title>tv</title>");
    }
    // Inline-Skript der index.html ist per Hash in der CSP erlaubt.
    const hash = createHash("sha256").update("alert(1)").digest("base64");
    const csp = String((await app.inject({ method: "GET", url: "/tv/" })).headers["content-security-policy"]);
    expect(csp).toContain(`script-src 'self' 'sha256-${hash}'`);
    const redirect = await app.inject({ method: "GET", url: "/tv" });
    expect(redirect.statusCode).toBe(301);
    expect(redirect.headers.location).toBe("/tv/");
  });

  it("fehlende Dateien → 404 statt index.html; /ws ohne Upgrade → 426", async () => {
    expect((await app.inject({ method: "GET", url: "/assets/fehlt-123.js" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/unbekannt" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/ws" })).statusCode).toBe(426);
  });

  it("cacheHeadersFor ordnet Dateien korrekt zu", () => {
    expect(cacheHeadersFor("/x/dist/index.html").cacheControl).toBe("no-cache");
    expect(cacheHeadersFor("/x/dist/registerSW.js").cacheControl).toBe("no-cache");
    expect(cacheHeadersFor("/x/dist/assets/a-1.js").cacheControl).toContain("immutable");
  });
});

describe("HTTP ohne gebaute Frontends", () => {
  it("liefert 503 mit Hinweis statt Absturz", async () => {
    const app = await buildApp(
      { ...loadConfig({}), logLevel: "silent" },
      { staticDirs: { tv: "/nonexistent/tv", controller: "/nonexistent/c" } },
    );
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/tv/" })).statusCode).toBe(503);
    expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    await app.close();
  });
});
