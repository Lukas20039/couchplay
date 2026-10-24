// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, type KdPlayerView, type KdTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<KdTvState, KdPlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule"];
const players = makePlayers(5).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));

function game_(categories: string[]): H {
  const h = createTestHarness<KdTvState, KdPlayerView>(game, { players, settings: { categories, turns: 2, answerSeconds: 25 }, seed: 11 });
  return h;
}
const askState = (h: H) => {
  h.advance(TIMING.introMs);
  return h.lastTv() as Extract<KdTvState, { phase: "ask" }>;
};
function revealed(categories: string[]): H {
  const h = game_(categories);
  const s = askState(h);
  h.input(s.hotseat.id, { type: "answer", index: 1 });
  h.players.filter((p) => p.id !== s.hotseat.id).forEach((p, i) => h.input(p.id, { type: "answer", index: i % 3 === 0 ? 1 : i % s.answers.length }));
  return h;
}
const hotOf = (h: H) => (h.lastTv() as { hotseat: { id: string } }).hotseat.id;
const guessOf = (h: H) => h.players.find((p) => p.id !== hotOf(h))!.id;

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => { h: H; me?: (h: H) => string } }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: game_(["alltag"]) }) },
  "tv-ask": {
    kind: "tv",
    build() {
      const h = game_(["alltag"]);
      const s = askState(h);
      h.input(s.hotseat.id, { type: "answer", index: 2 });
      h.input(guessOf(h), { type: "answer", index: 0 });
      return { h };
    },
  },
  "tv-reveal": { kind: "tv", build: () => ({ h: revealed(["essen"]) }) },
  "tv-either": {
    kind: "tv",
    build: () => {
      const h = game_(["entweder"]);
      askState(h);
      return { h };
    },
  },
  "tv-standings": {
    kind: "tv",
    build() {
      const h = revealed(["freizeit"]);
      h.advance(TIMING.revealMs);
      return { h };
    },
  },
  "ctl-hot": {
    kind: "ctl",
    build() {
      const h = game_(["persoenlichkeit"]);
      askState(h);
      return { h, me: hotOf };
    },
  },
  "ctl-guess": {
    kind: "ctl",
    build() {
      const h = game_(["waswaerewenn"]);
      askState(h);
      return { h, me: guessOf };
    },
  },
  "ctl-either": {
    kind: "ctl",
    build() {
      const h = game_(["entweder"]);
      askState(h);
      return { h, me: guessOf };
    },
  },
  "ctl-reveal": { kind: "ctl", build: () => ({ h: revealed(["reisen"]), me: guessOf }) },
  "ctl-reveal-hot": { kind: "ctl", build: () => ({ h: revealed(["reisen"]), me: hotOf }) },
};

const FRAME_TV = `
:root { --bg:#120f24; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
html { font-size: calc(100vh / 60); }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: #f8f4ff; font-family: Roboto, "Segoe UI", Arial, system-ui, sans-serif; }
#root { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
`;
const FRAME_CTL = `
:root { --bg:#14112a; --text:#f8f4ff; --ink:#120f24; --p0:#ff4d4d; --p1:#4da6ff; --p2:#4dff88; --p3:#ffd24d; --p4:#c34dff; color-scheme: dark; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font: 16px/1.4 ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif; }
.screen { min-height: 100%; display: flex; flex-direction: column; padding: 12px 20px 0; max-width: 560px; margin: 0 auto; }
.selfbar { display: flex; align-items: center; margin: -12px -20px 0; padding: 14px 20px; background: var(--p0); color: var(--ink); border-radius: 0 0 28px 28px; font-weight: 800; font-size: 1.25rem; }
.stage { flex: 1 0 auto; display: flex; flex-direction: column; margin: 0 -20px; }
.stage__view { flex: 1; display: flex; flex-direction: column; padding: 16px; }
`;

function main(): void {
  const name = new URLSearchParams(location.search).get("scene") ?? "tv-ask";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, me } = scene.build();
  const roomPlayers: Player[] = h.players.map((p, i) => ({ ...p, connected: true, isHost: i === 0 }));
  const s = h.lastTv()!;
  const clock = "endsAt" in s ? s.endsAt - 9_000 : 0;
  const base = { gameId: "kennstdu", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
  const style = document.createElement("style");
  style.textContent = scene.kind === "tv" ? FRAME_TV : FRAME_CTL;
  document.head.appendChild(style);
  if (scene.kind === "tv") {
    const v = tvView();
    v.mount(root, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(s);
    return;
  }
  const id = me!(h);
  const self = roomPlayers.find((p) => p.id === id)!;
  root.innerHTML = `<main class="screen"><div class="selfbar" style="background:var(--p${self.color})">${self.name}</div><section class="stage"><div class="stage__view"></div></section></main>`;
  const v = controllerView();
  v.mount(root.querySelector<HTMLElement>(".stage__view")!, {
    ...base,
    kind: "controller",
    playerId: id,
    isHost: () => false,
    sendInput: (input) => console.log("sendInput", input),
    vibrate: () => {},
  } satisfies ControllerViewApi);
  v.update(h.lastView(id)!);
}

main();
