# @couchplay/game-tictactoe

**Zuständig:** Spiele-Agent TicTacToe.

TicTacToe, 1–2 Teilnehmer. Platz 0 spielt X, Platz 1 spielt O.

- **1 Teilnehmer:** gegen den Computer, Setting `difficulty`:
  - `leicht` – zufällig, nimmt einen Sofortsieg nur mit 50 %, blockt nicht gezielt.
  - `mittel` – gewinnt/blockt immer, sonst 60 % optimaler Zug, 40 % zufällig.
  - `unbesiegbar` – Negamax mit Alpha-Beta + Transpositionstabelle; schneller Sieg/späte Niederlage bevorzugt.
  Zug nach 700 ms (`ctx.timers`), Zufall nur über `ctx.rng`.
- **2 Teilnehmer:** Handy gegen Handy.
- **Serie/Revanche:** Erste Partie beginnt Platz 0 (X), danach abwechselnd. Serienstand
  (`results.data.series = { key, games, draws, wins }`) wird über `ctx.previous` fortgeführt, solange dieselbe
  Paarung spielt (bei Computer: gleiche Stärke).
- **Ende:** Gewinnlinie/Banner bleiben 4 s stehen, dann `ctx.end`. Ranking enthält alle menschlichen Teilnehmer
  (auch Gegangene): Sieger Rang 1, Verlierer Rang 2, Remis beide Rang 1; `score` = Siege in der Serie. Gegen den
  Computer: Mensch Rang 1 bei Sieg/Remis, Rang 2 bei Niederlage. Der Computer steht nie im Ranking, sondern in
  `results.data` (`winnerId: "bot"`, `bot: {difficulty, mark}`); `data.players[].left` markiert Gegangene.
- **Verbindung:** Disconnect pausiert (auch den Computer), Rejoin setzt fort. Am TV wird das Brett nur gedimmt
  (Pausensymbol), den Namen meldet das Plattform-Banner von tv-web. `onPlayerLeave` → der andere Platz gewinnt kampflos.

| Datei | Inhalt |
|---|---|
| `src/shared.ts` | Input-Schema `{type:"place", cell:0..8}`, TV-State, Player-View, Ergebnisdaten |
| `src/server/board.ts` | reine Brettlogik + Computer-Gegner |
| `src/server/index.ts` | Spielablauf |
| `src/tv/`, `src/controller/` | Views (Preact, CSS als String injiziert) |
| `src/i18n/de.ts` | alle Texte |
| `preview/` | Sichtprüfung: `npx vite --config games/tictactoe/preview/vite.config.ts` → `http://localhost:5191/?scene=tv-win` (Szenen in `preview/main.tsx`) |
