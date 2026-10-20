// Vite-Konfiguration. Im Dev-Modus wird /ws an den Game-Server (Port 8080) weitergeleitet.
import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/tv/",
  plugins: [preact()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
  build: {
    outDir: "dist",
    // Android-TV-WebView: ES-Module + dynamic import ab Chrome 63/64. Syntax (?. ?? usw.)
    // wird auf dieses Ziel heruntergebrochen; @vitejs/plugin-legacy bewusst nicht
    // (Babel + Polyfills, großer Zusatz-Chunk) – die System-WebView ist per Play Store
    // aktualisierbar, ältere Geräte bekommen den nomodule-Hinweis aus index.html.
    target: ["chrome64", "safari12"],
    cssTarget: ["chrome64", "safari12"],
    sourcemap: true,
  },
  test: {
    environment: "happy-dom",
  },
});
