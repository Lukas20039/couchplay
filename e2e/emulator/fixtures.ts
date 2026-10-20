// Worker-Fixture der Emulator-E2E: Server (Host-Port 8080) + Android-TV-AVD + APK + WebView per CDP.
// Alles wird im Teardown abgeräumt – auch wenn ein Schritt fehlschlägt.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, openSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { ROOT, test as base } from "../tests/fixtures.js";
import { TvPage, type TvKey } from "../tests/pages/tv.js";
import { ACTIVITY, Adb, Emulator, ensureDebugApk, killAdbServer, log, PACKAGE, ScreenRecord, waitUntil } from "./android.js";

export const SERVER_PORT = 8080;
/** So erreicht der Emulator den Host (Build-Default der App). */
export const EMULATOR_HOST_URL = `http://10.0.2.2:${SERVER_PORT}`;
/** So erreichen die Playwright-Handys auf dem Host den Server. */
export const HOST_URL = `http://127.0.0.1:${SERVER_PORT}`;
export const EMU_SHOTS = path.join(ROOT, ".jait", "shots", "emulator");
export const RECORDING = path.join(ROOT, ".jait", "artifacts", "emulator-e2e.mp4");
const LOG_DIR = path.join(ROOT, ".jait", "artifacts", "emulator-logs");
const AVD = process.env.EMULATOR_AVD ?? "couchplay_tv";
const EMU_PORT = Number(process.env.EMULATOR_PORT ?? 5584);
const CDP_PORT = Number(process.env.EMULATOR_CDP_PORT ?? 9222);

const KEYCODES: Record<TvKey, string> = {
  ArrowUp: "KEYCODE_DPAD_UP",
  ArrowDown: "KEYCODE_DPAD_DOWN",
  ArrowLeft: "KEYCODE_DPAD_LEFT",
  ArrowRight: "KEYCODE_DPAD_RIGHT",
  Enter: "KEYCODE_DPAD_CENTER",
  Escape: "KEYCODE_BACK",
};

/** TV im Emulator: DOM über CDP, Bedienung ausschließlich über `adb shell input keyevent`. */
export class AndroidTv extends TvPage {
  constructor(
    page: Page,
    readonly adb: Adb,
  ) {
    super(page, null);
  }

  override async press(key: TvKey, times = 1): Promise<void> {
    await this.adb.keyevent(...Array.from({ length: times }, () => KEYCODES[key]));
  }

  async home(): Promise<void> {
    await this.adb.keyevent("KEYCODE_HOME");
  }
}

/** Server-Prozess (node server/dist/index.js) auf Port 8080. */
class ServerProc {
  private proc: ChildProcess | null = null;

  async start(extraEnv: Record<string, string> = {}): Promise<void> {
    if (!(await portFree(SERVER_PORT))) throw new Error(`Port ${SERVER_PORT} ist belegt – läuft schon ein Server?`);
    mkdirSync(LOG_DIR, { recursive: true });
    const out = openSync(path.join(LOG_DIR, "server.log"), "a");
    this.proc = spawn(process.execPath, ["server/dist/index.js"], {
      cwd: ROOT,
      stdio: ["ignore", out, out],
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(SERVER_PORT),
        HOST: "127.0.0.1",
        LOG_LEVEL: "info",
        TRUST_PROXY: "loopback",
        ...extraEnv,
      },
    });
    await waitUntil(
      "Server /healthz",
      async () => {
        if (this.proc?.exitCode !== null) throw new Error("Server-Prozess beendet – siehe server.log");
        const res = await fetch(`${HOST_URL}/healthz`);
        return res.ok;
      },
      30_000,
      300,
    );
    log(`Server läuft auf ${HOST_URL}`, extraEnv);
  }

  async stop(): Promise<void> {
    const p = this.proc;
    this.proc = null;
    if (!p || p.exitCode !== null) return;
    const exited = new Promise((r) => p.once("exit", r));
    p.kill("SIGTERM");
    await Promise.race([exited, new Promise((r) => setTimeout(r, 12_000))]);
    if (p.exitCode === null) p.kill("SIGKILL");
  }
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });
}

export interface AndroidEnv {
  adb: Adb;
  tv: AndroidTv;
  recorder: ScreenRecord;
  /** Screenshot per screencap nach .jait/shots/emulator/ (und PNG-Buffer zurück). */
  screencap(name: string): Promise<Buffer>;
  /** Server mit anderer Umgebung neu starten (z. B. PUBLIC_URL). */
  restartServer(env: Record<string, string>): Promise<void>;
}

let shotNo = 0;

