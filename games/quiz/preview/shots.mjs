// Screenshots der Preview: node games/quiz/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone-13-Profil. Ausgabe: .jait/shots/quiz-*.png (Repo-Root).
import { chromium, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5191/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of ["intro", "question", "reveal", "standings", "final"]) {
    await tv.goto(`${base}?tv=${key}`);
    await tv.waitForTimeout(key === "final" || key === "standings" ? 2200 : 900);
    await tv.screenshot({ path: `${out}/quiz-tv-${key}.png` });
  }
  const phone = await browser.newPage({ ...devices["iPhone 13"] });
  phone.on("pageerror", (e) => errors.push(`pad: ${e.message}`));
  for (const key of ["intro", "question", "locked", "correct", "wrong", "standings", "final"]) {
    await phone.goto(`${base}?pad=${key}`);
    await phone.waitForTimeout(600);
    await phone.screenshot({ path: `${out}/quiz-pad-${key}.png` });
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Screenshots in ${out}`);
