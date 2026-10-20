# CouchPlay — Projektauftrag (freigegeben 2026-10-20)

Android-TV-App als Spielkonsole, Smartphones als Controller (PWA, iOS + Android).
Vorbild: Netflix Games / Jackbox.

## Festgelegte Entscheidungen

- **Zentraler Game-Server** (Node 22, TypeScript, Fastify + `ws`), server-authoritative.
  Liefert auch die Controller-PWA und die TV-Web-UI aus.
- **Verbindung:** TV erstellt Raum → Server vergibt 6-stelligen numerischen Code
  (Ablauf 2 h Inaktivität). TV zeigt Code + QR (`${PUBLIC_URL}/j/<code>`).
  Handy: QR scannen oder Code tippen → Name + Avatar → Lobby.
  Reconnect-Token im `localStorage`. Rate-Limit auf Join-Versuche.
- **Spiele als Pakete:** `manifest.json` + Serverlogik + TV-View + Controller-View.
  Server liefert Katalog; Startspiele sind eingebaut.
- **Android TV:** Kotlin-Shell (Leanback-Launcher, Banner), Vollbild-WebView,
  D-Pad-Fokusnavigation, Keep-Screen-On, minSdk 24, targetSdk 35.
  Server-URL per Build-Default + Einstellungsmenü änderbar.
- **Monorepo (npm workspaces):** `packages/protocol`, `server`, `tv-web`,
  `controller-pwa`, `games/quiz`, `games/tictactoe`, `android-tv`, `e2e`.
- **Deployment:** GitHub Actions baut Docker-Image (multi-arch, non-root,
  Healthcheck) → GHCR. HTTPS/Reverse-Proxy macht der Betreiber.
  Config via ENV: `PUBLIC_URL`, `PORT`, `TRUST_PROXY`, `LOG_LEVEL`.
  Tests laufen lokal auf diesem Host über HTTP.
- **Sprache:** UI Deutsch (Texte zentral, i18n-fähig). Code-Kommentare Deutsch.
- **Design:** dunkel (Netflix-artig), bunte Akzente, TV-tauglich (10-Fuß-UI,
  große Schrift, klarer Fokusrahmen).

## Startspiele

1. **Allgemeinwissen-Quiz, 1–8 Spieler.** Erster Spieler = Host (Kategorien,
   Rundenzahl). TV: Frage + Countdown. Handy: 4 farbige Antwort-Buttons.
   Punkte für richtig + Zeitbonus, Auflösung, Rangliste, Podium.
   ~300 deutsche Fragen, 8 Kategorien, JSON.
2. **TicTacToe, 1–2 Spieler.** 1 Spieler gegen Bot (Minimax; leicht/mittel/
   unbesiegbar), 2 Spieler Handy gegen Handy. Revanche, Spielstand.

## Qualität

- Unit (Vitest), Integration (echte WS-Clients), Browser-E2E (Playwright,
  Chromium + WebKit, mehrere Handy-Kontexte), Emulator-E2E (Android TV AVD,
  adb, CDP in die WebView, QR aus Screenshot dekodieren).
- Jeder Agent: vor „fertig" `npm test` und `npm run typecheck` grün.
