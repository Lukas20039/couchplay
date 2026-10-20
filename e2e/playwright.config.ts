// Browser-E2E: ein TV-Kontext (Chromium 1920×1080) + mehrere Handy-Kontexte gegen einen
// lokal gestarteten Server. Browser einmalig installieren: `npx playwright install chromium webkit`.
//
// Projekte = Handy-Profil der Tests („Standard-Handy“). Der TV ist immer Chromium 1920×1080,
// gemischte Tests (8 Handys) holen sich zusätzlich das jeweils andere Profil – siehe tests/fixtures.ts.
//
// Artefakte:
//   lokal:  HTML-Report inkl. Videos/Screenshots → .jait/artifacts/e2e-report/ (Rohdaten: …/e2e-report-results/;
//           Ordner per E2E_ARTIFACTS_DIR änderbar)
//   CI:     Playwright-Standardordner e2e/playwright-report/ und e2e/test-results/ (Upload im Workflow)
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import type { PhoneProfile, TestOptions } from "./tests/fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const CI = !!process.env.CI;

/** Freien Port einmalig im Hauptprozess wählen; Worker erben ihn über die Umgebung. */
function freePort(): number {
  const out = execFileSync(
    process.execPath,
    ["-e", "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"],
    { encoding: "utf8" },
  );
  return Number(out.trim());
}
if (!process.env.E2E_PORT) process.env.E2E_PORT = String(freePort());
const PORT = Number(process.env.E2E_PORT);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const artifactsDir = process.env.E2E_ARTIFACTS_DIR
  ? path.resolve(process.env.E2E_ARTIFACTS_DIR)
  : CI
    ? null
    : path.join(root, ".jait", "artifacts", "e2e-report");
const reportDir = artifactsDir ?? path.join(here, "playwright-report");
// Rohdaten (Videos, Fehlerkontext) neben dem Report; der HTML-Report kopiert Anhänge nach <report>/data.
const outputDir = artifactsDir ? `${artifactsDir}-results` : path.join(here, "test-results");

// Root-Build (`npm run build`) wird vorausgesetzt. Fehlt er (z. B. frischer CI-Checkout), wird er nachgeholt.
const built = ["server/dist/index.js", "tv-web/dist/index.html", "controller-pwa/dist/index.html"].every((f) => existsSync(path.join(root, f)));
const serverCmd = "node server/dist/index.js";

export default defineConfig<TestOptions>({
  testDir: "./tests",
  outputDir,
  // Ein Worker: Die Tests starten bis zu 9 Browser-Kontexte gleichzeitig (Host mit wenig RAM).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: reportDir, open: "never" }]],
  use: {
    baseURL: BASE_URL,
    // Videos/Screenshots der selbst erzeugten Kontexte steuert tests/fixtures.ts (E2E_VIDEO).
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: built ? serverCmd : `npm run build && ${serverCmd}`,
    cwd: root,
    url: `${BASE_URL}/healthz`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      HOST: "127.0.0.1",
      PUBLIC_URL: BASE_URL,
      LOG_LEVEL: "warn",
      NODE_ENV: "production",
      // Jedes simulierte Gerät schickt eine eigene X-Forwarded-For-Adresse (wie verschiedene
      // Handys im WLAN). Sonst teilen sich alle Kontexte 127.0.0.1 und laufen in das Join-Limit
      // (10/min pro IP). Vertraut wird nur dem Loopback.
      TRUST_PROXY: "loopback",
    },
  },
  projects: [
    { name: "pixel7", use: { phone: "pixel7" satisfies PhoneProfile } },
    { name: "iphone13", use: { phone: "iphone13" satisfies PhoneProfile } },
  ],
});
