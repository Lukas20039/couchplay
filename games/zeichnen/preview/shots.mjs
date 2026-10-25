// Screenshots der Preview: node games/zeichnen/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/zeichnen-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5213/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of ["tv-intro", "tv-choose", "tv-draw", "tv-reveal", "tv-standings", "tv-final", "tv-draw&n=8", "tv-final&n=8", "tv-draw&n=3"]) {
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1200);
    const overflow = await tv.evaluate(
      () => document.documentElement.scrollHeight > innerHeight + 1 || [...document.querySelectorAll(".zg-side, .zg-list, .zg-podium")].some((e) => e.getBoundingClientRect().bottom > innerHeight),
    );
    if (overflow) errors.push(`${key}: ragt über den Bildschirm`);
    await tv.screenshot({ path: `${out}/zeichnen-${key.replace("&n=", "-")}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`pad: ${e.message}`));
    for (const key of ["ctl-choose", "ctl-wait", "ctl-draw", "ctl-guess", "ctl-success", "ctl-reveal", "ctl-reveal-draw"]) {
      await phone.goto(`${base}?scene=${key}`);
      await phone.waitForTimeout(600);
      const overflow = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
      if (overflow) errors.push(`${key}${suffix}: Seite scrollt`);
      await phone.screenshot({ path: `${out}/zeichnen-${key}${suffix}.png` });
    }
    // Zeichnen per Touch: Strich ziehen, die Seite darf nicht scrollen.
    await phone.goto(`${base}?scene=ctl-draw`);
    await phone.waitForTimeout(400);
    const box = await phone.locator("[data-testid=zg-pad]").boundingBox();
    if (box) {
      await phone.mouse.move(box.x + 30, box.y + box.height - 40);
      await phone.mouse.down();
      for (let i = 1; i <= 12; i++) await phone.mouse.move(box.x + 30 + i * 18, box.y + box.height - 40 - i * 12);
      await phone.mouse.up();
      await phone.screenshot({ path: `${out}/zeichnen-ctl-drawn${suffix}.png` });
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
