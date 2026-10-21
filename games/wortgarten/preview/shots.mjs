// Screenshots + Wisch-Probe der Preview: node games/wortgarten/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/wortgarten-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5193/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
const browser = await chromium.launch();
const errors = [];
const check = (cond, msg) => {
  if (!cond) errors.push(msg);
};
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of ["intro", "round", "roundEnd", "final"]) {
    await tv.goto(`${base}?tv=${key}`);
    await tv.waitForTimeout(1500);
    await tv.screenshot({ path: `${out}/wortgarten-tv-${key}.png` });
  }

  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`pad: ${e.message}`));
    const keys = suffix ? ["round"] : ["intro", "round", "tip", "roundEnd", "final"];
    for (const key of keys) {
      await phone.goto(`${base}?pad=${key}`);
      await phone.waitForTimeout(700);
      if (key === "round") {
        // Raster vollständig sichtbar, ohne Scrollen
        const h = await phone.evaluate(() => innerHeight);
        const box = await phone.locator(".wg-trace").boundingBox();
        check(box && box.y + box.height <= h && box.width > 200, `${device}: Raster nicht vollständig sichtbar (${JSON.stringify(box)}, h=${h})`);
      }
      await phone.screenshot({ path: `${out}/wortgarten-pad-${key}${suffix}.png` });
    }

    // Wisch-Probe (Touch → Pointer-Events): schräg 0 → 6 → 12 → 18 und zurück auf 12 (= zurückziehen) → 0,6,12
    await phone.goto(`${base}?pad=round&live=1`);
    await phone.waitForTimeout(500);
    const box = await phone.locator(".wg-trace").boundingBox();
    const cell = box.width / 5;
    const at = (i) => ({ x: box.x + ((i % 5) + 0.5) * cell, y: box.y + (Math.floor(i / 5) + 0.5) * cell });
    const swipe = async (cells) => {
      const cdp = await ctx.newCDPSession(phone);
      const pts = cells.map(at);
      const touch = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
      await touch("touchStart", pts[0]);
      for (let i = 1; i < pts.length; i++) {
        // Zwischenschritte wie ein echter Finger
        for (let s = 1; s <= 6; s++) {
          const a = pts[i - 1];
          const b = pts[i];
          await touch("touchMove", { x: a.x + ((b.x - a.x) * s) / 6, y: a.y + ((b.y - a.y) * s) / 6 });
        }
      }
      await phone.screenshot({ path: `${out}/wortgarten-pad-swipe${suffix}.png` });
      await touch("touchEnd", null);
      await phone.waitForTimeout(100);
    };
    await swipe([0, 6, 12, 18, 12]);
    let sent = await phone.evaluate(() => window.__sent);
    check(JSON.stringify(sent) === JSON.stringify([{ type: "word", path: [0, 6, 12] }]), `${device}: Wischen schräg + zurück → ${JSON.stringify(sent)}`);
    // Waagrecht/senkrecht: H(5) → U(6) → S(7), dann senkrecht runter auf U(12)
    await swipe([5, 6, 7, 12]);
    sent = await phone.evaluate(() => window.__sent);
    check(JSON.stringify(sent.at(-1)) === JSON.stringify({ type: "word", path: [5, 6, 7, 12] }), `${device}: Wischen gemischt → ${JSON.stringify(sent.at(-1))}`);
    // Tipp-Modus: B(10), L(11), U(12), M(13), E(14), dann E nochmal → abschicken
    for (const i of [10, 11, 12, 13, 14, 14]) {
      const p = at(i);
      await phone.mouse.click(p.x, p.y);
      await phone.waitForTimeout(40);
    }
    sent = await phone.evaluate(() => window.__sent);
    check(JSON.stringify(sent.at(-1)) === JSON.stringify({ type: "word", path: [10, 11, 12, 13, 14] }), `${device}: Tippen → ${JSON.stringify(sent.at(-1))}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("ok – Screenshots in", out);
