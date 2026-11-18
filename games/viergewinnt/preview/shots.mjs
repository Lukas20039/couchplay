// Screenshots der Preview: node games/viergewinnt/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/viergewinnt-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:5195/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of ["tv-start", "tv-play", "tv-round", "tv-over", "tv-bot"]) {
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1800);
    const overflow = await tv.evaluate(
      () => document.documentElement.scrollHeight > innerHeight + 1 || [...document.querySelectorAll(".c4-card, .c4-tv__center")].some((e) => e.getBoundingClientRect().bottom > innerHeight || e.getBoundingClientRect().right > innerWidth),
    );
    if (overflow) errors.push(`${key}: ragt über den Bildschirm`);
    await tv.screenshot({ path: `${out}/viergewinnt-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`pad: ${e.message}`));
    for (const key of ["ctl-myturn", "ctl-wait", "ctl-round", "ctl-lose", "ctl-big"]) {
      await phone.goto(`${base}?scene=${key}`);
      await phone.waitForTimeout(900);
      const overflow = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
      if (overflow) errors.push(`${key}${suffix}: Handy muss scrollen`);
      await phone.screenshot({ path: `${out}/viergewinnt-${key}${suffix}.png`, fullPage: true });
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
