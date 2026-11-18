// Screenshots der Preview: node games/spion/preview/shots.mjs [baseUrl]
// Vorher: npx vite --config games/spion/preview/vite.config.ts (Port 5221), danach wieder beenden.
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/spion-*.png (Repo-Root);
// zusätzlich die README-Bilder docs/screenshots/tv-spion.png und docs/screenshots/phone-spion.png.
import { chromium, devices } from "playwright";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5221/";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const out = path.join(root, ".jait/shots");
mkdirSync(out, { recursive: true });
const TV = [
  "tv-intro",
  "tv-intro-undercover",
  "tv-role",
  "tv-clue",
  "tv-clue-8",
  "tv-vote",
  "tv-vote-runoff",
  "tv-reveal-fly",
  "tv-reveal-accuse",
  "tv-reveal-tie",
  "tv-reveal-drum",
  "tv-reveal-caught",
  "tv-reveal-innocent",
  "tv-guess",
  "tv-result-caught",
  "tv-result-guessed",
  "tv-result-undercover",
  "tv-final",
  "tv-final-8",
];
/** [Szene, vorgetippter Text] */
const PHONE = [
  ["ctl-intro", ""],
  ["ctl-role", ""],
  ["ctl-role-shown", ""],
  ["ctl-role-spy", ""],
  ["ctl-role-undercover", ""],
  ["ctl-clue-wait", ""],
  ["ctl-clue-turn", "Sonnenbrille"],
  ["ctl-clue-rejected", ""],
  ["ctl-vote", ""],
  ["ctl-vote-locked", ""],
  ["ctl-reveal", ""],
  ["ctl-guess-spy", ""],
  ["ctl-guess-wait", ""],
  ["ctl-result-won", ""],
  ["ctl-result-spy", ""],
  ["ctl-final", ""],
];
/** Bilder für die README (Szene → Datei in docs/screenshots). */
const DOCS = { "tv-reveal-caught": "tv-spion.png", "ctl-role-shown": "phone-spion.png" };
const only = process.env.SHOTS ? new Set(process.env.SHOTS.split(",")) : null;
const browser = await chromium.launch();
const errors = [];
try {
  const tv = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  tv.on("pageerror", (e) => errors.push(`tv: ${e.message}`));
  for (const key of TV) {
    if (only && !only.has(key)) continue;
    await tv.goto(`${base}?scene=${key}`);
    await tv.waitForTimeout(1500);
    const overflow = await tv.evaluate(() => {
      const root = document.querySelector(".sp-tv");
      if (!root) return "keine sp-tv";
      const limit = root.getBoundingClientRect().bottom + 1;
      const bad = [...root.querySelectorAll("*")].find((e) => e.getBoundingClientRect().bottom > limit || e.getBoundingClientRect().right > innerWidth + 1);
      return bad ? `${bad.className}` : "";
    });
    if (overflow) errors.push(`${key}: ragt über den Bildschirm (${overflow})`);
    await tv.screenshot({ path: `${out}/spion-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`handy: ${e.message}`));
    for (const [key, text] of PHONE) {
      if (only && !only.has(key)) continue;
      await phone.goto(`${base}?scene=${key}${text ? `&text=${encodeURIComponent(text)}` : ""}`);
      await phone.waitForTimeout(700);
      const tooTall = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1);
      if (tooTall) errors.push(`${key}${suffix}: Handy-Ansicht scrollt`);
      await phone.screenshot({ path: `${out}/spion-${key}${suffix}.png` });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
for (const [key, file] of Object.entries(DOCS)) {
  if (only && !only.has(key)) continue;
  copyFileSync(`${out}/spion-${key}.png`, path.join(root, "docs/screenshots", file));
}
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("ok");
