// Szenario 9: Hintergrundmusik am TV – Lobby-Stück, nach Spielstart das Stück des Spiels,
// Musik-Knopf schaltet bis „Aus“ (alles angehalten). Wiedergabe wird über HTMLMediaElement mitgeschnitten.
import { expect, test } from "./fixtures.js";

declare global {
  interface Window {
    __plays: { src: string; ok: boolean | null }[];
    __playing: () => string[];
  }
}

test.describe("Musik", () => {
  test("Lobby- und Spielmusik, Lautstärke-Knopf bis Aus", async ({ lab }) => {
    const tv = await lab.openTv();
    await tv.page.addInitScript(() => {
      window.__plays = [];
      const active = new Set<HTMLMediaElement>();
      const play = HTMLMediaElement.prototype.play;
      const pause = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
        const entry = { src: this.src, ok: null as boolean | null };
        window.__plays.push(entry);
        const p = play.call(this);
        p.then(
          () => {
            entry.ok = true;
            active.add(this);
          },
          () => (entry.ok = false),
        );
        return p;
      };
      HTMLMediaElement.prototype.pause = function (this: HTMLMediaElement) {
        active.delete(this);
        return pause.call(this);
      };
      window.__playing = () => [...active].filter((a) => !a.paused).map((a) => a.src.split("/").pop() ?? "");
    });
    await tv.page.reload();
    const code = await tv.code();
    // Erste Taste hebt eine evtl. Autoplay-Sperre auf.
    await tv.page.keyboard.press("ArrowRight");
    await expect.poll(() => tv.page.evaluate(() => window.__playing())).toEqual(["lobby.mp3"]);

    const ph = await lab.newPhone("music-Anna");
    await ph.joinByCode(code, "Anna", "fuchs");
    await ph.hostSelectGame("blockblast");
    await tv.start();
    await expect(tv.tid("bb-tv")).toBeVisible();
    // Überblendung: kurz beide, danach nur noch das Spielstück.
    await expect.poll(() => tv.page.evaluate(() => window.__playing()), { timeout: 10_000 }).toEqual(["blockblast.mp3"]);

    await ph.hostAbort();
    await expect.poll(() => tv.page.evaluate(() => window.__playing()), { timeout: 10_000 }).toEqual(["lobby.mp3"]);

    const button = tv.tid("music-button");
    await expect(button).toHaveAttribute("data-level", "2");
    await expect(button).toContainText("Musik: Mittel");
    await button.click();
    await expect(button).toContainText("Musik: Laut");
    await button.click();
    await expect(button).toHaveAttribute("data-level", "0");
    await expect(button).toContainText("Musik: Aus");
    await expect.poll(() => tv.page.evaluate(() => window.__playing())).toEqual([]);
    // Stufe bleibt nach Neuladen erhalten.
    await tv.page.reload();
    await expect(tv.tid("music-button")).toHaveAttribute("data-level", "0");
    expect(await tv.page.evaluate(() => window.__plays.filter((p) => p.ok === false).length)).toBe(0);
  });
});
