# @couchplay/e2e

**Zuständig:** Test-Agent (nach Phase 2).

Browser-E2E mit Playwright (Chromium + WebKit, ein TV-Kontext + mehrere Handy-Kontexte)
und später Emulator-E2E (Android-TV-AVD, adb, CDP in die WebView, QR aus Screenshot
dekodieren mit `jsqr`/`pngjs`).

- Nicht Teil von `npm test` (braucht Browser + laufenden Server).
- Browser installieren: `npx playwright install chromium webkit`
- Ausführen: `npm run test:e2e` (Root) – startet Server auf Port 8090 via `webServer`.
- Integrationstests mit echten WS-Clients (ohne Browser) gehören nach `server/test/`.
