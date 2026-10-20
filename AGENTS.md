# Regeln für alle Agents (CouchPlay)

Verbindlich: `docs/PLAN.md` (Entscheidungen, nicht neu verhandeln), `docs/architecture.md`, `docs/protocol.md`.

## Paketgrenzen

| Pfad | Besitzer | Andere dürfen … |
|---|---|---|
| `packages/protocol`, `packages/game-sdk`, `docs/architecture.md`, `docs/protocol.md`, Root-Configs | Architekt | nur lesen/importieren |
| `server/` (+ später `Dockerfile`, `.github/workflows/`) | Agent A | nichts ändern |
| `tv-web/`, `android-tv/` | Agent B | nichts ändern |
| `controller-pwa/` | Agent C | nichts ändern |
| `games/<id>/` | jeweiliger Spiele-Agent | nichts ändern |
| `e2e/` | Test-Agent | nichts ändern |

- Arbeite nur in deinem Paket. Brauchst du etwas aus einem fremden Paket: beim Orchestrator melden, nicht selbst ändern.
- Importe zwischen Paketen nur über die `exports` in deren `package.json` (`@couchplay/protocol`, `@couchplay/game-sdk/client`, …), nie über relative Pfade `../../`.
- Apps importieren keine anderen Apps. Spiele importieren nur `@couchplay/game-sdk`, `@couchplay/protocol`, `preact`, `zod`.

## Protokoll & Spiel-Schnittstelle

- Das WS-Protokoll wird **ausschließlich** in `packages/protocol` definiert. Keine eigenen Nachrichtentypen, keine Ad-hoc-Felder, keine duplizierten Typen in Apps.
- Änderungsbedarf (Protokoll oder `game-sdk`) → Antrag an den Orchestrator mit Begründung und Beispiel. Der Architekt ändert Code + `docs/protocol.md` + Tests gemeinsam.
- Spiellogik ist server-authoritative. Handys senden nur `game.input`; TV/Handy rendern nur empfangene Zustände.
- Spiele verwenden `ctx.rng` statt `Math.random`, `ctx.now()`/`ctx.timers` statt `Date.now`/`setTimeout`. Zustände müssen JSON-serialisierbar sein.
- Spieltests laufen über `createTestHarness` (`@couchplay/game-sdk/testing`) mit festem Seed und virtueller Uhr.

## Abhängigkeiten

- `package-lock.json` ist gemeinsam. Neue npm-Abhängigkeiten nur, wenn unvermeidbar; im Abschlussbericht nennen.
- Installation immer mit `npm install --include=dev` (Shell hat `NODE_ENV=production`).
- Host hat ~1,8 GB RAM: keine parallelen Builds, keine dauerhaft laufenden Watcher/Dev-Server im Vordergrund; gestartete Prozesse wieder beenden.

## Qualität – vor „fertig"

1. `npm run typecheck` (Root) grün.
2. `npm test` (Root) grün; neue Logik hat Vitest-Tests im eigenen Paket (`<paket>/test/`).
3. Bei UI-Änderungen: `npm run build` des Pakets erfolgreich.
4. Nichts committen, keine Git-Remotes – der Orchestrator committet.

## Sprache & Texte

- Code-Kommentare, Doku, Commit-Vorschläge: **Deutsch**. Bezeichner im Code: Englisch.
- UI ist Deutsch. **Alle UI-Texte zentral in genau einer Datei pro App**: `tv-web/src/i18n/de.ts`, `controller-pwa/src/i18n/de.ts`; Spiele: `games/<id>/src/i18n/de.ts` (für TV- und Controller-View gemeinsam). Keine Texte direkt in Komponenten.
- Fehlercodes des Servers werden im Client über `errorText(code)` übersetzt; `error.message` nie anzeigen.

## Konventionen

- TypeScript strict, ESM, `import type` für Typen (`verbatimModuleSyntax`). Relative Importe mit `.js`-Endung.
- Frontends: Preact + Vite, kleines Bundle (TV-WebView!). Spiel-Views werden per `import()` nachgeladen.
- Design: dunkel, bunte Akzente (Spielerfarben `--p0`…`--p7`), TV mit großem, klarem Fokusrahmen.
