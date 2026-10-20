// Page-Object TV. Bedienung ausschließlich per Tastatur (D-Pad: Pfeile, Enter, Escape) – keine Klicks.
import { expect, type Locator, type Page } from "@playwright/test";
import type { Lab } from "../fixtures.js";

type Dir = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export type TvKey = "Enter" | "Escape" | Dir;

export class TvPage {
  constructor(
    readonly page: Page,
    readonly lab: Lab | null,
  ) {}

  tid(id: string): Locator {
    return this.page.getByTestId(id);
  }

  get roomCode(): Locator {
    return this.tid("room-code");
  }
  get joinQr(): Locator {
    return this.tid("join-qr");
  }
  get players(): Locator {
    return this.tid("player-item");
  }
  get startButton(): Locator {
    return this.tid("start-button");
  }
  get stage(): Locator {
    return this.tid("game-stage");
  }
  get results(): Locator {
    return this.tid("results");
  }

  async open(): Promise<void> {
    await this.page.goto("/tv/");
    await this.waitReady();
  }

  /** Raumcode da und Verbindung online. */
  async waitReady(): Promise<void> {
    await expect(this.roomCode).toHaveAttribute("data-code", /^\d{6}$/, { timeout: 30_000 });
    await expect(this.tid("connection-status")).toHaveAttribute("data-status", "online");
  }

  async code(): Promise<string> {
    return (await this.roomCode.getAttribute("data-code"))!;
  }

  /** Join-URL aus dem QR-Element (data-join-url); muss mit der angezeigten URL übereinstimmen. */
  async joinUrl(): Promise<string> {
    const url = (await this.joinQr.getAttribute("data-join-url"))!;
    await expect(this.tid("join-url")).toHaveAttribute("data-join-url", url);
    return url;
  }

  /** Taste der Fernbedienung. Browser: Tastatur; Android-TV-Emulator überschreibt das mit adb keyevent. */
  async press(key: TvKey, times = 1): Promise<void> {
    for (let i = 0; i < times; i++) await this.page.keyboard.press(key);
  }

  private async isFocused(target: Locator): Promise<boolean> {
    return target.evaluate((el) => el === document.activeElement).catch(() => false);
  }

  /**
   * Fokus per Pfeiltasten auf `target` bewegen (wie mit der Fernbedienung).
   * Richtung aus der Lage zum aktuell fokussierten Element; bleibt der Fokus hängen,
   * wird die andere Achse probiert.
   */
  async focus(target: Locator, maxSteps = 25): Promise<void> {
    await expect(target).toBeVisible();
    const tried = new Set<string>();
    for (let step = 0; step < maxSteps; step++) {
      if (await this.isFocused(target)) return;
      const geo = await target.evaluate((el) => {
        const a = document.activeElement as HTMLElement | null;
        const r = el.getBoundingClientRect();
        const t = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        if (!a || a === document.body) return null;
        const q = a.getBoundingClientRect();
        return { dx: t.x - (q.left + q.width / 2), dy: t.y - (q.top + q.height / 2), id: a.outerHTML.slice(0, 80) };
      });
      if (!geo) {
        // Noch kein Fokus: eine Pfeiltaste setzt ihn (ensureFocus).
        await this.press("ArrowDown");
        continue;
      }
      const vertical: Dir = geo.dy > 0 ? "ArrowDown" : "ArrowUp";
      const horizontal: Dir = geo.dx > 0 ? "ArrowRight" : "ArrowLeft";
      const order: Dir[] = Math.abs(geo.dy) >= Math.abs(geo.dx) ? [vertical, horizontal] : [horizontal, vertical];
      const candidates = order.filter((d) => (d === vertical ? Math.abs(geo.dy) > 4 : Math.abs(geo.dx) > 4));
      const key = candidates.find((d) => !tried.has(`${geo.id}|${d}`)) ?? candidates[0] ?? vertical;
      tried.add(`${geo.id}|${key}`);
      await this.press(key);
    }
    expect(await this.isFocused(target), "TV-Fokus hat das Ziel nicht erreicht").toBe(true);
  }

  /** Fokus auf das Ziel und OK drücken. */
  async activate(target: Locator): Promise<void> {
    await this.focus(target);
    await this.press("Enter");
  }

  playerItem(playerId: string): Locator {
    return this.page.locator(`[data-testid="player-item"][data-player-id="${playerId}"]`);
  }

  async expectPlayerCount(n: number): Promise<void> {
    await expect(this.tid("player-list")).toHaveAttribute("data-count", String(n));
  }

  /** Spiel in der Lobby per D-Pad wählen. */
  async selectGame(gameId: string): Promise<void> {
    const tile = this.page.locator(`[data-testid="game-tile"][data-game-id="${gameId}"]`);
    if ((await tile.getAttribute("aria-pressed")) !== "true") await this.activate(tile);
    await expect(tile).toHaveAttribute("aria-pressed", "true");
  }

  setting(key: string): Locator {
    return this.page.locator(`[data-testid="setting"][data-setting-key="${key}"]`);
  }

  /** Einstellung über das Auswahl-Overlay setzen (select/number). */
  async chooseSetting(key: string, optionLabel: string): Promise<void> {
    await this.activate(this.setting(key));
    const picker = this.tid("setting-picker");
    await expect(picker).toBeVisible();
    await this.activate(picker.getByRole("radio", { name: optionLabel, exact: true }));
    await expect(picker).toBeHidden();
    await expect(this.setting(key).locator(".setting-value")).toHaveText(optionLabel);
  }

  /** Spielstart per D-Pad (Start-Button muss bereit sein). */
  async start(): Promise<void> {
    await expect(this.startButton).toHaveAttribute("data-state", "ready");
    await this.activate(this.startButton);
    await expect(this.stage).toBeVisible();
  }

  resultRow(playerId: string): Locator {
    return this.page.locator(`[data-testid="result-row"][data-player-id="${playerId}"]`);
  }
}
