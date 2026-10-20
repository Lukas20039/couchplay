// Vite-Plugin: erzeugt dist/sw.js aus sw/service-worker.js mit der Liste aller Build-Dateien.
// Bewusst ohne vite-plugin-pwa/Workbox: Wir brauchen nur Precache + network-first für
// index.html (~60 Zeilen), keine Laufzeit-Abhängigkeit und kein zusätzlicher Build-Schritt.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { Plugin } from "vite";

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

export function serviceWorker(opts: { source: string; publicDir: string }): Plugin {
  return {
    name: "couchplay-sw",
    enforce: "post",
    apply: "build",
    generateBundle(_options, bundle) {
      const hash = createHash("sha256");
      const urls = new Set<string>(["/index.html"]);
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith(".map") || fileName === "index.html") continue;
        urls.add(`/${fileName}`);
        hash.update(fileName);
        // index.html ist nicht gehasht → Inhalt in die Version einfließen lassen.
        if (chunk.type === "asset" && fileName.endsWith(".html")) hash.update(String(chunk.source));
      }
      const html = bundle["index.html"];
      if (html?.type === "asset") hash.update(String(html.source));
      for (const file of listFiles(opts.publicDir)) {
        const rel = relative(opts.publicDir, file).split("\\").join("/");
        if (rel === "sw.js") continue;
        urls.add(`/${rel}`);
        hash.update(rel).update(readFileSync(file));
      }
      const precache = [...urls].sort();
      const version = hash.digest("hex").slice(0, 12);
      const source = readFileSync(opts.source, "utf8")
        .replace('const VERSION = "__VERSION__";', `const VERSION = ${JSON.stringify(version)};`)
        .replace("const PRECACHE = __PRECACHE__;", `const PRECACHE = ${JSON.stringify(precache)};`);
      if (source.includes("__VERSION__") || source.includes("__PRECACHE__")) {
        this.error("sw/service-worker.js: Platzhalter nicht ersetzt");
      }
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}
