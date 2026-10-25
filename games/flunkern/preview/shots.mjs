// Screenshots der Preview: node games/flunkern/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/flunkern-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
mkdirSync(out, { recursive: true });
const TV = [
  "tv-intro",
  "tv-write",
  "tv-write-double",
  "tv-choose",
  "tv-choose-9",
  "tv-reveal-fly",
  "tv-reveal-lie",
  "tv-reveal-shared",
  "tv-reveal-house",
  "tv-reveal-long",
  "tv-reveal-drum",
  "tv-reveal-truth",
  "tv-reveal-nobody",
  "tv-standings",
  "tv-final",
  "tv-final-8",
];
/** [Szene, vorgetippter Text] */
const PHONE = [
  ["ctl-intro", ""],
  ["ctl-write", "Wasserpistolen mit Glitzer"],
  ["ctl-rejected", ""],
  ["ctl-locked", ""],
  ["ctl-choose", ""],
  ["ctl-choose-9", ""],
  ["ctl-chosen", ""],
  ["ctl-chosen-me", ""],
  ["ctl-reveal-wait", ""],
  ["ctl-result-good", ""],
  ["ctl-result-fooled", ""],
  ["ctl-result-house", ""],
  ["ctl-standings", ""],
  ["ctl-final", ""],
];
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
      const root = document.querySelector(".fl-tv");
      if (!root) return "keine fl-tv";
      const limit = root.getBoundingClientRect().bottom + 1;
      const bad = [...root.querySelectorAll("*")].find((e) => e.getBoundingClientRect().bottom > limit || e.getBoundingClientRect().right > innerWidth + 1);
      return bad ? `${bad.className}` : "";
    });
    if (overflow) errors.push(`${key}: ragt über den Bildschirm (${overflow})`);
    await tv.screenshot({ path: `${out}/flunkern-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`handy: ${e.message}`));
    for (const [key, text] of PHONE) {
      if (only && !only.has(key)) continue;
      await phone.goto(`${base}?scene=${key}${text ? `&text=${encodeURIComponent(text)}` : ""}`);
      await phone.waitForTimeout(700);
      const tooTall = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
      if (tooTall) errors.push(`${key}${suffix}: Handy-Ansicht scrollt`);
      await phone.screenshot({ path: `${out}/flunkern-${key}${suffix}.png` });
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
