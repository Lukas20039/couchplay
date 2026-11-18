# @couchplay/game-viergewinnt

Vier gewinnt, 1–2 Teilnehmer (weitere Spieler im Raum sind Zuschauer), Brett 7 × 6 (optional 8 × 7 oder 9 × 7).

- **Ablauf:** Ein Match besteht aus bis zu `bestOf` Partien. Wer am Zug ist, wählt am Handy eine Spalte (`aim`, der
  TV lässt den Stein über der Spalte schweben) und wirft ein (`drop`; zweites Antippen derselben Spalte oder Knopf
  „Einwerfen“). Volle Spalten sind gesperrt, Eingaben des falschen Spielers werden ignoriert (Resync der Ansicht).
  Gewinnreihen (≥ 4, auch mehrere gleichzeitig) werden am TV hervorgehoben, volles Brett = Unentschieden.
- **Best-of:** `1`/`3`/`5`. Das Match gewinnt, wer zuerst `ceil(bestOf/2)` Partien gewinnt; sind alle Partien gespielt
  (Unentschieden zählen als gespielt), entscheidet die Mehrzahl, sonst ist das Match unentschieden. Zwischen den
  Partien bleibt die Gewinnreihe 4 s stehen, das Ergebnis 6 s (beides überspringbar, Spielzüge nie).
- **Startspieler** wechselt mit jeder Partie, auch über Revanchen hinweg (Serie über `ctx.previous`, wie TicTacToe).
- **Zugzeit** (`turnTime`: aus/15/30 s, nur für Menschen): läuft sie ab, fällt ein Stein in eine zufällige freie
  Spalte (`ctx.rng`). Die Uhr steht während einer Pause und beginnt danach neu.
- **Spielbrett** (`board`, Spaßmodus): `7x6` klassisch, `8x7`, `9x7`. Gewählt statt PopOut, weil sich Regeln, KI,
  Tests und Darstellung damit ohne Sonderfälle (Wiederholungen, Doppelsieg beim Herausziehen) erweitern lassen.
- **Computer** (`difficulty`, 1 Spieler) zieht nach 0,9 s (`ctx.timers`): `leicht` – Gewinnzug, sonst Blocken, sonst
  zufällig; `mittel` – Negamax/Alpha-Beta Tiefe 4; `schwer` – iterative Vertiefung bis Tiefe 7 mit
  Transpositionstabelle, Spalten von der Mitte nach außen, erzwungenen Zügen und Bewertung aller Viererfenster
  (Drohungen in der Luft, Zeilen-Parität). Knotenbudget statt Zeitmessung (≤ 40 000 Knoten, ca. 20–80 ms), damit
  er bei festem Seed immer gleich spielt. Bei gleich guten Zügen entscheidet `ctx.rng`.
- **Verbindung:** Disconnect pausiert (auch Computer und Zugzeit), Reconnect bekommt die vollständige letzte
  Ansicht. `onPlayerLeave` → der andere gewinnt das Match kampflos.
- **Ergebnis:** `results.data` wie bei TicTacToe (`winnerId` inkl. `"bot"`, `bot`, `series`), dazu `wins`, `history`,
  `bestOf`, `board`. Ranking: Partie-Siege dieses Matches, Platz 1 bei Sieg oder Unentschieden.

| Datei | Inhalt |
|---|---|
| `src/shared.ts` | Typen, Brettregeln (Einwerfen, Gewinnreihen) – auch fürs Handy |
| `src/server/input.ts` | zod-Schema der Eingaben |
| `src/server/bot.ts` | Computer-Gegner |
| `src/server/index.ts` | Spielablauf |
| `src/ui/common.tsx` | Brett (SVG mit Löchern, Fall-Animation je Fallhöhe) + CSS für TV und Handy |
| `src/tv/`, `src/controller/` | Views (Preact, CSS als String injiziert) |
| `src/i18n/de.ts` | alle Texte |
| `preview/` | Sichtprüfung: `npx vite --config games/viergewinnt/preview/vite.config.ts` → `http://127.0.0.1:5195/?scene=tv-play`; Screenshots: `node games/viergewinnt/preview/shots.mjs` |
