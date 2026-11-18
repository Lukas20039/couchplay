// Szenario: Wer ist der Spion? – drei Handys sehen ihre geheime Rolle, geben reihum Hinweise, stimmen ab,
// der TV löst auf; nach einem Reload sieht das Handy seine Rolle wieder.
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

/** Rollenkarte kurz aufdecken (pointerdown/up) und „Verstanden“ tippen. */
async function readRole(ph: PhonePage): Promise<void> {
  const card = ph.tid("sp-secret");
  await expect(card).toBeVisible();
  await card.dispatchEvent("pointerdown");
  await expect(ph.tid("sp-secret-text")).toBeVisible();
  await card.dispatchEvent("pointerup");
  await ph.tid("sp-ready").click();
}

test.describe("Wer ist der Spion?", () => {
  test("3 Runden: Rolle, Hinweise reihum, Abstimmung, Auflösung, Reconnect", async ({ lab, phone: profile }) => {
    test.setTimeout(240_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("sp-Anna", profile);
    const b = await lab.newPhone("sp-Ben", otherProfile(profile));
    const c = await lab.newPhone("sp-Cem", profile);
    const phones = [a, b, c];
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await c.joinByCode(code, "Cem", "tiger");
    await tv.expectPlayerCount(3);
    await a.hostSelectGame("spion");
    await a.hostSetSelect("rounds", "3 Runden");
    await a.hostSetNumber("clueRounds", 1);
    await tv.start();

    for (let r = 0; r < 3; r++) {
      await expect(tv.tid("sp-tv")).toHaveAttribute("data-phase", "role", { timeout: 20_000 });
      for (const ph of phones) await readRole(ph);
      if (r === 0) await lab.shot(a.page, "spion-phone-role");

      // Hinweise: wer das Eingabefeld hat, ist dran (3 Züge).
      await expect(tv.tid("sp-tv")).toHaveAttribute("data-phase", "clue");
      for (let turn = 0; turn < 3; turn++) {
        await expect(tv.tid("sp-turn")).toBeVisible();
        let done = false;
        for (let i = 0; i < 40 && !done; i++) {
          for (const ph of phones) {
            if (await ph.tid("sp-input").isVisible()) {
              if (r === 0 && turn === 1) {
                // Reconnect mitten in den Hinweisen: eigene Rolle ist sofort wieder da.
                await ph.page.reload();
                await expect(ph.tid("sp-input")).toBeVisible({ timeout: 15_000 });
                // Erst gecachte, dann Live-Ansicht: Feld kann einmal neu eingehängt werden.
                await expect(ph.tid("connection-banner")).toBeHidden({ timeout: 15_000 });
              }
              await expect(async () => {
                await ph.tid("sp-input").fill(`Hinweis${r}${turn}`, { timeout: 2_000 });
                await ph.tid("sp-submit").click({ timeout: 2_000 });
                await expect(ph.tid("sp-input")).toBeHidden({ timeout: 2_000 });
              }).toPass({ timeout: 15_000 });
              done = true;
              break;
            }
          }
          if (!done) await a.page.waitForTimeout(250);
        }
        expect(done).toBe(true);
        if (r === 0 && turn === 0) await lab.shot(tv.page, "spion-tv-clue");
      }

      // Abstimmung: jeder tippt die erste Kachel (nie sich selbst).
      await expect(tv.tid("sp-tv")).toHaveAttribute("data-phase", "vote");
      for (const ph of phones) {
        await expect(ph.tid("sp-secret")).toBeVisible();
        await ph.page.locator('[data-testid^="sp-tile-"]').first().click();
      }
      await expect(tv.tid("sp-tv")).toHaveAttribute("data-phase", "reveal");
      await expect(a.tid("skip-button")).toBeVisible();
      if (r === 0) await lab.shot(tv.page, "spion-tv-reveal");
      await a.tid("skip-button").click();

      // Enttarnt (klassisch) → der Spion rät; sonst direkt das Ergebnis.
      await expect(tv.tid("sp-tv")).toHaveAttribute("data-phase", /^(guess|result)$/);
      if ((await tv.tid("sp-tv").getAttribute("data-phase")) === "guess") {
        let guessed = false;
        for (let i = 0; i < 40 && !guessed; i++) {
          for (const ph of phones) {
            if (await ph.tid("sp-guess-0").isVisible()) {
              await ph.tid("sp-guess-0").click();
              guessed = true;
              break;
            }
          }
          if (!guessed) await a.page.waitForTimeout(250);
        }
        expect(guessed).toBe(true);
      }
      await expect(tv.tid("sp-tv")).toHaveAttribute("data-phase", "result");
      await expect(tv.tid("sp-word")).toBeVisible();
      if (r === 0) await lab.shot(tv.page, "spion-tv-result");
      await tv.press("Enter");
    }
    await expect(tv.tid("sp-tv")).toHaveAttribute("data-phase", "final");
    await expect(tv.tid("sp-winners")).toBeVisible();
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(3);
  });
});
