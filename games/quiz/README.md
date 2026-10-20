# @couchplay/game-quiz

**Zuständig:** Spiele-Agent (Phase 3). Aktuell Platzhalter, der die Schnittstelle erfüllt.

Allgemeinwissen-Quiz, 1–8 Spieler. Host wählt Kategorien und Rundenzahl (`manifest.json`).
TV: Frage + Countdown (`endsAt`), Auflösung, Rangliste, Podium. Handy: 4 farbige Antwort-Buttons.
Punkte: richtig + Zeitbonus. ~300 deutsche Fragen, 8 Kategorien als JSON in `src/data/`.

Aufbau und Regeln: `packages/game-sdk/README.md`. Texte: `src/i18n/de.ts`.
