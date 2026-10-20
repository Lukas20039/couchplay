// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik
// (über das Test-Harness). Aufruf: /?scene=<name>  – Liste siehe SCENES.
// Rahmen-CSS ahmt tv-web bzw. controller-pwa nach (Farben, rem-Basis, Kopfleiste).
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { Player } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import game, { BOT_DELAY_MS } from "../src/server/index.js";
import type { TicTacToePlayerView, TicTacToeTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<TicTacToeTvState, TicTacToePlayerView>;

const NAMES = ["Anna", "Ben"];
const AVATARS = ["fuchs", "panda"] as const;
const COLORS = [0, 1];
const gamePlayers = makePlayers(2).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: COLORS[i]! }));

const roomPlayers = (offline: string[] = []): Player[] =>
  gamePlayers.map((p, i) => ({ ...p, connected: !offline.includes(p.id), isHost: i === 0 }));

const pvp = (previous: Parameters<typeof createTestHarness>[1] = {}) =>
  createTestHarness<TicTacToeTvState, TicTacToePlayerView>(game, { players: gamePlayers, ...previous });
const bot = (difficulty: string) =>
  createTestHarness<TicTacToeTvState, TicTacToePlayerView>(game, { players: [gamePlayers[0]!], settings: { difficulty } });
const moves = (h: H, list: [string, number][]) => list.forEach(([p, c]) => h.input(p, { type: "place", cell: c }));

interface Scene {
  kind: "tv" | "ctl";
  build(): { h: H; offline?: string[]; me?: string };
}

/** Zweite Partie einer Serie, in der Anna die erste gewonnen hat. */
function series(): H {
  const g1 = pvp();
  moves(g1, [["p1", 4], ["p2", 0], ["p1", 2], ["p2", 1], ["p1", 6]]);
  g1.advance(5000);
  return pvp({ previous: g1.results });
}

const SCENES: Record<string, Scene> = {
  "tv-playing": {
    kind: "tv",
    build() {
      const h = series(); // Ben beginnt
      moves(h, [["p2", 4], ["p1", 0], ["p2", 2]]);
      return { h };
    },
  },
  "tv-win": {
    kind: "tv",
    build() {
      const h = series();
      moves(h, [["p2", 4], ["p1", 0], ["p2", 2], ["p1", 6], ["p2", 3], ["p1", 5], ["p2", 1], ["p1", 8], ["p2", 7]]);
      return { h };
    },
  },
  "tv-bot": {
    kind: "tv",
    build() {
      const h = bot("unbesiegbar");
      moves(h, [["p1", 0]]);
      h.advance(BOT_DELAY_MS);
      moves(h, [["p1", 8]]);
      return { h };
    },
  },
  "tv-paused": {
    kind: "tv",
    build() {
      const h = pvp();
      moves(h, [["p1", 4], ["p2", 0]]);
      h.setConnected("p2", false);
      return { h, offline: ["p2"] };
    },
  },
  "ctl-myturn": {
    kind: "ctl",
    build() {
      const h = series();
      moves(h, [["p2", 4], ["p1", 0], ["p2", 2]]);
      return { h, me: "p1" };
    },
  },
  "ctl-wait": {
    kind: "ctl",
    build() {
      const h = series();
      moves(h, [["p2", 4], ["p1", 0], ["p2", 2], ["p1", 6]]);
      return { h, me: "p1" };
    },
  },
  "ctl-bot": {
    kind: "ctl",
    build() {
      const h = bot("leicht");
      moves(h, [["p1", 4]]);
      return { h, me: "p1" };
    },
  },
  "ctl-win": {
    kind: "ctl",
    build() {
      const h = pvp();
      moves(h, [["p1", 4], ["p2", 0], ["p1", 2], ["p2", 1], ["p1", 6]]);
      return { h, me: "p1" };
    },
  },
  "ctl-lose": {
    kind: "ctl",
    build() {
      const h = pvp();
      moves(h, [["p1", 4], ["p2", 0], ["p1", 2], ["p2", 1], ["p1", 6]]);
      return { h, me: "p2" };
    },
  },
};

const FRAME_TV = `
:root { --bg:#120f24; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
html { font-size: calc(100vh / 60); }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: #f8f4ff; font-family: Roboto, "Segoe UI", Arial, system-ui, sans-serif; }
#root { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
`;
const FRAME_CTL = `
:root { --bg:#14112a; --text:#f8f4ff; --ink:#120f24; --p0:#ff4d4d; --p1:#4da6ff; --p2:#4dff88; --p3:#ffd24d; --p4:#c34dff; --p5:#ff9f4d; --p6:#4dfff0; --p7:#ff4dc4;
  --sat: env(safe-area-inset-top, 0px); --sab: env(safe-area-inset-bottom, 0px); color-scheme: dark; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font: 16px/1.4 ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif; }
.screen { min-height: 100%; display: flex; flex-direction: column; padding: calc(var(--sat) + 12px) 20px 0; max-width: 560px; margin: 0 auto; }
.selfbar { display: flex; align-items: center; gap: 12px; margin: calc(-12px - var(--sat)) -20px 0; padding: calc(var(--sat) + 14px) 20px 14px; background: var(--p0); color: var(--ink); border-radius: 0 0 28px 28px; font-weight: 800; font-size: 1.25rem; }
.stage { flex: 1 0 auto; display: flex; flex-direction: column; margin: 0 -20px; }
.stage__view { flex: 1; display: flex; flex-direction: column; padding: 16px 16px calc(var(--sab) + 16px); }
`;

function main(): void {
  const name = new URLSearchParams(location.search).get("scene") ?? "tv-playing";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, offline = [], me = "p1" } = scene.build();
  const players = roomPlayers(offline);
  const base = {
    gameId: "tictactoe",
    settings: {},
    getPlayers: () => players,
    getGamePlayerIds: () => h.players.map((p) => p.id),
    serverNow: () => Date.now(),
  };
  const style = document.createElement("style");
  style.textContent = scene.kind === "tv" ? FRAME_TV : FRAME_CTL;
  document.head.appendChild(style);

  if (scene.kind === "tv") {
    const v = tvView();
    v.mount(root, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    return;
  }
  const self = players.find((p) => p.id === me)!;
  root.innerHTML = `<main class="screen"><div class="selfbar" style="background:var(--p${self.color})">🦊 ${self.name}</div><section class="stage"><div class="stage__view"></div></section></main>`;
  const v = controllerView();
  v.mount(root.querySelector<HTMLElement>(".stage__view")!, {
    ...base,
    kind: "controller",
    playerId: me,
    isHost: () => me === "p1",
    sendInput: (input) => console.log("sendInput", input),
    vibrate: (p) => console.log("vibrate", p),
  } satisfies ControllerViewApi);
  v.update(h.lastView(me)!);
}

main();
