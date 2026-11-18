# Alles oder nichts (`games/allesodernichts`)

Knifflige Fragen mit vier Antworten. Alle tippen geheim oder enthalten sich, danach streicht ein
Lauflicht am TV Runde für Runde eine falsche Antwort. Wer noch drin ist, steigt aus (+1 bzw. +2) oder
zockt weiter; bis zum Schluss durchhalten bringt +3, als Einziger +1 Bonus. Fliegt die eigene Antwort in
Elimination k raus, gibt es −k.

## Ablauf (Server, `src/server/index.ts`)

`intro → (pick → spin → decide → spin → decide → spin → reveal → standings)* → final → ctx.end()`

- **pick** (Antwortzeit aus den Settings): `pick`/`abstain`, je Spieler einmal. Wer nicht tippt, gilt als enthalten.
  Endet vorzeitig, wenn alle verbundenen Spieler gewählt haben.
- **spin** (`TIMING.spinMs`, nicht überspringbar): Der Server zieht per `ctx.rng` eine falsche Antwort und den
  Weg des Lauflichts (`src/spin.ts`). Nur der TV bekommt den Weg; die Handys erfahren das Ergebnis danach.
- **decide** (`TIMING.decideMs`): `decide { stay }`. Ohne Entscheidung wird ausgestiegen. Ist niemand mehr
  drin, folgt sofort die Auflösung.
- **reveal / standings / final**: überspringbare Wartezeiten.

Die richtige Antwort steht nur in den Zuständen der Phase `reveal`.

## Fragen

`src/data/questions/*.ts`, je Kategorie ~195 Tupel `[id, Frage, richtig, falsch, falsch, falsch]`
(richtige Antwort immer zuerst, gemischt wird im Spiel). `test/questions.test.ts` prüft Schema, Längen,
Dubletten und dass die Antwort nicht in der Frage steht. Jedes Handy meldet seine schon gesehenen Fragen
(`src/seen.ts`), bevorzugt werden Fragen, die kein Mitspieler kennt.

## Preview

```
npx vite --config games/allesodernichts/preview/vite.config.ts     # http://127.0.0.1:5197/?tv=spin&live=1
node games/allesodernichts/preview/shots.mjs                       # Screenshots nach .jait/shots/
```
