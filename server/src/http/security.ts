// Sicherheitsheader für alle HTTP-Antworten. CSP passend für die Preact/Vite-Builds
// (nur eigene Skripte, kein eval) und WebSocket zur selben Origin.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * SHA-256-Hashes aller Inline-Skripte der gebauten index.html-Dateien (z. B. der
 * nomodule-Hinweis in tv-web), damit die CSP ohne 'unsafe-inline' auskommt.
 */
export function inlineScriptHashes(htmlFiles: readonly string[]): string[] {
  const hashes = new Set<string>();
  for (const file of htmlFiles) {
    let html: string;
    try {
      html = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const m of html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      const body = m[1] ?? "";
      if (body.trim() === "") continue;
      hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
    }
  }
  return [...hashes];
}

const HOST_PATTERN = /^[a-zA-Z0-9.-]+(:\d{1,5})?$|^\[[0-9a-fA-F:.]+\](:\d{1,5})?$/;

export function contentSecurityPolicy(host: string | undefined, scriptHashes: readonly string[] = []): string {
  // 'self' deckt ws/wss zur selben Origin in CSP3 ab; explizit für ältere WebViews.
  const ws = host && HOST_PATTERN.test(host) ? ` ws://${host} wss://${host}` : "";
  return [
    "default-src 'self'",
    ["script-src 'self'", ...scriptHashes].join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' data: blob:",
    `connect-src 'self'${ws}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function hostOf(req: FastifyRequest): string | undefined {
  try {
    return req.host;
  } catch {
    return undefined;
  }
}

export function registerSecurityHeaders(app: FastifyInstance, scriptHashes: readonly string[] = []): void {
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("Content-Security-Policy", contentSecurityPolicy(hostOf(req), scriptHashes));
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Permissions-Policy", "geolocation=(), microphone=(), payment=(), usb=()");
    return payload;
  });
}
