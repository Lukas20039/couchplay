import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { BUILTIN_GAMES } from "../src/games.js";

describe("App-Gerüst", () => {
  it("antwortet auf /healthz", async () => {
    const app = await buildApp({ ...loadConfig({}), logLevel: "silent" });
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });

  it("registriert eingebaute Spiele mit eindeutigen IDs", () => {
    const ids = BUILTIN_GAMES.map((g) => g.manifest.id);
    expect(ids).toEqual(["quiz", "tictactoe"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
