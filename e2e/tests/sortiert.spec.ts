// Szenario 17: Sortiert! – zwei Handys bringen Karten per Antippen in Reihenfolge, TV löst mit Werten auf.
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

/** Karten in Auslage-Reihenfolge antippen; die letzte rutscht automatisch nach. */
async function sortAll(ph: PhonePage, last = false): Promise<void> {
  const pool = ph.tid("sc-pool").locator('[data-testid^="sc-card-"]');
  await expect(pool).toHaveCount(4);
  // 4 → 3 → 2 → 0: nach der dritten Karte rutscht die vierte automatisch ans Ende.
  for (const left of [3, 2, 0]) {
    await pool.first().click();
    await expect(pool).toHaveCount(left);
  }
  await ph.tid("sc-done").click();
  // Die letzte Abgabe beendet die Runde sofort – dann gibt es kein „Warten“.
  if (!last) await expect(ph.tid("sc-locked")).toBeVisible();
}

test.describe("Sortiert!", () => {
  test("5 Runden antippen, Auflösung und Überspringen", async ({ lab, phone: profile }) => {
    test.setTimeout(180_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("so-Anna", profile);
    const b = await lab.newPhone("so-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);
    await a.hostSelectGame("sortiert");
    await a.hostSetNumber("rounds", 5);
    await tv.start();

    for (let r = 0; r < 5; r++) {
      await expect(tv.tid("so-tv")).toHaveAttribute("data-phase", "sort", { timeout: 20_000 });
      // Vor der Auflösung keine Werte am TV.
      await expect(tv.page.locator('[data-testid^="so-value-"]')).toHaveCount(0);
      if (r === 0) {
        await lab.shot(tv.page, "sortiert-tv-sort");
        await lab.shot(b.page, "sortiert-phone-sort");
      }
      await sortAll(a);
      await sortAll(b, true);
      await expect(tv.tid("so-tv")).toHaveAttribute("data-phase", "reveal");
      await expect(tv.tid("so-value-3")).toBeVisible({ timeout: 15_000 });
      await expect(a.tid("sc-result")).toBeVisible();
      if (r === 0) {
        await lab.shot(tv.page, "sortiert-tv-reveal");
        await lab.shot(a.page, "sortiert-phone-reveal");
      }
      await a.tid("skip-button").click();
      if (r < 4) {
        await expect(tv.tid("so-tv")).toHaveAttribute("data-phase", "standings");
        await tv.press("Enter");
      }
    }
    await expect(tv.tid("so-tv")).toHaveAttribute("data-phase", "final");
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(2);
  });
});
