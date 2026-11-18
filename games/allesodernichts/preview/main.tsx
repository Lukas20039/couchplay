// Preview: rendert TV- oder Controller-View mit Beispielzuständen.
// Aufruf: ?tv=spin | ?pad=decide (Schlüssel siehe samples.ts). Nur für Sichtprüfung/Screenshots.
// ?live=1 lässt bei ?tv=spin die Uhr laufen (Lauflicht in Bewegung).
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import controllerFactory from "../src/controller/index.js";
import type { AonInput } from "../src/shared.js";
import tvFactory from "../src/tv/index.js";
import { CONTROLLER_SAMPLES, LIVE_PLAYERS, NOW, TV_SAMPLES } from "./samples.js";

const params = new URLSearchParams(location.search);
const el = document.getElementById("app")!;
const startedAt = performance.now();
const base = {
  gameId: "allesodernichts",
  settings: {},
  getPlayers: () => LIVE_PLAYERS,
  getGamePlayerIds: () => LIVE_PLAYERS.map((p) => p.id),
  // Eingefroren → reproduzierbare Screenshots; mit ?live=1 läuft sie ab Spin-Start.
  serverNow: params.has("live") ? () => NOW - 2_000 + (performance.now() - startedAt) : () => NOW,
};

const tvKey = params.get("tv");
if (tvKey !== null || !params.has("pad")) {
  document.documentElement.classList.add("tv");
  const view = tvFactory();
  view.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
  const state = TV_SAMPLES[tvKey ?? "pick"];
  if (state) view.update(state);
} else {
  // Rahmen wie controller-pwa: SelfBar oben, darunter die Stage, deren Inhalt die Spiel-View füllt.
  document.documentElement.classList.add("pad");
  el.innerHTML = `<main class="screen"><div class="selfbar">🐼 Chiara</div><section class="stage"><div class="stage__view"></div></section></main>`;
  const host = el.querySelector<HTMLElement>(".stage__view")!;
  const view = controllerFactory();
  const api: ControllerViewApi<AonInput> = {
    ...base,
    kind: "controller",
    playerId: "p3",
    isHost: () => false,
    sendInput: (input) => console.log("sendInput", input),
    vibrate: (p) => console.log("vibrate", p),
  };
  view.mount(host, api);
  const sample = CONTROLLER_SAMPLES[params.get("pad") ?? "pick"];
  if (sample) view.update(sample);
}
