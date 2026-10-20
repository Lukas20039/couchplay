// Serverlogik TicTacToe. PLATZHALTER (Phase 1): zeigt einen Platzhalter und endet,
// sobald ein Spieler { type: "finish" } sendet. Wird vom Spiele-Agent ersetzt.
import { defineGame } from "@couchplay/game-sdk";
import manifest from "../../manifest.json" with { type: "json" };
import { TicTacToeInputSchema, type TicTacToeInput, type TicTacToePlayerView, type TicTacToeTvState } from "../shared.js";

export default defineGame<Record<string, unknown>, TicTacToeInput, TicTacToeTvState, TicTacToePlayerView>({
  manifest,
  inputSchema: TicTacToeInputSchema,
  createGame(ctx) {
    ctx.broadcastTv({ phase: "placeholder", playerIds: ctx.players.map((p) => p.id) });
    ctx.sendToAllPlayers(() => ({ phase: "placeholder" }));
    return {
      onPlayerInput(_playerId, input) {
        if (input.type === "finish") {
          ctx.end({ ranking: ctx.players.map((p) => ({ playerId: p.id, score: 0, rank: 1 })) });
        }
      },
      onPlayerLeave() {
        if (ctx.activePlayerIds().length === 0) ctx.end({ ranking: [] });
      },
    };
  },
});
