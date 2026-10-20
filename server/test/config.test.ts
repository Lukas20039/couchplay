import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("liefert Defaults", () => {
    expect(loadConfig({})).toMatchObject({ port: 8080, publicUrl: "http://localhost:8080", trustProxy: false, logLevel: "info" });
  });

  it("parst ENV und entfernt abschließenden Slash", () => {
    const c = loadConfig({ PORT: "9000", PUBLIC_URL: "https://play.example.org/", TRUST_PROXY: "1", LOG_LEVEL: "warn" });
    expect(c).toMatchObject({ port: 9000, publicUrl: "https://play.example.org", trustProxy: 1, logLevel: "warn" });
  });

  it("lehnt ungültige Werte ab", () => {
    expect(() => loadConfig({ PORT: "abc" })).toThrow();
    expect(() => loadConfig({ PUBLIC_URL: "ftp://x" })).toThrow();
    expect(() => loadConfig({ LOG_LEVEL: "laut" })).toThrow();
  });
});
