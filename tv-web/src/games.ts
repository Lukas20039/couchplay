// TV-Views der eingebauten Spiele, per dynamischem import() nachgeladen (eigene Chunks).
// Neues Spiel: eine Zeile ergänzen.
import type { TvViewFactory, ViewModuleLoader } from "@couchplay/game-sdk/client";

export const TV_VIEWS: Record<string, ViewModuleLoader<TvViewFactory>> = {
  quiz: () => import("@couchplay/game-quiz/tv"),
  tictactoe: () => import("@couchplay/game-tictactoe/tv"),
  wortgarten: () => import("@couchplay/game-wortgarten/tv"),
  schiffe: () => import("@couchplay/game-schiffe/tv"),
  blockblast: () => import("@couchplay/game-blockblast/tv"),
  kennstdu: () => import("@couchplay/game-kennstdu/tv"),
};
