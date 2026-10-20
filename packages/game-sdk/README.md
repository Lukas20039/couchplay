# @couchplay/game-sdk

**Zuständig:** Architekt. Andere Agents: nur importieren; Änderungen per Antrag.

| Export | Für | Inhalt |
|---|---|---|
| `@couchplay/game-sdk` | Server, Spiel-Serverlogik | `defineGame`, `GameDefinition`, `GameContext`, `GameInstance`, `createGameSession`, `createRng`, `systemClock`, `ManualClock` |
| `@couchplay/game-sdk/client` | Apps, Spiel-Views | `GameTvView`, `GameControllerView`, `TvViewApi`, `ControllerViewApi`, Factory-/Loader-Typen |
| `@couchplay/game-sdk/preact` | Spiel-Views | `preactTvView(Component)`, `preactControllerView(Component)` |
| `@couchplay/game-sdk/testing` | Spieltests | `createTestHarness(def, { players, settings, seed, previous })`, `makePlayers(n)` |

## Ein Spiel schreiben

```
games/<id>/
  manifest.json            id, name, minPlayers, maxPlayers, botSupport, settings[]
  src/shared.ts            Input-Schema (zod) + TV-State-/View-Typen
  src/i18n/de.ts           alle Texte des Spiels
  src/server/index.ts      export default defineGame({ manifest, inputSchema, createGame(ctx) { … } })
  src/tv/index.tsx         export default preactTvView(Component)
  src/controller/index.tsx export default preactControllerView(Component)
  test/*.test.ts           createTestHarness(...)
```

Regeln: nur `ctx.rng`, `ctx.now()`, `ctx.timers`; Zustände JSON-serialisierbar; `broadcastTv` sendet immer den **vollständigen** TV-Zustand (ersetzt den vorherigen, wird für Reconnects gecached), ebenso `sendToPlayer`.
