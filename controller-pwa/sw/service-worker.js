// Service Worker der Controller-PWA. Wird beim Build von build/sw-plugin.ts nach dist/sw.js
// geschrieben; Precache-Liste und Version werden dabei eingesetzt.
//
// Strategie:
// - App-Shell (gehashte Assets, Icons, Manifest) beim Install vorcachen.
// - Navigationen (/, /j/<code>): network-first → ein neues Deployment greift beim nächsten
//   Öffnen; offline/fehlerhaft → gecachte index.html.
// - Gehashte Assets: cache-first (unveränderlich).
// - /ws, /api, /tv/, /healthz und fremde Origins: nie anfassen.
/* eslint-disable no-restricted-globals */
const VERSION = "__VERSION__";
const CACHE = `couchplay-controller-${VERSION}`;
const PRECACHE = __PRECACHE__;
const SHELL = "/index.html";

const BYPASS = [/^\/ws(\/|$)/, /^\/api(\/|$)/, /^\/tv(\/|$)/, /^\/healthz$/, /^\/sw\.js$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("couchplay-controller-") && k !== CACHE).map((k) => caches.delete(k))))
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
          if (res.ok) {
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
