# Stadt, Land, Fluss (`stadtland`)

Server-authoritative Partyspiel für 2–8 Spieler: Ein Buchstabe, 5–6 Kategorien, die Uhr läuft. Der TV zeigt
Buchstabe, Kategorien, Fortschritt und die gemeinsame Prüfung; die Handys sind Eingabefelder und Stimmzettel.

## Ablauf

`[setup] → intro → (letter → write → timeup → review × Kategorien → standings)* → final`

| Phase | Inhalt | überspringbar |
|---|---|---|
| `setup` | nur mit Set „Eigene Kategorien“: Host legt 3–6 Kategorien fest (max. 120 s) | ja |
| `intro` | Regeln, bei eigenem Set die Kategorienliste | ja |
| `letter` | Walze am TV; die Handys kennen den Buchstaben erst danach | nein |
| `write` | Antworten tippen; wer alles ausgefüllt hat, ruft „Stopp!“ (dann noch 5 s) | nein |
| `timeup` | „Stifte weg!“ – Gnadenfrist für verspätete Eingaben | nein |
| `review` | Kategorie für Kategorie prüfen, abstimmen, „Passt – weiter“ | ja |
| `standings`, `final` | Zwischenstand, Podium und Auszeichnungen | ja |

Wertung je Kategorie: einzige gültige Antwort 20, einzigartig 10, doppelt (normalisiert gleich) 5, sonst 0.

## Einstellungen (`manifest.json`)

- `set`: klassisch, essen, popkultur, quatsch, gemischt, **eigene**
- `rounds`, `roundSeconds`, `categoryCount` (bei `eigene` ohne Bedeutung – jede Runde spielt alle eigenen Kategorien)
- `check` – **Lexikon-Prüfung**: `streng` (Standard), `hinweis` („Nur markieren“), `aus`. Kurze Labels, weil die
  App Selects mit ≤ 4 Optionen als Segmente zeigt; die Erklärung steht in den Intro-Regeln am TV.

## Lexikon-Prüfung

Nur der Server fragt die Wortlisten (`src/server/lexicon/`, `lookupAnswer(category, text)`); `scoring.ts`, `shared.ts`
und die Views importieren sie nie – die Listen landen nicht in TV-/Handy-Bundles. Der Server reicht das Ergebnis je
Antwort als `RawAnswer.lexicon` an `scoreCategory` weiter (und cacht es je Partie).

Für Antworten, die die automatische Prüfung bestehen (nicht leer, nicht zu kurz, richtiger Buchstabe):

| Lexikon | `streng` | `hinweis` | `aus` |
|---|---|---|---|
| `known` | gilt, Markierung „✓ im Lexikon“ | gilt, markiert | gilt |
| `unknown` | **zunächst gestrichen** („nicht im Lexikon“), per Mehrheit 👍 rettbar | gilt, markiert „? nicht im Lexikon“ | gilt |
| `null` (Kategorie ohne Liste, eigene Kategorie ohne Zuordnung) | gilt | gilt | gilt |

- Jede Gruppe gleicher Antworten hat eine **Voreinstellung** (`SlEntry.preset`: gilt / gestrichen). Eine Gruppe
  gilt als bekannt, sobald eine ihrer Schreibweisen bekannt ist.
- Stimmberechtigt sind alle aktiven Spieler, die die Antwort nicht selbst gegeben haben. Erreichen die Stimmen gegen
  die Voreinstellung deren Mehrheit (`neededVotes`), kippt sie: gültig → „gestrichen“ (👎), gestrichen → „gerettet“ (👍).
  Ohne Stimmberechtigte bleibt es bei der Voreinstellung (z. B. alle haben dasselbe Unbekannte geschrieben).
- Die Punkte richten sich nach dem Endergebnis; gestrichene Antworten zählen nicht für „einzige gültige Antwort“.
- Status: `ok` (zählt; `preset === false` heißt „gerettet“), `rejected` (per 👎 gestrichen), `unlisted` (nicht im
  Lexikon, nicht gerettet), sonst automatisch `empty`/`short`/`letter`.
- Prüfdauer: Kategorien ohne anfechtbare oder rettbare Antwort bleiben kurz (`reviewEmptyMs`).
- Auszeichnung „Strengste Jury“ zählt nur 👎-Stimmen (gegen gültig voreingestellte Antworten), keine 👍-Rettungen.

