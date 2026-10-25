// Szenario 13: Zeichnen & Raten – zwei Handys, jeder zeichnet einmal: Begriff wählen, am Handy malen
// (TV zeigt die Zeichnung live), Fehltipp als Sprechblase am TV, Treffer, Auflösung, Weiter per Host.
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

test.describe("Zeichnen & Raten", () => {
  test("zwei Runden: wählen, zeichnen, raten, auflösen", async ({ lab, phone: profile }) => {
    test.setTimeout(180_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("zg-Anna", profile);
    const b = await lab.newPhone("zg-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);
    await a.hostSelectGame("zeichnen");
    await tv.start();
    await expect(tv.tid("zg-tv")).toHaveAttribute("data-phase", "intro");

    for (let round = 0; round < 2; round++) {
      await expect(tv.tid("zg-tv")).toHaveAttribute("data-phase", "choose", { timeout: 20_000 });
      // Warten, bis eines der Handys die Begriffsauswahl zeigt (der TV kann früher umschalten).
      await expect.poll(async () => (await a.tid("zg-option-0").isVisible()) || (await b.tid("zg-option-0").isVisible())).toBe(true);
      const aDraws = await a.tid("zg-option-0").isVisible();
      const [drawer, guesser]: [PhonePage, PhonePage] = aDraws ? [a, b] : [b, a];
      await expect(drawer.tid("zg-option-0")).toBeVisible();
      await drawer.tid("zg-option-0").click();
      await expect(tv.tid("zg-tv")).toHaveAttribute("data-phase", "draw");
      const word = (await drawer.tid("zg-drawword").textContent())!.trim();

      // Einen Strich quer über das Blatt ziehen.
      const pad = drawer.tid("zg-pad");
      const box = (await pad.boundingBox())!;
      await drawer.page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
      await drawer.page.mouse.down();
      for (let i = 1; i <= 10; i++) await drawer.page.mouse.move(box.x + box.width * (0.2 + i * 0.06), box.y + box.height * (0.2 + i * 0.05));
      await drawer.page.mouse.up();
      // TV zeichnet mit: Canvas hat nicht-weiße Pixel.
      await expect
        .poll(async () =>
          tv.tid("zg-canvas").evaluate((c: HTMLCanvasElement) => {
            const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < d.length; i += 4) if (d[i]! < 200) return true;
            return false;
          }),
        )
        .toBe(true);

      // Fehltipp → Sprechblase am TV; dann Treffer.
      await guesser.tid("zg-input").fill("Quatschwort");
      await guesser.tid("zg-send").click();
      await expect(tv.tid("zg-bubbles")).toContainText("Quatschwort");
      if (round === 0) {
        await lab.shot(tv.page, "zeichnen-tv-draw");
        await lab.shot(drawer.page, "zeichnen-phone-draw");
        await lab.shot(guesser.page, "zeichnen-phone-guess");
      }
      await guesser.page.waitForTimeout(1100); // max. 1 Tipp pro Sekunde
      await guesser.tid("zg-input").fill(word.toLowerCase());
      await guesser.tid("zg-send").click();
      // Einziger Rater hat's → sofort Auflösung (der Erfolgsbildschirm kann schon vorbei sein).
      await expect(guesser.tid("zg-success").or(guesser.tid("zg-result"))).toBeVisible();
      await expect(tv.tid("zg-tv")).toHaveAttribute("data-phase", "reveal");
      await expect(tv.tid("zg-word")).toHaveText(word);
      await a.tid("skip-button").click();
      if (round === 0) {
        await expect(tv.tid("zg-tv")).toHaveAttribute("data-phase", "standings");
        await tv.press("Enter");
      }
    }
    await expect(tv.tid("zg-tv")).toHaveAttribute("data-phase", "final");
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(2);
  });
});
