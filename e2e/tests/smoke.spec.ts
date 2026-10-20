// Platzhalter-Smoke-Test (Phase 1). Echte Szenarien schreibt der Test-Agent.
import { expect, test } from "@playwright/test";

test("Server ist erreichbar", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.ok()).toBe(true);
});
