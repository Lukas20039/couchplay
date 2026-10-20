// Controller-View Quiz. PLATZHALTER (Phase 1).
import { preactControllerView } from "@couchplay/game-sdk/preact";
import type { QuizInput, QuizPlayerView } from "../shared.js";

export default preactControllerView<QuizPlayerView, QuizInput>(({ api }) => (
  <div class="game-placeholder">
    <button type="button" onClick={() => api.sendInput({ type: "finish" })}>
      Beenden
    </button>
  </div>
));
