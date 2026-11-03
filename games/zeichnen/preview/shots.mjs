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
      // Werkzeuge: Blatt schwarz füllen, weißer Kreis, darin rot füllen, schwarz radieren, Farbmenü offen.
      const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
      const drag = async (a, b) => {
        await phone.mouse.move(...a);
        await phone.mouse.down();
        for (let i = 1; i <= 8; i++) await phone.mouse.move(a[0] + ((b[0] - a[0]) * i) / 8, a[1] + ((b[1] - a[1]) * i) / 8);
        await phone.mouse.up();
      };
      await phone.click("[data-testid=zg-quick-0]");
      await phone.click("[data-testid=zg-tool-fill]");
      await phone.mouse.click(...at(0.05, 0.05));
      await phone.click("[data-testid=zg-quick-1]");
      await phone.click("[data-testid=zg-tool-ellipse]");
      await drag(at(0.2, 0.2), at(0.8, 0.7));
      await phone.click("[data-testid=zg-quick-2]");
      await phone.click("[data-testid=zg-tool-fill]");
      await phone.mouse.click(...at(0.5, 0.45));
      await phone.click("[data-testid=zg-tool-eraser]");
      await drag(at(0.1, 0.85), at(0.9, 0.85));
      await phone.click("[data-testid=zg-more]");
      const px = await phone.evaluate(() => {
        const c = document.querySelector("[data-testid=zg-pad]");
        const g = c.getContext("2d");
        const pick = (fx, fy) => [...g.getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data].slice(0, 3).join(",");
        return { corner: pick(0.02, 0.02), inside: pick(0.5, 0.45), erased: pick(0.5, 0.85) };
      });
      if (px.corner !== "27,27,31" || px.inside !== "229,56,59" || px.erased !== "27,27,31") errors.push(`werkzeuge${suffix}: ${JSON.stringify(px)}`);
      const overflow = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
      if (overflow) errors.push(`werkzeuge${suffix}: Seite scrollt`);
      await phone.screenshot({ path: `${out}/zeichnen-ctl-tools${suffix}.png` });
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
