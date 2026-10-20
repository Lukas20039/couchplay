// Page-Object Handy (Controller-PWA).
import type { AvatarId } from "@couchplay/protocol";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { Lab, PhoneProfile } from "../fixtures.js";

/** Anzeige des Raumcodes am Handy: „Raum 123 456“. */
export const roomLabel = (code: string): string => `Raum ${code.slice(0, 3)} ${code.slice(3)}`;

export class PhonePage {
  /** Spieler-ID nach dem Beitritt (aus localStorage). */
  playerId = "";
  name = "";

  constructor(
    readonly page: Page,
    readonly label: string,
    readonly profile: PhoneProfile,
    readonly lab: Lab,
    /** Basis-URL dieses Handys (abweichend vom Server, wenn es über eine NetCut-Strecke läuft). */
    readonly baseURL: string = lab.baseURL,
  ) {}

  get context(): BrowserContext {
    return this.page.context();
  }

  tid(id: string): Locator {
    return this.page.getByTestId(id);
  }

  /** Profilschritt ausfüllen (Name + Avatar) und beitreten – ohne Erfolgsprüfung. */
  async submitProfile(name: string, avatar: AvatarId): Promise<void> {
    await expect(this.tid("name-input")).toBeVisible();
    await this.tid("name-input").fill(name);
    await this.tid(`avatar-option-${avatar}`).click();
    await expect(this.tid(`avatar-option-${avatar}`)).toHaveAttribute("aria-checked", "true");
    await this.tid("join-button").click();
  }

  /** Wartet auf die Lobby und liest die eigene Spieler-ID. */
  async expectJoined(): Promise<void> {
    await expect(this.tid("lobby-status")).toBeVisible();
    const read = (): Promise<string> =>
      this.page.evaluate(() => (JSON.parse(localStorage.getItem("couchplay.player.session") ?? "null")?.playerId as string | undefined) ?? "");
    await expect.poll(read).not.toBe("");
    this.playerId = await read();
  }

  /** QR/Link: öffnet die Join-URL, landet direkt im Profilschritt. */
  async joinByUrl(url: string, name: string, avatar: AvatarId, code?: string): Promise<void> {
    await this.page.goto(url);
    if (code) await expect(this.tid("profile-room")).toHaveText(roomLabel(code));
    await this.submitProfile(name, avatar);
    this.name = name;
    await this.expectJoined();
  }

  /** Code tippen (Tastatur) → Profil → beitreten. */
  async typeCode(code: string): Promise<void> {
    if (!this.page.url().startsWith(this.baseURL)) await this.page.goto("/");
    const input = this.tid("code-input");
    await expect(input).toBeVisible();
    await input.click();
    await this.page.keyboard.type(code, { delay: 30 });
  }

  async joinByCode(code: string, name: string, avatar: AvatarId): Promise<void> {
    await this.typeCode(code);
    await expect(this.tid("profile-room")).toHaveText(roomLabel(code));
    await this.submitProfile(name, avatar);
    this.name = name;
    await this.expectJoined();
  }

  // --- Lobby (Host) -------------------------------------------------------

  async hostSelectGame(gameId: string): Promise<void> {
    const opt = this.tid(`game-option-${gameId}`);
    await opt.click();
    await expect(opt).toHaveAttribute("aria-checked", "true");
  }

  /** Zahlen-Setting per Stepper auf `target` bringen (wartet nach jedem Schritt auf den Server). */
  async hostSetNumber(key: string, target: number): Promise<void> {
    const box = this.tid(`setting-${key}`);
    const value = box.locator(".stepper__value");
    for (let i = 0; i < 20; i++) {
      const now = Number((await value.textContent())?.trim());
      if (now === target) return;
      const btn = box.locator(".stepper__btn").nth(now > target ? 0 : 1);
      await btn.click();
      await expect(value).not.toHaveText(String(now));
    }
    await expect(value).toHaveText(String(target));
  }

  async hostSetSelect(key: string, label: string): Promise<void> {
    const btn = this.tid(`setting-${key}`).getByRole("button", { name: label, exact: true });
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  }

  /** Gemeinsame Einstellungen für schnelle Quiz-Runden: 5 Fragen, 10 s. */
  async hostQuickQuiz(): Promise<void> {
    await this.hostSelectGame("quiz");
    await this.hostSetNumber("rounds", 5);
    await this.hostSetNumber("answerSeconds", 10);
  }

  // --- Spiel --------------------------------------------------------------

  /** In-App-Bestätigung (ConfirmDialog) mit „Ja“ beantworten. */
  async confirm(): Promise<void> {
    await expect(this.tid("confirm-dialog")).toBeVisible();
    await this.tid("confirm-yes").click();
    await expect(this.tid("confirm-dialog")).toBeHidden();
  }

  /** Host bricht das laufende Spiel am Handy ab. */
  async hostAbort(): Promise<void> {
    await this.tid("abort-button").click();
    await this.confirm();
  }

  /** Raum verlassen (Lobby). */
  async leave(): Promise<void> {
    await this.tid("leave-button").click();
    await this.confirm();
  }

  get stage(): Locator {
    return this.tid("game-stage");
  }
  get results(): Locator {
    return this.tid("results");
  }
}

/** Freie Funktionen (Wunsch-API): Beitritt mit beliebigem Kontext. */
export async function joinByUrl(ctx: BrowserContext, url: string, name: string, avatar: AvatarId): Promise<Page> {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url);
  await page.getByTestId("name-input").fill(name);
  await page.getByTestId(`avatar-option-${avatar}`).click();
  await page.getByTestId("join-button").click();
  await expect(page.getByTestId("lobby-status")).toBeVisible();
  return page;
}

export async function joinByCode(ctx: BrowserContext, code: string, name: string, avatar: AvatarId): Promise<Page> {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("/");
  await page.getByTestId("code-input").click();
  await page.keyboard.type(code, { delay: 30 });
  await page.getByTestId("name-input").fill(name);
  await page.getByTestId(`avatar-option-${avatar}`).click();
  await page.getByTestId("join-button").click();
  await expect(page.getByTestId("lobby-status")).toBeVisible();
  return page;
}
