// Screenshots der Preview: node games/schiffe/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/schiffe-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5194/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of ["tv-setup", "tv-battle", "tv-over", "tv-bot"]) {
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1200);
    const overflow = await tv.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1 || [...document.querySelectorAll(".sv-side")].some((e) => e.getBoundingClientRect().bottom > innerHeight));
    if (overflow) errors.push(`${key}: ragt über den Bildschirm`);
    await tv.screenshot({ path: `${out}/schiffe-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`pad: ${e.message}`));
    for (const key of ["ctl-setup", "ctl-ready", "ctl-myturn", "ctl-wait", "ctl-lose"]) {
      await phone.goto(`${base}?scene=${key}`);
      await phone.waitForTimeout(600);
      await phone.screenshot({ path: `${out}/schiffe-${key}${suffix}.png`, fullPage: true });
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
