# @couchplay/game-quiz

**Zuständig:** Spiele-Agent. Allgemeinwissen-Quiz, 1–8 Spieler.

Host wählt Kategorien, Fragenanzahl (5–30) und Antwortzeit (10–30 s) – siehe `manifest.json`.

## Ablauf (Server, `src/server/`)

`intro` (5 s) → je Frage: `question` (Antwortzeit) → `reveal` (7 s) → `standings` (6 s) → … →
nach der letzten Auflösung `final` (Podium, 12 s) → `ctx.end({ ranking, data })`.

- Fragen per `ctx.rng` gezogen: Kategorien reihum, keine Wiederholung, Antworten gemischt.
  Bei Revanche werden Fragen der Vorrunde (`ctx.previous.data.questionIds`) gemieden.
- Punkte: richtig = `round(1000 × (0,5 + 0,5 × Restzeit/Antwortzeit))`, sonst 0. Eine Antwort pro Frage.
- Frage endet vorzeitig, wenn alle **verbundenen** aktiven Spieler geantwortet haben.
- Getrennte Spieler behalten Punkte und spielen nach Rejoin weiter; wer das Spiel verlässt,
  bleibt mit Punkten in der Wertung (`data.players[].left`). Gleichstand = gleicher Rang.
- Die richtige Antwort (`correctIndex`) steht erst in den Zuständen der Phase `reveal`.

Zeiten: `TIMING` in `src/constants.ts`. Typen der Zustände: `src/shared.ts`.

## Fragen (`src/data/`)

370 Fragen in 8 Kategorien (je 45–48), Tupel `[id, Schwierigkeit 1–3, Frage, RICHTIG, falsch, falsch, falsch]`,
beim Laden mit zod validiert (`schema.ts`: eindeutige Antworten, Längenlimits Frage ≤ 120, Antwort ≤ 40).
Zeitstabil formuliert (keine Amtsinhaber, Rekorde, Bevölkerungszahlen).

## Views

- TV (`src/tv/`): Frage, Kategorie, Fortschritt, Countdown-Ring, Antworten in Farbe **und** Form
  (rot ▲, blau ◆, gelb ●, grün ■), Antwortstatus per Avatar, Auflösung mit Verteilung,
  animierte Rangliste (transform), Podium. Keine Interaktion nötig.
- Handy (`src/controller/`): vier große Buttons, „Antwort gesperrt“, Ergebnis mit Punkten/Platz, Vibration.
- Styles als String (`styles.ts`), werden beim ersten Render in `<head>` eingefügt.
- Texte: `src/i18n/de.ts`.

## Entwicklung

```
npm test -w @couchplay/game-quiz
npx vite --config games/quiz/preview/vite.config.ts      # Preview: ?tv=question | ?pad=locked
node games/quiz/preview/shots.mjs                          # Screenshots → .jait/shots/quiz-*.png
```
