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
    target: "es2020",
    sourcemap: true,
  },
  test: {
    environment: "happy-dom",
  },
});
