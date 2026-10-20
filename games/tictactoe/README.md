# @couchplay/game-tictactoe

**Zuständig:** Spiele-Agent (Phase 3). Aktuell Platzhalter, der die Schnittstelle erfüllt.

TicTacToe, 1–2 Spieler. 1 Spieler gegen Bot (Minimax; Setting `difficulty`: leicht/mittel/unbesiegbar, Bot-Züge über `ctx.rng` + `ctx.timers` für Verzögerung), 2 Spieler Handy gegen Handy.
Revanche = `lobby.start` in Phase results; Serien-Spielstand über `ctx.previous.data`.

Aufbau und Regeln: `packages/game-sdk/README.md`. Texte: `src/i18n/de.ts`.
