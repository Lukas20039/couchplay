// Service-Worker-Registrierung und kontrolliertes Update (nur Produktions-Build).
//
// Ein neuer SW wartet, bis die App an einer „sicheren“ Stelle ist (Startseite ohne laufenden
// Beitritt, Lobby, Ergebnis). Dann: SKIP_WAITING → controllerchange → location.reload().
// Während eines Spiels passiert nichts; Reload folgt automatisch, sobald die Runde vorbei ist.
// (Mehrere Tabs: übernimmt der SW wegen eines anderen Tabs, wartet dieser Tab ebenso.)
import type { AppState } from "./state/store.js";

export interface WorkerLike {
  readonly state: string;
  postMessage(msg: unknown): void;
  addEventListener(type: "statechange", fn: () => void): void;
}
export interface RegistrationLike {
  readonly waiting: WorkerLike | null;
  readonly installing: WorkerLike | null;
  addEventListener(type: "updatefound", fn: () => void): void;
  update(): Promise<unknown>;
}
export interface ContainerLike {
  readonly controller: unknown;
  register(url: string, opts: { scope: string; updateViaCache: "none" }): Promise<RegistrationLike>;
  addEventListener(type: "controllerchange", fn: () => void): void;
}

/** Darf die App jetzt neu laden / den neuen SW übernehmen lassen? */
export function isUpdateSafe(s: AppState): boolean {
  if (s.room && s.playerId) return s.room.phase !== "game";
  // Join-Ablauf: nur auf der Code-Seite ohne laufende Verbindung (keine Eingaben verlieren).
  return s.step === "code" && !s.joinPending && (s.conn === "idle" || s.conn === "closed");
}

export interface SwUpdaterDeps {
  container: ContainerLike;
  isSafe(): boolean;
  /** Bei jeder Zustandsänderung erneut prüfen. */
  subscribe(fn: () => void): void;
  reload(): void;
}

export async function startSwUpdater(deps: SwUpdaterDeps): Promise<RegistrationLike> {
  const { container } = deps;
  let hadController = !!container.controller;
  let waiting: WorkerLike | null = null;
  let reloadPending = false;
  let reloaded = false;

  const step = (): void => {
    if (!deps.isSafe()) return;
    if (waiting) {
      const w = waiting;
      waiting = null;
      w.postMessage({ type: "SKIP_WAITING" });
    }
    if (reloadPending && !reloaded) {
      reloaded = true;
      deps.reload();
    }
  };

  container.addEventListener("controllerchange", () => {
    // Erstinstallation (clients.claim): kein Reload nötig.
    if (!hadController) {
      hadController = true;
      return;
    }
    reloadPending = true;
    step();
  });

  const reg = await container.register("/sw.js", { scope: "/", updateViaCache: "none" });
  const track = (w: WorkerLike | null): void => {
    if (!w) return;
    const check = (): void => {
      // "installed" + bestehender Controller = Update wartet.
      if (w.state === "installed" && container.controller) {
        waiting = w;
        step();
      }
    };
    w.addEventListener("statechange", check);
    check();
  };
  if (reg.waiting && container.controller) {
    waiting = reg.waiting;
    step();
  }
  reg.addEventListener("updatefound", () => track(reg.installing));
  deps.subscribe(step);
  return reg;
}

export function registerServiceWorker(store: { getState(): AppState; subscribe(fn: () => void): () => void }): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    startSwUpdater({
      container: navigator.serviceWorker as unknown as ContainerLike,
      isSafe: () => isUpdateSafe(store.getState()),
      subscribe: (fn) => void store.subscribe(fn),
      reload: () => location.reload(),
    })
      .then((reg) => {
        // Beim Zurückkehren in die App (iOS hält PWAs lange im Speicher) nach Updates sehen.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}
