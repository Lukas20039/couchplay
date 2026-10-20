// Stylesheets müssen in alten Android-TV-WebViews (Chrome 64) funktionieren:
// kein inset, clamp(), aspect-ratio und kein gap in Flexbox-Regeln (Grid-gap ist erlaubt).
import { describe, expect, it } from "vitest";
import { CONTROLLER_CSS } from "../src/controller/styles.js";
import { TV_CSS } from "../src/tv/styles.js";
import { GLYPH_CSS } from "../src/ui/common.js";

const SHEETS: Record<string, string> = { TV_CSS, CONTROLLER_CSS, GLYPH_CSS };

/** Liefert Verstöße als "Regel: Grund". */
function violations(css: string): string[] {
  const out: string[] = [];
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, ""); // Kommentare ignorieren
  for (const m of plain.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = (m[1] ?? "").trim();
    const body = m[2] ?? "";
    if (/(^|[;\s])inset\s*:/.test(body)) out.push(`${sel}: inset`);
    if (/clamp\(/.test(body)) out.push(`${sel}: clamp()`);
    if (/aspect-ratio\s*:/.test(body)) out.push(`${sel}: aspect-ratio`);
    if (/display\s*:\s*(inline-)?flex/.test(body) && /(^|[;\s])(row-|column-)?gap\s*:/.test(body)) out.push(`${sel}: gap in flex`);
  }
  return out;
}

describe("Stylesheets (Chrome-64-kompatibel)", () => {
  it.each(Object.entries(SHEETS))("%s nutzt keine verbotenen Properties", (_name, css) => {
    expect(violations(css)).toEqual([]);
  });

  it("Prüfung erkennt Verstöße", () => {
    expect(violations(".a { display: flex; gap: 1rem; } .b { inset: 0; } .c { width: clamp(1px, 2px, 3px); aspect-ratio: 1; }")).toEqual([
      ".a: gap in flex",
      ".b: inset",
      ".c: clamp()",
      ".c: aspect-ratio",
    ]);
    expect(violations(".g { display: grid; gap: 1rem; } .s { box-shadow: inset 0 0 1px red; }")).toEqual([]);
  });
});
