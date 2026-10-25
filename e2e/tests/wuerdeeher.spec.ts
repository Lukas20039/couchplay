// Szenario 15: Wer würde eher …? – drei Handys stimmen ab, TV krönt den Meistgewählten, Titel im Finale.
import { expect, otherProfile, test } from "./fixtures.js";

test.describe("Wer würde eher …?", () => {
  test("5 Runden abstimmen, Krone, Überspringen, Titel", async ({ lab, phone: profile }) => {
    test.setTimeout(180_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("we-Anna", profile);
    const b = await lab.newPhone("we-Ben", otherProfile(profile));
    const c = await lab.newPhone("we-Cem", profile);
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await c.joinByCode(code, "Cem", "tiger");
    await tv.expectPlayerCount(3);
    await a.hostSelectGame("wuerdeeher");
    await a.hostSetNumber("rounds", 5);
    await tv.start();

    for (let r = 0; r < 5; r++) {
      await expect(tv.tid("we-tv")).toHaveAttribute("data-phase", "vote", { timeout: 20_000 });
      // Anna und Ben wählen Cem, Cem wählt sich selbst → Cem wird gekrönt, alle lagen mit der Mehrheit.
      await a.tid(`we-tile-${c.playerId}`).click();
      await expect(a.tid("we-locked")).toBeVisible();
      if (r === 0) {
        await lab.shot(tv.page, "wuerdeeher-tv-vote");
        await lab.shot(b.page, "wuerdeeher-phone-vote");
      }
      await b.tid(`we-tile-${c.playerId}`).click();
      await c.tid(`we-tile-${c.playerId}`).click();
      await expect(tv.tid("we-tv")).toHaveAttribute("data-phase", "reveal");
      await expect(tv.tid("we-crowned")).toBeVisible({ timeout: 15_000 });
      await expect(tv.tid("we-headline")).toContainText("Cem");
      await expect(a.tid("skip-button")).toBeVisible();
      if (r === 0) {
        await lab.shot(tv.page, "wuerdeeher-tv-reveal");
        await lab.shot(c.page, "wuerdeeher-phone-reveal");
      }
      await a.tid("skip-button").click();
      if (r < 4) {
        await expect(tv.tid("we-tv")).toHaveAttribute("data-phase", "standings");
        await tv.press("Enter");
      }
    }
    await expect(tv.tid("we-tv")).toHaveAttribute("data-phase", "final");
    await expect(tv.tid(`we-title-${c.playerId}`)).toBeVisible();
    await lab.shot(tv.page, "wuerdeeher-tv-final");
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(3);
  });
});
