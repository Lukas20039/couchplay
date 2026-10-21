// Controller-Views der eingebauten Spiele, per dynamischem import() nachgeladen (eigene Chunks).
// Neues Spiel: eine Zeile ergänzen.
import type { ControllerViewFactory, ViewModuleLoader } from "@couchplay/game-sdk/client";

export const CONTROLLER_VIEWS: Record<string, ViewModuleLoader<ControllerViewFactory>> = {
  quiz: () => import("@couchplay/game-quiz/controller"),
  tictactoe: () => import("@couchplay/game-tictactoe/controller"),
  wortgarten: () => import("@couchplay/game-wortgarten/controller"),
};
