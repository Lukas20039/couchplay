// Registriert den Service Worker (nur im Produktions-Build, siehe vite.config.ts → sw.js).
// Update-Strategie: index.html kommt immer zuerst aus dem Netz; ein neuer SW übernimmt
// sofort (skipWaiting + clients.claim). Laufende Seiten werden NICHT neu geladen –
// mitten im Spiel wäre das störend; das neue Deployment greift beim nächsten Öffnen.
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        // Beim Zurückkehren in die App (iOS hält PWAs lange im Speicher) nach Updates sehen.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") void reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}
