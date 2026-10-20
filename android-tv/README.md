# android-tv

**Zuständig:** Agent B (Android-Teil). Eigenständiges Gradle-Projekt, kein npm-Workspace.

Kotlin-Shell für Android TV: Vollbild-WebView, die `${serverUrl}/tv/` (tv-web) lädt.
Keine AndroidX-Abhängigkeiten (nur Kotlin-Stdlib) → kleine APK (Release ≈ 70 KB).

| | |
|---|---|
| applicationId | `at.couchplay.tv` |
| SDK | minSdk 24, targetSdk 35, compileSdk 35 |
| Toolchain | Gradle 8.14.3 (Wrapper), AGP 8.13.0, Kotlin 2.2.20, Java 17-Bytecode (läuft mit JDK 17/21) |

## Bauen

```sh
cd android-tv
export ANDROID_HOME=/pfad/zum/Android/Sdk      # oder local.properties: sdk.dir=…
./gradlew assembleDebug --no-daemon             # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease --no-daemon -Pcouchplay.serverUrl=https://play.example.org
```

- `couchplay.serverUrl` (Default in `gradle.properties`: `http://10.0.2.2:8080` = Host-Rechner aus dem Emulator) → `BuildConfig.SERVER_URL`.
- Version: `-Pcouchplay.versionName=…` (Default `0.1.0`), `-Pcouchplay.versionCode=…` (Default `1`).
- Release-Signatur nur aus der Umgebung: `ANDROID_KEYSTORE_FILE` (Pfad; CI dekodiert den Keystore selbst), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` → `app-release.apk`. Nichts gesetzt → **unsigniertes** Release `app-release-unsigned.apk` + Warnung. Teilweise gesetzt → Build-Fehler (nur bei Release-Tasks). Der Build schreibt keinen Keystore.
- `gradle.properties` begrenzt den Heap (`-Xmx1536m`).

## Verhalten

- **Leanback:** `LEANBACK_LAUNCHER` + `LAUNCHER`, Banner 320×180 (`drawable-xhdpi/banner.png`), adaptives Icon; `android.software.leanback` und `android.hardware.touchscreen` nicht erforderlich.
- **WebView:** JS + DOM-Storage an, Media-Autoplay ohne Geste, Keep-Screen-On, Immersive Mode. Navigation nur innerhalb des Server-Origins (Schema + Host case-insensitiv + effektiver Port); ein Redirect http → https auf denselben Host wird erlaubt und die erlaubte Origin auf https umgestellt. Jede andere blockierte Hauptseiten-Navigation zeigt die Fehlerseite. JS-Timer werden in `onPause` angehalten. `WebView.setWebContentsDebuggingEnabled(true)` **nur in Debug-Builds** (Emulator-E2E per CDP: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`). Renderer-Absturz → WebView wird neu aufgebaut (nach 3 Abstürzen ohne erfolgreiches Laden: Fehlerseite statt Schleife).
- **Tasten:** Pfeile/OK gehen direkt an die Web-App. Hardware-Back → `window.dispatchEvent(new CustomEvent("couchplay:back",{cancelable:true}))`; ruft die Web-App kein `preventDefault()` (oder ist sie nicht geladen), beendet sich die App. Menü-Taste analog mit `couchplay:menu` (Fallback: Einstellungen).
- **JS-Brücke `CouchPlayNative`:** `exitApp()`, `openSettings()`, `retry()`. Jeder Aufruf wird im UI-Thread nur ausgeführt, wenn `webView.url` zur Server-Origin gehört oder die eigene Fehlerseite ist (kein AndroidX → kein `addWebMessageListener`).
- **Fehlerseite:** `assets/error.html` (gestylt, D-Pad-bedienbar) bei Netzwerkfehler oder HTTP ≥ 400 der Hauptseite; „Erneut versuchen“, „Einstellungen“, automatischer Neuversuch nach 15 s.
- **Einstellungen:** `SettingsActivity` – Server-Adresse (Host wird kleingeschrieben, Standard-Ports entfernt; ohne Schema: `http://` für lokale Adressen wie private IPs/`*.local`/Rechnernamen, sonst `https://`) (SharedPreferences; leer/„Standard verwenden“ = Build-Default). Erreichbar über Fehlerseite, Menü-Taste, Langdruck OK auf der Startseite der Web-App oder den Einstellungen-Button in der Lobby. Nach Änderung lädt die WebView neu.
- **Cleartext-HTTP** ist per `network_security_config` bewusst global erlaubt: Der Server läuft im Heimnetz typischerweise per `http://<LAN-IP>:8080`, eine Host-Liste ist vorab nicht bekannt. Risiko: Im selben Netz kann ein Angreifer (MITM) eine HTTP-TV-UI austauschen; die JS-Brücke kann dann nur Beenden/Einstellungen/Neu laden auslösen. Für Betrieb über das Internet immer `https://` verwenden (Release mit `-Pcouchplay.serverUrl=https://…` bauen).
