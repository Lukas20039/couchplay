// Preview: rendert TV- oder Controller-View mit Beispielzuständen.
// Aufruf: ?tv=round | ?pad=round (Schlüssel siehe samples.ts). Nur für Sichtprüfung/Screenshots.
// ?live=1 lässt die Uhr laufen (sonst eingefroren für reproduzierbare Screenshots).
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import controllerFactory from "../src/controller/index.js";
import type { WgInput } from "../src/shared.js";
import tvFactory from "../src/tv/index.js";
import { CONTROLLER_SAMPLES, LIVE_PLAYERS, NOW, TV_SAMPLES } from "./samples.js";

const params = new URLSearchParams(location.search);
const el = document.getElementById("app")!;
const started = Date.now();
const base = {
  gameId: "wortgarten",
  settings: {},
  getPlayers: () => LIVE_PLAYERS,
  getGamePlayerIds: () => LIVE_PLAYERS.map((p) => p.id),
  serverNow: params.has("live") ? () => NOW + (Date.now() - started) : () => NOW,
};

const tvKey = params.get("tv");
if (tvKey !== null || !params.has("pad")) {
  document.documentElement.classList.add("tv");
  const view = tvFactory();
  view.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
  const state = TV_SAMPLES[tvKey ?? "round"];
  if (state) view.update(state);
} else {
  // Rahmen wie controller-pwa: SelfBar oben, darunter die Stage, deren Inhalt die Spiel-View füllt.
  document.documentElement.classList.add("pad");
  el.innerHTML = `<main class="screen"><div class="selfbar">🐼 Chiara</div><section class="stage"><div class="stage__view"></div></section></main>`;
  const host = el.querySelector<HTMLElement>(".stage__view")!;
  const view = controllerFactory();
  const sent: WgInput[] = [];
  (window as unknown as { __sent: WgInput[] }).__sent = sent;
  const api: ControllerViewApi<WgInput> = {
    ...base,
    kind: "controller",
    playerId: "p3",
    isHost: () => false,
    sendInput: (input) => {
      sent.push(input);
      console.log("sendInput", JSON.stringify(input));
    },
    vibrate: () => {},
  };
  view.mount(host, api);
  const sample = CONTROLLER_SAMPLES[params.get("pad") ?? "round"];
  if (sample) view.update(sample);
}
