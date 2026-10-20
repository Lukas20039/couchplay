// Service Worker der Controller-PWA. Wird beim Build von build/sw-plugin.ts nach dist/sw.js
// geschrieben; Precache-Liste und Version werden dabei eingesetzt.
//
// Strategie:
// - App-Shell (gehashte Assets inkl. aller Spiel-Chunks, Icons, Manifest) beim Install vorcachen.
// - Update: Der neue SW WARTET. Die App schickt {type:"SKIP_WAITING"}, sobald sie in
//   Startseite/Lobby/Ergebnis ist, und lädt nach controllerchange neu – nie mitten im Spiel.
// - Alte Caches: aktuelle + vorige Version bleiben erhalten (caches.match durchsucht alle),
//   damit ein noch offener alter Tab seine Spiel-Chunks weiter findet.
// - Navigationen (/, /j/<code>): network-first → ein neues Deployment greift beim nächsten
//   Öffnen; offline/fehlerhaft → gecachte index.html.
// - Gehashte Assets: cache-first (unveränderlich).
// - /ws, /api, /tv/, /healthz und fremde Origins: nie anfassen.
/* eslint-disable no-restricted-globals */
const VERSION = "__VERSION__";
const BUILD = "__BUILD__"; // Build-Zeitpunkt (sortierbar), für das Aufräumen alter Caches
const PREFIX = "couchplay-controller-";
const CACHE = `${PREFIX}${BUILD}-${VERSION}`;
const KEEP_CACHES = 2;
const PRECACHE = __PRECACHE__;
const SHELL = "/index.html";

const BYPASS = [/^\/ws(\/|$)/, /^\/api(\/|$)/, /^\/tv(\/|$)/, /^\/healthz$/, /^\/sw\.js$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })))),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        // Neueste zuerst (Name enthält Build-Zeitpunkt); nur ältere als die vorige Version löschen.
        const ours = keys.filter((k) => k.startsWith(PREFIX)).sort().reverse();
        const keep = new Set([CACHE, ...ours.filter((k) => k !== CACHE).slice(0, KEEP_CACHES - 1)]);
        return Promise.all(ours.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS.some((re) => re.test(url.pathname))) return;
  if (req.headers.get("upgrade") === "websocket") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Nur echte HTML-Antworten als Shell übernehmen (keine JSON-/Fehlerseiten).
          const type = res.headers.get("content-type") || "";
          if (res.ok && type.includes("text/html")) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || Response.error())),
    );
    return;
  }

  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
