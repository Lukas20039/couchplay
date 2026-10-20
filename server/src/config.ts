// Konfiguration aus Umgebungsvariablen (siehe docs/architecture.md, Abschnitt Konfiguration),
// validiert mit zod. Fehler beim Start statt zur Laufzeit.
import { z } from "zod";

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface ServerConfig {
  /**
   * Öffentliche Basis-URL für Join-Links/QR, z. B. "https://play.example.org" (ohne Slash am Ende).
   * null = nicht gesetzt → wird pro Raum aus dem Request (Host / X-Forwarded-*) abgeleitet.
   */
  publicUrl: string | null;
  port: number;
  host: string;
  /** Fastify trustProxy: true/false, Hop-Anzahl oder IP-/CIDR-Liste (kommagetrennt). */
  trustProxy: boolean | number | string;
  logLevel: LogLevel;
  /**
   * Erlaubte Origins für das WS-Upgrade (zusätzlich zur gleichen Origin wie der Request-Host
   * und der Origin von PUBLIC_URL). "*" = alle. Leer = nur die Defaults.
   */
  allowedOrigins: string[];
  /** Dev-Modus (NODE_ENV ≠ production): jede Origin erlaubt. */
  devMode: boolean;
}

const trimmed = (v: unknown): unknown => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v);

const EnvSchema = z.object({
  PUBLIC_URL: z.preprocess(
    trimmed,
    z
      .url({ protocol: /^https?$/, message: "PUBLIC_URL muss eine http(s)-URL sein" })
      .transform((u) => u.replace(/\/+$/, ""))
      .optional(),
  ),
  PORT: z.preprocess(trimmed, z.coerce.number().int().min(1).max(65535).default(8080)),
  HOST: z.preprocess(trimmed, z.string().min(1).default("0.0.0.0")),
  TRUST_PROXY: z.preprocess(
    trimmed,
    z
      .string()
      .default("false")
      .transform((raw): boolean | number | string => {
        if (raw === "true" || raw === "false") return raw === "true";
        if (/^\d+$/.test(raw)) return Number(raw);
        return raw;
      }),
  ),
  LOG_LEVEL: z.preprocess(trimmed, z.enum(LOG_LEVELS).default("info")),
  ALLOWED_ORIGINS: z.preprocess(
    trimmed,
    z
      .string()
      .default("")
      .transform((raw) =>
        raw
          .split(",")
          .map((s) => s.trim().replace(/\/+$/, ""))
          .filter((s) => s.length > 0),
      )
      .refine((list) => list.every((o) => o === "*" || /^https?:\/\/[^/\s]+$/.test(o)), {
        message: "ALLOWED_ORIGINS: kommagetrennte Origins wie https://play.example.org oder *",
      }),
  ),
  NODE_ENV: z.string().optional(),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ungültige Konfiguration: ${details}`);
  }
  const e = parsed.data;
  return {
    publicUrl: e.PUBLIC_URL ?? null,
    port: e.PORT,
    host: e.HOST,
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    allowedOrigins: e.ALLOWED_ORIGINS,
    devMode: e.NODE_ENV !== "production",
  };
}
