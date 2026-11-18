// Szenario: Stadt, Land, Fluss – zwei Handys tippen Antworten, einer ruft „Stopp!“, gemeinsame Prüfung mit
// Daumen runter, „Passt – weiter“ je Kategorie, Zwischenstand überspringen, Finale.
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

/** Alle sechs Felder ausfüllen (Playwright-fill löst die entprellten Eingaben aus). */
async function fillAll(ph: PhonePage, letter: string, tag: string): Promise<void> {
  for (let i = 0; i < 6; i++) await ph.tid(`sl-input-${i}`).fill(`${letter}${tag}${"abcdef"[i]}`);
}

test.describe("Stadt, Land, Fluss", () => {
  test("3 Runden: tippen, Stopp, anfechten, prüfen, Finale", async ({ lab, phone: profile }) => {
    test.setTimeout(240_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("sl-Anna", profile);
    const b = await lab.newPhone("sl-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);
    await a.hostSelectGame("stadtland");
    await a.hostSetNumber("rounds", 3);
    await a.hostSetNumber("roundSeconds", 60);
    await tv.start();

    for (let r = 0; r < 3; r++) {
      // Intro (Runde 1) bzw. Zwischenstand überspringen, dann läuft die Walze.
      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", /intro|standings|letter|write/, { timeout: 20_000 });
      if ((await tv.tid("sl-tv").getAttribute("data-phase")) !== "write") await tv.press("Enter");
      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "write", { timeout: 20_000 });
      const letter = (await a.tid("sl-letter").textContent())!.trim();
      expect(letter).toMatch(/^[A-Z]$/);
      await expect(tv.tid("sl-letter")).toHaveText(letter);

      await fillAll(a, letter, "anna");
      await fillAll(b, letter, "ben");
      // Fortschritt am TV ohne Inhalte.
      await expect(tv.page.locator('[data-testid^="sl-progress-"][data-filled="6"]')).toHaveCount(2);
      await expect(tv.tid("sl-tv")).not.toContainText("anna");
      if (r === 0) {
        await lab.shot(tv.page, "stadtland-tv-write");
        await lab.shot(a.page, "stadtland-phone-write");
      }
      await a.tid("sl-stop").click();
      await expect(tv.tid("sl-stop")).toBeVisible();
      await expect(b.tid("sl-stopbar")).toContainText("Anna ruft Stopp!");

      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "review", { timeout: 15_000 });
      if (r === 0) {
        // Ben streicht Annas erste Antwort (er ist der einzige Stimmberechtigte).
        await b.page.locator('[data-testid^="sl-thumb-"]').first().click();
        await expect(tv.page.locator('[data-testid^="sl-entry-"][data-status="rejected"]')).toHaveCount(1);
        await lab.shot(tv.page, "stadtland-tv-review");
      }
      for (let c = 0; c < 6; c++) {
        await expect(a.tid("sl-category")).toContainText(`${c + 1}/6`);
        await a.tid("sl-ready").click();
        await b.tid("sl-ready").click();
      }
      if (r < 2) await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "standings");
    }
    await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "final");
    await expect(tv.tid("sl-awards")).toBeVisible();
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(2);
  });
});

