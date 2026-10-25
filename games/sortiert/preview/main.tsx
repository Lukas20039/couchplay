// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES. Optional &taps=3,0,5 tippt am Handy Karten an.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import { ALL_SETS } from "../src/data/index.js";
import { solutionOf } from "../src/scoring.js";
import game from "../src/server/index.js";
import { TIMING, cardRevealOffset, type SoPlayerView, type SoTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<SoTvState, SoPlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn", "Greta", "Maximilian"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger", "pinguin", "krake"];
const people = (n: number) => makePlayers(n).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));

const start = (categories: string[], items = 4, n = 5, seed = 11): H =>
  createTestHarness<SoTvState, SoPlayerView>(game, { players: people(n), settings: { categories, rounds: 8, itemsPerRound: items, answerSeconds: 35 }, seed });
const toSort = (h: H): H => {
  h.advance(TIMING.introMs);
  return h;
};
const solution = (h: H): number[] => {
  const v = h.lastView("p1") as Extract<SoPlayerView, { phase: "sort" }>;
  const set = ALL_SETS.find((s) => s.id === v.setId)!;
  return solutionOf(
    v.cards.map((c) => set.items.find((i) => i.label === c.label)!.value),
    set.unit,
  );
};
const swap = (o: number[], a: number, b: number): number[] => {
  const x = [...o];
  [x[a], x[b]] = [x[b]!, x[a]!];
  return x;
};
/** Alle legen eine Reihenfolge (abgeleitet von der Lösung); null = nichts, {partial} = nur Zwischenstand. */
type Pick = number[] | { partial: number[] } | null;
function sortAll(h: H, f: (sol: number[], i: number) => Pick): H {
  const sol = solution(h);
  h.players.forEach((p, i) => {
    const o = f(sol, i);
    if (o === null) return;
    if (Array.isArray(o)) h.input(p.id, { type: "order", order: o, final: true });
    else h.input(p.id, { type: "order", order: o.partial, final: false });
  });
  if (h.lastTv()!.phase === "sort") h.advance(35_000);
  return h;
}
/** Anna perfekt, Ben zwei vertauscht, Cleo umgedreht, Dino unvollständig, Ella nichts … */
const mixed = (sol: number[], i: number): Pick =>
  [sol, swap(sol, 1, 2), [...sol].reverse(), { partial: sol.slice(0, 2) }, null, swap(sol, 0, sol.length - 1), swap(sol, 2, 3), sol][i] ?? null;
const noPerfect = (sol: number[], i: number): Pick => (i === 0 ? swap(sol, 0, 1) : mixed(sol, i === 7 ? 1 : i));

/** at: Serverzeit für die Darstellung (Animation der Auflösung). */
type Built = { h: H; me?: string; at?: (s: SoTvState) => number };
const revealAt = (offset: number | ((s: Extract<SoTvState, { phase: "reveal" }>) => number)) => (s: SoTvState) =>
  s.phase === "reveal" ? (typeof offset === "number" ? s.revealAt + offset : offset(s)) : 0;
