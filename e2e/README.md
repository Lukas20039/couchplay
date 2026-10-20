# @couchplay/e2e

**Zuständig:** Test-Agent. Nicht Teil von `npm test` (braucht Browser bzw. Emulator).

## Stufe 1 – Browser-E2E (`npm run test:e2e`, auch in CI)

Voraussetzung: Root-Build (`npm run build`; fehlt er, holt `webServer` ihn nach) und Browser
(`npx playwright install chromium webkit`). Playwright startet `node server/dist/index.js` auf einem
freien Port (`E2E_PORT` überschreibt), `PUBLIC_URL=http://127.0.0.1:<port>`, `NODE_ENV=production`.

- **Projekte** = Standard-Handy: `pixel7` (Chromium, Pixel 7) und `iphone13` (WebKit, iPhone 13).
  Der TV ist immer Chromium 1920×1080. Das 8-Handy-Quiz mischt beide Profile und läuft nur in `pixel7`,
  das Solo-Quiz nur in `iphone13`.
- **Geräte-IPs:** Jeder Browser-Kontext schickt eine eigene `X-Forwarded-For`-Adresse, der Server vertraut
  nur dem Loopback (`TRUST_PROXY=loopback`). So verhalten sich die Kontexte wie getrennte Handys im WLAN
  und teilen sich keine IP-Limits.
- **Page-Objects:** `tests/pages/tv.ts` (TV nur per Tastatur: Pfeile/Enter/Escape, `focus()` steuert den
  Fokus wie ein D-Pad), `tests/pages/phone.ts` (`joinByUrl`, `joinByCode`, Host-Einstellungen, Bestätigungsdialog).
  Ablauf-Helfer: `tests/flows/quiz.ts` (Quiz durchspielen, TV ↔ Handys gegenprüfen).
- **Netzabbruch:** `lib/netcut.ts` – TCP-Durchreiche, die sich hart trennen lässt (`context.setOffline()`
  allein lässt bestehende WebSockets offen).
- **QR:** `lib/qr.ts` dekodiert Screenshots mit `jsqr` + `pngjs`.

| Spec | Inhalt |
|---|---|
| `join.spec.ts` | QR aus TV-Screenshot = `data-join-url` → Profilschritt; Code per Tastatur, falscher Code → Meldung |
| `quiz.spec.ts` | 8 Handys (Chromium + WebKit) komplett, 9. Handy abgewiesen; Solo-Quiz auf dem iPhone (Einstellungen per D-Pad) |
| `tictactoe.spec.ts` | gegen Computer (leicht), 2 Spieler mit Revanche/Serienstand, 3 Spieler → Auswahl + Zuschauer |
| `robustness.spec.ts` | Offline/Online + Reload im Quiz (Rejoin), TV-Reload (`room.resume`), Host-Wechsel |

Artefakte: Screenshots der Schlüsselmomente → `.jait/shots/e2e/`; HTML-Report inkl. Videos →
`.jait/artifacts/e2e-report/` (Rohdaten `…/e2e-report-results/`). In CI (`CI=1`) die Playwright-Standardordner
`e2e/playwright-report/` und `e2e/test-results/`. Steuerung: `E2E_ARTIFACTS_DIR`, `E2E_SHOTS_DIR`,
`E2E_VIDEO=on|off|retain-on-failure` (lokal `on`, CI `retain-on-failure`).

Stabilität prüfen: `cd e2e && npx playwright test --repeat-each=3` (über das Root-Skript schluckt npm die Option).

## Stufe 2 – Emulator-E2E (`npm run test:emulator`, nur lokal)

`playwright.emulator.config.ts` + `emulator/`. Ein Worker-Fixture (`emulator/fixtures.ts`)
1. baut bei Bedarf die Debug-APK (`./gradlew assembleDebug --no-daemon`, wenn älter als die Quellen),
2. startet den Server auf Host-Port 8080 (ohne `PUBLIC_URL`),
3. bootet den AVD `couchplay_tv` headless (`-no-window -no-audio -no-snapshot -gpu swiftshader_indirect -memory 2048`)
   und wartet auf `sys.boot_completed`,
4. installiert die APK, löscht App-Daten, startet `at.couchplay.tv/.MainActivity`,
5. verbindet sich per `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` + `chromium.connectOverCDP`
   mit der TV-WebView,
6. räumt im `finally` alles ab (Aufnahme holen, `adb emu kill`, Server stoppen, `adb kill-server`).

Am TV wird ausschließlich mit `adb shell input keyevent` (DPAD_*, DPAD_CENTER, BACK, HOME) navigiert.
Tests: QR im `screencap` = Join-URL (zeigt ohne `PUBLIC_URL` auf `10.0.2.2` – für Handys nicht erreichbar),
Quiz mit 3 Handys, TicTacToe gegen Computer, BACK → Pausenmenü, HOME → zurück, Server-Neustart mit
`PUBLIC_URL` → Join direkt per QR.

Artefakte: `.jait/shots/emulator/`, `.jait/artifacts/emulator-e2e.mp4` (screenrecord, max. 3 min),
Report `.jait/artifacts/emulator-report/`, Logs `.jait/artifacts/emulator-logs/`.
Umgebung: `ANDROID_HOME` (Default `/home/hermes/Android/Sdk`), `ANDROID_USER_HOME` (Default `/home/hermes/.android`),
`EMULATOR_AVD`, `EMULATOR_PORT` (5584), `EMULATOR_CDP_PORT` (9222).

### Fehlerbehebung Emulator

- **APK-Installation hängt oder schlägt ohne Meldung fehl:** Meist liegt noch eine
  ältere App-Version mit anderer Debug-Signatur im AVD (z. B. aus einem anderen
  HOME gebaut). AVD einmal zurücksetzen und danach die Suite erneut starten:
  `$ANDROID_HOME/emulator/emulator -avd couchplay_tv -no-window -wipe-data`,
  nach dem Boot mit `adb emu kill` beenden.
- **Sehr langsamer Boot / Timeouts:** Der Emulator rendert per Software
  (swiftshader) und braucht ~2 GB RAM. Währenddessen keine anderen schweren
  Prozesse (Builds, weitere Emulatoren) laufen lassen.
