// Szenario 7: Schiffe versenken – zwei Handys stellen auf (verschieben, würfeln, bereit),
// schießen abwechselnd; der TV zeigt nur Treffer, keine Schiffe. Der Host bricht ab → Lobby.
// (Kampfloser Sieg beim Verlassen ist in games/schiffe/test/server.test.ts abgedeckt.)
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

const target = (ph: PhonePage, i: number) => ph.tid(`sv-cell-${i}`);

/** Erstes noch freies Feld auf dem gegnerischen Gewässer beschießen und auf die Bestätigung warten. */
async function fireFirstFree(ph: PhonePage): Promise<void> {
  const free = ph.page.locator('[data-testid^="sv-cell-"]:enabled').first();
  const id = (await free.getAttribute("data-testid"))!;
  await free.click();
  await expect(ph.tid(id)).not.toHaveAttribute("aria-label", /unbekannt/);
}

test.describe("Schiffe versenken", () => {
  test("2 Handys: Aufstellung, Schüsse, Abbruch", async ({ lab, phone: profile }) => {
    test.setTimeout(120_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("sv-Anna", profile);
    const b = await lab.newPhone("sv-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "pinguin");
    await tv.expectPlayerCount(2);

    await a.hostSelectGame("schiffe");
    await tv.start();
    await expect(tv.tid("sv-tv")).toHaveAttribute("data-phase", "setup");
    await expect(a.tid("sv-controller")).toHaveAttribute("data-phase", "setup");
    // Der TV verrät keine Schiffe.
    await expect(tv.page.locator(".sv-ship")).toHaveCount(0);

    // Anna würfelt neu, Ben übernimmt die Zufallsaufstellung.
    await a.tid("sv-shuffle").click();
    await a.page.locator(".sv-ship").first().waitFor();
    await lab.shot(a.page, "schiffe-phone-setup");
    await a.tid("sv-ready").click();
    await expect(tv.tid("sv-side-0")).toContainText("bereit");
    await b.tid("sv-ready").click();

    await expect(tv.tid("sv-tv")).toHaveAttribute("data-phase", "battle");
    await expect(tv.tid("sv-status")).toContainText("Anna beginnt");
    await expect(b.tid("sv-status")).toContainText("Anna zielt");
    await expect(target(b, 0)).toBeDisabled();

    await fireFirstFree(a);
    await expect(tv.tid("sv-status")).toContainText(/Anna: A1 – (Wasser|Treffer!)/);
    await lab.shot(tv.page, "schiffe-tv-battle");

    // Bis Ben dran ist (Treffer = nochmal), dann schießt Ben einmal.
    for (let i = 0; i < 20 && !(await b.tid("sv-status").textContent())?.startsWith("Du bist dran"); i++) {
      if ((await a.tid("sv-status").textContent())?.match(/Du bist dran|nochmal/)) await fireFirstFree(a);
    }
    await expect(b.tid("sv-status")).toContainText("Du bist dran");
    await fireFirstFree(b);
    await lab.shot(b.page, "schiffe-phone-battle");

    await a.hostAbort();
    await expect(tv.tid("sv-tv")).toHaveCount(0);
    await expect(a.tid("host-game-select")).toBeVisible();
  });
});
