// Konfiguration aus Umgebungsvariablen (siehe docs/architecture.md, Abschnitt Konfiguration),
// validiert mit zod. Fehler beim Start statt zur Laufzeit.
import proxyaddr from "@fastify/proxy-addr";
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
  /** Optional: Bearer-Token für Detailzahlen unter /healthz (sonst nur {ok:true}). */
  metricsToken: string | null;
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
      })
      .superRefine((v, ctx) => {
        if (typeof v !== "string") return;
        try {
          proxyaddr.compile(
            v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          );
        } catch (err) {
          ctx.addIssue({ code: "custom", message: `TRUST_PROXY: ungültige IP/CIDR-Liste (${String(err)})` });
        }
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
  METRICS_TOKEN: z.preprocess(trimmed, z.string().min(16, "METRICS_TOKEN: mindestens 16 Zeichen").optional()),
  NODE_ENV: z.string().optional(),
});

/** Warnungen beim Start (Konfiguration erlaubt, aber riskant). */
export function configWarnings(config: ServerConfig): string[] {
  const w: string[] = [];
  if (config.trustProxy === true) {
    w.push(
      "TRUST_PROXY=true vertraut jeder X-Forwarded-For-Kette – Clients können ihre IP fälschen und alle IP-Limits umgehen. " +
        "Nur im Dev-Modus erlaubt; Hop-Zahl (z. B. 1) oder Proxy-IP/CIDR verwenden.",
    );
  }
  return w;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Ungültige Konfiguration: ${details}`);
  }
  const e = parsed.data;
  const devMode = e.NODE_ENV !== "production";
  if (e.TRUST_PROXY === true && !devMode) {
    throw new Error(
      "Ungültige Konfiguration: TRUST_PROXY=true ist in Produktion nicht erlaubt (IP-Spoofing über X-Forwarded-For). " +
        "Hop-Zahl (z. B. TRUST_PROXY=1) oder IP/CIDR-Liste des Proxys angeben.",
    );
  }
  return {
    publicUrl: e.PUBLIC_URL ?? null,
    port: e.PORT,
    host: e.HOST,
    trustProxy: e.TRUST_PROXY,
    logLevel: e.LOG_LEVEL,
    allowedOrigins: e.ALLOWED_ORIGINS,
    devMode,
    metricsToken: e.METRICS_TOKEN ?? null,
  };
}
