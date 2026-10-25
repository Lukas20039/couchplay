// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player, SettingsValues } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, revealSchedule, type WePlayerView, type WeTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<WeTvState, WePlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Maximilian", "Ella", "Finn", "Greta", "Anna-Lena"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger", "pinguin", "einhorn"];
const people = (n: number) => makePlayers(n).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));

const start = (n: number, extra: SettingsValues = {}, seed = 11): H =>
  createTestHarness<WeTvState, WePlayerView>(game, {
    players: people(n),
    settings: { categories: ["alltag", "abenteuer", "chaos"], rounds: 5, voteSeconds: 20, ...extra },
    seed,
  });
const toVote = (h: H): H => {
  h.advance(TIMING.introMs);
  return h;
};
/** Stimmen nach Muster: Index Wähler → Index Ziel (null = keine Stimme). */
function castAll(h: H, pattern: (i: number) => number | null): H {
  h.players.forEach((p, i) => {
    const target = pattern(i);
    if (target !== null) h.input(p.id, { type: "vote", target: h.players[target]!.id });
  });
  if (h.lastTv()!.phase === "vote") h.advance(20_000);
  return h;
}
const clear3 = (i: number) => [1, 1, 0][i] ?? null;
const clear8 = (i: number) => [3, 3, 1, 3, 0, 3, 1, 7][i] ?? null;
const tie8 = (i: number) => [1, 3, 1, 1, 3, 3, 7, null][i] ?? null;

/** at: Serverzeit für die Darstellung (Animation der Auflösung). */
type Built = { h: H; me?: string; at?: (s: WeTvState | WePlayerView) => number };
const revealAt = (offset: (n: number) => number) => (s: WeTvState | WePlayerView) => {
  if (s.phase !== "reveal") return 0;
  const n = "flights" in s ? s.flights.length : s.voteCount;
  return s.revealAt + offset(n);
};
const DONE = (n: number) => revealSchedule(n).pointsMs + 1_500;
const MID = (n: number) => revealSchedule(n).firstMs + revealSchedule(n).stepMs * Math.ceil(n / 2) + 200;

