// Szenario 12: Spieleabend in zwei Teams – Abend am Handy planen, Team wechseln, Quiz spielen
// (Wartezeiten per „Weiter“ überspringen), Abendwertung im Ergebnis, Finale „Wie gut kennst du mich?“
// mit doppelten Punkten, Siegerehrung auf TV und Handys, Abend beenden.
import { expect, otherProfile, test } from "./fixtures.js";
import { playQuiz } from "./flows/quiz.js";
import type { PhonePage } from "./pages/phone.js";

test.describe("Spieleabend", () => {
  test("zwei Teams, zwei Spiele, Überspringen, Siegerehrung", async ({ lab, phone: profile }) => {
    test.setTimeout(240_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const anna = await lab.newPhone("ev-Anna", profile);
    const ben = await lab.newPhone("ev-Ben", otherProfile(profile));
    const cem = await lab.newPhone("ev-Cem", profile);
    await anna.joinByCode(code, "Anna", "fuchs");
    await ben.joinByCode(code, "Ben", "eule");
    await cem.joinByCode(code, "Cem", "tiger");
    await tv.expectPlayerCount(3);
    const phones = [anna, ben, cem];

    // --- Planen am Host-Handy: nur Quiz und „Wie gut kennst du mich?“, 2 Teams, Finale doppelt.
    await anna.tid("evening-open").click();
    await expect(anna.tid("evening-planner")).toBeVisible();
    const checked = anna.page.locator('[data-testid^="evening-game-"][aria-checked="true"]');
    while ((await checked.count()) > 0) await checked.first().click();
    await anna.tid("evening-game-quiz").click();
    await anna.tid("evening-game-kennstdu").click();
    await anna.tid("evening-mode-2").click();
    await lab.shot(anna.page, "evening-phone-planner");
    await anna.tid("evening-start").click();

    await expect(tv.tid("evening-plan")).toBeVisible();
    await expect(tv.tid("evening-chip")).toHaveCount(2);
    await expect(tv.tid("team-col")).toHaveCount(2);
    await expect(tv.startButton).toHaveText("Spiel 1 starten");

    // Teams bauen: Anna + Ben in Team 0, Cem in Team 1 (jeder tippt sein Team selbst an).
    const join = async (ph: PhonePage, team: number): Promise<void> => {
      const box = ph.tid(`team-${team}`);
      if ((await box.evaluate((el) => el.tagName)) === "BUTTON") await box.click();
      await expect(box.locator(".team__you")).toBeVisible();
    };
    await join(anna, 0);
    await join(ben, 0);
    await join(cem, 1);
    const col = (team: number) => tv.page.locator(`[data-testid="team-col"][data-team="${team}"] [data-testid="team-member"]`);
    await expect(col(0)).toHaveCount(2);
    await expect(col(1)).toHaveCount(1);
    await lab.shot(tv.page, "evening-tv-lobby-teams");
    await lab.shot(ben.page, "evening-phone-teams");

    // --- Spiel 1: kurzes Quiz.
    await expect(anna.tid("host-game-select")).toHaveCount(0);
    await anna.hostSetNumber("rounds", 5);
    await anna.hostSetNumber("answerSeconds", 10);
    await tv.start();
    await expect(tv.tid("team-col")).toHaveCount(0);

    await playQuiz({
      tv,
      phones,
      total: 5,
      // Niemand antwortet → alle teilen sich Platz 1 → beide Teams bekommen 10 Abendpunkte.
      choose: () => null,
      onReveal: async (q) => {
        // Auflösung ist eine Wartezeit: TV und Host-Handy zeigen „Weiter“, die anderen nicht.
        await expect(tv.tid("skip-button")).toBeVisible();
        await expect(anna.tid("skip-button")).toBeVisible();
        await expect(ben.tid("skip-button")).toHaveCount(0);
        if (q === 0) {
          await lab.shot(tv.page, "evening-tv-skip");
          await lab.shot(anna.page, "evening-phone-skip");
        }
        // Abwechselnd am Handy und per OK auf der Fernbedienung überspringen.
        if (q % 2 === 0) await anna.tid("skip-button").click();
        else await tv.press("Enter");
      },
    });

    // Ergebnis mit Abendwertung (niemand hat geantwortet → alle Platz 1 → beide Teams +10).
    await expect(tv.results).toBeVisible({ timeout: 40_000 });
    await expect(tv.tid("evening-side")).toBeVisible();
    await expect(tv.tid("evening-row")).toHaveCount(2);
    await expect(tv.tid("evening-next")).toHaveText("Weiter: Wie gut kennst du mich?");
    await expect(anna.tid("evening-award")).toHaveText("Team Feuer: +10 Abendpunkte");
    await expect(cem.tid("evening-award")).toHaveText("Team Welle: +10 Abendpunkte");
    await expect(anna.tid("again-button")).toHaveCount(0);
    await lab.shot(tv.page, "evening-tv-results");
    await lab.shot(cem.page, "evening-phone-results");

    // --- Spiel 2 (Finale ×2): „Wie gut kennst du mich?“, 1 Frage pro Person.
    await anna.tid("evening-next").click();
    await expect(tv.startButton).toHaveText("Finale starten");
    await expect(tv.page.locator('[data-testid="evening-chip"][data-state="done"]')).toHaveCount(1);
    await anna.hostSetNumber("turns", 1);
    await tv.start();
    for (let q = 0; q < 3; q++) {
      await expect(tv.tid("kd-tv")).toHaveAttribute("data-phase", "ask", { timeout: 20_000 });
      // Alle wählen Antwort 1 → alle Rater liegen richtig.
      await Promise.all(phones.map((ph) => ph.tid("kd-btn-0").click()));
      await expect(tv.tid("kd-tv")).toHaveAttribute("data-phase", "reveal");
      await anna.tid("skip-button").click();
      if (q < 2) {
        await expect(tv.tid("kd-tv")).toHaveAttribute("data-phase", "standings");
        await tv.press("Enter");
      }
    }
    await expect(tv.tid("kd-tv")).toHaveAttribute("data-phase", "final");
    await anna.tid("skip-button").click();

    // Ergebnis → Siegerehrung.
    await expect(tv.tid("evening-side")).toBeVisible({ timeout: 20_000 });
    await expect(tv.tid("evening-next")).toHaveText("Zur Siegerehrung 🏆");
    await tv.activate(tv.tid("evening-next"));
    await expect(tv.tid("evening-finale")).toBeVisible();
    await expect(tv.tid("finale-row")).toHaveCount(2);
    for (const ph of phones) await expect(ph.tid("evening-finale")).toBeVisible();
    await lab.shot(tv.page, "evening-tv-finale");
    await lab.shot(anna.page, "evening-phone-finale");

    // Fertig → normale Lobby mit Spielkatalog.
    await anna.tid("finale-done").click();
    await expect(tv.tid("game-catalog")).toBeVisible();
    await expect(tv.tid("evening-plan")).toHaveCount(0);
    await expect(anna.tid("host-game-select")).toBeVisible();
  });
});
