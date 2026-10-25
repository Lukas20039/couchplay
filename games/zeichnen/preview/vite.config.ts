// Nur für die lokale Sichtprüfung der Views (nicht Teil des Spiel-Bundles).
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  server: { port: 5213, strictPort: true, host: "127.0.0.1" },
  logLevel: "warn",
});
