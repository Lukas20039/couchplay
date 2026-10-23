// Screenshots + Bedienprobe der Preview: node games/blockblast/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/blockblast-*.png (Repo-Root).
// Probe: Teil per Touch aufs Brett ziehen und per Antippen legen – beides muss einen Zug senden.
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5195/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
const browser = await chromium.launch();
const errors = [];
const check = (cond, msg) => cond || errors.push(msg);
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of ["tv-countdown", "tv-duo", "tv-quad", "tv-many", "tv-over"]) {
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1600);
    const over = await tv.evaluate(() => [...document.querySelectorAll(".bb-panel")].some((e) => e.getBoundingClientRect().bottom > innerHeight + 1));
    check(!over, `${key}: Bretter ragen über den Bildschirm`);
    await tv.screenshot({ path: `${out}/blockblast-${key}.png` });
  }

  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`pad: ${e.message}`));
    for (const key of ["ctl-countdown", "ctl-play", "ctl-over"]) {
      await phone.goto(`${base}?scene=${key}`);
      await phone.waitForTimeout(600);
      const h = await phone.evaluate(() => innerHeight);
      const hand = await phone.locator(".bb-ctl__hand").boundingBox();
      check(hand && hand.y + hand.height <= h, `${device} ${key}: Hand nicht vollständig sichtbar (${JSON.stringify(hand)}, h=${h})`);
      await phone.screenshot({ path: `${out}/blockblast-${key}${suffix}.png` });
    }

    // Ziehen per Touch (CDP), Ziel: Brettmitte unten.
    await phone.goto(`${base}?scene=ctl-fresh`);
    await phone.waitForTimeout(500);
    const slot = await phone.locator('[data-testid="bb-slot-0"]').boundingBox();
    const board = await phone.locator(".bb-ctl__board").boundingBox();
    const cdp = await ctx.newCDPSession(phone);
    const touch = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
    const from = { x: slot.x + slot.width / 2, y: slot.y + slot.height / 2 };
    const to = { x: board.x + board.width / 2, y: board.y + board.height * 0.95 };
    await touch("touchStart", from);
    for (let s = 1; s <= 12; s++) await touch("touchMove", { x: from.x + ((to.x - from.x) * s) / 12, y: from.y + ((to.y - from.y) * s) / 12 });
    await phone.waitForTimeout(150);
    check(await phone.locator(".bb-cell.is-ghost").count() > 0, `${device}: keine Vorschau beim Ziehen`);
    await phone.screenshot({ path: `${out}/blockblast-drag${suffix}.png` });
    await touch("touchEnd", null);
    await phone.waitForTimeout(300);
    let inputs = await phone.evaluate(() => window.__inputs);
    check(inputs.length === 1 && inputs[0].slot === 0, `${device}: Ziehen hat keinen Zug gesendet (${JSON.stringify(inputs)})`);
    check(await phone.locator('.bb-cell[data-cell]:not([data-cell="."])').count() > 0, `${device}: Brett nach dem Ziehen leer`);

    // Antippen: Teil 1 auswählen, dann Feld links oben.
    await phone.locator('[data-testid="bb-slot-1"]').tap();
    await phone.locator('[data-testid="bb-cell-0"]').tap();
    await phone.waitForTimeout(300);
    inputs = await phone.evaluate(() => window.__inputs);
    check(inputs.length === 2 && inputs[1].slot === 1 && inputs[1].x === 0 && inputs[1].y === 0, `${device}: Antippen hat keinen Zug gesendet (${JSON.stringify(inputs)})`);
    await phone.screenshot({ path: `${out}/blockblast-tap${suffix}.png` });
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
