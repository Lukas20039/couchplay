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
- Optional: `-Pcouchplay.versionCode=…`, `-Pcouchplay.versionName=…`.
- Release-Signatur aus der Umgebung: `ANDROID_KEYSTORE_BASE64` (oder `ANDROID_KEYSTORE_FILE`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (Default = Keystore-Passwort). Fehlen sie, wird das Release mit dem Debug-Key signiert (Warnung im Log) – installierbar, aber nicht für den Store.
- `gradle.properties` begrenzt den Heap (`-Xmx1536m`).

## Verhalten

- **Leanback:** `LEANBACK_LAUNCHER` + `LAUNCHER`, Banner 320×180 (`drawable-xhdpi/banner.png`), adaptives Icon; `android.software.leanback` und `android.hardware.touchscreen` nicht erforderlich.
- **WebView:** JS + DOM-Storage an, Media-Autoplay ohne Geste, Keep-Screen-On, Immersive Mode. Navigation nur innerhalb des Server-Origins (JS-Brücke!). `WebView.setWebContentsDebuggingEnabled(true)` **nur in Debug-Builds** (Emulator-E2E per CDP: `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`). Renderer-Absturz → WebView wird neu aufgebaut.
- **Tasten:** Pfeile/OK gehen direkt an die Web-App. Hardware-Back → `window.dispatchEvent(new CustomEvent("couchplay:back",{cancelable:true}))`; ruft die Web-App kein `preventDefault()` (oder ist sie nicht geladen), beendet sich die App. Menü-Taste analog mit `couchplay:menu` (Fallback: Einstellungen).
- **JS-Brücke `CouchPlayNative`:** `exitApp()`, `openSettings()`, `retry()`.
- **Fehlerseite:** `assets/error.html` (gestylt, D-Pad-bedienbar) bei Netzwerkfehler oder HTTP ≥ 400 der Hauptseite; „Erneut versuchen“, „Einstellungen“, automatischer Neuversuch nach 15 s.
- **Einstellungen:** `SettingsActivity` – Server-Adresse (SharedPreferences; leer/„Standard verwenden“ = Build-Default). Erreichbar über Fehlerseite, Menü-Taste, Langdruck OK auf der Startseite der Web-App oder den Einstellungen-Button in der Lobby. Nach Änderung lädt die WebView neu.
- **Cleartext-HTTP** ist per `network_security_config` erlaubt (Heimnetz/Tests per HTTP).
