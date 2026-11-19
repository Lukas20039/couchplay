// Szenario: Stadt, Land, Fluss – zwei Handys tippen Antworten, einer ruft „Stopp!“, gemeinsame Prüfung mit
// Daumen runter, „Passt – weiter“ je Kategorie, Zwischenstand überspringen, Finale.
// Zweites Szenario: eigene Kategorien (Editor am Host-Handy, live am TV) und eine Lexikon-Rettung (👍).
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

/** Alle Felder ausfüllen (Playwright-fill löst die entprellten Eingaben aus). */
async function fillAll(ph: PhonePage, letter: string, tag: string, n = 6): Promise<void> {
  for (let i = 0; i < n; i++) await ph.tid(`sl-input-${i}`).fill(`${letter}${tag}${"abcdef"[i]}`);
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
    // Ohne Lexikon: Die Fantasie-Antworten gelten zunächst, Ben streicht per 👎.
    await a.hostSetSelect("check", "Aus");
    await tv.start();

    for (let r = 0; r < 3; r++) {
      // Intro (Runde 1) bzw. Zwischenstand überspringen, dann läuft die Walze.
      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", /intro|standings|letter|write/, { timeout: 20_000 });
      if ((await tv.tid("sl-tv").getAttribute("data-phase")) !== "write") await tv.press("Enter");
      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "write", { timeout: 20_000 });
      const letter = (await a.tid("sl-letter").textContent())!.trim();
      expect(letter).toMatch(/^[A-Z]$/);
      await expect(tv.tid("sl-letter")).toHaveText(letter);
      if (r === 0) {
        // Zeitbalken: Die Animation am Handy darf sich pro Tick nicht ändern (sonst läuft sie schneller ab als
        // die Uhr) und steht etwa so weit wie der Balken am TV.
        const bar = a.page.locator(".sl-time span");
        const duration = await bar.evaluate((el) => getComputedStyle(el).animationDuration);
        await a.page.waitForTimeout(1500);
        expect(await bar.evaluate((el) => getComputedStyle(el).animationDuration)).toBe(duration);
        const fill = (el: Element) => el.getBoundingClientRect().width / el.parentElement!.getBoundingClientRect().width;
        const [phoneFill, tvFill] = await Promise.all([bar.evaluate(fill), tv.page.locator(".sl-timebar span").first().evaluate(fill)]);
        expect(Math.abs(phoneFill - tvFill)).toBeLessThan(0.05);
      }

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

  test("Eigene Kategorien am Host-Handy, Lexikon streicht Unbekanntes, Ben rettet es", async ({ lab, phone: profile }) => {
    test.setTimeout(240_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("sl-Anna", profile);
    const b = await lab.newPhone("sl-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);
    await a.hostSelectGame("stadtland");
    // Mehr als 4 Optionen → Auswahlliste statt Segmenten.
    const setSelect = a.tid("setting-set").locator("select");
    await setSelect.selectOption("eigene");
    await expect(setSelect).toHaveValue("eigene");
    await a.hostSetNumber("rounds", 3);
    await a.hostSetNumber("roundSeconds", 60);
    await a.tid("setting-check").scrollIntoViewIfNeeded();
    await lab.shot(a.page, "stadtland-phone-settings");
    await tv.start();

    // Setup: Editor nur am Host-Handy, vorbelegt mit Stadt, Land, Fluss …; Ben wartet.
    await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "setup", { timeout: 20_000 });
    await expect(a.tid("sl-setup-editor")).toBeVisible();
    await expect(a.tid("sl-custom-0")).toHaveValue("Stadt");
    await expect(b.tid("sl-setup-wait")).toContainText("Anna legt die Kategorien fest");
    for (const i of [5, 4, 3]) await a.tid(`sl-custom-remove-${i}`).click();
    await a.tid("sl-custom-0").fill("Städte");
    await a.tid("sl-custom-1").fill("Automarken");
    // Live am TV und bei Ben.
    await expect(tv.tid("sl-setup-list").locator("li")).toHaveText(["Städte", "Automarken", "Fluss"]);
    await expect(b.tid("sl-setup-wait")).toContainText("Automarken");
    await lab.shot(tv.page, "stadtland-tv-setup");
    await lab.shot(a.page, "stadtland-phone-setup-host");
    await lab.shot(b.page, "stadtland-phone-setup-guest");
    await a.tid("sl-custom-go").click();
    await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "intro");
    await expect(tv.tid("sl-intro-cats")).toContainText("Automarken");
    // Das Host-Handy merkt sich die Liste.
    expect(await a.page.evaluate(() => localStorage.getItem("couchplay.stadtland.custom"))).toBe(JSON.stringify(["Städte", "Automarken", "Fluss"]));

    for (let r = 0; r < 3; r++) {
      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", /intro|standings|letter|write/, { timeout: 20_000 });
      if ((await tv.tid("sl-tv").getAttribute("data-phase")) !== "write") await tv.press("Enter");
      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "write", { timeout: 20_000 });
      const letter = (await a.tid("sl-letter").textContent())!.trim();
      await expect(tv.page.locator("[data-testid=sl-catlist] li")).toHaveText(["Städte", "Automarken", "Fluss"]);
      // „Städte“ ist auf Stadt abgebildet → Lexikon. Annas Fantasie-Stadt kennt es nicht.
      await a.tid("sl-input-0").fill(`${letter}qxzqw`);
      await a.tid("sl-input-1").fill(`${letter}anna`);
      await a.tid("sl-input-2").fill(`${letter}annc`);
      await fillAll(b, letter, "ben", 3);
      await expect(tv.page.locator('[data-testid^="sl-progress-"][data-filled="3"]')).toHaveCount(2);
      await a.tid("sl-stop").click();
      await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "review", { timeout: 15_000 });
      if (r === 0) {
        const anna = tv.page.locator('[data-testid^="sl-entry-"]').filter({ hasText: `${letter}qxzqw` });
        await expect(anna).toHaveAttribute("data-status", "unlisted");
        await expect(anna).toContainText("nicht im Lexikon");
        await lab.shot(b.page, "stadtland-phone-review-lexicon");
        // Ben ist einziger Stimmberechtigter → 👍 rettet.
        const up = b.page.locator('[data-testid^="sl-thumb-"][data-kind="up"]');
        await expect(up).toHaveCount(1);
        await up.click();
        await expect(anna).toHaveAttribute("data-status", "ok");
        await expect(anna).toHaveAttribute("data-rescued", "true");
        await expect(anna).toContainText("gerettet");
        await lab.shot(tv.page, "stadtland-tv-review-lexicon");
      }
      for (let c = 0; c < 3; c++) {
        await expect(a.tid("sl-category")).toContainText(`${c + 1}/3`);
        await a.tid("sl-ready").click();
        await b.tid("sl-ready").click();
      }
      if (r < 2) await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "standings");
    }
    await expect(tv.tid("sl-tv")).toHaveAttribute("data-phase", "final");
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
  });
});
