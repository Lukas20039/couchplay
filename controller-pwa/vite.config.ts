// Vite-Konfiguration. Im Dev-Modus wird /ws an den Game-Server (Port 8080) weitergeleitet.
// Im Build erzeugt build/sw-plugin.ts zusätzlich dist/sw.js (Service Worker mit Precache-Liste).
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import { serviceWorker } from "./build/sw-plugin.js";

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  base: "/",
  plugins: [preact(), serviceWorker({ source: here("./sw/service-worker.js"), publicDir: here("./public") })],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
  preview: {
    port: 4174,
    proxy: {
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
  build: {
    outDir: "dist",
    // iOS 15 Safari: ES2020 + kein CSS-Nesting.
    target: ["es2020", "safari15"],
    cssTarget: ["safari15"],
    sourcemap: true,
  },
  test: {
    environment: "happy-dom",
  },
});
