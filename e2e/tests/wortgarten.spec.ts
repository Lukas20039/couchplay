// Szenario 6: Wortgarten – zwei Handys (Chromium + WebKit) wischen Wörter, auch schräg;
// geteilte und einzigartige Wörter in der Ernte, Garten-Erfahrung landet im localStorage.
import { wordsInGrid } from "@couchplay/game-wortgarten/testing";
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";
import type { TvPage } from "./pages/tv.js";

/** Buchstaben des Rasters vom TV lesen. */
async function boardFromTv(tv: TvPage): Promise<{ letters: string[]; size: number }> {
  const letters = (await tv.tid("wg-tile").allTextContents()).map((s) => s.trim());
  return { letters, size: Math.round(Math.sqrt(letters.length)) };
}

/** Pfad auf dem Handy-Raster nachfahren (Pointer-Events per Maus, in Zwischenschritten). */
async function swipe(ph: PhonePage, path: number[], size: number): Promise<void> {
  const box = (await ph.tid("wg-trace").boundingBox())!;
  const cell = box.width / size;
  const at = (i: number) => ({ x: box.x + ((i % size) + 0.5) * cell, y: box.y + (Math.floor(i / size) + 0.5) * cell });
  const start = at(path[0]!);
  await ph.page.mouse.move(start.x, start.y);
  await ph.page.mouse.down();
  for (const i of path.slice(1)) {
    const p = at(i);
    await ph.page.mouse.move(p.x, p.y, { steps: 6 });
  }
  await ph.page.mouse.up();
}

const isDiagonal = (path: number[], size: number) =>
  path.some((c, i) => i > 0 && Math.floor(c / size) !== Math.floor(path[i - 1]! / size) && c % size !== path[i - 1]! % size);

test.describe("Wortgarten", () => {
  test("2 Handys: Wörter wischen (auch schräg), Ernte mit einzigartigen Wörtern, Erfahrung gespeichert", async ({ lab, phone: profile }) => {
    test.setTimeout(180_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("wg-Anna", profile);
    const b = await lab.newPhone("wg-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);

    await a.hostSelectGame("wortgarten");
    await a.hostSetNumber("rounds", 1);
    await a.hostSetNumber("roundSeconds", 60);
    await tv.start();

    await expect(tv.tid("wg-tv")).toHaveAttribute("data-phase", "intro");
    await expect(a.tid("wg-pad")).toHaveAttribute("data-phase", "intro");
    await expect(tv.tid("wg-tv")).toHaveAttribute("data-phase", "round", { timeout: 15_000 });
    await lab.shot(tv.page, "wortgarten-tv-round");

    const { letters, size } = await boardFromTv(tv);
    expect(size).toBe(4);
    const words = wordsInGrid(letters, size);
    expect(words.length).toBeGreaterThan(5);
    // Ein schräges Wort für beide (geteilt) und ein weiteres nur für Ben (einzigartig)
    const shared = words.find((w) => isDiagonal(w.path, size)) ?? words[0]!;
    const onlyBen = words.find((w) => w.word !== shared.word)!;

    await swipe(a, shared.path, size);
    await expect(a.tid("wg-feedback")).toHaveAttribute("data-result", "ok");
    await expect(a.tid("wg-found")).toHaveAttribute("data-count", "1");
    await lab.shot(a.page, "wortgarten-phone-found");
    // Dasselbe Wort nochmal → schon gefunden
    await swipe(a, shared.path, size);
    await expect(a.tid("wg-feedback")).toHaveAttribute("data-result", "dup");

    await swipe(b, shared.path, size);
    await expect(b.tid("wg-feedback")).toHaveAttribute("data-result", "ok");
    await swipe(b, onlyBen.path, size);
    await expect(b.tid("wg-found")).toHaveAttribute("data-count", "2");

    // Ernte nach Ablauf der Runde
    await expect(tv.tid("wg-tv")).toHaveAttribute("data-phase", "roundEnd", { timeout: 70_000 });
    await expect(tv.page.locator(".wg-word.is-unique", { hasText: onlyBen.word })).toBeVisible();
    await expect(tv.page.locator(".wg-word.is-shared", { hasText: shared.word })).toHaveCount(2);
    await lab.shot(tv.page, "wortgarten-tv-harvest");

    await expect(tv.tid("wg-tv")).toHaveAttribute("data-phase", "final", { timeout: 20_000 });
    await expect(b.tid("wg-pad")).toHaveAttribute("data-phase", "final");
    const xp = await b.page.evaluate(() => Number(localStorage.getItem("couchplay.wortgarten.xp")));
    expect(xp).toBeGreaterThan(0);
    await expect(tv.results).toBeVisible({ timeout: 20_000 });
  });
});
