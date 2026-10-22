// Testdaten für tv-web.
import type { GameManifest, Player, RoomState } from "@couchplay/protocol";

export function player(id: string, extra: Partial<Player> = {}): Player {
  return { id, name: id.toUpperCase(), avatar: "fuchs", color: 0, connected: true, isHost: false, ...extra };
}

export const quiz: GameManifest = {
  id: "quiz",
  name: "Quiz",
  description: "",
  version: "0.1.0",
  minPlayers: 1,
  maxPlayers: 8,
  botSupport: false,
  settings: [
    {
      type: "multiselect",
      key: "categories",
      label: "Kategorien",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
      default: ["a", "b", "c"],
      minSelected: 1,
    },
    { type: "number", key: "rounds", label: "Fragen", min: 5, max: 30, step: 5, default: 10 },
    { type: "toggle", key: "bonus", label: "Bonus", default: true },
  ],
};

export const ttt: GameManifest = {
  id: "tictactoe",
  name: "TicTacToe",
  description: "",
  version: "0.1.0",
  minPlayers: 1,
  maxPlayers: 2,
  botSupport: true,
  settings: [
    {
      type: "select",
      key: "difficulty",
      label: "Stärke",
      options: [
        { value: "leicht", label: "Leicht" },
        { value: "mittel", label: "Mittel" },
      ],
      default: "mittel",
    },
  ],
};

export function room(extra: Partial<RoomState> = {}): RoomState {
  return {
    progress: {},
    code: "042137",
    phase: "lobby",
    joinUrl: "http://192.168.1.5:8080/j/042137",
    players: [],
    hostId: null,
    tvConnected: true,
    selectedGameId: null,
    playerLimits: null,
    settings: {},
    gamePlayerIds: [],
    results: null,
    ...extra,
  };
}
