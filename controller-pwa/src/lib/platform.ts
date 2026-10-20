// Geräte-Fähigkeiten: Vibration, Screen Wake Lock, Standalone-Erkennung.
// Alles mit Feature-Detection – iOS Safari hat z. B. kein navigator.vibrate.

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // manche Browser werfen ohne vorherige Nutzerinteraktion
  }
}

/** Läuft die App vom Home-Bildschirm (iOS: navigator.standalone, sonst display-mode)? */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches;
}

/** iPhone/iPad (auch iPadOS, das sich als Mac ausgibt). */
export function isIos(): boolean {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * Hält den Bildschirm wach, solange `active` gesetzt ist. Das Sperrobjekt verfällt,
 * wenn die Seite in den Hintergrund geht – daher bei visibilitychange erneut anfordern.
 * Ohne API (iOS < 16.4) passiert einfach nichts.
 */
export function createWakeLock(): { setActive(active: boolean): void } {
  type Sentinel = { release(): Promise<void>; released?: boolean };
  type WakeLockApi = { request(type: "screen"): Promise<Sentinel> };
  const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
  let active = false;
  let sentinel: Sentinel | null = null;
  let pending = false;

  const acquire = (): void => {
    if (!api || !active || pending || document.visibilityState !== "visible") return;
    if (sentinel && !sentinel.released) return;
    pending = true;
    api
      .request("screen")
      .then((s) => {
        sentinel = s;
        if (!active) void s.release().catch(() => undefined);
      })
      .catch(() => undefined)
      .finally(() => {
        pending = false;
      });
  };

  if (api) document.addEventListener("visibilitychange", acquire);

  return {
    setActive(next) {
      active = next;
      if (next) acquire();
      else if (sentinel) {
        void sentinel.release().catch(() => undefined);
        sentinel = null;
      }
    },
  };
}
