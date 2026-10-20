// Erzeugt die PWA-Icons aus icons/logo.svg (einmalig bzw. nach Logo-Änderung ausführen):
//   node controller-pwa/scripts/make-icons.mjs
// Rendert per Playwright-Chromium (im Monorepo vorhanden) → keine zusätzliche Abhängigkeit.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const svg = readFileSync(`${root}icons/logo.svg`, "utf8");
const out = `${root}public/icons/`;

/** name, Kantenlänge, Eckenradius-Anteil (0 = vollflächig, z. B. maskable/Apple). */
const targets = [
  ["icon-192.png", 192, 0.22],
  ["icon-512.png", 512, 0.22],
  ["maskable-512.png", 512, 0],
  ["apple-touch-icon.png", 180, 0],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, radius] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">` +
      `<div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden">` +
      svg.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `) +
      `</div></body></html>`,
  );
  writeFileSync(out + name, await page.screenshot({ omitBackground: true }));
  console.log("geschrieben:", name);
}
writeFileSync(`${root}public/favicon.svg`, svg);
await browser.close();
