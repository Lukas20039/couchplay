// Nur für die lokale Sichtprüfung der Views (nicht Teil des Spiel-Bundles).
// Die echten Wortlisten braucht die Vorschau nicht (sie nutzt ein Fake-Lexikon) – das Modul wird durch einen
// Platzhalter ersetzt, damit die Vorschau schnell lädt und unabhängig von den Listen bleibt.
import { defineConfig } from "vite";

const LEXICON_STUB = "\0stadtland-lexicon-stub";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    {
      name: "stadtland-lexicon-stub",
      enforce: "pre",
      resolveId(id, importer) {
        return id === "./lexicon/index.js" && importer?.replace(/\\/g, "/").includes("/src/server/") ? LEXICON_STUB : null;
      },
      load(id) {
        return id === LEXICON_STUB ? "export const LEXICON_CATEGORIES = new Set();\nexport function lookupAnswer() { return null; }\n" : null;
      },
    },
  ],
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
  server: { port: 5199, strictPort: false, host: "127.0.0.1" },
  logLevel: "warn",
});
