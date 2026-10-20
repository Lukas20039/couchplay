// Szenario 6: Robustheit – Handy offline/online und Seiten-Reload mitten im Quiz (Rejoin),
// TV-Reload (room.resume, gleicher Code) und Host-Wechsel beim Verlassen.
import { expect, otherProfile, test } from "./fixtures.js";
import { playQuiz } from "./flows/quiz.js";
import type { PhonePage } from "./pages/phone.js";

test.describe("Robustheit", () => {
  test("Quiz: Handy offline/online mitten in der Frage und Seiten-Reload → Rejoin, spielt weiter", async ({ lab, phone: profile }) => {
    const tv = await lab.openTv();
    const code = await tv.code();
    const host = await lab.newPhone("host-reload");
    const net = await lab.netCut();
    const flaky = await lab.newPhone("offline", otherProfile(profile), net);
    const steady = await lab.newPhone("stabil");
    await host.joinByCode(code, "Rita", "fuchs");
    await flaky.joinByCode(code, "Otto", "eule");
    await steady.joinByCode(code, "Sina", "katze");
    const phones = [host, flaky, steady];

    await host.hostSelectGame("quiz");
    await host.hostSetNumber("rounds", 5);
    // Lange Antwortzeit: Reload/Reconnect sollen sicher in die laufende Frage fallen.
    await host.hostSetNumber("answerSeconds", 30);
    await tv.start();

    await playQuiz({
      tv,
      phones,
      total: 5,
      stopAfter: 2,
      choose: (p, q) => (p + q) % 4,
      beforeQuestion: async (q) => {
        if (q !== 1) return;
        await expect(tv.page.locator(".qz-tv.is-question .qz-progress > span").first()).toHaveText("Frage 2 von 5", { timeout: 30_000 });

        // Netz weg am Handy „Otto“ mitten in Frage 2 (Browser offline + Verbindung hart getrennt)
        // → Banner am Handy, TV meldet getrennten Spieler.
        await flaky.context.setOffline(true);
        net.cut();
        await expect(flaky.tid("connection-banner")).toBeVisible();
        await expect(tv.tid("player-disconnected")).toContainText("Otto");
        await lab.shot(flaky.page, "robust-phone-offline");
        await lab.shot(tv.page, "robust-tv-player-disconnected");

        // Netz wieder da → Reconnect + room.rejoin, gleiche Frage, Antwort noch möglich.
        net.restore();
        await flaky.context.setOffline(false);
        await expect(flaky.tid("connection-banner")).toBeHidden({ timeout: 20_000 });
        await expect(tv.tid("player-disconnected")).toBeHidden({ timeout: 20_000 });
        await expect(flaky.page.locator(".qz-pad.is-question .qz-top strong")).toHaveText("Frage 2/5");
      },
      onReveal: async (q) => {
        if (q !== 1) return;
        // Host lädt die Seite in der Auflösung neu → Sitzung aus localStorage, room.rejoin.
        // (Reload mitten in der Frage: siehe test.fixme unten – Controller-Bug.)
        await host.page.reload();
        await expect(tv.playerItem(host.playerId)).toHaveCount(0); // TV zeigt die Spielbühne
        await expect(tv.tid("player-disconnected")).toBeHidden({ timeout: 20_000 });
      },
    });
    // Punkte blieben über Offline/Reload erhalten (playQuiz prüft „Gesamt“ nach jeder Auflösung),
    // und beide Handys haben die jeweils nächste Frage beantwortet.

    // Host ist nach dem Reload weiterhin Host und bricht am Handy ab.
    await host.hostAbort();
    await expect(tv.startButton).toBeVisible();
    await expect(tv.playerItem(host.playerId)).toHaveAttribute("data-host", "true");
    for (const ph of phones) await expect(tv.playerItem(ph.playerId)).toHaveAttribute("data-connected", "true");
    await tv.expectPlayerCount(3);
  });

  // BUG (controller-pwa/src/hooks.ts, useAppState): Der Store wird erst im useEffect abonniert.
  // Treffen room.joined/room.state/game.view nach dem ersten Render, aber vor dem Effekt ein
  // (lokal ~15–30 ms nach dem Laden, Effekte laufen bis zu 100 ms später), rendert die App nicht neu
  // und bleibt auf „Verbinde mit deinem Raum …“ stehen – bis zur nächsten Zustandsänderung
  // (im Quiz: Ende der Frage → die laufende Frage ist für diesen Spieler verloren).
  // Repro: Quiz starten, Handy während der Frage neu laden → in ~50 % der Läufe kein Antwort-Screen.
  // Fix-Vorschlag: nach dem Abonnieren einmal force() aufrufen (oder useSyncExternalStore-Muster).
  test("Quiz: Handy-Reload mitten in der Frage zeigt sofort wieder die Antwortbuttons", async ({ lab }) => {
    const tv = await lab.openTv();
    const ph = await lab.newPhone("reload-mid-question");
    await ph.joinByCode(await tv.code(), "Rolf", "roboter");
    await ph.hostSelectGame("quiz");
    await ph.hostSetNumber("answerSeconds", 30);
    await tv.start();
    await expect(ph.page.locator(".qz-pad.is-question .qz-btn")).toHaveCount(4, { timeout: 20_000 });
    await ph.page.reload();
    // Muss innerhalb der laufenden Frage (30 s) wieder antworten können.
    await expect(ph.page.locator(".qz-pad.is-question .qz-btn")).toHaveCount(4, { timeout: 5_000 });
  });

  test("TV-Reload: room.resume mit gleichem Code – in der Lobby und mitten im Spiel", async ({ lab }) => {
    const tv = await lab.openTv();
    const code = await tv.code();
    const ph = await lab.newPhone("tv-reload");
    await ph.joinByCode(code, "Tom", "tiger");

    // TV weg → Handy zeigt Hinweis; TV wieder da → gleicher Raum.
    await tv.page.goto("about:blank");
    await expect(ph.page.getByText("Der Fernseher ist gerade nicht verbunden", { exact: false })).toBeVisible();
    await lab.shot(ph.page, "robust-phone-tv-away");
    await tv.page.goto("/tv/");
    await expect(tv.roomCode).toHaveAttribute("data-code", code);
    await expect(ph.page.getByText("Der Fernseher ist gerade nicht verbunden", { exact: false })).toBeHidden();
    await tv.expectPlayerCount(1);

    // Lobby: einfacher Reload.
    await tv.page.reload();
    await expect(tv.roomCode).toHaveAttribute("data-code", code);
    await expect(tv.playerItem(ph.playerId)).toContainText("Tom");

    // Mitten im Spiel (TicTacToe gegen Computer): Reload → gecachter game.tv, Spiel läuft weiter.
    await ph.hostSelectGame("tictactoe");
    await tv.start();
    await expect(ph.tid("ttt-status")).toHaveText("Du bist dran!");
    await ph.tid("ttt-cell-4").click();
    await expect(ph.tid("ttt-cell-4")).toHaveAttribute("aria-label", /: X/);
    await tv.page.reload();
    await expect(tv.stage).toHaveAttribute("data-game-id", "tictactoe");
    await expect(tv.tid("ttt-tv")).toBeVisible();
    await expect(tv.tid("ttt-seat-X")).toContainText("Tom");
    await expect(tv.tid("reconnect-banner")).toHaveCount(0);
    await lab.shot(tv.page, "robust-tv-after-reload-ingame");
    // Spieler zieht weiter (Bot hat inzwischen gezogen).
    await expect(ph.tid("ttt-status")).toHaveText("Du bist dran!");
    const free = ph.page.locator('[data-testid^="ttt-cell-"]:enabled').first();
    const label = (await free.getAttribute("aria-label"))!;
    await free.click();
    const idx = Number(/Feld (\d)/.exec(label)![1]) - 1;
    await expect(ph.tid(`ttt-cell-${idx}`)).toHaveAttribute("aria-label", /: X/);

    // Zurück am TV → Pausenmenü → Abbrechen.
    await tv.press("Escape");
    await expect(tv.tid("pause-menu")).toBeVisible();
    await lab.shot(tv.page, "robust-tv-pause-menu");
    await tv.activate(tv.tid("abort-game"));
    await expect(tv.roomCode).toHaveAttribute("data-code", code);
    await expect(ph.tid("lobby-status")).toBeVisible();
  });

  test("Host verlässt den Raum → am längsten anwesender Spieler wird Host", async ({ lab }) => {
    const tv = await lab.openTv();
    const code = await tv.code();
    const phones: PhonePage[] = [];
    for (const [n, a] of [["Hugo", "hund"], ["Ina", "panda"], ["Jan", "frosch"]] as const) {
      const ph = await lab.newPhone(`host-${n}`);
      await ph.joinByCode(code, n, a);
      phones.push(ph);
    }
    const [hugo, ina, jan] = phones as [PhonePage, PhonePage, PhonePage];
    await expect(tv.playerItem(hugo.playerId)).toHaveAttribute("data-host", "true");
    await expect(ina.tid("host-game-select")).toHaveCount(0);

    await hugo.leave();
    await expect(hugo.tid("closed-notice")).toContainText("Du hast den Raum verlassen.");
    await expect(hugo.tid("code-input")).toBeVisible();

    await tv.expectPlayerCount(2);
    await expect(tv.playerItem(ina.playerId)).toHaveAttribute("data-host", "true");
    await expect(tv.playerItem(jan.playerId)).toHaveAttribute("data-host", "false");
    await expect(ina.tid("host-game-select")).toBeVisible();
    await expect(jan.tid("host-game-select")).toHaveCount(0);
    await lab.shot(ina.page, "robust-new-host");
    await lab.shot(tv.page, "robust-tv-new-host");
    // Neuer Host kann starten.
    await ina.hostSelectGame("tictactoe");
    await ina.tid("start-button").click();
    await expect(tv.tid("ttt-tv")).toBeVisible();
    await expect(tv.tid("ttt-seat-X")).toContainText("Ina");
  });
});
