// Screenshots der Preview: node games/stadtland/preview/shots.mjs [baseUrl]
// TV: 1920×1080, Handy: iPhone 13 und iPhone SE. Ausgabe: .jait/shots/stadtland-*.png (Repo-Root).
// Prüft nebenbei: nichts ragt am TV über den Rand, keine Handy-Ansicht scrollt
// (Ausnahme: Prüfung mit 8 Spielern auf dem iPhone SE – die Liste darf dort scrollen).
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.jait/shots");
mkdirSync(out, { recursive: true });
const TV = [
  "tv-intro",
  "tv-setup",
  "tv-setup-empty",
  "tv-intro-custom",
  "tv-write-custom",
  "tv-review-lexicon",
  "tv-review-lexicon-8",
  "tv-letter-spin",
  "tv-letter",
  "tv-write",
  "tv-write-8",
  "tv-stop",
  "tv-timeup",
  "tv-review",
  "tv-review-8",
  "tv-review-quatsch",
  "tv-standings",
  "tv-final",
  "tv-final-8",
];
const PHONE = [
  "ctl-intro",
  "ctl-setup-host",
  "ctl-setup-host-chips",
  "ctl-setup-guest",
  "ctl-review-lexicon",
  "ctl-review-lexicon-8",
  "ctl-letter",
  "ctl-write",
  "ctl-write-empty",
  "ctl-write-quatsch",
  "ctl-stop-other",
  "ctl-timeup",
  "ctl-review",
  "ctl-review-8",
  "ctl-standings",
  "ctl-final",
];
// Setup-Editor (Host): Seite darf scrollen – „Los geht’s!“ klebt unten (sticky) über dem „Weiter“-Knopf der App.
const MAY_SCROLL = new Set([
  "ctl-review-8-se",
  "ctl-review-lexicon-8-se",
  "ctl-setup-host",
  "ctl-setup-host-se",
  "ctl-setup-host-chips",
  "ctl-setup-host-chips-se",
]);
/** Im Browser: Blatt-Elemente unter `rootSel`, die die Attrappe des „Weiter“-Knopfs (.preview-skip) schneiden. */
function overlapsSkip(rootSel) {
  const skip = document.querySelector(".preview-skip");
  const root = document.querySelector(rootSel);
  if (!skip || !root) return "";
  // Scrollende Seiten: Was ganz unten steht, darf nicht verdeckt sein (darüber scrollt der Inhalt unter dem Knopf durch).
  window.scrollTo(0, document.documentElement.scrollHeight);
  const s = skip.getBoundingClientRect();
  const bad = [...root.querySelectorAll("*")].find((e) => {
    if (e.children.length > 0) return false;
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || getComputedStyle(e).visibility === "hidden") return false;
    if (!(r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top)) return false;
    // Weggescrollt/abgeschnitten in einem Scroll-Bereich (z. B. Vorschlags-Chips) → nicht sichtbar.
    const cy = (r.top + r.bottom) / 2;
    for (let p = e.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).overflowY === "visible") continue;
      const pr = p.getBoundingClientRect();
      if (cy < pr.top || cy > pr.bottom) return false;
    }
    return true;
  });
  return bad ? `${bad.tagName.toLowerCase()}.${bad.className} „${(bad.textContent ?? "").slice(0, 30)}“` : "";
}
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
      const root = document.querySelector(".sl-tv");
      if (!root) return "keine sl-tv";
      const limit = root.getBoundingClientRect().bottom + 1;
      const bad = [...root.querySelectorAll("*")].find(
        (e) => !e.closest(".sl-reel") && (e.getBoundingClientRect().bottom > limit || e.getBoundingClientRect().right > innerWidth + 1),
      );
      return bad ? `${bad.className}` : "";
    });
    if (overflow) errors.push(`${key}: ragt über den Bildschirm (${overflow})`);
    const covered = await tv.evaluate(overlapsSkip, ".sl-tv");
    if (covered) errors.push(`${key}: vom „Weiter“-Knopf verdeckt (${covered})`);
    await tv.screenshot({ path: `${out}/stadtland-${key}.png` });
  }
  for (const [device, suffix] of [["iPhone 13", ""], ["iPhone SE", "-se"]]) {
    const ctx = await browser.newContext({ ...devices[device] });
    const phone = await ctx.newPage();
    phone.on("pageerror", (e) => errors.push(`handy: ${e.message}`));
    for (const key of PHONE) {
      if (only && !only.has(key)) continue;
      await phone.goto(`${base}?scene=${key}`);
      await phone.waitForTimeout(700);
      const tooTall = await phone.evaluate(() => document.documentElement.scrollHeight > innerHeight + 1 || document.body.scrollHeight > innerHeight + 1);
      if (tooTall && !MAY_SCROLL.has(`${key}${suffix}`)) errors.push(`${key}${suffix}: Handy-Ansicht scrollt`);
      // Scrollende Ansichten schneidet die Vorschau ab (overflow: hidden) – dort prüft das die E2E-Aufnahme.
      const covered = MAY_SCROLL.has(`${key}${suffix}`) ? "" : await phone.evaluate(overlapsSkip, ".sl-ctl");
      if (covered) errors.push(`${key}${suffix}: vom „Weiter“-Knopf verdeckt (${covered})`);
      await phone.screenshot({ path: `${out}/stadtland-${key}${suffix}.png` });
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
