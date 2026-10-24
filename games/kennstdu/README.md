# @couchplay/game-kennstdu – „Wie gut kennst du mich?“

Kennenlernspiel, 2–8 Spieler. Ablauf: `intro` (7 s) → je Frage `ask` (Antwortzeit) → `reveal` (8 s) →
`standings` (5 s) → … → `final` (6 s) → `ctx.end`.

- **Hauptperson:** reihum in gemischter Reihenfolge, jede Person `turns` Mal (Setting „Fragen pro Person“, 1–4).
  Sie sieht die Frage in du-Form und wählt ehrlich; alle anderen sehen die Frage mit ihrem Namen und raten –
  gleichzeitig. Die Antwort der Hauptperson kennt niemand vor `reveal` (auch der TV nicht).
- **Punkte:** richtig geraten `POINTS.guess` (100), Hauptperson `POINTS.perGuesser` (50) je richtigem Rater.
  Antwortet die Hauptperson nicht, gibt es keine Punkte. Vorzeitige Auflösung, sobald Hauptperson und alle
  verbundenen Rater geantwortet haben. Geht die Hauptperson, wird sofort aufgelöst; bleibt nur noch eine
  Person, folgt das Finale.
- **Fragen** (`src/data/questions/*.ts`): 640 (8 Kategorien × 80), Tupel
  `[id, Frage mit {name}, Frage in du-Form, Antwort…]`, 2–4 Antworten („Entweder – oder“ genau 2), beim Laden
  mit zod geprüft (`schema.ts`). Antworten werden nicht gemischt (Reihenfolge ist oft eine Skala).
- **Gedächtnis je Handy** (`src/seen.ts`, wie beim Quiz): gestellte Fragen im localStorage
  (`couchplay.kennstdu.seen`), Meldung `{ type: "seen", ids }`; der Server zieht jede Frage erst, wenn sie dran
  ist – Kategorien reihum, darin bevorzugt Fragen, die kein aktiver Teilnehmer hatte.
- Vorschau: `npx vite --config games/kennstdu/preview/vite.config.ts` → `http://127.0.0.1:5196/?scene=tv-reveal`;
  Screenshots: `node games/kennstdu/preview/shots.mjs`.