export const test = base.extend<{ android: AndroidEnv }, { androidWorker: AndroidEnv }>({
  androidWorker: [
    async ({}, use) => {
      const server = new ServerProc();
      const emulator = new Emulator({ avd: AVD, port: EMU_PORT, logFile: path.join(LOG_DIR, "emulator.log") });
      const recorder = new ScreenRecord(emulator.adb);
      let cdp: Browser | null = null;
      try {
        if (!Emulator.avdExists(AVD)) throw new Error(`AVD ${AVD} fehlt`);
        for (const f of ["server/dist/index.js", "tv-web/dist/index.html", "controller-pwa/dist/index.html"]) {
          if (!existsSync(path.join(ROOT, f))) throw new Error(`Build fehlt (${f}) – zuerst \`npm run build\` im Root`);
        }
        // Schwere Schritte nacheinander: erst Gradle (falls nötig), dann Emulator.
        const apk = await ensureDebugApk(path.join(ROOT, "android-tv"));
        await server.start();
        // Evtl. mit fremdem Schlüssel laufenden adb-Server beenden (sonst „device unauthorized“).
        await killAdbServer();
        await emulator.start();
        await emulator.waitForBoot(12 * 60_000);
        const adb = emulator.adb;
        log("Gebootet. Animationen aus, APK installieren …");
        for (const k of ["window_animation_scale", "transition_animation_scale", "animator_duration_scale"]) {
          await adb.shell(`settings put global ${k} 0`);
        }
        // Gestreamte Installation hängt auf frisch gebooteten Emulatoren gelegentlich
        // unbegrenzt → kurzer Timeout, Wiederholung, ab Versuch 2 ohne Streaming.
        for (let attempt = 1; ; attempt++) {
          const args = attempt === 1 ? ["install", "-r", "-t", apk] : ["install", "--no-streaming", "-r", "-t", apk];
          try {
            await adb.run(args, 90_000);
            break;
          } catch (err) {
            if (attempt >= 3) throw err;
            log(`APK-Installation fehlgeschlagen (Versuch ${attempt}), neuer Versuch …`);
            await adb.run(["reconnect"], 15_000).catch(() => undefined);
            await adb.run(["wait-for-device"], 60_000).catch(() => undefined);
          }
        }
        await adb.shell(`pm clear ${PACKAGE}`);
        await adb.shell(`am start -W -n ${ACTIVITY}`, 120_000);

        // WebView-DevTools-Socket der App (nur Debug-Builds) → CDP.
        let pid: number | null = null;
        await waitUntil("App-Prozess", async () => (pid = await adb.pid(PACKAGE)) !== null, 60_000);
        const socket = `webview_devtools_remote_${pid}`;
        await waitUntil("WebView-DevTools-Socket", async () => (await adb.shell("cat /proc/net/unix")).includes(socket), 120_000);
        await adb.run(["forward", `tcp:${CDP_PORT}`, `localabstract:${socket}`]);
        cdp = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`, { timeout: 60_000 });
        let page: Page | undefined;
        await waitUntil(
          "TV-Seite in der WebView",
          async () => {
            page = cdp!.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes("/tv/"));
            return page !== undefined;
          },
          120_000,
        );
        const tv = new AndroidTv(page!, adb);
        await tv.waitReady();
        log(`TV bereit, Raum ${await tv.code()}`);

        const env: AndroidEnv = {
          adb,
          tv,
          recorder,
          async screencap(name) {
            const png = await adb.screencap();
            mkdirSync(EMU_SHOTS, { recursive: true });
            writeFileSync(path.join(EMU_SHOTS, `${String(++shotNo).padStart(2, "0")}-${name}.png`), png);
            await test.info().attach(`screencap-${name}`, { body: png, contentType: "image/png" });
            return png;
          },
          async restartServer(extra) {
            await server.stop();
            await server.start(extra);
          },
        };
        await use(env);
      } finally {
        log("Aufräumen …");
        await recorder.stopAndPull(RECORDING).then((ok) => ok && log("Aufnahme:", RECORDING)).catch((e) => log("Aufnahme fehlgeschlagen:", String(e)));
        await cdp?.close().catch(() => undefined);
        await emulator.adb.run(["forward", "--remove-all"], 10_000).catch(() => undefined);
        await emulator.stop();
        await server.stop();
        await killAdbServer();
        log("Aufgeräumt.");
      }
    },
    { scope: "worker", timeout: 20 * 60_000 },
  ],
  android: async ({ androidWorker }, use) => {
    await use(androidWorker);
  },
});

export { expect };
