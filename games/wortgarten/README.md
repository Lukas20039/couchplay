# @couchplay/game-wortgarten

**Zuständig:** Spiele-Agent Wortgarten.

Gemütliches Wortsuch-Battle, 1–8 Teilnehmer. Alle spielen gleichzeitig auf demselben Buchstabenraster
(TV zeigt es groß, jedes Handy hat es zum Wischen). Wörter entstehen aus benachbarten Feldern –
**waagrecht, senkrecht und schräg** –, jedes Feld höchstens einmal pro Wort.

## Ablauf

`intro` (9 s) → (`round` → `roundEnd` 15 s) × Runden → `final` (14 s) → `ctx.end`.

- **Handy:** über die Buchstaben wischen (Loslassen schickt ab, Zurückziehen nimmt das letzte Feld
  weg) oder Felder nacheinander antippen und das letzte nochmal tippen. Rückmeldung sofort:
  Punkte mit Multiplikator, „schon gefunden“, „kein Wort“, „zu kurz“.
- **TV während der Runde:** Raster, Countdown und je Spieler ein Beet mit einer Blume pro Wort
  (Größe nach Wortlänge) – die Wörter selbst bleiben geheim.
- **Ernte (Rundenende):** Wörter aller Spieler, ★ einzigartig, geteilte gedimmt, längstes Wort,
  bis zu 6 verpasste Wörter (Grundformen bevorzugt), Anzahl aller Wörter im Raster.

## Wertung

| Länge | 3 | 4 | 5 | 6 | 7 | 8 | 9+ |
|---|---|---|---|---|---|---|---|
| Punkte | 1 | 2 | 4 | 6 | 9 | 12 | 12 + 4 je weiterem Buchstaben |

- +1 je seltenem Buchstaben (Ä, Ö, Ü, J, V, X, Y)
- **Goldfeld** im Wort: ×2
- **Combo:** gültige Wörter im Abstand von höchstens 8 s (Blitz: 5 s) → ab dem 3. Wort ×1,5, ab dem 6. ×2
  (Blitz: ×2 / ×3); ein falsches Wort beendet die Serie
- **Langwort-Modus:** ×2
- **Einzigartig** (nur eine Person hat das Wort, ab 2 Teilnehmern): ×2, verrechnet am Rundenende

Punkte = ⌈(Grundpunkte + Seltenheit) × Gold × Combo × Modus⌉, danach ggf. × 2 für einzigartig.

## Gartenstufen (Freischaltungen)

Die Erfahrung (= erspielte Punkte, aufsummiert) speichert jedes Handy im `localStorage`
(`couchplay.wortgarten.xp`) und meldet sie im Intro (`{type:"hello", xp}`). Die Stufe des Raums ist die
der erfahrensten Person; innerhalb eines Raums wird sie zusätzlich über `ctx.previous` (`data.xp`)
weitergegeben, falls ein Handy nichts speichern kann.

| Stufe | ab Erfahrung | neu |
|---|---|---|
| 1 | 0 | 4 × 4, Klassisch |
| 2 | 40 | 💡 1 Tipp pro Runde (Startfeld, Länge, erste zwei Buchstaben) |
| 3 | 120 | 5 × 5 |
| 4 | 250 | ✨ Goldfelder |
| 5 | 420 | ⚡ Blitz-Modus (halbe Zeit, mind. 45 s) |
| 6 | 650 | 6 × 6 |
| 7 | 950 | 📜 Langwort-Modus (ab 5 Buchstaben, ×2) |
| 8 | 1300 | 2 Tipps pro Runde |

Settings `mode` und `gridSize` sind Wünsche: Gesperrtes fällt auf das Freigeschaltete zurück
(Hinweis 🔒 im Intro). `gridSize: auto` = größtes freigeschaltetes Raster.

## Wortliste

≈ 410 000 deutsche Wortformen (inkl. Plural, Verb- und Adjektivformen) aus dem LanguageTool-Wörterbuch,
**CC BY-SA 4.0** – siehe [`DATA-LICENSE.md`](DATA-LICENSE.md). Sie steckt nur im Server-Bundle
(`src/server/wordlist.data.ts`, 1 MB, front-codiert) und wird beim ersten Spiel in ~0,15 s entpackt
(≈ 40 MB Heap). Neu erzeugen: siehe Kopf von `tools/build-wordlist.mjs`.

Raster: Buchstaben nach deutscher Häufigkeit (kein Q, 30–50 % Vokale); von bis zu 40 Kandidaten
gewinnt der erste mit genug Wörtern (4×4: 70, 5×5: 160, 6×6: 260), sonst der ergiebigste.

| Datei | Inhalt |
|---|---|
| `src/shared.ts` | Typen, Wertung, Pfadprüfung, Gartenstufen (ohne zod/Wortliste → kleine View-Bundles) |
| `src/server/input.ts` | zod-Schema der Eingaben |
| `src/server/dictionary.ts`, `grid.ts` | Wörterbuch, Raster erzeugen/lösen |
| `src/server/index.ts` | Spielablauf |
| `src/tv/`, `src/controller/` | Views (Preact, CSS als String injiziert) |
| `src/testing.ts` | `wordsInGrid()` für E2E-Tests |
| `preview/` | Sichtprüfung: `npx vite --config games/wortgarten/preview/vite.config.ts` → `http://127.0.0.1:5193/?tv=round` bzw. `?pad=round`; `node games/wortgarten/preview/shots.mjs` macht Screenshots und prüft Wischen (schräg, zurück, Tippen) |
