// Browser-E2E: TV-Kontext + mehrere Handy-Kontexte gegen einen lokal gestarteten Server.
// Browser einmalig installieren: `npx playwright install chromium webkit` (nicht Teil von npm install).
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 8090);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  webServer: {
    command: "npm run build && npm start",
    cwd: "..",
    url: `${BASE_URL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PORT: String(PORT), PUBLIC_URL: BASE_URL, LOG_LEVEL: "warn" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["iPhone 13"] } },
  ],
});
