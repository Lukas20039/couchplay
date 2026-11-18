// Szenario: Vier gewinnt – zwei Handys, eine Partie. Vorschau-Spalte erscheint am TV, Steine fallen,
// der falsche Spieler kann nicht ziehen, senkrechte Viererreihe gewinnt. Danach 1 Spieler gegen den Computer.
// (Best-of, Zeitlimit, Unentschieden und Reconnect sind in games/viergewinnt/test/server.test.ts abgedeckt.)
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

const col = (ph: PhonePage, i: number) => ph.tid(`c4-col-${i}`);

/** Spalte wählen und einwerfen; wartet, bis der Server den Zug bestätigt (man ist nicht mehr dran). */
async function drop(ph: PhonePage, i: number): Promise<void> {
  await expect(col(ph, i)).toBeEnabled();
  await col(ph, i).click();
  await expect(col(ph, i)).toHaveAttribute("aria-pressed", "true");
  await ph.tid("c4-drop").click();
  await expect(col(ph, i)).toBeDisabled();
}

test.describe("Vier gewinnt", () => {
  test("2 Handys: Vorschau, Einwerfen, Sieg", async ({ lab, phone: profile }) => {
    test.setTimeout(120_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("c4-Anna", profile);
    const b = await lab.newPhone("c4-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "pinguin");
    await tv.expectPlayerCount(2);

    await a.hostSelectGame("viergewinnt");
    await a.hostSetSelect("bestOf", "Eine Partie");
    await tv.start();
    await expect(tv.tid("c4-tv")).toHaveAttribute("data-phase", "playing");
    await expect(tv.tid("c4-status")).toContainText("Anna beginnt");
    await expect(b.tid("c4-status")).toContainText("Anna ist am Zug");
    await expect(col(b, 0)).toBeDisabled();

    // Vorschau: erster Tipp markiert die Spalte, der TV zeigt den schwebenden Stein.
    await col(a, 3).click();
    await expect(a.tid("c4-status")).toContainText("Spalte 4 gewählt");
    await expect(tv.page.locator(".c4-hover")).toHaveCount(1);
    await lab.shot(a.page, "viergewinnt-phone-aim");

    // Anna baut senkrecht in Spalte 1, Ben setzt in Spalte 2 und 3 (ohne eigene Reihe).
    await a.tid("c4-drop").click();
    await expect(tv.page.locator(".c4-stone")).toHaveCount(1);
    for (const benCol of [1, 1, 2]) {
      await drop(b, benCol);
      await drop(a, 0);
    }
    await expect(tv.page.locator(".c4-stone")).toHaveCount(7);
    await lab.shot(tv.page, "viergewinnt-tv-play");
    await drop(b, 2);
    await col(a, 0).click();
    await expect(col(a, 0)).toHaveAttribute("aria-pressed", "true");
    await col(a, 0).click(); // zweites Antippen wirft ein
    await expect(tv.tid("c4-banner")).toHaveText("Anna gewinnt!");
    await expect(tv.page.locator(".c4-stone.is-win")).toHaveCount(4);
    await expect(a.tid("c4-result")).toContainText("Gewonnen!");
    await expect(b.tid("c4-result")).toContainText("Verloren");
    await lab.shot(tv.page, "viergewinnt-tv-win");
  });

  test("1 Spieler gegen den Computer, Abbruch durch den Host", async ({ lab, phone: profile }) => {
    test.setTimeout(90_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("c4-Solo", profile);
    await a.joinByCode(code, "Solo", "eule");
    await a.hostSelectGame("viergewinnt");
    await a.hostSetSelect("difficulty", "Schwer");
    await tv.start();
    await expect(tv.tid("c4-seat-1")).toContainText("Computer");
    await drop(a, 3);
    await expect(a.tid("c4-status")).toContainText("Computer überlegt");
    // Nach der Bedenkzeit ist man wieder dran; der Computer hat einen Stein gesetzt.
    await expect(col(a, 3)).toBeEnabled({ timeout: 10_000 });
    await expect(tv.page.locator(".c4-stone")).toHaveCount(2);
    await a.hostAbort();
    await expect(tv.tid("c4-tv")).toHaveCount(0);
  });
});
