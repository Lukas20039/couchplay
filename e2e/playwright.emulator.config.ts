// Emulator-E2E (nur lokal, nicht in CI): Android-TV-AVD `couchplay_tv` + Server auf Host-Port 8080
// + Playwright-Handys. Start: `npm run test:emulator` (Root). Voraussetzung: Root-Build (`npm run build`).
// Erst-Boot des Emulators kann mehrere Minuten dauern; während des Laufs keine schweren Prozesse starten.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import type { TestOptions } from "./tests/fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
process.env.E2E_SHOTS_DIR ??= path.join(root, ".jait", "shots", "emulator");
// Handy-Videos lohnen hier nicht (Bildschirmaufnahme des TVs kommt per screenrecord).
process.env.E2E_VIDEO ??= "retain-on-failure";
const reportDir = path.join(root, ".jait", "artifacts", "emulator-report");

export default defineConfig<TestOptions>({
  testDir: "./emulator",
  outputDir: `${reportDir}-results`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Boot/Install laufen im Worker-Fixture (eigenes Timeout); die Tests selbst sind kürzer.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { outputFolder: reportDir, open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:8080",
    phone: "pixel7",
    actionTimeout: 20_000,
  },
});
