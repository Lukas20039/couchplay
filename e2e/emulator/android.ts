// Steuerung von Android-SDK-Werkzeugen für die Emulator-E2E: AVD starten/beenden, adb,
// APK bauen/installieren, Screenshots, Bildschirmaufnahme, WebView-DevTools-Socket.
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export const ANDROID_HOME = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? "/home/hermes/Android/Sdk";
/** AVDs liegen im echten Home des Nutzers (die Agent-Shell hat ein eigenes HOME). */
export const ANDROID_USER_HOME = process.env.ANDROID_USER_HOME ?? "/home/hermes/.android";
const ADB = path.join(ANDROID_HOME, "platform-tools", "adb");
const EMULATOR = path.join(ANDROID_HOME, "emulator", "emulator");

export const PACKAGE = "at.couchplay.tv";
export const ACTIVITY = `${PACKAGE}/.MainActivity`;

/** Umgebung für SDK-Werkzeuge (AVD-Pfad, adb-Schlüssel). */
export function sdkEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // adb sucht seinen Schlüssel unter $HOME/.android; der Emulator autorisiert den Schlüssel aus ANDROID_USER_HOME.
    HOME: path.dirname(ANDROID_USER_HOME),
    ANDROID_HOME,
    ANDROID_SDK_ROOT: ANDROID_HOME,
    ANDROID_USER_HOME,
    ANDROID_EMULATOR_HOME: ANDROID_USER_HOME,
    ANDROID_AVD_HOME: path.join(ANDROID_USER_HOME, "avd"),
  };
}

export const log = (...args: unknown[]): void => console.log(`[emulator ${new Date().toISOString().slice(11, 19)}]`, ...args);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Wartet (pollend), bis `fn` true liefert. Nur für Geräte-Zustände ohne DOM (Boot, Sockets). */
export async function waitUntil(what: string, fn: () => Promise<boolean>, timeoutMs: number, intervalMs = 1000): Promise<void> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (await fn().catch(() => false)) return;
    if (Date.now() > end) throw new Error(`Zeitüberschreitung: ${what} (${Math.round(timeoutMs / 1000)} s)`);
    await sleep(intervalMs);
  }
}

export class Adb {
  constructor(readonly serial: string) {}

