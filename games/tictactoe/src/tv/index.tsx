// TV-View TicTacToe. PLATZHALTER (Phase 1).
import { preactTvView } from "@couchplay/game-sdk/preact";
import type { TicTacToeTvState } from "../shared.js";

export default preactTvView<TicTacToeTvState>(({ state, players }) => (
  <div class="game-placeholder">
    <h1>TicTacToe</h1>
    <p>{state ? `${players.length} Spieler` : "…"}</p>
  </div>
));
