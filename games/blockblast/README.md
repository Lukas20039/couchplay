# @couchplay/game-blockblast (PoC)

Blockblast im Versus-Modus, 1–8 Spieler gleichzeitig, jeder am eigenen 8 × 8-Feld.

- **Ablauf:** 3 s Countdown → Spielzeit (Setting `duration`: 2/3/5 Minuten) → 6 s Ergebnis → `ctx.end`.
  Endet früher, wenn niemand mehr legen kann.
- **Legen:** Jeder hat 3 Teile in der Hand; sind alle gelegt, kommen die nächsten 3. Alle ziehen aus
  **derselben Teile-Reihenfolge** (`PieceSequence`, eigener RNG aus `ctx.rng`) – wer gleich spielt, hat dasselbe
  Brett. Volle Reihen und Spalten verschwinden gleichzeitig. Kann man kein Teil der Hand mehr legen, ist man
  raus (Punkte bleiben).
- **Wertung:** 1 Punkt je gelegtem Feld + `10 × Linien²`, mal Combo (Räumungen in Folge, ×1 … ×5).
- **Angriffe** (Setting `attacks`, Standard an): Räumung von ≥ 2 Linien schickt `2 × (Linien − 1)` Steine,
  ab Combo 3 zusätzlich 2 – an den führenden noch aktiven Gegner (Gleichstand: zufällig). Steine landen auf
  zufälligen freien Feldern und werden mit Linien mitgeräumt.
- **Ranking:** nach Punkten, Gleichstand = gleicher Rang. Keine Pause bei Verbindungsabbruch (Echtzeit); wer geht,
  ist raus.
- **Handy:** Teil aufs Brett ziehen (schwebt über dem Finger, Vorschau rastet ein) oder antippen und dann das Feld
  der linken oberen Ecke wählen. Bis zur Server-Antwort wird der Zug vorläufig angezeigt.

Simulation (einfache Strategie, 1 Zug/s): solo ca. 35–300 Züge, Angriffe entscheiden 2-Spieler-Partien spürbar;
ohne Angriffe spielen zwei gleich starke Spieler identisch (Fairness der Reihenfolge).

| Datei | Inhalt |
|---|---|
| `src/shared.ts` | Formen, Brettlogik (`fits`, `place`), Wertung, Typen |
| `src/server/index.ts` | Spielablauf, Teile-Reihenfolge, Angriffe |
| `src/testing.ts` | `bestMove` (Heuristik für Tests, Vorschau, E2E) |
| `src/ui/common.tsx` | Brett/Teil-Komponenten + CSS |
| `src/tv/`, `src/controller/` | Views |
| `preview/` | `npx vite --config games/blockblast/preview/vite.config.ts` → `http://127.0.0.1:5195/?scene=tv-duo`; Screenshots + Bedienprobe (Ziehen/Antippen): `node games/blockblast/preview/shots.mjs` |

**Offen für nach dem PoC:** Teile so ziehen, dass meist etwas passt (wie im Original), Angriffs-Warnung mit
Verzögerung statt sofort, Sounds, README-Abschnitt mit Screenshots.
