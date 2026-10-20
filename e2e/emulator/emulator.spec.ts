// Emulator-E2E: echte Android-TV-App (AVD couchplay_tv) + Playwright-Handys (Chromium + WebKit).
// TV-DOM über CDP (WebView-DevTools), Bedienung am TV nur per `adb shell input keyevent`.
import net from "node:net";
import type { AvatarId } from "@couchplay/protocol";
import { decodeQrPng } from "../lib/qr.js";
import { expectQuizFinish, playQuiz } from "../tests/flows/quiz.js";
import type { PhonePage } from "../tests/pages/phone.js";
import { EMULATOR_HOST_URL, expect, HOST_URL, test } from "./fixtures.js";
import { log } from "./android.js";

test.describe.configure({ mode: "serial" });

/** Ist eine URL vom Host aus per TCP erreichbar? (kurzer Versuch) */
function reachable(url: string, timeoutMs = 3000): Promise<boolean> {
  const u = new URL(url);
  return new Promise((resolve) => {
    const s = net.connect({ host: u.hostname, port: Number(u.port || 80) });
    const done = (ok: boolean) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeoutMs, () => done(false));
    s.once("connect", () => done(true));
    s.once("error", () => done(false));
  });
}

async function leaveAll(phones: PhonePage[]): Promise<void> {
  for (const ph of phones) {
    await expect(ph.tid("lobby-status")).toBeVisible();
    await ph.leave();
  }
}

