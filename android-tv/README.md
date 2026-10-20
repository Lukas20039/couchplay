# android-tv

**Zuständig:** Agent B (Android-Teil). Kein npm-Workspace.

Kotlin-Shell für Android TV (Gradle-Projekt wird von Agent B angelegt):

- Leanback-Launcher-Eintrag + Banner (320×180), `android.software.leanback`, Touchscreen nicht erforderlich.
- Eine Activity mit Vollbild-WebView, lädt `${SERVER_URL}/tv/`.
- D-Pad-Navigation läuft in der Web-UI (Fokusrahmen); WebView bekommt Fokus, Back-Taste → `history.back()` bzw. Beenden-Dialog.
- `FLAG_KEEP_SCREEN_ON`, Immersive Mode.
- minSdk 24, targetSdk 35.
- Server-URL: Build-Default (`BuildConfig.DEFAULT_SERVER_URL`, via Gradle-Property) + Einstellungsmenü (SharedPreferences).
- Cleartext-HTTP nur per `network_security_config` für lokale Tests.
- `WebView.setWebContentsDebuggingEnabled(true)` in Debug-Builds (Emulator-E2E über CDP).

Die TV-Web-UI selbst liegt in `../tv-web`.
