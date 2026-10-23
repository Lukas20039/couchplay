# @couchplay/game-schiffe

Schiffe versenken, 1–2 Teilnehmer, Spielfeld 10 × 10 (Spalten A–J, Zeilen 1–10).

- **Ablauf:** Aufstellung → Kampf → Ergebnis. Die Aufstellung liegt als Entwurf auf dem Server (zu Beginn
  zufällig); das Handy schickt `move` (Schiff verschieben/drehen), `shuffle`, `ready`/`unready`. Der Kampf
  beginnt, sobald beide bereit sind. Danach `fire` auf ein noch unbekanntes Feld.
- **Settings:** `difficulty` (Computer, 1 Spieler), `fleet` (`klassisch` 5-4-3-3-2, `gross` 5-4-4-3-3-3-2-2-2-2),
  `extraShot` (Treffer = nochmal schießen, Standard an), `touching` (Schiffe dürfen sich berühren, Standard aus).
  Dürfen sie sich nicht berühren, gilt das auch über Eck, und rund um versenkte Schiffe wird das Wasser
  automatisch markiert (`~`), darauf kann nicht mehr geschossen werden.
- **Geheimhaltung:** Der TV-Zustand enthält keine Schiffspositionen – nur die Gewässer (ein Zeichen pro Feld:
  `.` unbekannt, `o` Wasser, `x` Treffer, `#` versenkt, `~` sicher Wasser) und versenkte Schiffe. Erst bei
  Spielende kommen alle Flotten in `revealed`. Jedes Handy sieht nur die eigene Flotte.
- **Computer:** stellt nach 1,5 s auf, schießt nach 1,1 s (`ctx.timers`, Zufall nur über `ctx.rng`) und sieht nur
  die öffentliche Sicht. `leicht` – zufällig, nach Treffern nur manchmal gezielt; `mittel` – Schachbrettsuche, nach
  einem Treffer wird das Schiff abgefahren; `schwer` – Wahrscheinlichkeitskarte über alle noch möglichen Lagen.
  Im Schnitt (klassische Flotte) ca. 55 / 45 / 38 Schüsse bis zum Sieg.
- **Serie/Revanche:** Wer beginnt, wechselt mit jeder Partie. Serienstand (`results.data.series`) läuft über
  `ctx.previous` weiter, solange Paarung und Flotte gleich bleiben. Ergebnisdaten wie bei TicTacToe
  (`winnerId: "bot"`, `bot`), damit Podium/„Computer gewinnt“ in den Apps funktionieren.
- **Verbindung:** Disconnect im Kampf pausiert (auch den Computer); `onPlayerLeave` → der andere gewinnt kampflos.

| Datei | Inhalt |
|---|---|
| `src/shared.ts` | Typen, Geometrie, Aufstellungsprüfung (auch fürs Handy) |
| `src/server/input.ts` | zod-Schema der Eingaben |
| `src/server/ocean.ts` | Zufallsaufstellung, Schüsse auswerten |
| `src/server/bot.ts` | Computer-Gegner |
| `src/server/index.ts` | Spielablauf |
| `src/ui/common.tsx` | Spielfeld-Komponente + CSS für TV und Handy |
| `src/tv/`, `src/controller/` | Views (Preact, CSS als String injiziert) |
| `src/i18n/de.ts` | alle Texte |
| `preview/` | Sichtprüfung: `npx vite --config games/schiffe/preview/vite.config.ts` → `http://127.0.0.1:5194/?scene=tv-battle`; Screenshots: `node games/schiffe/preview/shots.mjs` |
