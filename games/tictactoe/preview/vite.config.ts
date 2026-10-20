// Nur für die lokale Sichtprüfung der Views (nicht Teil des Spielpakets).
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [preact()],
  server: { port: 5191, strictPort: true },
});