test.describe("Android-TV-Emulator", () => {
  test("App startet, QR im Screencap = Join-URL; 10.0.2.2 ist für Handys nicht erreichbar", async ({ android }) => {
    const { tv } = android;
    const code = await tv.code();
    const joinUrl = await tv.joinUrl();
    // Ohne PUBLIC_URL leitet der Server die Join-URL aus dem Host-Header der WebView ab.
    expect(joinUrl).toBe(`${EMULATOR_HOST_URL}/j/${code}`);
    const png = await android.screencap("tv-lobby");
    expect(decodeQrPng(png), "QR im Emulator-Screenshot").toBe(joinUrl);
    // Diskrepanz: 10.0.2.2 ist nur emulator-intern der Host – Handys im (Host-)Netz erreichen ihn nicht.
    expect(await reachable(joinUrl)).toBe(false);
    expect(await reachable(HOST_URL)).toBe(true);
    test.info().annotations.push({
      type: "Bewertung",
      description: `Join-URL/QR zeigt auf ${EMULATOR_HOST_URL} (nur im Emulator gültig). Handys nutzen ${HOST_URL} + Code. Lösung: PUBLIC_URL auf die im WLAN erreichbare Adresse setzen (siehe letzter Test).`,
    });
  });

  test("Quiz mit 3 Handys (Chromium + WebKit), Start per D-Pad am TV", async ({ android, lab }) => {
    test.setTimeout(240_000);
    const { tv } = android;
    const code = await tv.code();
    const names: Array<[string, AvatarId]> = [
      ["Mia", "fuchs"],
      ["Noah", "panda"],
      ["Ella", "eule"],
    ];
    const phones: PhonePage[] = [];
    for (const [i, [n, a]] of names.entries()) {
      const ph = await lab.newPhone(`emu-${n}`, i === 1 ? "iphone13" : "pixel7");
      await ph.joinByCode(code, n, a);
      phones.push(ph);
    }
    await tv.expectPlayerCount(3);
    await android.screencap("tv-lobby-3-players");

    await phones[0]!.hostQuickQuiz();
    await expect(tv.setting("rounds").locator(".setting-value")).toHaveText("5");
    android.recorder.start(180);
    await tv.start();

    const { scores } = await playQuiz({
      tv,
      phones,
      total: 5,
      choose: (p, q) => (p + q) % 4,
      onQuestion: async (q) => {
        if (q === 0) await android.screencap("tv-quiz-question");
      },
      onReveal: async (q) => {
        if (q === 0) await android.screencap("tv-quiz-reveal");
      },
    });
    await expectQuizFinish(tv, phones, scores, async () => {
      await android.screencap("tv-quiz-podium");
    });
    await android.screencap("tv-quiz-results");

    // Zurück (BACK) im Ergebnis → Lobby; Handys verlassen den Raum für die nächsten Tests.
    await tv.press("Escape");
    await expect(tv.startButton).toBeVisible();
    await leaveAll(phones);
    await tv.expectPlayerCount(0);
  });

  test("TicTacToe gegen Computer, Start per D-Pad", async ({ android, lab }) => {
    const { tv } = android;
    const ph = await lab.newPhone("emu-ttt", "iphone13");
    await ph.joinByCode(await tv.code(), "Theo", "roboter");
    await ph.hostSelectGame("tictactoe");
    await ph.hostSetSelect("difficulty", "Leicht");
    await expect(tv.setting("difficulty").locator(".setting-value")).toHaveText("Leicht");
    await tv.start();
    await expect(tv.tid("ttt-tv")).toBeVisible();
    await expect(tv.tid("ttt-seat-X")).toContainText("Theo");

    const result = ph.tid("ttt-result");
    const free = ph.page.locator('[data-testid^="ttt-cell-"]:enabled');
    for (let move = 0; move < 9; move++) {
      await expect(result.or(free.first())).toBeVisible({ timeout: 20_000 });
      if (await result.isVisible()) break;
      const label = (await free.first().getAttribute("aria-label"))!;
      await free.first().click();
      const idx = Number(/Feld (\d)/.exec(label)![1]) - 1;
      await expect(ph.tid(`ttt-cell-${idx}`)).toHaveAttribute("aria-label", /: (X|O)/);
      if (move === 1) await android.screencap("tv-ttt-playing");
    }
    await expect(result).toBeVisible();
    await expect(tv.tid("ttt-banner")).toBeVisible();
    await android.screencap("tv-ttt-end");
    await expect(tv.results).toBeVisible({ timeout: 20_000 });
    await expect(tv.resultRow(ph.playerId)).toBeVisible();
    await android.screencap("tv-ttt-results");
    await tv.press("Escape");
    await expect(tv.startButton).toBeVisible();
    await ph.leave();
    await tv.expectPlayerCount(0);
  });

  test("BACK → Pausenmenü (Weiterspielen/Abbrechen); HOME und zurück → Raum lebt", async ({ android, lab }) => {
    const { tv, adb } = android;
    const code = await tv.code();
    const ph = await lab.newPhone("emu-back");
    await ph.joinByCode(code, "Bea", "katze");
    await ph.hostSelectGame("tictactoe");
    await tv.start();
    await expect(ph.tid("ttt-status")).toHaveText("Du bist dran!");

    // BACK im Spiel → Pausenmenü, OK auf „Weiterspielen“ (Fokus) schließt es.
    await tv.press("Escape");
    await expect(tv.tid("pause-menu")).toBeVisible();
    await android.screencap("tv-pause-menu");
    await tv.press("Enter");
    await expect(tv.tid("pause-menu")).toBeHidden();
    await expect(tv.tid("ttt-tv")).toBeVisible();
    // BACK → Menü → „Spiel abbrechen“ → Lobby (Handy ebenfalls).
    await tv.press("Escape");
    await expect(tv.tid("pause-menu")).toBeVisible();
    await tv.activate(tv.tid("abort-game"));
    await expect(tv.startButton).toBeVisible();
    await expect(ph.tid("lobby-status")).toBeVisible();

    // HOME → App im Hintergrund; danach wieder holen.
    await tv.home();
    await expect
      .poll(async () => (await adb.shell("dumpsys activity activities")).match(/topResumedActivity=.*\}/)?.[0] ?? "", { timeout: 20_000 })
      .not.toContain("at.couchplay.tv");
    await android.screencap("home-screen");
    // Raum lebt serverseitig weiter: das Handy bleibt in der Lobby.
    await expect(ph.tid("lobby-status")).toBeVisible();
    await adb.shell("am start -W -n at.couchplay.tv/.MainActivity", 60_000);
    await expect
      .poll(async () => (await adb.shell("dumpsys activity activities")).match(/topResumedActivity=.*\}/)?.[0] ?? "", { timeout: 20_000 })
      .toContain("at.couchplay.tv");
    await expect(tv.roomCode).toHaveAttribute("data-code", code);
    await expect(tv.tid("connection-status")).toHaveAttribute("data-status", "online", { timeout: 30_000 });
    await expect(tv.playerItem(ph.playerId)).toHaveAttribute("data-connected", "true");
    await expect(ph.page.getByText("Der Fernseher ist gerade nicht verbunden")).toBeHidden({ timeout: 30_000 });
    await android.screencap("tv-after-home");
    // Weiter spielbar: Start per D-Pad.
    await tv.start();
    await expect(ph.tid("ttt-controller")).toBeVisible();
    await tv.press("Escape");
    await tv.activate(tv.tid("abort-game"));
    await expect(tv.startButton).toBeVisible();
    await ph.leave();
  });

  test("Mit PUBLIC_URL: QR enthält die vom Handy erreichbare Adresse, Join direkt per QR", async ({ android, lab }) => {
    const { tv } = android;
    const oldCode = await tv.code();
    // Server-Neustart mit PUBLIC_URL (hier: Host-Adresse aus Sicht der Handys).
    await android.restartServer({ PUBLIC_URL: HOST_URL });
    // TV merkt den Neustart: alter Raum ist weg → Endbildschirm „Neuer Raum“ (OK) oder direkt neuer Raum.
    const fatal = tv.tid("fatal-screen");
    await expect(fatal.or(tv.roomCode.and(tv.page.locator(`:not([data-code="${oldCode}"])`)))).toBeVisible({ timeout: 60_000 });
    if (await fatal.isVisible()) {
      log("TV zeigt Endbildschirm:", await fatal.getAttribute("data-kind"));
      await android.screencap("tv-server-restart");
      await tv.press("Enter");
    }
    await tv.waitReady();
    const code = await tv.code();
    expect(code).not.toBe(oldCode);
    const joinUrl = await tv.joinUrl();
    expect(joinUrl).toBe(`${HOST_URL}/j/${code}`);
    const png = await android.screencap("tv-lobby-public-url");
    const decoded = decodeQrPng(png);
    expect(decoded).toBe(joinUrl);

    const ph = await lab.newPhone("emu-qr", "pixel7");
    await ph.joinByUrl(decoded!, "Quentin", "alien", code);
    await tv.expectPlayerCount(1);
    await expect(tv.playerItem(ph.playerId)).toContainText("Quentin");
    await android.screencap("tv-qr-joined");
  });
});
