// Preview: rendert TV- oder Controller-View mit Beispielzuständen.
// Aufruf: ?tv=question | ?pad=locked (Schlüssel siehe samples.ts). Nur für Sichtprüfung/Screenshots.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import controllerFactory from "../src/controller/index.js";
import type { QuizInput } from "../src/shared.js";
import tvFactory from "../src/tv/index.js";
import { CONTROLLER_SAMPLES, LIVE_PLAYERS, NOW, TV_SAMPLES } from "./samples.js";

const params = new URLSearchParams(location.search);
const el = document.getElementById("app")!;
const base = {
  gameId: "quiz",
  settings: {},
  getPlayers: () => LIVE_PLAYERS,
  getGamePlayerIds: () => LIVE_PLAYERS.map((p) => p.id),
  serverNow: () => NOW, // eingefroren → reproduzierbare Screenshots
};

const tvKey = params.get("tv");
if (tvKey !== null || !params.has("pad")) {
  document.documentElement.classList.add("tv");
  const view = tvFactory();
  view.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
  const state = TV_SAMPLES[tvKey ?? "question"];
  if (state) view.update(state);
} else {
  const view = controllerFactory();
  const api: ControllerViewApi<QuizInput> = {
    ...base,
    kind: "controller",
    playerId: "p3",
    isHost: () => false,
    sendInput: (input) => console.log("sendInput", input),
    vibrate: (p) => console.log("vibrate", p),
  };
  view.mount(el, api);
  const sample = CONTROLLER_SAMPLES[params.get("pad") ?? "question"];
  if (sample) view.update(sample);
}
