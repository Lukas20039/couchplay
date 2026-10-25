// Screenshots der Preview: node games/wuerdeeher/preview/shots.mjs [baseUrl]
// Vorher: npx vite --config games/wuerdeeher/preview/vite.config.ts (Port 5214), danach wieder beenden.
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/wuerdeeher-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5214/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
mkdirSync(out, { recursive: true });
const TV = [
  "tv-intro",
  "tv-intro-8",
  "tv-vote",
  "tv-vote-8",
  "tv-reveal-fly",
  "tv-reveal",
  "tv-reveal-8",
  "tv-reveal-tie-anon-8",
  "tv-reveal-none",
  "tv-standings",
  "tv-standings-8",
  "tv-final",
  "tv-final-8",
];
const PHONE = ["ctl-intro", "ctl-vote", "ctl-vote-8", "ctl-locked", "ctl-reveal-wait", "ctl-reveal", "ctl-reveal-winner", "ctl-reveal-against", "ctl-final"];
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of TV) {
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1800);
    const overflow = await tv.evaluate(() => {
      const root = document.querySelector(".we-tv");
      if (!root) return "keine we-tv";
      const limit = root.getBoundingClientRect().bottom + 1;
      const bad = [...root.querySelectorAll("*")].find((e) => e.getBoundingClientRect().bottom > limit || e.getBoundingClientRect().right > innerWidth + 1);
      return bad ? `${bad.className}` : "";
    });
    if (overflow) errors.push(`${key}: ragt über den Bildschirm (${overflow})`);
    await tv.screenshot({ path: `${out}/wuerdeeher-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`handy: ${e.message}`));
    for (const key of PHONE) {
      await phone.goto(`${base}?scene=${key}`);
      await phone.waitForTimeout(700);
      const tooTall = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
      if (tooTall) errors.push(`${key}${suffix}: Handy-Ansicht scrollt`);
      await phone.screenshot({ path: `${out}/wuerdeeher-${key}${suffix}.png` });
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
