import { describe, expect, it } from "vitest";
import { configWarnings, loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("liefert Defaults (PUBLIC_URL leer → aus Request ableiten)", () => {
    expect(loadConfig({})).toEqual({
      publicUrl: null,
      port: 8080,
      host: "0.0.0.0",
      trustProxy: false,
      logLevel: "info",
      allowedOrigins: [],
      devMode: true,
      metricsToken: null,
    });
  });

  it("parst ENV und entfernt abschließenden Slash", () => {
    const c = loadConfig({
      PORT: "9000",
      PUBLIC_URL: "https://play.example.org/",
      TRUST_PROXY: "1",
      LOG_LEVEL: "warn",
      HOST: "127.0.0.1",
      ALLOWED_ORIGINS: "https://a.example.org, https://b.example.org/",
      NODE_ENV: "production",
    });
    expect(c).toEqual({
      publicUrl: "https://play.example.org",
      port: 9000,
      host: "127.0.0.1",
      trustProxy: 1,
      logLevel: "warn",
      allowedOrigins: ["https://a.example.org", "https://b.example.org"],
      devMode: false,
      metricsToken: null,
    });
  });

  it("TRUST_PROXY: Hop-Zahl, IP/CIDR-Liste; true nur im Dev-Modus (mit Warnung)", () => {
    expect(loadConfig({ TRUST_PROXY: "false" }).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: "2", NODE_ENV: "production" }).trustProxy).toBe(2);
    expect(loadConfig({ TRUST_PROXY: "10.0.0.0/8, 127.0.0.1, loopback" }).trustProxy).toBe("10.0.0.0/8, 127.0.0.1, loopback");
    expect(() => loadConfig({ TRUST_PROXY: "10.0.0.0/99" })).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig({ TRUST_PROXY: "true", NODE_ENV: "production" })).toThrow(/TRUST_PROXY=true/);
    const dev = loadConfig({ TRUST_PROXY: "true" });
    expect(dev.trustProxy).toBe(true);
    expect(configWarnings(dev).join()).toMatch(/TRUST_PROXY=true/);
    expect(configWarnings(loadConfig({ TRUST_PROXY: "1" }))).toEqual([]);
  });

  it("METRICS_TOKEN optional, mindestens 16 Zeichen", () => {
    expect(loadConfig({ METRICS_TOKEN: "x".repeat(16) }).metricsToken).toBe("x".repeat(16));
    expect(() => loadConfig({ METRICS_TOKEN: "kurz" })).toThrow(/METRICS_TOKEN/);
  });

  it("leere Strings gelten als nicht gesetzt", () => {
    expect(loadConfig({ PUBLIC_URL: "", PORT: "" })).toMatchObject({ publicUrl: null, port: 8080 });
  });

  it("lehnt ungültige Werte ab", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: "70000" })).toThrow();
    expect(() => loadConfig({ PUBLIC_URL: "ftp://x" })).toThrow(/PUBLIC_URL/);
    expect(() => loadConfig({ LOG_LEVEL: "laut" })).toThrow(/LOG_LEVEL/);
    expect(() => loadConfig({ ALLOWED_ORIGINS: "nicht-url" })).toThrow(/ALLOWED_ORIGINS/);
  });
});
