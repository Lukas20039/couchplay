// Szenario 5: TicTacToe – 1 Spieler gegen den Computer, 2 Spieler mit Revanche/Serienstand,
// 3 Spieler im Raum → Teilnehmerauswahl am TV, der dritte wird Zuschauer.
import { expect, test } from "./fixtures.js";
import type { PhonePage } from "./pages/phone.js";
import type { TvPage } from "./pages/tv.js";

const cell = (ph: PhonePage, i: number) => ph.tid(`ttt-cell-${i}`);

/** Zug setzen: Feld muss frei und man selbst am Zug sein; danach ist es belegt. */
async function place(ph: PhonePage, i: number): Promise<void> {
  await expect(ph.tid("ttt-status")).toHaveText("Du bist dran!");
  await expect(cell(ph, i)).toBeEnabled();
  await cell(ph, i).click();
  await expect(cell(ph, i)).toHaveAttribute("aria-label", /: (X|O)/);
}

/** Gegen den Computer spielen, bis die Partie entschieden ist (immer erstes freies Feld). */
async function playVsBotUntilEnd(ph: PhonePage): Promise<string> {
  const result = ph.tid("ttt-result");
  const free = ph.page.locator('[data-testid^="ttt-cell-"]:enabled');
  for (let move = 0; move < 9; move++) {
    // Entweder Ende oder man ist wieder am Zug (Bot zieht nach ~700 ms).
    await expect(result.or(free.first())).toBeVisible({ timeout: 20_000 });
    if (await result.isVisible()) break;
    const target = free.first();
    const label = await target.getAttribute("aria-label");
    await target.click();
    // Warten, bis der Server den Zug bestätigt (Feld trägt jetzt eine Markierung).
    const idx = Number(label!.match(/Feld (\d)/)![1]) - 1;
    await expect(cell(ph, idx)).toHaveAttribute("aria-label", /: (X|O)/);
  }
  await expect(result).toBeVisible();
  return (await result.locator("strong").textContent()) ?? "";
}

async function setupRoom(lab: import("./fixtures.js").Lab, names: string[]): Promise<{ tv: TvPage; phones: PhonePage[] }> {
  const tv = await lab.openTv();
  const code = await tv.code();
  const phones: PhonePage[] = [];
  for (const [i, n] of names.entries()) {
    const ph = await lab.newPhone(`ttt-${n}`);
    await ph.joinByCode(code, n, (["roboter", "alien", "pinguin"] as const)[i]!);
    phones.push(ph);
  }
  await tv.expectPlayerCount(names.length);
  return { tv, phones };
}

