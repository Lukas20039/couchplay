# @couchplay/game-zeichnen – „Zeichnen & Raten“

Zeichen- und Ratespiel, 2–8 Spieler. Ablauf: `intro` (7 s) → je Zug `choose` (10 s) → `draw` (Zeichenzeit) →
`reveal` (7 s) → `standings` (5 s) → … → `final` (8 s) → `ctx.end`. Überspringbar (`skippable`) sind nur
Auflösung, Zwischenstand und Finale – das Intro nicht, weil die Handys darin ihre gespielten Begriffe melden.

- **Zeichner:** reihum in gemischter Reihenfolge, jede Person `turns` Mal. Wählt am Handy einen von drei Begriffen
  (möglichst aus verschiedenen Kategorien, nach Schwierigkeit gefiltert; ohne Wahl nach 10 s Zufall) und zeichnet ihn.
- **Zeichnungsdaten:** `{type:"stroke", id, color, size, points:[x,y,…]}` (0–1000, ≤ 250 Punkte je Nachricht,
  Folge-Chunks mit gleicher `id` hängen an), `undo`, `clear`. Das Handy glättet (Mindestabstand) und sendet
  höchstens alle 125 ms. Server: ≤ 6000 Punkte je Zeichnung, TV-Zustand gedrosselt (120 ms), `rev` steigt bei
  undo/clear. Die Ansicht des Zeichners enthält seine Striche (Reconnect), gedrosselt alle 2 s aufgefrischt.
- **Raten:** Freitext ≤ 40 Zeichen, ≤ 1 Tipp/s. Vergleich normalisiert (`normalizeGuess` in `src/data/schema.ts`),
  Tippfehler (Levenshtein 1 ab 5, 2 ab 9 Zeichen) → nur privat „Knapp daneben!“ und nicht auf dem TV.
  Treffer erscheinen am TV nur als „Anna hat’s! ✅“.
- **Punkte:** Rater 100/80/70/60/50 nach Reihenfolge, Zeichner 50 je Treffer (max. 200). Vorzeitige Auflösung,
  sobald alle verbundenen Rater es haben. Hinweise: nach 50 % und 75 % der Zeit je ein Buchstabe.
- **Begriffe** (`src/data/words/*.ts`): Tupel `[id, Schwierigkeit 1–3, Wort, ...Alternativen]`, beim Laden mit zod
  geprüft. Gedächtnis je Handy wie beim Quiz (`src/seen.ts`, `couchplay.zeichnen.seen`), dazu `ctx.previous.data.wordIds`.
- Vorschau: `npx vite --config games/zeichnen/preview/vite.config.ts` → `http://127.0.0.1:5213/?scene=tv-draw&n=8`;
  Screenshots: `node games/zeichnen/preview/shots.mjs`.
