import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

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
    });
  });

  it("TRUST_PROXY: true/false/IP-Liste", () => {
    expect(loadConfig({ TRUST_PROXY: "true" }).trustProxy).toBe(true);
    expect(loadConfig({ TRUST_PROXY: "false" }).trustProxy).toBe(false);
    expect(loadConfig({ TRUST_PROXY: "10.0.0.0/8,127.0.0.1" }).trustProxy).toBe("10.0.0.0/8,127.0.0.1");
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
