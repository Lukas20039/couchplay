// Szenarien 1 + 2: Beitritt per QR-Code (aus dem TV-Screenshot dekodiert) und per Code-Eingabe.
import { decodeQrPng } from "../lib/qr.js";
import { expect, test } from "./fixtures.js";
import { roomLabel } from "./pages/phone.js";

test.describe("Beitritt", () => {
  test("QR-Join: QR im TV-Screenshot = data-join-url, Handy landet in Name/Avatar", async ({ lab, baseURL }) => {
    const tv = await lab.openTv();
    const code = await tv.code();
    const joinUrl = await tv.joinUrl();
    expect(joinUrl).toBe(`${baseURL}/j/${code}`);
    // Angezeigter Code (Ziffern) = data-code.
    await expect(tv.roomCode).toHaveText(code);

    const png = await tv.page.screenshot();
    await lab.shot(tv.page, "join-tv-lobby");
    const decoded = decodeQrPng(png);
    expect(decoded, "QR-Code im TV-Screenshot lesbar").toBe(joinUrl);

    const phone = await lab.newPhone("handy-qr");
    await phone.page.goto(decoded!);
    // Direkt im Profilschritt, Raumcode übernommen.
    await expect(phone.tid("name-input")).toBeVisible();
    await expect(phone.tid("profile-room")).toHaveText(roomLabel(code));
    await expect(phone.tid("code-input")).toHaveCount(0);
    await lab.shot(phone.page, "join-phone-profile");

    await phone.submitProfile("Qr Anna", "fuchs");
    phone.name = "Qr Anna";
    await phone.expectJoined();
    // Nach dem Beitritt wird die URL bereinigt (kein Code mehr im Pfad).
    await expect(phone.page).toHaveURL(`${baseURL}/`);
    await tv.expectPlayerCount(1);
    await expect(tv.playerItem(phone.playerId)).toContainText("Qr Anna");
    await expect(tv.playerItem(phone.playerId)).toHaveAttribute("data-host", "true");
    await lab.shot(tv.page, "join-tv-player");
  });

  test("Code-Join per Tastatur; falscher Code → Fehlermeldung", async ({ lab }) => {
    const tv = await lab.openTv();
    const code = await tv.code();
    // Garantiert falscher Code (anderer als der echte).
    const wrong = code === "000000" ? "000001" : String((Number(code) + 1) % 1_000_000).padStart(6, "0");

    const phone = await lab.newPhone("handy-code");
    await phone.typeCode(wrong);
    await expect(phone.tid("profile-room")).toHaveText(roomLabel(wrong));
    await phone.submitProfile("Ben", "panda");
    // Server: ROOM_NOT_FOUND → zurück zur Code-Eingabe mit Meldung.
    await expect(phone.tid("code-input")).toBeVisible();
    await expect(phone.tid("join-error")).toHaveText("Raum nicht gefunden. Stimmt der Code?");
    await expect(phone.tid("join-error")).toHaveAttribute("role", "alert");
    await lab.shot(phone.page, "join-wrong-code");
    await tv.expectPlayerCount(0);

    // Code korrigieren (Feld leeren, richtigen Code tippen).
    await phone.tid("code-input").fill("");
    await phone.page.keyboard.type(code, { delay: 30 });
    await expect(phone.tid("profile-room")).toHaveText(roomLabel(code));
    // Profil (Name/Avatar) ist vom ersten Versuch gemerkt.
    await expect(phone.tid("name-input")).toHaveValue("Ben");
    await expect(phone.tid("avatar-option-panda")).toHaveAttribute("aria-checked", "true");
    await phone.tid("join-button").click();
    phone.name = "Ben";
    await phone.expectJoined();
    await tv.expectPlayerCount(1);
    await expect(tv.playerItem(phone.playerId)).toContainText("Ben");
    await lab.shot(phone.page, "join-lobby");
  });
});
