# @couchplay/tv-web

**Zuständig:** Agent B (zusammen mit `android-tv/`).

TV-Oberfläche (Preact + Vite, `base: "/tv/"`), läuft in der Android-TV-WebView und im Desktop-Browser.

- 10-Fuß-UI: `1rem = 1/60 Viewporthöhe`, großer Fokusrahmen, komplett per D-Pad (Pfeile/Enter/Back) bedienbar.
- Ablauf: Raum erstellen (`room.create`) → Code + QR (`joinUrl`, Bibliothek `uqr`) → Lobby (Spieler, Spielauswahl, Settings, Start) → Spiel-TV-View → Ergebnis/Podium.
- Reconnect über `STORAGE_KEYS.tvSession` + `room.resume`.
- Spiel-Views: `src/games.ts` (dynamischer Import), Schnittstelle `GameTvView` aus `@couchplay/game-sdk/client`.
- Alle Texte: `src/i18n/de.ts`. Fehlertexte: `errorText(code)`.
- Bundle klein halten; Ziel ist eine alte Android-TV-WebView (`build.target: es2020`).
