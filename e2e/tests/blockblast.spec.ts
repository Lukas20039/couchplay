// Szenario 8: Blockblast – zwei Handys legen gleichzeitig Teile (antippen + Feld), der TV zeigt beide
// Bretter und Punktestände live; dieselbe Teile-Reihenfolge für alle. Host bricht ab → Lobby.
import { bestMove } from "@couchplay/game-blockblast/testing";
import { expect, otherProfile, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";

/** Brett und Hand vom Handy lesen (data-cell / data-shape). */
async function readPhone(ph: PhonePage): Promise<{ board: string; hand: (number | null)[] }> {
  const board = (await ph.page.locator('[data-testid^="bb-cell-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-cell") ?? "."))).join("");
  const hand = await Promise.all(
    [0, 1, 2].map(async (i) => {
      const v = await ph.tid(`bb-slot-${i}`).getAttribute("data-shape");
      return v === "" || v === null ? null : Number(v);
    }),
  );
  return { board, hand };
}

/** Einen sinnvollen Zug per Antippen machen und auf die Bestätigung (Punkte steigen) warten. */
async function playOne(ph: PhonePage): Promise<void> {
  const before = Number(await ph.tid("bb-my-score").textContent());
  const { board, hand } = await readPhone(ph);
  const m = bestMove(board, hand);
  expect(m).not.toBeNull();
  await ph.tid(`bb-slot-${m!.slot}`).click();
  await expect(ph.tid(`bb-slot-${m!.slot}`)).toHaveAttribute("aria-pressed", "true");
  await ph.tid(`bb-cell-${m!.y * 8 + m!.x}`).click();
  await expect.poll(async () => Number(await ph.tid("bb-my-score").textContent())).toBeGreaterThan(before);
}

test.describe("Blockblast", () => {
  test("2 Handys legen gleichzeitig, TV zeigt Bretter und Punkte live", async ({ lab, phone: profile }) => {
    test.setTimeout(120_000);
    const tv = await lab.openTv();
    const code = await tv.code();
    const a = await lab.newPhone("bb-Anna", profile);
    const b = await lab.newPhone("bb-Ben", otherProfile(profile));
    await a.joinByCode(code, "Anna", "fuchs");
    await b.joinByCode(code, "Ben", "eule");
    await tv.expectPlayerCount(2);

    await a.hostSelectGame("blockblast");
    await tv.start();
    await expect(tv.tid("bb-tv")).toHaveAttribute("data-phase", "countdown");
    await expect(tv.tid("bb-tv")).toHaveAttribute("data-phase", "playing", { timeout: 10_000 });
    await expect(a.tid("bb-controller")).toHaveAttribute("data-phase", "playing");

    // Gleiche Teile für alle
    expect((await readPhone(a)).hand).toEqual((await readPhone(b)).hand);

    for (let i = 0; i < 5; i++) {
      await Promise.all([playOne(a), playOne(b)]);
    }
    const scoreA = await a.tid("bb-my-score").textContent();
    const scoreB = await b.tid("bb-my-score").textContent();
    await expect(tv.page.locator(`[data-testid^="bb-score-"]`).first()).toContainText(scoreA!);
    await expect(tv.page.locator(`[data-testid^="bb-score-"]`).nth(1)).toContainText(scoreB!);
    // Beide haben dieselben Teile mit derselben Strategie gelegt → gleiche Bretter.
    expect((await readPhone(a)).board).toEqual((await readPhone(b)).board);
    await lab.shot(tv.page, "blockblast-tv");
    await lab.shot(a.page, "blockblast-phone");

    await a.hostAbort();
    await expect(tv.tid("bb-tv")).toHaveCount(0);
    await expect(a.tid("host-game-select")).toBeVisible();
  });
});
