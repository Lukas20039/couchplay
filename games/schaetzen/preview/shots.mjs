// Screenshots der Preview: node games/schaetzen/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/schaetzen-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5197/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
mkdirSync(out, { recursive: true });
const TV = [
  "tv-intro",
  "tv-question",
  "tv-question-year",
  "tv-reveal-drum",
  "tv-reveal-count",
  "tv-reveal",
  "tv-reveal-lin",
  "tv-reveal-log",
  "tv-reveal-8",
  "tv-reveal-solo",
  "tv-standings",
  "tv-final",
];
/** [Szene, vorgetippte Tasten] */
const PHONE = [
  ["ctl-intro", ""],
  ["ctl-input", "8000000,5"],
  ["ctl-year", "1989"],
  ["ctl-locked", ""],
  ["ctl-reveal-wait", ""],
  ["ctl-reveal", ""],
  ["ctl-reveal-bull", ""],
  ["ctl-final", ""],
];
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of TV) {
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1500);
    const overflow = await tv.evaluate(() => {
      const root = document.querySelector(".es-tv");
      if (!root) return "keine es-tv";
      const limit = root.getBoundingClientRect().bottom + 1;
      const bad = [...root.querySelectorAll("*")].find((e) => e.getBoundingClientRect().bottom > limit || e.getBoundingClientRect().right > innerWidth + 1);
      return bad ? `${bad.className}` : "";
    });
    if (overflow) errors.push(`${key}: ragt über den Bildschirm (${overflow})`);
    await tv.screenshot({ path: `${out}/schaetzen-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`handy: ${e.message}`));
    for (const [key, keys] of PHONE) {
      await phone.goto(`${base}?scene=${key}${keys ? `&keys=${encodeURIComponent(keys)}` : ""}`);
      await phone.waitForTimeout(700);
      const tooTall = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
      if (tooTall) errors.push(`${key}${suffix}: Handy-Ansicht scrollt`);
      await phone.screenshot({ path: `${out}/schaetzen-${key}${suffix}.png` });
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