const DONE = revealAt((s) => s.resultAt + 600);
const CELEBRATE = revealAt((s) => s.resultAt + 700);

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => Built }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: start(["zeit", "geld", "verkauf", "groesse", "mengen", "tempo"]) }) },
  "tv-sort-4": {
    kind: "tv",
    build() {
      const h = toSort(start(["verkauf"]));
      h.input("p2", { type: "order", order: [0, 1, 2, 3], final: true });
      h.input("p4", { type: "order", order: [3, 2, 1, 0], final: true });
      return { h };
    },
  },
  "tv-sort-6": { kind: "tv", build: () => ({ h: toSort(start(["geld"], 6, 8, 3)) }) },
  "tv-reveal-build": { kind: "tv", build: () => ({ h: sortAll(toSort(start(["zeit"], 4)), mixed), at: revealAt(cardRevealOffset(1) + 400) }) },
  "tv-reveal-4": { kind: "tv", build: () => ({ h: sortAll(toSort(start(["zeit"], 4)), mixed), at: CELEBRATE }) },
  "tv-reveal-6": { kind: "tv", build: () => ({ h: sortAll(toSort(start(["geld"], 6, 5, 3)), noPerfect), at: DONE }) },
  "tv-reveal-6-8": { kind: "tv", build: () => ({ h: sortAll(toSort(start(["verkauf"], 6, 8, 5)), mixed), at: revealAt((s) => s.resultAt + 4_500) }) },
  "tv-reveal-solo": { kind: "tv", build: () => ({ h: sortAll(toSort(start(["tempo"], 5, 1)), (sol) => swap(sol, 3, 4)), at: DONE }) },
  "tv-standings": {
    kind: "tv",
    build() {
      const h = sortAll(toSort(start(["mengen"])), mixed);
      h.skip();
      return { h };
    },
  },
  "tv-final": {
    kind: "tv",
    build() {
      const h = start(["geld", "tempo", "groesse"], 4, 5, 5);
      for (let i = 0; i < 100 && h.lastTv()!.phase !== "final"; i++) {
        if (h.lastTv()!.phase === "sort") sortAll(h, (sol, j) => mixed(sol, (j + i) % 6));
        else if (!h.skip()) h.advance(TIMING.introMs);
      }
      return { h, at: (s) => ("endsAt" in s ? s.endsAt - 5_000 : 0) };
    },
  },
  "ctl-intro": { kind: "ctl", build: () => ({ h: start(["zeit"]), me: "p1" }) },
  "ctl-sort-4": { kind: "ctl", build: () => ({ h: toSort(start(["verkauf"], 4)), me: "p1" }) },
  "ctl-sort-6": { kind: "ctl", build: () => ({ h: toSort(start(["geld"], 6, 5, 3)), me: "p1" }) },
  "ctl-locked-6": {
    kind: "ctl",
    build() {
      const h = toSort(start(["geld"], 6, 5, 3));
      h.input("p1", { type: "order", order: [5, 2, 0, 1, 4, 3], final: true });
      return { h, me: "p1" };
    },
  },
  "ctl-reveal-wait": { kind: "ctl", build: () => ({ h: sortAll(toSort(start(["zeit"], 4)), mixed), me: "p1", at: revealAt(1_000) }) },
  "ctl-reveal-4": { kind: "ctl", build: () => ({ h: sortAll(toSort(start(["zeit"], 4)), mixed), me: "p1", at: DONE }) },
  "ctl-reveal-6": { kind: "ctl", build: () => ({ h: sortAll(toSort(start(["geld"], 6, 5, 3)), mixed), me: "p2", at: DONE }) },
  "ctl-reveal-6-partial": { kind: "ctl", build: () => ({ h: sortAll(toSort(start(["geld"], 6, 5, 3)), mixed), me: "p4", at: DONE }) },
  "ctl-final": {
    kind: "ctl",
    build() {
      const h = start(["zeit", "mengen"], 4, 3);
      for (let i = 0; i < 100 && h.lastTv()!.phase !== "final"; i++) {
        if (h.lastTv()!.phase === "sort") sortAll(h, mixed);
        else if (!h.skip()) h.advance(TIMING.introMs);
      }
      return { h, me: "p1" };
    },
  },
};

const FRAME_TV = `
:root { --bg:#0e1224; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
html { font-size: calc(100vh / 60); }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: #f3f7ff; font-family: Roboto, "Segoe UI", Arial, system-ui, sans-serif; }
#root { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
`;
const FRAME_CTL = `
:root { --bg:#111528; --text:#f3f7ff; --ink:#0e1224; --p0:#ff4d4d; --p1:#4da6ff; --p2:#4dff88; --p3:#ffd24d; --p4:#c34dff; color-scheme: dark; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font: 16px/1.4 ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif; }
#root { height: 100%; }
.screen { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; padding: 12px 20px 0; max-width: 560px; margin: 0 auto; }
.selfbar { display: flex; align-items: center; margin: -12px -20px 0; padding: 14px 20px; background: var(--p0); color: var(--ink); border-radius: 0 0 28px 28px; font-weight: 800; font-size: 1.25rem; }
.stage { flex: 1 0 auto; display: flex; flex-direction: column; margin: 0 -20px; }
.stage__view { flex: 1; display: flex; flex-direction: column; padding: 16px; }
`;

function main(): void {
  const params = new URLSearchParams(location.search);
  const name = params.get("scene") ?? "tv-reveal-4";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, me, at } = scene.build();
  const roomPlayers: Player[] = h.players.map((p, i) => ({ ...p, connected: i !== 2, isHost: i === 0 }));
  const s = h.lastTv()!;
  const clock = at ? at(s) : "endsAt" in s ? s.endsAt - 12_000 : 0;
  const base = { gameId: "sortiert", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
  const style = document.createElement("style");
  style.textContent = scene.kind === "tv" ? FRAME_TV : FRAME_CTL;
  document.head.appendChild(style);
  if (scene.kind === "tv") {
    const v = tvView();
    v.mount(root, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(s);
    return;
  }
  const id = me!;
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
  v.update(h.lastView(id)!);
  // Vortippen: ?taps=3,0,5
  const taps = params.get("taps");
  if (taps) {
    const list = taps.split(",");
    const step = (i: number): void => {
      if (i >= list.length) return;
      root.querySelector<HTMLButtonElement>(`[data-testid=sc-card-${list[i]}]`)?.click();
      setTimeout(() => step(i + 1), 40);
    };
    setTimeout(() => step(0), 50);
  }
}

main();
