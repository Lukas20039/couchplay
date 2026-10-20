// Gemeinsame Fixtures der Browser-E2E.
//
// - `lab`: erzeugt TV- und Handy-Kontexte (beliebig viele, Chromium und WebKit gemischt),
//   vergibt jedem simulierten Gerät eine eigene X-Forwarded-For-Adresse, nimmt optional Videos
//   auf, hängt bei Fehlern Screenshots aller Seiten an und räumt am Ende alles ab.
// - Browser werden pro Worker einmal gestartet (lazy), Kontexte pro Test.
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  chromium,
  devices,
  test as base,
  webkit,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { NetCut } from "../lib/netcut.js";
import { PhonePage } from "./pages/phone.js";
import { TvPage } from "./pages/tv.js";

export type PhoneProfile = "pixel7" | "iphone13";

export interface TestOptions {
  /** Standard-Handy des Projekts. */
  phone: PhoneProfile;
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..", "..");
/** Screenshots der Schlüsselmomente (unabhängig vom Report, wird pro Lauf überschrieben). */
export const SHOTS_DIR = process.env.E2E_SHOTS_DIR ? path.resolve(process.env.E2E_SHOTS_DIR) : path.join(ROOT, ".jait", "shots", "e2e");

type VideoMode = "on" | "off" | "retain-on-failure";
const VIDEO: VideoMode = ((): VideoMode => {
  const v = process.env.E2E_VIDEO ?? (process.env.CI ? "retain-on-failure" : "on");
  return v === "off" || v === "retain-on-failure" ? v : "on";
})();

export const PHONE_DEVICES: Record<PhoneProfile, { browser: "chromium" | "webkit"; options: BrowserContextOptions; label: string }> = {
  pixel7: { browser: "chromium", options: devices["Pixel 7"]!, label: "Pixel 7 (Chromium)" },
  iphone13: { browser: "webkit", options: devices["iPhone 13"]!, label: "iPhone 13 (WebKit)" },
};

export const otherProfile = (p: PhoneProfile): PhoneProfile => (p === "pixel7" ? "iphone13" : "pixel7");

/** Laufende Nummer für simulierte Geräte-IPs (eigener Join-Rate-Limit-Bucket pro Gerät). */
let deviceCounter = 0;
function nextDeviceIp(): string {
  const n = ++deviceCounter;
  return `10.${(process.pid % 200) + 20}.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`;
}

interface Tracked {
  label: string;
  context: BrowserContext;
  pages: Page[];
}

export class Lab {
  private readonly tracked: Tracked[] = [];
  private readonly cuts: NetCut[] = [];
  private shotNo = 0;

  constructor(
    private readonly browsers: Browsers,
    readonly testInfo: TestInfo,
    readonly baseURL: string,
    readonly defaultPhone: PhoneProfile,
  ) {}

  private videoDir(): string {
    return this.testInfo.outputPath("videos");
  }

  /** Neuer Kontext mit eigener Geräte-IP; Video je nach E2E_VIDEO. */
  async newContext(kind: "chromium" | "webkit", label: string, options: BrowserContextOptions, baseURL = this.baseURL): Promise<BrowserContext> {
    const browser = await this.browsers.get(kind);
    const ip = nextDeviceIp();
    const context = await browser.newContext({
      ...options,
      baseURL,
      locale: "de-DE",
      timezoneId: "Europe/Vienna",
      extraHTTPHeaders: { ...(options.extraHTTPHeaders ?? {}), "X-Forwarded-For": ip },
      ...(VIDEO !== "off"
        ? { recordVideo: { dir: this.videoDir(), size: options.viewport && options.viewport.width > 1000 ? { width: 960, height: 540 } : undefined } }
        : {}),
    });
    const entry: Tracked = { label, context, pages: [] };
    context.on("page", (p) => entry.pages.push(p));
    this.tracked.push(entry);
    return context;
  }

