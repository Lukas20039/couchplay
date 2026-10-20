// Dummy-Spiel für Integrationstests: Punkte sammeln, bis `target` erreicht ist.
// "crash" wirft absichtlich eine Exception (Crash-Isolation).
import { defineGame } from "@couchplay/game-sdk";
import { z } from "zod";

const InputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("point") }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("crash") }),
  /** Großer TV-Zustand (Backpressure-Test). */
  z.object({ type: z.literal("blob"), size: z.number().int().min(1).max(15_000) }),
]);

export interface TestTvState {
  scores: Record<string, number>;
  previousWinner: string | null;
}

export const testGame = defineGame<{ target: number }, z.infer<typeof InputSchema>, TestTvState, { mine: number }>({
  manifest: {
    id: "testgame",
    name: "Testspiel",
    description: "Nur für Tests",
    version: "1.0.0",
    minPlayers: 1,
    maxPlayers: 3,
    botSupport: false,
    settings: [{ type: "number", key: "target", label: "Ziel", min: 1, max: 10, default: 2 }],
  },
  inputSchema: InputSchema,
  parseSettings: (v) => ({ target: Number(v.target) }),
  createGame(ctx) {
    const scores: Record<string, number> = Object.fromEntries(ctx.players.map((p) => [p.id, 0]));
    const previousWinner = ctx.previous?.ranking.find((r) => r.rank === 1)?.playerId ?? null;
    const push = (): void => {
      ctx.broadcastTv({ scores: { ...scores }, previousWinner });
      ctx.sendToAllPlayers((p) => ({ mine: scores[p.id] ?? 0 }));
    };
    const finish = (): void => {
      const ranking = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([playerId, score], i) => ({ playerId, score, rank: i + 1 }));
      ctx.end({ ranking, data: { scores } });
    };
    push();
    return {
      onPlayerInput(playerId, input) {
        if (input.type === "crash") throw new Error("Absichtlicher Testabsturz");
        if (input.type === "finish") return finish();
        if (input.type === "blob") {
          ctx.broadcastTv({ scores: { ...scores }, previousWinner, blob: "x".repeat(input.size) } as TestTvState);
          return;
        }
        scores[playerId] = (scores[playerId] ?? 0) + 1;
        push();
        if ((scores[playerId] ?? 0) >= ctx.settings.target) finish();
      },
      onPlayerLeave() {
        if (ctx.activePlayerIds().length === 0) finish();
      },
      onPlayerConnectionChange() {
        push();
      },
    };
  },
});