## Eigene Kategorien (Phase `setup`)

- Das Protokoll kennt keine Freitext-Settings – deshalb legt das **Host-Handy** (`api.isHost()`) die Liste im Spiel fest:
  3–6 Felder (je höchstens 28 Zeichen), vorbelegt mit der zuletzt bestätigten Liste aus `localStorage`
  (`couchplay.stadtland.custom`), sonst „Stadt, Land, Fluss, Name, Beruf, Tier“; Felder hinzufügen/entfernen,
  Vorschlags-Chips aller eingebauten Kategorien, „Los geht’s!“. Der Stand geht entprellt an den Server; TV und die
  anderen Handys zeigen ihn live („Anna legt die Kategorien fest …“). Nur beim Bestätigen speichert das Host-Handy die Liste.
- Der Server kennt den Host nicht (`GamePlayer` hat kein `isHost`) und nimmt `custom` deshalb von **jedem** aktiven
  Spieler an; nur das Host-Handy zeigt den Editor.
- Bereinigung (`cleanCategoryList`): wie Antworten säubern, leere/nur Satzzeichen raus, Doppelte (gleicher
  Vergleichsschlüssel) raus, höchstens 6.
- Ende: „Los geht’s!“ (`done`, nur mit ≥ 3 Einträgen), Zeitablauf (120 s) oder Skip am TV/Host. Dann gilt die zuletzt
  empfangene Liste – mit weniger als 3 Einträgen bzw. ohne Eingabe wird klassisch gespielt.
- Namen, die einer eingebauten Kategorie oder einem naheliegenden Alias entsprechen („Städte“, „Tiere“, „Vorname“,
  „Länder“, „Obst“, „Gemüse“, „Getränke“ …, siehe `matchCategory` in `src/custom.ts`), werden auf sie abgebildet und
  bekommen die Lexikon-Prüfung; alle anderen sind nicht prüfbar.
- Runden-Kategorien sind `SlCategory = { id: CategoryId; custom: null } | { id: CategoryId | null; custom: string }`;
  Anzeige über `categoryLabel()` (`src/i18n/de.ts`). Eigene Namen werden so gezeigt, wie der Host sie getippt hat.
- Ergebnisdaten (`SlResultData`) enthalten zusätzlich `check` und bei eigenem Set `custom` (gespielte Namen).

## Eingaben (`game.input.data`, Schema `src/server/input.ts`)

| `type` | Felder | wann |
|---|---|---|
| `custom` | `categories: string[]` (≤ 6, roh ≤ 120 Zeichen), `done: boolean` | `setup` |
| `answers` | `round`, `answers: string[]` (≤ 6) | `write`, `timeup` |
| `stop` | `round` | `write`, alle Felder ausgefüllt |
| `challenge` | `round`, `category`, `key`, `on` – Stimme gegen die Voreinstellung (👎 bzw. 👍) | `review` |
| `ready` | `round`, `category` | `review` |

## Entwicklung

- Tests: `npm test -w @couchplay/game-stadtland` (Vitest; Servertests mocken das Lexikon-Modul bzw. nutzen
  `createStadtlandGame(fakeLookup)`).
- Vorschau: `npx vite --config preview/vite.config.ts` (im Paketordner), Szenen per `?scene=…` (u. a. `tv-setup`,
  `tv-intro-custom`, `tv-review-lexicon`, `ctl-setup-host`, `ctl-setup-guest`, `ctl-review-lexicon`). Die Vorschau
  ersetzt das Lexikon-Modul durch einen Platzhalter und nutzt ein Fake-Lexikon.
  Screenshots: `node games/stadtland/preview/shots.mjs` (Repo-Root) → `.jait/shots/stadtland-*.png`. Die Vorschau
  blendet in überspringbaren Phasen eine Attrappe des „Weiter ⏭“-Knopfs von tv-web bzw. controller-pwa ein; das
  Skript meldet Inhalte, die er verdecken würde. Freigehalten werden: TV-Prüfung (Fußzeile/Zeitbalken rechts),
  TV-Finale (Abstand unten), Host-Handy in der Prüfung („Passt – weiter“ rechts eingerückt) und im Setup.
