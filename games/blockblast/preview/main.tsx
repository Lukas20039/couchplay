// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik
// (über das Test-Harness). Aufruf: /?scene=<name>  – Liste siehe SCENES.
// Controller-Szenen sind live: Eingaben gehen an das Harness, die Ansicht aktualisiert sich.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import game, { COUNTDOWN_MS } from "../src/server/index.js";
import type { BlockblastPlayerView, BlockblastTvState } from "../src/shared.js";
import { bestMove } from "../src/testing.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<BlockblastTvState, BlockblastPlayerView>;

const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn", "Gina", "Hugo"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger", "einhorn", "pinguin"];
const gamePlayers = (n: number) => makePlayers(n).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));

/** Spiel mit n Spielern, jeder macht `moves` Züge (einfache Strategie). */
function game_(n: number, moves: number, seed = 4): H {
  const h = createTestHarness<BlockblastTvState, BlockblastPlayerView>(game, { players: gamePlayers(n), seed });
  if (moves < 0) return h;
  h.advance(COUNTDOWN_MS);
  for (let i = 0; i < moves; i++) {
    for (const p of h.players) {
      const v = h.lastView(p.id)!;
      const m = bestMove(v.me.board, v.hand);
      if (m && v.me.alive && (i + p.color) % 7 !== 0) h.input(p.id, { type: "place", ...m });
    }
    h.advance(1500);
  }
  return h;
}

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => H }> = {
  "tv-countdown": { kind: "tv", build: () => game_(2, -1) },
  "tv-duo": { kind: "tv", build: () => game_(2, 14) },
  "tv-quad": { kind: "tv", build: () => game_(4, 18) },
  "tv-many": { kind: "tv", build: () => game_(8, 22) },
  "tv-over": {
    kind: "tv",
    build() {
      const h = game_(3, 25);
      h.advance(200_000);
      return h;
    },
  },
  "ctl-play": { kind: "ctl", build: () => game_(2, 6) },
  "ctl-fresh": { kind: "ctl", build: () => game_(2, 0) },
  "ctl-countdown": { kind: "ctl", build: () => game_(2, -1) },
  "ctl-over": {
    kind: "ctl",
    build() {
      const h = game_(3, 25);
      h.advance(200_000);
      return h;
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
.selfbar { display: flex; align-items: center; margin: calc(-12px - var(--sat)) -20px 0; padding: calc(var(--sat) + 14px) 20px 14px; background: var(--p0); color: var(--ink); border-radius: 0 0 28px 28px; font-weight: 800; font-size: 1.25rem; }
.stage { flex: 1 0 auto; display: flex; flex-direction: column; margin: 0 -20px; }
.stage__view { flex: 1; display: flex; flex-direction: column; padding: 16px 16px calc(var(--sab) + 16px); }
`;

function main(): void {
  const name = new URLSearchParams(location.search).get("scene") ?? "tv-duo";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const h = scene.build();
  const players: Player[] = h.players.map((p, i) => ({ ...p, connected: true, isHost: i === 0 }));
  // Virtuelle Uhr des Harness als Server-Uhr (die Szene steht still).
  const clockNow = h.lastTv()!.endsAt - (h.lastTv()!.phase === "countdown" ? 2000 : 95_000);
  const base = {
    gameId: "blockblast",
    settings: {},
    getPlayers: () => players,
    getGamePlayerIds: () => h.players.map((p) => p.id),
    serverNow: () => clockNow,
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
  root.innerHTML = `<main class="screen"><div class="selfbar">Anna</div><section class="stage"><div class="stage__view"></div></section></main>`;
  const v = controllerView();
  const w = window as unknown as { __inputs: unknown[] };
  w.__inputs = [];
  v.mount(root.querySelector<HTMLElement>(".stage__view")!, {
    ...base,
    kind: "controller",
    playerId: "p1",
    isHost: () => true,
    sendInput: (input) => {
      w.__inputs.push(input);
      h.input("p1", input);
      setTimeout(() => v.update(h.lastView("p1")!), 60); // wie eine kurze Netzwerk-Verzögerung
    },
    vibrate: () => {},
  } satisfies ControllerViewApi);
  v.update(h.lastView("p1")!);
}

main();
