// Bündelt den Server nach dist/index.js. Workspace-Pakete (@couchplay/*, liegen
// als TypeScript-Quelltext vor) werden eingebettet, npm-Abhängigkeiten bleiben extern.
import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
  plugins: [
    {
      name: "external-npm",
      setup(b) {
        b.onResolve({ filter: /^[^./]/ }, (args) =>
          args.path.startsWith("@couchplay/") ? undefined : { path: args.path, external: true },
        );
      },
    },
  ],
});