  async run(args: string[], timeoutMs = 60_000): Promise<string> {
    const { stdout } = await execFileP(ADB, ["-s", this.serial, ...args], { env: sdkEnv(), timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
  }

  async shell(cmd: string, timeoutMs = 60_000): Promise<string> {
    return (await this.run(["shell", cmd], timeoutMs)).trim();
  }

  /** PNG-Screenshot des Geräts (`adb exec-out screencap -p`). */
  async screencap(): Promise<Buffer> {
    const { stdout } = await execFileP(ADB, ["-s", this.serial, "exec-out", "screencap", "-p"], {
      env: sdkEnv(),
      encoding: "buffer",
      timeout: 30_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout;
  }

  async keyevent(...codes: string[]): Promise<void> {
    await this.shell(`input keyevent ${codes.join(" ")}`);
  }

  async pid(pkg: string): Promise<number | null> {
    const out = await this.shell(`pidof ${pkg}`).catch(() => "");
    const n = Number(out.split(/\s+/)[0]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}

export interface EmulatorOptions {
  avd: string;
  port: number;
  logFile: string;
}

/** Startet den AVD headless; `stop()` beendet ihn (auch wenn er nicht gebootet hat). */
export class Emulator {
  private proc: ChildProcess | null = null;
  readonly adb: Adb;

  constructor(readonly opts: EmulatorOptions) {
    this.adb = new Adb(`emulator-${opts.port}`);
  }

  static avdExists(avd: string): boolean {
    return existsSync(path.join(ANDROID_USER_HOME, "avd", `${avd}.ini`));
  }

  async start(): Promise<void> {
    mkdirSync(path.dirname(this.opts.logFile), { recursive: true });
    const out = openSync(this.opts.logFile, "w");
    // Eigene Prozessgruppe, damit beim Aufräumen auch qemu-Kindprozesse sicher enden.
    this.proc = spawn(
      EMULATOR,
      [
        "-avd", this.opts.avd,
        "-port", String(this.opts.port),
        "-no-window", "-no-audio", "-no-snapshot", "-no-boot-anim",
        "-gpu", "swiftshader_indirect",
        "-memory", "2048",
      ],
      { env: sdkEnv(), stdio: ["ignore", out, out], detached: true },
    );
    this.proc.on("exit", (code, signal) => log(`Emulator-Prozess beendet (code=${code}, signal=${signal})`));
    log(`Emulator gestartet (pid ${this.proc.pid}), Log: ${this.opts.logFile}`);
  }

  get running(): boolean {
    return this.proc !== null && this.proc.exitCode === null && this.proc.signalCode === null;
  }

  async waitForBoot(timeoutMs: number): Promise<void> {
    await execFileP(ADB, ["start-server"], { env: sdkEnv() });
    await waitUntil(
      "Gerät sichtbar (adb)",
      async () => {
        if (!this.running) throw new Error("Emulator-Prozess ist beendet – siehe Log");
        const out = await this.adb.run(["get-state"], 10_000).catch(() => "");
        return out.trim() === "device";
      },
      timeoutMs,
      2000,
    );
    await waitUntil("sys.boot_completed", async () => (await this.adb.shell("getprop sys.boot_completed", 10_000)) === "1", timeoutMs, 3000);
    await waitUntil("Package-Manager", async () => (await this.adb.shell("pm path android", 15_000)).startsWith("package:"), 120_000, 2000);
  }

  /** `adb emu kill`, danach notfalls die Prozessgruppe beenden. */
  async stop(): Promise<void> {
    await this.adb.run(["emu", "kill"], 15_000).catch(() => undefined);
    const p = this.proc;
    if (p?.pid && this.running) {
      const exited = new Promise<void>((r) => p.once("exit", () => r()));
      const t = setTimeout(() => {
        try {
          process.kill(-p.pid!, "SIGKILL");
        } catch {
          // schon weg
        }
      }, 20_000);
      await exited;
      clearTimeout(t);
    }
    this.proc = null;
  }
}

/** Debug-APK bauen, wenn sie fehlt oder älter als die Quellen ist. */
export async function ensureDebugApk(androidDir: string): Promise<string> {
  const apk = path.join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  const newest = newestMtime([
    path.join(androidDir, "app", "src"),
    path.join(androidDir, "app", "build.gradle.kts"),
    path.join(androidDir, "build.gradle.kts"),
    path.join(androidDir, "settings.gradle.kts"),
    path.join(androidDir, "gradle.properties"),
  ]);
  if (existsSync(apk) && statSync(apk).mtimeMs >= newest) {
    log("Debug-APK aktuell:", apk);
    return apk;
  }
  log("Baue Debug-APK (./gradlew assembleDebug --no-daemon) …");
  await execFileP("./gradlew", ["assembleDebug", "--no-daemon", "-q"], {
    cwd: androidDir,
    env: sdkEnv(),
    timeout: 20 * 60_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!existsSync(apk)) throw new Error(`APK fehlt nach dem Build: ${apk}`);
  return apk;
}

function newestMtime(paths: string[]): number {
  let max = 0;
  const walk = (p: string): void => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) for (const e of readdirSync(p)) walk(path.join(p, e));
    else max = Math.max(max, st.mtimeMs);
  };
  paths.forEach(walk);
  return max;
}

/** Bildschirmaufnahme auf dem Gerät (`screenrecord`, max. 180 s) und Abholen als MP4. */
export class ScreenRecord {
  private proc: ChildProcess | null = null;
  private readonly remote = "/sdcard/couchplay-e2e.mp4";

  constructor(private readonly adb: Adb) {}

  start(limitSec = 180): void {
    this.proc = spawn(ADB, ["-s", this.adb.serial, "shell", "screenrecord", "--time-limit", String(limitSec), "--bit-rate", "4000000", this.remote], {
      env: sdkEnv(),
      stdio: "ignore",
    });
    log(`Bildschirmaufnahme läuft (max. ${limitSec} s)`);
  }

  /** Aufnahme beenden (SIGINT auf dem Gerät → sauberes MP4) und nach `target` holen. */
  async stopAndPull(target: string): Promise<boolean> {
    if (!this.proc) return false;
    await this.adb.shell("pkill -INT screenrecord", 10_000).catch(() => undefined);
    const p = this.proc;
    this.proc = null;
    if (p.exitCode === null && p.signalCode === null) {
      await Promise.race([new Promise((r) => p.once("exit", r)), sleep(10_000)]);
      p.kill();
    }
    // screenrecord schreibt den moov-Atom beim Beenden; kurz bis die Datei stabil ist.
    let last = -1;
    await waitUntil(
      "MP4 fertig geschrieben",
      async () => {
        const size = Number((await this.adb.shell(`stat -c %s ${this.remote}`, 10_000)).trim());
        const stable = size > 0 && size === last;
        last = size;
        return stable;
      },
      20_000,
      1000,
    ).catch(() => undefined);
    mkdirSync(path.dirname(target), { recursive: true });
    await this.adb.run(["pull", this.remote, target], 120_000);
    await this.adb.shell(`rm -f ${this.remote}`).catch(() => undefined);
    return existsSync(target);
  }
}

/** adb-Server beenden (läuft sonst als Daemon weiter). */
export async function killAdbServer(): Promise<void> {
  await execFileP(ADB, ["kill-server"], { env: sdkEnv() }).catch(() => undefined);
}
