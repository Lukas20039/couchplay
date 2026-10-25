// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES. Optional &keys=8000000,5 tippt am Handy vor.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import { ALL_QUESTIONS } from "../src/data/index.js";
import game from "../src/server/index.js";
import { REVEAL_STEPS, TIMING, type EsPlayerView, type EsTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<EsTvState, EsPlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger"];
const people = (n: number) => makePlayers(n).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));

const start = (categories: string[], n = 5, seed = 11): H =>
  createTestHarness<EsTvState, EsPlayerView>(game, { players: people(n), settings: { categories, rounds: 10, answerSeconds: 30 }, seed });
const toQuestion = (h: H): H => {
  h.advance(TIMING.introMs);
  return h;
};
const answerOf = (h: H): number => {
  const v = h.lastView("p1") as Extract<EsPlayerView, { phase: "question" }>;
  return ALL_QUESTIONS.find((q) => q.id === v.questionId)!.answer;
};
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Alle tippen: Faktoren (Zahl) bzw. Abstände (Jahr) relativ zur Lösung; null = kein Tipp. */
function guessAll(h: H, f: (answer: number, i: number) => number | null): H {
  const a = answerOf(h);
  h.players.forEach((p, i) => {
    const v = f(a, i);
    if (v !== null) h.input(p.id, { type: "guess", value: Math.max(0, r2(v)) });
  });
  if (h.lastTv()!.phase === "question") h.advance(30_000);
  return h;
}
const linear = (a: number, i: number) => [a * 0.9, a * 1.25, a * 0.7, a * 1.04, null][i] ?? null;
const years = (a: number, i: number) => [a - 3, a + 12, a - 40, a, a - 2][i] ?? null;
const wild = (a: number, i: number) => [a * 0.01, a * 0.6, a * 1.3, a * 40, 0][i] ?? null;

/** at: Serverzeit für die Darstellung (Animation der Auflösung). */
type Built = { h: H; me?: string; at?: (s: EsTvState) => number };
const revealAt = (offset: number) => (s: EsTvState) => (s.phase === "reveal" ? s.revealAt + offset : 0);
const DONE = REVEAL_STEPS.resultMs + 2_000;

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => Built }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: start(["geografie", "geschichte", "weltall", "alltag"]) }) },
  "tv-question": {
    kind: "tv",
    build() {
      const h = toQuestion(start(["technik"]));
      h.input("p2", { type: "guess", value: 100 });
      h.input("p4", { type: "guess", value: 200 });
      return { h };
    },
  },
  "tv-question-year": { kind: "tv", build: () => ({ h: toQuestion(start(["geschichte"])) }) },
  "tv-reveal-drum": { kind: "tv", build: () => ({ h: guessAll(toQuestion(start(["geschichte"])), years), at: revealAt(REVEAL_STEPS.drumMs + 300) }) },
  "tv-reveal-count": { kind: "tv", build: () => ({ h: guessAll(toQuestion(start(["geschichte"])), years), at: revealAt(REVEAL_STEPS.countFromMs + 800) }) },
  "tv-reveal": { kind: "tv", build: () => ({ h: guessAll(toQuestion(start(["geschichte"])), years), at: revealAt(DONE) }) },
  "tv-reveal-lin": { kind: "tv", build: () => ({ h: guessAll(toQuestion(start(["technik"])), linear), at: revealAt(DONE) }) },
  "tv-reveal-log": { kind: "tv", build: () => ({ h: guessAll(toQuestion(start(["weltall"])), wild), at: revealAt(DONE) }) },
  "tv-reveal-8": {
    kind: "tv",
    build() {
      const h = createTestHarness<EsTvState, EsPlayerView>(game, {
        players: makePlayers(8).map((p, i) => ({ ...p, name: ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn", "Greta", "Maximilian"][i]! })),
        settings: { categories: ["natur"], rounds: 10, answerSeconds: 30 },
        seed: 3,
      });
      toQuestion(h);
      return { h: guessAll(h, (a, i) => a * [1, 1.01, 0.98, 1.3, 0.5, 2, 1.02, 0.97][i]!), at: revealAt(DONE) };
    },
  },
  "tv-reveal-solo": { kind: "tv", build: () => ({ h: guessAll(toQuestion(start(["mensch"], 1)), (a) => a * 1.08), at: revealAt(DONE) }) },
  "tv-standings": {
    kind: "tv",
    build() {
      const h = guessAll(toQuestion(start(["sport"])), linear);
      h.advance(TIMING.revealAnimMs + TIMING.revealHoldMs);
      return { h };
    },
  },
  "tv-final": {
    kind: "tv",
    build() {
      const h = start(["alltag", "sport"], 5, 5);
      for (let i = 0; i < 100 && h.lastTv()!.phase !== "final"; i++) {
        const s = h.lastTv()!;
        if (s.phase === "question") guessAll(h, (a, j) => a * (1 + 0.1 * j) + (i % 3) * j);
        else if (!h.skip()) h.advance(TIMING.revealAnimMs);
      }
      return { h, at: (s) => ("endsAt" in s ? s.endsAt - 5_000 : 0) };
    },
  },
  "ctl-intro": { kind: "ctl", build: () => ({ h: start(["geografie"]), me: "p1" }) },
  "ctl-input": { kind: "ctl", build: () => ({ h: toQuestion(start(["geografie"])), me: "p1" }) },
  "ctl-year": { kind: "ctl", build: () => ({ h: toQuestion(start(["geschichte"])), me: "p1" }) },
  "ctl-locked": {
    kind: "ctl",
    build() {
      const h = toQuestion(start(["weltall"]));
      h.input("p1", { type: "guess", value: 380000 });
      return { h, me: "p1" };
    },
  },
  "ctl-reveal-wait": { kind: "ctl", build: () => ({ h: guessAll(toQuestion(start(["technik"])), linear), me: "p1", at: revealAt(1_000) }) },
  "ctl-reveal": { kind: "ctl", build: () => ({ h: guessAll(toQuestion(start(["technik"])), linear), me: "p1", at: revealAt(DONE) }) },
  "ctl-reveal-bull": { kind: "ctl", build: () => ({ h: guessAll(toQuestion(start(["geschichte"])), years), me: "p4", at: revealAt(DONE) }) },
  "ctl-final": {
    kind: "ctl",
    build() {
      const h = start(["alltag"], 3);
      for (let i = 0; i < 100 && h.lastTv()!.phase !== "final"; i++) {
        if (h.lastTv()!.phase === "question") guessAll(h, (a, j) => a * (1 + 0.01 * j));
        else if (!h.skip()) h.advance(TIMING.revealAnimMs);
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
  const clock = at ? at(s) : "endsAt" in s ? s.endsAt - 9_000 : 0;
  const base = { gameId: "schaetzen", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
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
  // Vortippen: ?keys=8000000,5
  const keys = params.get("keys");
  if (keys) {
    setTimeout(() => {
      for (const k of keys) root.querySelector<HTMLButtonElement>(`[data-testid=es-key-${k === "," ? "comma" : k}]`)?.click();
    }, 50);
  }
}

main();