  /** TV: Chromium 1920×1080, öffnet `/tv/` und wartet auf Raumcode + Join-URL. */
  async openTv(label = "tv"): Promise<TvPage> {
    const ctx = await this.newContext("chromium", label, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const tv = new TvPage(page, this);
    await tv.open();
    return tv;
  }

  /** Handy-Kontext (Standard: Profil des Projekts). Navigiert noch nicht. */
  async newPhone(label: string, profile: PhoneProfile = this.defaultPhone, via?: NetCut): Promise<PhonePage> {
    const dev = PHONE_DEVICES[profile];
    const base = via ? `http://127.0.0.1:${via.port}` : this.baseURL;
    const ctx = await this.newContext(dev.browser, label, dev.options, base);
    const page = await ctx.newPage();
    return new PhonePage(page, label, profile, this, base);
  }

  /** Durchtrennbare Netzstrecke zum Server (siehe lib/netcut.ts); wird am Testende gestoppt. */
  async netCut(): Promise<NetCut> {
    const cut = new NetCut(Number(new URL(this.baseURL).port));
    await cut.start();
    this.cuts.push(cut);
    return cut;
  }

  /** Screenshot eines Schlüsselmoments nach .jait/shots/e2e/ und in den Report. */
  async shot(page: Page, name: string): Promise<void> {
    const project = this.testInfo.project.name;
    const file = path.join(SHOTS_DIR, `${project}-${name}.png`);
    mkdirSync(SHOTS_DIR, { recursive: true });
    const body = await page.screenshot({ path: file, animations: "disabled", caret: "hide" });
    this.shotNo++;
    await this.testInfo.attach(`${String(this.shotNo).padStart(2, "0")}-${name}`, { body, contentType: "image/png" });
  }

  async dispose(): Promise<void> {
    const failed = this.testInfo.status !== this.testInfo.expectedStatus;
    if (failed) {
      for (const t of this.tracked) {
        for (const [i, p] of t.pages.entries()) {
          if (p.isClosed()) continue;
          const body = await p.screenshot({ timeout: 5_000 }).catch(() => null);
          if (body) await this.testInfo.attach(`failure-${t.label}${i ? `-${i}` : ""}`, { body, contentType: "image/png" });
        }
      }
    }
    const videos: Array<{ label: string; path: string }> = [];
    for (const t of this.tracked) {
      for (const p of t.pages) {
        const v = p.video();
        if (v) videos.push({ label: t.label, path: await v.path().catch(() => "") });
      }
      await t.context.close().catch(() => undefined);
    }
    for (const c of this.cuts) await c.stop();
    for (const v of videos) {
      if (!v.path) continue;
      if (VIDEO === "retain-on-failure" && !failed) {
        rmSync(v.path, { force: true });
        continue;
      }
      await this.testInfo.attach(`video-${v.label}`, { path: v.path, contentType: "video/webm" });
    }
  }
}

/** Browser pro Worker, erst bei Bedarf gestartet. */
export class Browsers {
  private readonly launched = new Map<string, Promise<Browser>>();
  get(kind: "chromium" | "webkit"): Promise<Browser> {
    let b = this.launched.get(kind);
    if (!b) {
      b = (kind === "chromium" ? chromium : webkit).launch({ headless: true });
      this.launched.set(kind, b);
    }
    return b;
  }
  async closeAll(): Promise<void> {
    for (const b of this.launched.values()) await (await b).close().catch(() => undefined);
    this.launched.clear();
  }
}

export const test = base.extend<TestOptions & { lab: Lab }, { browsers: Browsers }>({
  phone: ["pixel7", { option: true }],
  browsers: [
    async ({}, use) => {
      const b = new Browsers();
      await use(b);
      await b.closeAll();
    },
    { scope: "worker" },
  ],
  lab: async ({ browsers, baseURL, phone }, use, testInfo) => {
    const lab = new Lab(browsers, testInfo, baseURL!, phone);
    await use(lab);
    await lab.dispose();
  },
});

export { expect } from "@playwright/test";
