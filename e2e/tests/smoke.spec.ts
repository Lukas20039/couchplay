// Smoke: Server (webServer) antwortet auf den Healthcheck.
import { expect, test } from "@playwright/test";

test("Server ist erreichbar", async ({ request }) => {
  const res = await request.get("/healthz");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toMatchObject({ ok: true });
});