function playToFinal(h: H, pattern: (round: number, i: number) => number | null): H {
  for (let i = 0; i < 200 && h.lastTv()!.phase !== "final"; i++) {
    const s = h.lastTv()!;
    if (s.phase === "vote") castAll(h, (j) => pattern(s.round, j));
    else if (!h.skip()) h.advance(1_000);
  }
  return h;
}
const finalPattern = (n: number) => (round: number, j: number) => (j === n - 1 && round === 0 ? null : (j + round * 3 + (j % 2 ? 1 : 0)) % Math.max(2, n - 2));

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => Built }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: start(3) }) },
  "tv-intro-8": { kind: "tv", build: () => ({ h: start(8, { anonymous: "anonym", categories: ["alltag", "abenteuer", "peinlich", "zukunft", "essen", "chaos"] }) }) },
  "tv-vote": {
    kind: "tv",
    build() {
      const h = toVote(start(3));
      h.input("p2", { type: "vote", target: "p1" });
      return { h };
    },
  },
  "tv-vote-8": {
    kind: "tv",
    build() {
      const h = toVote(start(8, {}, 4));
      for (const id of ["p1", "p3", "p4", "p6", "p7"]) h.input(id, { type: "vote", target: "p2" });
      return { h };
    },
  },
  "tv-reveal-fly": { kind: "tv", build: () => ({ h: castAll(toVote(start(8)), clear8), at: revealAt(MID) }) },
  "tv-reveal": { kind: "tv", build: () => ({ h: castAll(toVote(start(3)), clear3), at: revealAt(DONE) }) },
  "tv-reveal-8": { kind: "tv", build: () => ({ h: castAll(toVote(start(8, {}, 5)), clear8), at: revealAt(DONE) }) },
  "tv-reveal-tie-anon-8": { kind: "tv", build: () => ({ h: castAll(toVote(start(8, { anonymous: "anonym" }, 6)), tie8), at: revealAt(DONE) }) },
  "tv-reveal-none": { kind: "tv", build: () => ({ h: castAll(toVote(start(3)), () => null), at: revealAt(DONE) }) },
  "tv-standings": {
    kind: "tv",
    build() {
      const h = castAll(toVote(start(3)), clear3);
      h.advance(TIMING.revealMs);
      return { h };
    },
  },
  "tv-standings-8": {
    kind: "tv",
    build() {
      const h = castAll(toVote(start(8)), clear8);
      h.advance(TIMING.revealMs);
      return { h };
    },
  },
  "tv-final": { kind: "tv", build: () => ({ h: playToFinal(start(3, {}, 5), finalPattern(3)), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },
  "tv-final-8": { kind: "tv", build: () => ({ h: playToFinal(start(8, { rounds: 8 }, 5), finalPattern(8)), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },
  "ctl-intro": { kind: "ctl", build: () => ({ h: start(3), me: "p1" }) },
  "ctl-vote": { kind: "ctl", build: () => ({ h: toVote(start(3)), me: "p1" }) },
  "ctl-vote-8": { kind: "ctl", build: () => ({ h: toVote(start(8)), me: "p4" }) },
  "ctl-locked": {
    kind: "ctl",
    build() {
      const h = toVote(start(3));
      h.input("p1", { type: "vote", target: "p2" });
      return { h, me: "p1" };
    },
  },
  "ctl-reveal-wait": { kind: "ctl", build: () => ({ h: castAll(toVote(start(3)), clear3), me: "p1", at: revealAt(() => 800) }) },
  "ctl-reveal": { kind: "ctl", build: () => ({ h: castAll(toVote(start(3)), clear3), me: "p1", at: revealAt(DONE) }) },
  "ctl-reveal-winner": { kind: "ctl", build: () => ({ h: castAll(toVote(start(8)), clear8), me: "p4", at: revealAt(DONE) }) },
  "ctl-reveal-against": { kind: "ctl", build: () => ({ h: castAll(toVote(start(8)), clear8), me: "p3", at: revealAt(DONE) }) },
  "ctl-final": { kind: "ctl", build: () => ({ h: playToFinal(start(3, {}, 5), finalPattern(3)), me: "p2" }) },
};

const FRAME_TV = `
:root { --bg:#110c22; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
html { font-size: calc(100vh / 60); }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: #f3f7ff; font-family: Roboto, "Segoe UI", Arial, system-ui, sans-serif; }
#root { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
`;
const FRAME_CTL = `
:root { --bg:#151028; --text:#f8f3ff; --ink:#0e1224; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font: 16px/1.4 ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif; }
#root { height: 100%; }
.screen { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; padding: 12px 20px 0; max-width: 560px; margin: 0 auto; }
.selfbar { display: flex; align-items: center; margin: -12px -20px 0; padding: 14px 20px; background: var(--p0); color: var(--ink); border-radius: 0 0 28px 28px; font-weight: 800; font-size: 1.25rem; }
.stage { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; margin: 0 -20px; }
.stage__view { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 16px; }
`;

function main(): void {
  const params = new URLSearchParams(location.search);
  const name = params.get("scene") ?? "tv-reveal";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, me, at } = scene.build();
  const roomPlayers: Player[] = h.players.map((p, i) => ({ ...p, connected: i !== 2, isHost: i === 0 }));
  const s = h.lastTv()!;
  const style = document.createElement("style");
  style.textContent = scene.kind === "tv" ? FRAME_TV : FRAME_CTL;
  document.head.appendChild(style);
  if (scene.kind === "tv") {
    const clock = at ? at(s) : "endsAt" in s ? s.endsAt - 9_000 : 0;
    const base = { gameId: "wuerdeeher", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
    const v = tvView();
    v.mount(root, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(s);
    return;
  }
  const id = me!;
  const view = h.lastView(id)!;
  const clock = at ? at(view) : "endsAt" in view ? view.endsAt - 9_000 : 0;
  const base = { gameId: "wuerdeeher", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
  const self = roomPlayers.find((p) => p.id === id)!;
  root.innerHTML = `<main class="screen"><div class="selfbar" style="background:var(--p${self.color})"></div><section class="stage"><div class="stage__view"></div></section></main>`;
  root.querySelector(".selfbar")!.textContent = self.name;
  const v = controllerView();
  v.mount(root.querySelector<HTMLElement>(".stage__view")!, {
    ...base,
    kind: "controller",
    playerId: id,
    isHost: () => false,
    sendInput: (input) => console.log("sendInput", input),
    vibrate: () => {},
  } satisfies ControllerViewApi);
  v.update(view);
}

main();
