# @couchplay/controller-pwa

**Zuständig:** Agent C.

Handy-Controller (Preact + Vite, PWA, iOS Safari + Android Chrome), ausgeliefert unter `/` und `/j/<code>`.

- Join: Code aus Pfad (`parseJoinPath`) oder Eingabe (`sanitizeRoomCodeInput`) → Name + Avatar (`AVATAR_IDS`, Profil in `STORAGE_KEYS.profile`) → `room.join`.
- Reconnect: `STORAGE_KEYS.playerSession` + `room.rejoin`, Backoff `reconnectDelayMs`; bei `SESSION_INVALIDATING_CODES`/Close 4001–4004 Sitzung löschen.
- Lobby; Host-Ansicht mit Spielauswahl + Settings-Formular aus `GameManifest.settings`.
- Spiel-Views: `src/games.ts` (dynamischer Import), Schnittstelle `GameControllerView` aus `@couchplay/game-sdk/client`.
- PWA: `public/manifest.webmanifest` (Icons fehlen noch), Service Worker optional (kein Offline-Spiel nötig).
- Alle Texte: `src/i18n/de.ts`. Fehlertexte: `errorText(code)`.
