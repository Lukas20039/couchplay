// Szenario 11: „Wie gut kennst du mich?“ – zwei Handys: eines ist Hauptperson (du-Frage), das andere rät
// (Frage mit Namen). Beide tippen dieselbe Antwort → TV löst sofort auf, beide bekommen Punkte.
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

test.describe("Wie gut kennst du mich?", () => {
  test("Hauptperson antwortet, die andere Person rät richtig", async ({ lab, phone: profile }) => {
    test.setTimeout(120_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("kd-Anna", profile);
    const b = await lab.newPhone("kd-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);

    await a.hostSelectGame("kennstdu");
    await tv.start();
    await expect(tv.tid("kd-tv")).toHaveAttribute("data-phase", "intro");
    await expect(tv.tid("kd-tv")).toHaveAttribute("data-phase", "ask", { timeout: 15_000 });

    const role = async (ph: PhonePage) => ph.tid("kd-role").getAttribute("data-role");
    const [hot, guess] = (await role(a)) === "hotseat" ? [a, b] : [b, a];
    expect(await role(guess)).toBe("guess");
    const hotName = hot === a ? "Anna" : "Ben";
    await expect(tv.tid("kd-question")).toContainText(hotName);
    await expect(guess.tid("kd-role")).toHaveText(`Was hat ${hotName} gewählt?`);
    await lab.shot(tv.page, "kennstdu-tv-ask");
    await lab.shot(hot.page, "kennstdu-phone-hot");

    await hot.tid("kd-btn-1").click();
    await expect(hot.tid("kd-locked")).toBeVisible();
    await expect(tv.tid("kd-status")).toContainText(`${hotName} hat geantwortet`);
    await guess.tid("kd-btn-1").click();

    await expect(tv.tid("kd-tv")).toHaveAttribute("data-phase", "reveal");
    await expect(tv.tid("kd-answer-1")).toHaveClass(/is-chosen/);
    await expect(tv.tid("kd-status")).toContainText("Alle haben richtig geraten!");
    await expect(guess.tid("kd-result")).toContainText("Richtig geraten!");
    await expect(hot.tid("kd-result")).toContainText("1 Person kennt dich gut!");
    await lab.shot(tv.page, "kennstdu-tv-reveal");

    await a.hostAbort();
    await expect(a.tid("host-game-select")).toBeVisible();
  });
});
