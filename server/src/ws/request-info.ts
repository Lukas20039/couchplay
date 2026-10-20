// Client-IP, öffentliche Basis-URL und Origin-Prüfung für rohe HTTP-Upgrade-Requests.
// Respektiert TRUST_PROXY genauso wie Fastify (request.ip).
import type { IncomingMessage } from "node:http";
import proxyaddr from "@fastify/proxy-addr";
import type { FastifyBaseLogger } from "fastify";
import type { ServerConfig } from "../config.js";

export type TrustFn = (addr: string, hop: number) => boolean;

export function compileTrust(trust: ServerConfig["trustProxy"]): TrustFn {
  if (trust === true) return () => true;
  if (trust === false) return () => false;
  if (typeof trust === "number") return (_addr, hop) => hop < trust;
  return proxyaddr.compile(splitTrustList(trust));
}

export function splitTrustList(trust: string): string[] {
  return trust
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Warnt einmalig, wenn TRUST_PROXY=false ist, aber Requests X-Forwarded-For tragen
 * (Server läuft vermutlich hinter einem Proxy → alle Nutzer teilen eine IP und damit die Limits).
 */
export function untrustedXffWarner(config: ServerConfig, log: FastifyBaseLogger): (req: IncomingMessage) => void {
  let warned = false;
  return (req) => {
    if (warned || config.trustProxy !== false || req.headers["x-forwarded-for"] === undefined) return;
    warned = true;
    log.warn(
      "Request mit X-Forwarded-For, aber TRUST_PROXY=false: Läuft der Server hinter einem Reverse-Proxy, " +
        "TRUST_PROXY auf die Hop-Zahl (z. B. 1) oder die Proxy-IP/CIDR setzen – sonst teilen sich alle Nutzer die Rate-Limits der Proxy-IP.",
    );
  };
}

export function clientIp(req: IncomingMessage, trust: TrustFn): string {
  try {
    return proxyaddr(req, trust);
  } catch {
    return req.socket.remoteAddress ?? "unknown";
  }
}

const HOST_PATTERN = /^[a-zA-Z0-9.-]+(:\d{1,5})?$|^\[[0-9a-fA-F:.]+\](:\d{1,5})?$/;

function firstHeader(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.split(",")[0]?.trim() || undefined;
}

/** Host und Schema des Requests (X-Forwarded-* nur von vertrauenswürdigem Proxy). */
export function requestOrigin(req: IncomingMessage, trust: TrustFn): { proto: "http" | "https"; host: string } | null {
  const trusted = trust(req.socket.remoteAddress ?? "", 0);
  const fwdHost = trusted ? firstHeader(req.headers["x-forwarded-host"]) : undefined;
  const fwdProto = trusted ? firstHeader(req.headers["x-forwarded-proto"]) : undefined;
  const host = fwdHost ?? req.headers.host;
  if (!host || !HOST_PATTERN.test(host)) return null;
  const encrypted = (req.socket as { encrypted?: boolean }).encrypted === true;
  const proto = fwdProto === "https" || fwdProto === "wss" || (!fwdProto && encrypted) ? "https" : "http";
  return { proto, host: host.toLowerCase() };
}

/** Basis-URL für Join-Links: PUBLIC_URL oder aus dem Request abgeleitet. */
export function publicBaseUrl(config: ServerConfig, req: IncomingMessage, trust: TrustFn): string {
  if (config.publicUrl) return config.publicUrl;
  const o = requestOrigin(req, trust);
  return o ? `${o.proto}://${o.host}` : `http://localhost:${config.port}`;
}

/**
 * Origin-Prüfung beim WS-Upgrade. Erlaubt: kein Origin-Header (Nicht-Browser-Clients),
 * Dev-Modus, "*", gleiche Origin wie der Request-Host, Origin von PUBLIC_URL,
 * Einträge aus ALLOWED_ORIGINS.
 */
export function isOriginAllowed(config: ServerConfig, req: IncomingMessage, trust: TrustFn): boolean {
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  if (config.devMode || config.allowedOrigins.includes("*")) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const normalized = parsed.origin.toLowerCase();
  if (config.allowedOrigins.some((o) => o.toLowerCase() === normalized)) return true;
  if (config.publicUrl && new URL(config.publicUrl).origin.toLowerCase() === normalized) return true;
  // Gleiche Origin: Ist PUBLIC_URL gesetzt, zählt nur der echte Host-Header (X-Forwarded-Host
  // könnte sonst eine beliebige Origin „passend" machen); ohne PUBLIC_URL auch der vertrauenswürdige XFH.
  const own = config.publicUrl ? requestOrigin(req, () => false) : requestOrigin(req, trust);
  return own !== null && parsed.host.toLowerCase() === own.host;
}
