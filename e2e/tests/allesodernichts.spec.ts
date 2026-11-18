// Szenario: Alles oder nichts – zwei Handys. Frage 1: Anna tippt, Ben enthält sich, am TV läuft das
// Lauflicht und streicht eine falsche Antwort; Anna steigt aus (oder fliegt raus). Restliche Fragen
// enthalten sich beide → direkte Auflösung. (Punkte, Bonus, Zeitablauf: games/allesodernichts/test/server.test.ts)
import { expect, otherProfile, test } from "./fixtures.js";

test.describe("Alles oder nichts", () => {
  test("Tippen, Lauflicht, Aussteigen, Auflösung bis zum Ergebnis", async ({ lab, phone: profile }) => {
    test.setTimeout(180_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("an-Anna", profile);
    const b = await lab.newPhone("an-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);
    await a.hostSelectGame("allesodernichts");
    await a.hostSetNumber("rounds", 5);
    await tv.start();

    // Frage 1
    await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", "pick", { timeout: 20_000 });
    await expect(tv.tid("an-question")).not.toBeEmpty();
    await a.tid("an-pick-0").click();
    await expect(a.tid("an-locked")).toBeVisible();
    await lab.shot(b.page, "allesodernichts-phone-pick");
    await b.tid("an-abstain").click();
    await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", "spin");
    await expect(tv.page.locator(".an-answer.is-lit")).toHaveCount(1);
    await expect(a.tid("an-state")).toBeVisible();
    // Nach dem Lauflicht: entweder ist Annas Antwort noch drin (Entscheidung) oder sie ist geflogen (Auflösung).
    await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", /decide|reveal/, { timeout: 15_000 });
    await expect(tv.page.locator(".an-answer.is-struck")).toHaveCount(1);
    if ((await tv.tid("an-tv").getAttribute("data-phase")) === "decide") {
      await expect(a.tid("an-cash")).toBeVisible();
      await lab.shot(tv.page, "allesodernichts-tv-decide");
      await lab.shot(a.page, "allesodernichts-phone-decide");
      await a.tid("an-cash").click();
    }
    await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", "reveal");
    await expect(tv.page.locator(".an-answer.is-correct")).toHaveCount(1);
    await expect(a.tid("an-result")).toBeVisible();
    await expect(b.tid("an-result")).toContainText("Enthalten");
    await expect(a.tid("skip-button")).toBeVisible({ timeout: 15_000 });
    await a.tid("skip-button").click();

    for (let q = 1; q < 5; q++) {
      await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", "standings");
      await tv.press("Enter");
      await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", "pick");
      await a.tid("an-abstain").click();
      await b.tid("an-abstain").click();
      await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", "reveal");
      await expect(a.tid("skip-button")).toBeVisible({ timeout: 15_000 });
      await a.tid("skip-button").click();
    }
    await expect(tv.tid("an-tv")).toHaveAttribute("data-phase", "final");
    await a.tid("skip-button").click();
    await expect(tv.results).toBeVisible({ timeout: 15_000 });
    await expect(tv.page.getByTestId("result-row")).toHaveCount(2);
  });
});
