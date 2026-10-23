// Szenario 10: TV-Lobby mit mehr Spielen als Platz – nur die Spielreihe scrollt, Code und QR bleiben
// stehen, und man kommt mit Pfeil links wieder zum ersten Spiel (früher verschob sich der ganze Bildschirm).
import { expect, test } from "./fixtures.js";

test.describe("TV-Spielkatalog", () => {
  test("Durch alle Spiele und zurück: Bildschirm bleibt stehen, fokussierte Kachel sichtbar", async ({ lab }) => {
    const tv = await lab.openTv();
    const tiles = tv.tid("game-tile");
    const count = await tiles.count();
    expect(count).toBeGreaterThan(3);
    const join = tv.page.locator(".join-card");
    const joinLeft = (await join.boundingBox())!.x;
    const visible = async () => {
      // Die Reihe scrollt weich – warten, bis die Kachel ganz drin ist.
      await expect
        .poll(() =>
          tv.page.evaluate(() => {
            const r = document.activeElement!.getBoundingClientRect();
            const c = document.querySelector(".tiles")!.getBoundingClientRect();
            return r.left >= c.left - 1 && r.right <= c.right + 1;
          }),
        )
        .toBe(true);
      expect(await tv.page.evaluate(() => document.querySelector(".screen")!.scrollLeft)).toBe(0);
      expect((await join.boundingBox())!.x).toBe(joinLeft);
    };
    await tv.focus(tiles.first());
    for (let i = 1; i < count; i++) {
      await tv.press("ArrowRight");
      await expect(tiles.nth(i)).toBeFocused();
      await visible();
    }
    await lab.shot(tv.page, "tv-catalog-end");
    for (let i = count - 2; i >= 0; i--) {
      await tv.press("ArrowLeft");
      await expect(tiles.nth(i)).toBeFocused();
      await visible();
    }
    await expect(tv.tid("game-catalog")).not.toHaveClass(/more-left/);
    await expect(tv.tid("game-catalog")).toHaveClass(/more-right/);
  });
});
