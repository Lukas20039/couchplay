// Controller-View TicTacToe. PLATZHALTER (Phase 1).
import { preactControllerView } from "@couchplay/game-sdk/preact";
import type { TicTacToeInput, TicTacToePlayerView } from "../shared.js";

export default preactControllerView<TicTacToePlayerView, TicTacToeInput>(({ api }) => (
  <div class="game-placeholder">
    <button type="button" onClick={() => api.sendInput({ type: "finish" })}>
      Beenden
    </button>
  </div>
));
