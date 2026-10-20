// Szenarien 3 + 4: Quiz mit 8 Handys (Chromium + WebKit gemischt) und Quiz solo auf dem iPhone.
import type { AvatarId } from "@couchplay/protocol";
import { expect, otherProfile, test } from "./fixtures.js";
import { expectQuizFinish, playQuiz } from "./flows/quiz.js";
import type { PhonePage } from "./pages/phone.js";

const PLAYERS: Array<[string, AvatarId]> = [
  ["Anna", "fuchs"],
  ["Ben", "panda"],
  ["Cem", "tiger"],
  ["Dora", "eule"],
  ["Emil", "frosch"],
  ["Fritzi", "katze"],
  ["Gustl", "hund"],
  ["Hanna", "einhorn"],
];

test.describe("Quiz", () => {
  test("8 Handys (Chromium + WebKit) spielen komplett, 9. Handy wird abgewiesen", async ({ lab, phone: profile }) => {
    // Der Test mischt ohnehin beide Browser – einmal pro Lauf genügt.
    test.skip(profile !== "pixel7", "läuft nur im Projekt pixel7 (enthält beide Handy-Profile)");
    test.setTimeout(300_000);

    const tv = await lab.openTv();
    const code = await tv.code();
    const url = await tv.joinUrl();

    // Host zuerst (per QR-Link), dann die übrigen 7 gleichzeitig – abwechselnd Link/Code, Pixel/iPhone.
    const phones: PhonePage[] = [];
    for (const [i, [name]] of PLAYERS.entries()) phones.push(await lab.newPhone(`p${i + 1}-${name}`, i % 2 === 0 ? profile : otherProfile(profile)));
    await phones[0]!.joinByUrl(url, PLAYERS[0]![0], PLAYERS[0]![1], code);
    await Promise.all(
      phones.slice(1).map((ph, k) => {
        const [name, avatar] = PLAYERS[k + 1]!;
        return k % 2 === 0 ? ph.joinByCode(code, name, avatar) : ph.joinByUrl(url, name, avatar, code);
      }),
    );
    await tv.expectPlayerCount(8);
    for (const ph of phones) await expect(tv.playerItem(ph.playerId)).toHaveAttribute("data-connected", "true");
    await expect(tv.playerItem(phones[0]!.playerId)).toHaveAttribute("data-host", "true");
    await expect(tv.page.locator('[data-testid="player-item"][data-host="true"]')).toHaveCount(1);
    await lab.shot(tv.page, "quiz8-tv-lobby-full");

    // 9. Handy: Raum voll → Meldung, bleibt im Profilschritt.
    const ninth = await lab.newPhone("p9-abgewiesen", otherProfile(profile));
    await ninth.typeCode(code);
    await ninth.submitProfile("Ida", "pinguin");
    await expect(ninth.tid("join-error")).toHaveText("Der Raum ist voll.");
    await expect(ninth.tid("name-input")).toBeVisible();
    await expect(ninth.tid("lobby-status")).toHaveCount(0);
    await lab.shot(ninth.page, "quiz8-ninth-rejected");
    await tv.expectPlayerCount(8);

    // Host stellt am Handy ein: Quiz, 5 Fragen, 10 s.
    const host = phones[0]!;
    await expect(host.tid("host-game-select")).toBeVisible();
    await expect(phones[1]!.tid("host-game-select")).toHaveCount(0);
    await host.hostQuickQuiz();
    await expect(tv.setting("rounds").locator(".setting-value")).toHaveText("5");
    await expect(tv.setting("answerSeconds").locator(".setting-value")).toHaveText("10");
    await lab.shot(host.page, "quiz8-host-settings");

    // Start am TV per D-Pad.
    await tv.start();
    await expect(tv.page.locator(".qz-tv.is-intro")).toBeVisible();
    await lab.shot(tv.page, "quiz8-tv-intro");

    const { scores } = await playQuiz({
      tv,
      phones,
      total: 5,
      // Unterschiedliche Antworten: je zwei Handys pro Antwortfeld.
      choose: (p, q) => (p + q) % 4,
      onQuestion: async (q) => {
        if (q === 0) {
          await lab.shot(tv.page, "quiz8-tv-question");
          await lab.shot(phones[1]!.page, "quiz8-phone-locked");
          await lab.shot(phones[7]!.page, "quiz8-phone-question");
        }
      },
      onReveal: async (q) => {
        if (q === 0) {
          await lab.shot(tv.page, "quiz8-tv-reveal");
          await lab.shot(phones[0]!.page, "quiz8-phone-reveal-p1");
          await lab.shot(phones[1]!.page, "quiz8-phone-reveal-p2");
        }
      },
    });
    // Nicht alle gleich: die Antworten waren verschieden.
    expect(new Set(scores).size).toBeGreaterThan(1);

    await expectQuizFinish(tv, phones, scores, async () => {
      await lab.shot(tv.page, "quiz8-tv-podium");
      await lab.shot(phones[0]!.page, "quiz8-phone-final");
    });
    await lab.shot(tv.page, "quiz8-tv-results");
    await lab.shot(phones[0]!.page, "quiz8-phone-results-host");
    await lab.shot(phones[3]!.page, "quiz8-phone-results-guest");

    // Nur der Host hat die Ergebnis-Aktionen.
    await expect(host.tid("again-button")).toBeVisible();
    await expect(phones[1]!.tid("again-button")).toHaveCount(0);
    // Zurück zur Lobby per D-Pad am TV.
    await tv.activate(tv.tid("to-lobby"));
    await expect(tv.startButton).toBeVisible();
    await Promise.all(phones.map((ph) => expect(ph.tid("lobby-status")).toBeVisible()));
  });

  test("Solo-Quiz (1 Spieler), Einstellungen per D-Pad am TV", async ({ lab, phone: profile }) => {
    test.skip(profile !== "iphone13", "Solo-Quiz ist für WebKit/iPhone 13 vorgesehen");
    const tv = await lab.openTv();
    const solo = await lab.newPhone("solo-iphone");
    await solo.joinByCode(await tv.code(), "Solo", "krake");
    await tv.expectPlayerCount(1);

    // Spielauswahl + Einstellungen nur mit der Fernbedienung.
    await tv.selectGame("quiz");
    await tv.chooseSetting("rounds", "5");
    await tv.chooseSetting("answerSeconds", "10");
    await expect(solo.tid("setting-rounds").locator(".stepper__value")).toHaveText("5");
    await lab.shot(tv.page, "solo-tv-settings");
    await expect(tv.startButton).toHaveAttribute("data-state", "ready");
    await tv.start();

    const { scores, correct } = await playQuiz({
      tv,
      phones: [solo],
      total: 5,
      // Frage 3 bleibt unbeantwortet (Zeit läuft ab → „Keine Antwort“).
      choose: (_p, q) => (q === 2 ? null : q % 4),
      onQuestion: async (q) => {
        if (q === 0) await lab.shot(solo.page, "solo-phone-question");
      },
      onReveal: async (q) => {
        if (q === 2) await lab.shot(solo.page, "solo-phone-no-answer");
      },
    });
    expect(correct[0]![2]).toBe(false);
    await expectQuizFinish(tv, [solo], scores);
    await expect(tv.page.locator(".qz-tv")).toHaveCount(0);
    await expect(tv.resultRow(solo.playerId)).toHaveAttribute("data-rank", "1");
    await lab.shot(solo.page, "solo-phone-results");
    await lab.shot(tv.page, "solo-tv-results");

    // Revanche vom Handy-Host: neue Runde startet sofort.
    await solo.tid("again-button").click();
    await expect(tv.stage).toBeVisible();
    await expect(solo.stage).toBeVisible();
    // Abbruch per Zurück → Pausenmenü → „Spiel abbrechen“ (D-Pad).
    await tv.press("Escape");
    await expect(tv.tid("pause-menu")).toBeVisible();
    await tv.activate(tv.tid("abort-game"));
    await expect(tv.startButton).toBeVisible();
    await expect(solo.tid("lobby-status")).toBeVisible();
  });
});
