// Screenshots der Preview: node games/allesodernichts/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone-13-Profil (+ iPhone SE für die engsten Ansichten).
// Ausgabe: .jait/shots/aon-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5197/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of ["intro", "pick", "spin", "hit", "decide", "reveal", "standings", "final"]) {
    await tv.goto(`${base}?tv=${key}`);
    await tv.waitForTimeout(key === "final" || key === "standings" ? 2200 : 900);
    await tv.screenshot({ path: `${out}/aon-tv-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`pad: ${e.message}`));
    const keys = suffix ? ["pick", "decide"] : ["intro", "pick", "locked", "abstained", "spin", "decide", "decided", "out", "cashed", "won", "lost", "standings", "final"];
    for (const key of keys) {
      await phone.goto(`${base}?pad=${key}`);
      await phone.waitForTimeout(600);
      // Alle Bedienelemente müssen ohne Scrollen vollständig sichtbar sein.
      const h = await phone.evaluate(() => innerHeight);
      const bottoms = await phone.$$eval(".an-btn, .an-abstain, .an-choice", (b) => b.map((x) => x.getBoundingClientRect().bottom));
      if (bottoms.some((y) => y > h)) errors.push(`${device} ${key}: Buttons nicht sichtbar ${bottoms} > ${h}`);
      await phone.screenshot({ path: `${out}/aon-pad-${key}${suffix}.png` });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Screenshots in ${out}`);
