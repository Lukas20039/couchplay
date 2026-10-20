// Konfiguration aus Umgebungsvariablen (siehe docs/architecture.md, Abschnitt Konfiguration).

export interface ServerConfig {
  /** Öffentliche Basis-URL für Join-Links/QR, z. B. "https://play.example.org". */
  publicUrl: string;
  port: number;
  host: string;
  /** Fastify trustProxy: true/false, Hop-Anzahl oder IP-Liste. */
  trustProxy: boolean | number | string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 8080);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`Ungültiger PORT: ${env.PORT}`);

  const publicUrl = (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, "");
  if (!/^https?:\/\//.test(publicUrl)) throw new Error(`PUBLIC_URL muss mit http(s):// beginnen: ${publicUrl}`);

  const rawTrust = env.TRUST_PROXY ?? "false";
  let trustProxy: boolean | number | string;
  if (rawTrust === "true" || rawTrust === "false") trustProxy = rawTrust === "true";
  else if (/^\d+$/.test(rawTrust)) trustProxy = Number(rawTrust);
  else trustProxy = rawTrust;

  const logLevel = (env.LOG_LEVEL ?? "info") as ServerConfig["logLevel"];
  if (!LOG_LEVELS.includes(logLevel)) throw new Error(`Ungültiges LOG_LEVEL: ${env.LOG_LEVEL}`);

  return { publicUrl, port, host: env.HOST ?? "0.0.0.0", trustProxy, logLevel };
}
