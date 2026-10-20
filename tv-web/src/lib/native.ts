// Brücke zur Android-TV-Shell (android-tv/, @JavascriptInterface "CouchPlayNative").
// Im Desktop-Browser fehlt die Brücke; dann sind die Aufrufe wirkungslos.

interface NativeBridge {
  exitApp(): void;
  openSettings(): void;
}

function bridge(): NativeBridge | null {
  const w = globalThis as { CouchPlayNative?: Partial<NativeBridge> };
  const b = w.CouchPlayNative;
  return b && typeof b.exitApp === "function" && typeof b.openSettings === "function" ? (b as NativeBridge) : null;
}

export function hasNative(): boolean {
  return bridge() !== null;
}

/** App beenden (nur in der Android-Shell). */
export function exitApp(): void {
  bridge()?.exitApp();
}

/** Einstellungen der Android-Shell öffnen (Server-URL). */
export function openNativeSettings(): void {
  bridge()?.openSettings();
}
