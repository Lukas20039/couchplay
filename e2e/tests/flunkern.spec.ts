// Szenario 16: Flunkern – zwei Handys schreiben Lügen, wählen die Wahrheit, TV deckt Schritt für Schritt auf.
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

async function lie(ph: PhonePage, text: string, last = false): Promise<void> {
  await ph.tid("fl-input").fill(text);
  await ph.tid("fl-submit").click();
  // Die letzte Lüge beendet die Schreibphase sofort – dann gibt es kein „Warten“.
  if (!last) await expect(ph.tid("fl-locked")).toBeVisible();
}

test.describe("Flunkern", () => {
  test("3 Runden lügen, wählen, Auflösung und Überspringen", async ({ lab, phone: profile }) => {
    test.setTimeout(180_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("fl-Anna", profile);
    const b = await lab.newPhone("fl-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);
    await a.hostSelectGame("flunkern");
    await a.hostSetNumber("rounds", 3);
    await tv.start();

    for (let r = 0; r < 3; r++) {
      await expect(tv.tid("fl-tv")).toHaveAttribute("data-phase", "write", { timeout: 20_000 });
      await lie(a, `Quietscheente ${r}`);
      if (r === 0) {
        await lab.shot(tv.page, "flunkern-tv-write");
        await lab.shot(b.page, "flunkern-phone-write");
      }
      await lie(b, `Gummistiefel ${r}`, true);

      await expect(tv.tid("fl-tv")).toHaveAttribute("data-phase", "choose");
      // Mit Hauslügen aufgefüllt: mindestens 4 Antworten; die eigene Lüge ist gesperrt.
      expect(await tv.page.locator('[data-testid^="fl-tile-"]').count()).toBeGreaterThanOrEqual(4);
      for (const ph of [a, b]) {
        await expect(ph.page.locator('[data-testid^="fl-btn-"]:disabled')).toHaveCount(1);
        await ph.page.locator('[data-testid^="fl-btn-"]:not(:disabled)').first().click();
      }
      if (r === 0) await lab.shot(tv.page, "flunkern-tv-choose");

      await expect(tv.tid("fl-tv")).toHaveAttribute("data-phase", "reveal");
      await expect(a.tid("skip-button")).toBeVisible();
      if (r === 0) await lab.shot(tv.page, "flunkern-tv-reveal");
      await a.tid("skip-button").click();
      if (r < 2) {
        await expect(tv.tid("fl-tv")).toHaveAttribute("data-phase", "standings");
        await tv.press("Enter");
      }
    }
    await expect(tv.tid("fl-tv")).toHaveAttribute("data-phase", "final");
    await expect(tv.tid("fl-awards")).toBeVisible();
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(2);
  });
});
