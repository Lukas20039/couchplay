// Screenshots der Preview: node games/sortiert/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13, iPhone SE und 360×640 (kleines Android). Ausgabe: .jait/shots/sortiert-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5198/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
mkdirSync(out, { recursive: true });
const TV = [
  "tv-intro",
  "tv-sort-4",
  "tv-sort-6",
  "tv-reveal-build",
  "tv-reveal-4",
  "tv-reveal-6",
  "tv-reveal-6-8",
  "tv-reveal-solo",
  "tv-standings",
  "tv-final",
];
/** [Szene, vorgetippte Karten] */
const PHONE = [
  ["ctl-intro", ""],
  ["ctl-sort-4", ""],
  ["ctl-sort-4", "2,0"],
  ["ctl-sort-6", ""],
  ["ctl-sort-6", "3,0,5"],
  ["ctl-sort-6", "3,0,5,1,2"],
  ["ctl-locked-6", ""],
  ["ctl-reveal-wait", ""],
  ["ctl-reveal-4", ""],
  ["ctl-reveal-6", ""],
  ["ctl-reveal-6-partial", ""],
  ["ctl-final", ""],
];
const PHONES = [
  ["iPhone 13", "", { ...devices["iPhone 13"] }],
  ["iPhone SE", "-se", { ...devices["iPhone SE"] }],
  ["360x640", "-360", { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
];
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of TV) {
    await tv.goto(`${base}?scene=${key}`);
    // „Perfekt!“-Feier blendet nach gut 3 s aus – früher fotografieren.
    await tv.waitForTimeout(key === "tv-reveal-4" ? 900 : 1500);
    const overflow = await tv.evaluate(() => {
      const root = document.querySelector(".so-tv");
      if (!root) return "keine so-tv";
      const limit = root.getBoundingClientRect().bottom + 1;
      const bad = [...root.querySelectorAll("*")].find((e) => e.getBoundingClientRect().bottom > limit || e.getBoundingClientRect().right > innerWidth + 1);
      return bad ? `${bad.className}` : "";
    });
    if (overflow) errors.push(`${key}: ragt über den Bildschirm (${overflow})`);
    await tv.screenshot({ path: `${out}/sortiert-${key}.png` });
  }
  for (const [, suffix, opts] of PHONES) {
    const ctx = await browser.newContext(opts);
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`handy: ${e.message}`));
    for (const [key, taps] of PHONE) {
      await phone.goto(`${base}?scene=${key}${taps ? `&taps=${encodeURIComponent(taps)}` : ""}`);
      await phone.waitForTimeout(700);
      const tooTall = await phone.evaluate(
        () => document.documentElement.scrollHeight > innerHeight + 1 || [...document.querySelectorAll("#root *")].some((e) => e.getBoundingClientRect().bottom > innerHeight + 1),
      );
      const tag = `${key}${taps ? `-t${taps.split(",").length}` : ""}${suffix}`;
      if (tooTall) errors.push(`${tag}: Handy-Ansicht scrollt`);
      await phone.screenshot({ path: `${out}/sortiert-${tag}.png` });
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
