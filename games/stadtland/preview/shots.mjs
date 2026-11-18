// Screenshots der Preview: node games/stadtland/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/stadtland-*.png (Repo-Root).
// Prüft nebenbei: nichts ragt am TV über den Rand, keine Handy-Ansicht scrollt
// (Ausnahme: Prüfung mit 8 Spielern auf dem iPhone SE – die Liste darf dort scrollen).
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
mkdirSync(out, { recursive: true });
const TV = [
  "tv-intro",
  "tv-letter-spin",
  "tv-letter",
  "tv-write",
  "tv-write-8",
  "tv-stop",
  "tv-timeup",
  "tv-review",
  "tv-review-8",
  "tv-review-quatsch",
  "tv-standings",
  "tv-final",
  "tv-final-8",
];
const PHONE = [
  "ctl-intro",
  "ctl-letter",
  "ctl-write",
  "ctl-write-empty",
  "ctl-write-quatsch",
  "ctl-stop-other",
  "ctl-timeup",
  "ctl-review",
  "ctl-review-8",
  "ctl-standings",
  "ctl-final",
];
const MAY_SCROLL = new Set(["ctl-review-8-se"]);
const only = process.env.SHOTS ? new Set(process.env.SHOTS.split(",")) : null;
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of TV) {
    if (only && !only.has(key)) continue;
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1500);
    const overflow = await tv.evaluate(() => {
      const root = document.querySelector(".sl-tv");
      if (!root) return "keine sl-tv";
      const limit = root.getBoundingClientRect().bottom + 1;
      const bad = [...root.querySelectorAll("*")].find(
        (e) => !e.closest(".sl-reel") && (e.getBoundingClientRect().bottom > limit || e.getBoundingClientRect().right > innerWidth + 1),
      );
      return bad ? `${bad.className}` : "";
    });
    if (overflow) errors.push(`${key}: ragt über den Bildschirm (${overflow})`);
    await tv.screenshot({ path: `${out}/stadtland-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`handy: ${e.message}`));
    for (const key of PHONE) {
      if (only && !only.has(key)) continue;
      await phone.goto(`${base}?scene=${key}`);
      await phone.waitForTimeout(700);
      const tooTall = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1);
      if (tooTall && !MAY_SCROLL.has(`${key}${suffix}`)) errors.push(`${key}${suffix}: Handy-Ansicht scrollt`);
      await phone.screenshot({ path: `${out}/stadtland-${key}${suffix}.png` });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("ok");
