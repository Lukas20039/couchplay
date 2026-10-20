# @couchplay/tv-web

**Zuständig:** Agent B (zusammen mit `android-tv/`).

TV-Oberfläche (Preact + Vite, `base: "/tv/"`), läuft in der Android-TV-WebView und im Desktop-Browser.
Wird vom Server same-origin unter `${server}/tv/` ausgeliefert; die WebSocket-URL wird aus `location` abgeleitet (`ws(s)://<host>/ws`).

## Aufbau

| Datei | Inhalt |
|---|---|
| `src/net/client.ts` | WS-Client: `room.create` bzw. `room.resume` (Token unter `STORAGE_KEYS.tvSession`), Reconnect mit `reconnectDelayMs`, Close-Codes 4001–4004, Ping/Pong-Uhrabgleich |
| `src/state/store.ts` | reiner Reducer + Mini-Store (Verbindung, Raum, Katalog, `game.tv` mit seq-Prüfung, Fehlerhinweis, Endzustände) |
| `src/state/selectors.ts` | Startprüfung (Spielerzahl), Teilnehmerauswahl, Revanche |
| `src/nav/spatial.ts`, `src/nav/navigator.ts` | Spatial-Navigation mit Fokus-Gruppen und Gruppen-Gedächtnis, OK beim Loslassen, Langdruck OK, Zurück-Stack |
| `src/ui/*` | Start, Lobby, Einstellungen (aus dem Settings-Schema), Teilnehmerauswahl, Spielbühne, Ergebnis, Endzustände |
| `src/games.ts` | Loader der Spiel-TV-Views (`import()`, eigene Chunks) |
| `src/i18n/de.ts` | alle Texte; Fehler über `errorText(code)` |

## Bedienung (D-Pad)

- Pfeile bewegen den Fokus. OK (Enter) löst beim Loslassen aus, Langdruck OK (≥ 0,8 s) oder Menü-Taste öffnen auf der Startseite die Einstellungen der Android-Shell.
- Zurück (Escape/Backspace/Android-Back) geht eine Ebene zurück: Overlay schließen → Ergebnis → Lobby; im Spiel öffnet Zurück das Menü (Weiterspielen/Spiel abbrechen = `game.abort`). Auf der obersten Ebene ruft die App `CouchPlayNative.exitApp()`.
- Markup-Konvention: `data-nav="<gruppe>"` (fokussierbar), `data-nav-autofocus`, `data-nav-layer` (Overlay).

## Android-Brücke

- Shell → Web: `window.dispatchEvent(new CustomEvent("couchplay:back", { cancelable: true }))` bzw. `"couchplay:menu"`. Die Web-App ruft `preventDefault()`; ist das Event nicht abgebrochen (Seite nicht geladen), handelt die Shell selbst.
- Web → Shell: `CouchPlayNative.exitApp()`, `CouchPlayNative.openSettings()` (fehlen im Desktop-Browser → wirkungslos).

## E2E-Anker (`data-testid`)

`room-code` (`data-code`), `join-qr` (`data-join-url`), `join-url`, `player-list` (`data-count`), `player-item` (`data-player-id`, `data-connected`, `data-host`), `game-tile` (`data-game-id`, `aria-pressed`), `setting` (`data-setting-key`), `start-button` (`data-state`: noGame/tooFew/ready/choose), `start-hint`, `choose-players`, `choose-player`, `choose-start`, `game-stage` (`data-game-id`), `player-disconnected`, `pause-menu`, `abort-game`, `results`, `result-row` (`data-player-id`, `data-rank`, `data-score`), `play-again`, `to-lobby`, `connection-status` (`data-status`), `reconnect-banner`, `toast` (`data-error-code`), `start-screen`, `fatal-screen` (`data-kind`).

## Zielplattform

`build.target = chrome64/safari12`: ES-Module + dynamisches `import()` ab Chrome 63/64; neuere Syntax wird heruntergebrochen. CSS ohne Flexbox-`gap`, `inset`, `aspect-ratio`, `clamp()`. `@vitejs/plugin-legacy` wird bewusst **nicht** verwendet (Babel/Polyfill-Chunk, neue Abhängigkeit) – die Android-System-WebView wird über den Play Store aktualisiert; WebViews ohne Modul-Unterstützung zeigen einen Hinweis (`nomodule` in `index.html`).
Eingehende Nachrichten werden leichtgewichtig geprüft statt per zod (`parseServerMessage` würde zod ins Bundle ziehen); Typen kommen per `import type` aus `@couchplay/protocol`.

## Skripte

`npm run dev -w tv-web` (Vite 5173, Proxy `/ws` → 8080) · `npm run build -w tv-web` · `npm test -w tv-web`
