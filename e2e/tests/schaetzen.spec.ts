// Szenario 14: Schätzen! – zwei Handys tippen über das Ziffernfeld, TV löst auf dem Zahlenstrahl auf.
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

async function typeNumber(ph: PhonePage, digits: string): Promise<void> {
  for (const k of digits) await ph.tid(`es-key-${k === "," ? "comma" : k}`).click();
}

test.describe("Schätzen!", () => {
  test("5 Fragen mit Ziffernfeld, Auflösung und Überspringen", async ({ lab, phone: profile }) => {
    test.setTimeout(180_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("es-Anna", profile);
    const b = await lab.newPhone("es-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);
    await a.hostSelectGame("schaetzen");
    await a.hostSetNumber("rounds", 5);
    await tv.start();

    for (let q = 0; q < 5; q++) {
      await expect(tv.tid("es-tv")).toHaveAttribute("data-phase", "question", { timeout: 20_000 });
      await typeNumber(a, "1234");
      // Zahlen mit Tausenderpunkt, Jahreszahlen ohne.
      await expect(a.tid("es-display")).toContainText(/1\.?234/);
      await a.tid("es-done").click();
      await expect(a.tid("es-locked")).toBeVisible();
      await typeNumber(b, "987"); // ganze Zahl: bei Jahreszahlen ist das Komma gesperrt
      if (q === 0) {
        await lab.shot(tv.page, "schaetzen-tv-question");
        await lab.shot(b.page, "schaetzen-phone-input");
      }
      await b.tid("es-done").click();
      await expect(tv.tid("es-tv")).toHaveAttribute("data-phase", "reveal");
      await expect(tv.tid(`es-pin-${a.playerId}`)).toBeVisible();
      // Überspringen erst nach der Animation möglich.
      await expect(a.tid("skip-button")).toBeVisible({ timeout: 15_000 });
      await expect(a.tid("es-result")).toBeVisible();
      if (q === 0) {
        await lab.shot(tv.page, "schaetzen-tv-reveal");
        await lab.shot(a.page, "schaetzen-phone-reveal");
      }
      await a.tid("skip-button").click();
      if (q < 4) {
        await expect(tv.tid("es-tv")).toHaveAttribute("data-phase", "standings");
        await tv.press("Enter");
      }
    }
    await expect(tv.tid("es-tv")).toHaveAttribute("data-phase", "final");
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(2);
  });
});