test.describe("TicTacToe", () => {
  test("1 Spieler gegen Computer (leicht) bis Spielende", async ({ lab }) => {
    const { tv, phones } = await setupRoom(lab, ["Lea"]);
    const [lea] = phones as [PhonePage];
    await lea.hostSelectGame("tictactoe");
    await lea.hostSetSelect("difficulty", "Leicht");
    await expect(tv.setting("difficulty").locator(".setting-value")).toHaveText("Leicht");
    await tv.start();

    await expect(tv.tid("ttt-tv")).toBeVisible();
    await expect(tv.tid("ttt-seat-X")).toContainText("Lea");
    await expect(tv.tid("ttt-seat-O")).toContainText("Computer");
    await expect(lea.tid("ttt-controller")).toBeVisible();
    await lab.shot(lea.page, "ttt-bot-phone-start");

    const outcome = await playVsBotUntilEnd(lea);
    expect(["Gewonnen!", "Verloren", "Unentschieden"]).toContain(outcome);
    await expect(tv.tid("ttt-banner")).toBeVisible();
    await lab.shot(tv.page, "ttt-bot-tv-end");
    await lab.shot(lea.page, "ttt-bot-phone-end");

    // Ergebnisphase: TV-Ranking enthält den Spieler (Rang 1 bei Sieg/Remis, sonst 2).
    await expect(tv.results).toBeVisible({ timeout: 20_000 });
    const rank = outcome === "Verloren" ? "2" : "1";
    await expect(tv.resultRow(lea.playerId)).toHaveAttribute("data-rank", rank);
    await expect(tv.resultRow(lea.playerId)).toHaveAttribute("data-score", outcome === "Gewonnen!" ? "1" : "0");
    await expect(lea.results).toBeVisible();
    if (outcome === "Verloren") {
      // Computer-Sieg: TV und Handy zeigen den Computer auf Platz 1.
      await expect(tv.tid("bot-wins")).toBeVisible();
      await expect(tv.tid("podium-bot")).toBeVisible();
      await expect(lea.tid("bot-wins")).toBeVisible();
      await expect(lea.tid("own-place")).toHaveCount(0);
    } else {
      await expect(tv.tid("bot-wins")).toHaveCount(0);
      await expect(lea.tid("own-place").locator(".place__rank")).toHaveText(`Platz ${rank}`);
    }
    await lab.shot(tv.page, "ttt-bot-tv-results");
  });

  test("2 Spieler: Sieg, Revanche mit Startspielerwechsel und Serienstand", async ({ lab }) => {
    const { tv, phones } = await setupRoom(lab, ["Xaver", "Olga"]);
    const [xa, ol] = phones as [PhonePage, PhonePage];
    await xa.hostSelectGame("tictactoe");
    await tv.start();

    // Partie 1: Xaver (X, Platz 0) beginnt und gewinnt die obere Reihe.
    await expect(tv.page.locator(".ttt-tv__round")).toContainText("Partie 1");
    await expect(ol.tid("ttt-status")).toHaveText("Xaver ist am Zug …");
    await place(xa, 0);
    await place(ol, 3);
    await place(xa, 1);
    await place(ol, 4);
    await lab.shot(tv.page, "ttt-2p-tv-playing");
    await place(xa, 2);
    await expect(xa.tid("ttt-result")).toContainText("Gewonnen!");
    await expect(ol.tid("ttt-result")).toContainText("Verloren");
    await expect(tv.tid("ttt-banner")).toContainText("Xaver gewinnt!");
    await lab.shot(tv.page, "ttt-2p-tv-win");
    await lab.shot(xa.page, "ttt-2p-phone-win");

    await expect(tv.results).toBeVisible({ timeout: 20_000 });
    await expect(tv.resultRow(xa.playerId)).toHaveAttribute("data-rank", "1");
    await expect(tv.resultRow(ol.playerId)).toHaveAttribute("data-rank", "2");
    await expect(tv.resultRow(xa.playerId)).toHaveAttribute("data-score", "1");

    // Revanche per D-Pad am TV („Nochmal“ hat den Fokus).
    await tv.activate(tv.tid("play-again"));
    await expect(tv.tid("ttt-tv")).toBeVisible();
    await expect(tv.page.locator(".ttt-tv__round")).toContainText("Partie 2");
    // Startspieler wechselt: jetzt beginnt Olga (O).
    await expect(ol.tid("ttt-status")).toHaveText("Du bist dran!");
    await expect(xa.tid("ttt-status")).toHaveText("Olga ist am Zug …");
    // Serienstand aus Partie 1 auf beiden Handys und am TV.
    await expect(xa.page.locator(".ttt-ctl__side--me dd")).toHaveText("1");
    await expect(ol.page.locator(".ttt-ctl__side--opp dd")).toHaveText("1");
    await expect(tv.tid("ttt-seat-X").locator(".ttt-card__num")).toHaveText("1");
    await expect(tv.tid("ttt-seat-O").locator(".ttt-card__num")).toHaveText("0");
    await lab.shot(tv.page, "ttt-2p-tv-rematch");

    // Partie 2: Olga gewinnt → Serie 1:1.
    await place(ol, 0);
    await place(xa, 3);
    await place(ol, 1);
    await place(xa, 4);
    await place(ol, 2);
    await expect(ol.tid("ttt-result")).toContainText("Gewonnen!");
    await expect(tv.tid("ttt-banner")).toContainText("Olga gewinnt!");
    await expect(tv.tid("ttt-seat-O").locator(".ttt-card__num")).toHaveText("1");
    await expect(ol.page.locator(".ttt-ctl__side--me dd")).toHaveText("1");
    await expect(ol.page.locator(".ttt-ctl__side--opp dd")).toHaveText("1");

    await expect(tv.results).toBeVisible({ timeout: 20_000 });
    await expect(tv.resultRow(ol.playerId)).toHaveAttribute("data-rank", "1");
    await expect(tv.resultRow(xa.playerId)).toHaveAttribute("data-rank", "2");
    await expect(tv.resultRow(ol.playerId)).toHaveAttribute("data-score", "1");
    await expect(tv.resultRow(xa.playerId)).toHaveAttribute("data-score", "1");
    await expect(ol.tid("own-place").locator(".place__rank")).toHaveText("Platz 1");
    await expect(xa.tid("own-place").locator(".place__rank")).toHaveText("Platz 2");
    await lab.shot(tv.page, "ttt-2p-tv-results");
  });

  test("3 Spieler: Teilnehmerauswahl am TV, dritter wird Zuschauer", async ({ lab }) => {
    const { tv, phones } = await setupRoom(lab, ["Ute", "Vic", "Wim"]);
    const [ute, vic, wim] = phones as [PhonePage, PhonePage, PhonePage];
    await ute.hostSelectGame("tictactoe");
    // Host-Handy bietet ebenfalls eine Teilnehmerauswahl an.
    await expect(ute.tid("host-participants")).toBeVisible();

    await expect(tv.startButton).toHaveAttribute("data-state", "choose");
    await tv.activate(tv.startButton);
    const overlay = tv.tid("choose-players");
    await expect(overlay).toBeVisible();
    await expect(tv.tid("choose-player")).toHaveCount(3);
    // Vorauswahl: die ersten zwei; Wim abwählen ist nicht nötig, aber Vic gegen Wim tauschen:
    const pick = (ph: PhonePage) => tv.page.locator(`[data-testid="choose-player"][data-player-id="${ph.playerId}"]`);
    await expect(pick(ute)).toHaveAttribute("aria-checked", "true");
    await expect(pick(vic)).toHaveAttribute("aria-checked", "true");
    await expect(pick(wim)).toHaveAttribute("aria-checked", "false");
    await expect(pick(wim)).toHaveAttribute("aria-disabled", "true");
    await tv.activate(pick(vic));
    await expect(pick(vic)).toHaveAttribute("aria-checked", "false");
    await tv.activate(pick(wim));
    await expect(pick(wim)).toHaveAttribute("aria-checked", "true");
    await lab.shot(tv.page, "ttt-3p-tv-choose");
    await tv.activate(tv.tid("choose-start"));

    await expect(tv.tid("ttt-tv")).toBeVisible();
    await expect(tv.tid("ttt-seat-X")).toContainText("Ute");
    await expect(tv.tid("ttt-seat-O")).toContainText("Wim");
    await expect(vic.tid("spectator-screen")).toBeVisible();
    await expect(vic.tid("ttt-controller")).toHaveCount(0);
    await expect(ute.tid("ttt-controller")).toBeVisible();
    await expect(wim.tid("ttt-controller")).toBeVisible();
    await lab.shot(vic.page, "ttt-3p-phone-spectator");

    // Kurz spielen, dann bricht der Host am Handy ab (Bestätigungsdialog).
    await place(ute, 4);
    await place(wim, 0);
    await ute.hostAbort();
    await expect(tv.startButton).toBeVisible();
    await Promise.all(phones.map((ph) => expect(ph.tid("lobby-status")).toBeVisible()));
  });
});
