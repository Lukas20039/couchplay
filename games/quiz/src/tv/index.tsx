// TV-View Quiz. PLATZHALTER (Phase 1).
import { preactTvView } from "@couchplay/game-sdk/preact";
import type { QuizTvState } from "../shared.js";

export default preactTvView<QuizTvState>(({ state, players }) => (
  <div class="game-placeholder">
    <h1>Quiz</h1>
    <p>{state ? `${players.length} Spieler` : "…"}</p>
  </div>
));
