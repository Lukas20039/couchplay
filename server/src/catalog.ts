// Spielkatalog: Registry der Spieldefinitionen + Manifeste für Clients.
import type { AnyGameDefinition } from "@couchplay/game-sdk";
import type { GameManifest, ServerMessageOf } from "@couchplay/protocol";

export class GameCatalog {
  private readonly byId = new Map<string, AnyGameDefinition>();
  readonly manifests: readonly GameManifest[];
  readonly message: ServerMessageOf<"catalog">;

  constructor(games: readonly AnyGameDefinition[]) {
    for (const def of games) {
      const id = def.manifest.id;
      if (this.byId.has(id)) throw new Error(`Spiel-ID doppelt registriert: ${id}`);
      this.byId.set(id, def);
    }
    this.manifests = games.map((g) => g.manifest);
    this.message = { t: "catalog", games: [...this.manifests] };
  }

  get(id: string): AnyGameDefinition | undefined {
    return this.byId.get(id);
  }
}
