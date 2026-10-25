// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES. Optional &text=… tippt am Handy eine Lüge vor.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import { ALL_QUESTIONS, type Bluff } from "../src/data/index.js";
import game from "../src/server/index.js";
import { TIMING, type FlPlayerView, type FlTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<FlTvState, FlPlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn", "Greta", "Maximilian"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger", "pinguin", "krake"];
const people = (n: number) => makePlayers(n).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));
/** Lügen in typischer Länge … */
const SHORT = ["Zahnseide", "Wasserpistolen", "Luftballons ohne Schnur", "Kreide", "Spiegel", "Blockflöten", "Goldfische", "Hüte"];
/** … und am Limit (bis 40 Zeichen). */
const LONG = [
  "Gelbe Regenschirme an ungeraden Tagen",
  "Gartenzwerge mit erhobenem Mittelfinger",
  "Kaffee nach siebzehn Uhr in Bussen",
  "Ketchup auf jeder Art von Wurst",
  "Pfeifen nach Sonnenuntergang im Park",
  "Socken mit Sandalen in der Innenstadt",
  "Rückwärts Einparken vor Krankenhäusern",
  "Luftballons mit mehr als drei Farben",
];

const start = (n: number, seed = 11, categories = ["kurioses", "welt"]): H =>
  createTestHarness<FlTvState, FlPlayerView>(game, { players: people(n), settings: { categories, rounds: 5, writeSeconds: 60, chooseSeconds: 20 }, seed });
/** Frage der aktuellen Runde (letzte Schreib-Ansicht von p1). */
const question = (h: H): Bluff => {
  const v = [...h.views.get("p1")!].reverse().find((x) => x.phase === "write") as Extract<FlPlayerView, { phase: "write" }>;
  return ALL_QUESTIONS.find((q) => q.id === v.questionId)!;
};
const toWrite = (h: H): H => {
  h.advance(TIMING.introMs);
  return h;
};
/** Alle schreiben (Liste), optional ohne die letzten `skip`. */
const writeAll = (h: H, lies = SHORT, skip = 0): H => {
  h.players.slice(0, h.players.length - skip).forEach((p, i) => h.input(p.id, { type: "lie", text: lies[i]! }));
  if (h.lastTv()!.phase === "write") h.advance(60_000);
  return h;
};
const options = (h: H) => (h.lastTv() as Extract<FlTvState, { phase: "choose" }>).options;
/** picks[i]: Index der Lüge in `lies`, "t" = Wahrheit, "h" = erste Hauslüge, null = nichts. */
function chooseAll(h: H, picks: (number | "t" | "h" | null)[], lies = SHORT): H {
  const q = question(h);
  const opts = options(h);
  h.players.forEach((p, i) => {
    const pick = picks[i];
    if (pick === null || pick === undefined) return;
    const index = pick === "t" ? opts.indexOf(q.answer) : pick === "h" ? opts.findIndex((o) => q.lies.includes(o)) : opts.indexOf(lies[pick]!);
    h.input(p.id, { type: "choose", index });
  });
  if (h.lastTv()!.phase === "choose") h.advance(20_000);
  return h;
}
/** Zum Auflösungsschritt `step` vorspulen. */
const toStep = (h: H, step: number): H => {
  h.advance(step * TIMING.revealLieMs);
  return h;
};

/** freeze: CSS-Animationen anhalten, damit der Screenshot genau den Zeitpunkt `at` zeigt. */
type Built = { h: H; me?: string; at?: (s: FlTvState) => number; freeze?: boolean };
const stepAt = (offset: number) => (s: FlTvState) => (s.phase === "reveal" ? s.stepAt + offset : 0);
const STEP_DONE = 2_800;
const TRUTH_DONE = 5_500;

/** Spiel bis ins Finale spielen (mit etwas Wertung). */
function playToFinal(n: number): H {
  const h = toWrite(start(n, 5));
  for (let i = 0; i < 100 && h.lastTv()!.phase !== "final"; i++) {
    const s = h.lastTv()!;
    if (s.phase === "write") writeAll(h);
    else if (s.phase === "choose") chooseAll(h, h.players.map((_, j) => ((j + i) % 3 === 0 ? "t" : (j + 1 + i) % n)));
    else if (!h.skip()) h.advance(1000);
  }
  return h;
}

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => Built }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: start(5) }) },
  "tv-write": {
    kind: "tv",
    build() {
      const h = toWrite(start(6));
      h.input("p2", { type: "lie", text: "Zahnseide" });
      h.input("p4", { type: "lie", text: "Kreide" });
      return { h };
    },
  },
  "tv-write-double": {
    kind: "tv",
    build() {
      const h = createTestHarness<FlTvState, FlPlayerView>(game, { players: people(4), settings: { categories: ["tiere"], rounds: 3 }, seed: 4 });
      h.advance(TIMING.introMs);
      for (let i = 0; i < 20 && !(h.lastTv()!.phase === "write" && (h.lastTv() as { double: boolean }).double); i++) h.skip() || h.advance(60_000);
      h.input("p1", { type: "lie", text: "Zahnseide" });
      return { h };
    },
  },
  "tv-choose": {
    kind: "tv",
    build() {
      const h = writeAll(toWrite(start(3)));
      h.input("p2", { type: "choose", index: 0 });
      return { h };
    },
  },
  "tv-choose-9": { kind: "tv", build: () => ({ h: writeAll(toWrite(start(8)), LONG) }) },
  "tv-reveal-fly": { kind: "tv", build: () => ({ h: chooseAll(writeAll(toWrite(start(5))), [1, 0, 0, "t", 0]), at: stepAt(900) }) },
  "tv-reveal-lie": { kind: "tv", build: () => ({ h: toStep(chooseAll(writeAll(toWrite(start(5))), [1, 0, 0, "t", 0]), 1), at: stepAt(STEP_DONE) }) },
  "tv-reveal-shared": {
    kind: "tv",
    build() {
      const lies = ["Zahnseide", "zahnseide!", "Kreide", "Spiegel"];
      return { h: chooseAll(writeAll(toWrite(start(4)), lies), [2, 2, 0, 0], lies), at: stepAt(STEP_DONE) };
    },
  },
  "tv-reveal-house": { kind: "tv", build: () => ({ h: chooseAll(writeAll(toWrite(start(2))), ["h", "h"]), at: stepAt(STEP_DONE) }) },
  "tv-reveal-long": {
    kind: "tv",
    build: () => ({ h: chooseAll(writeAll(toWrite(start(8)), LONG), [1, 0, 0, 0, 0, 0, 0, 1], LONG), at: stepAt(STEP_DONE) }),
  },
  "tv-reveal-drum": { kind: "tv", build: () => ({ h: toStep(chooseAll(writeAll(toWrite(start(5))), [1, 0, 0, "t", "t"]), 2), at: stepAt(800) }) },
  "tv-reveal-truth": { kind: "tv", build: () => ({ h: toStep(chooseAll(writeAll(toWrite(start(5))), [1, 0, 0, "t", "t"]), 2), at: stepAt(TRUTH_DONE) }) },
  "tv-reveal-nobody": { kind: "tv", build: () => ({ h: toStep(chooseAll(writeAll(toWrite(start(3))), [1, 2, 0]), 3), at: stepAt(TRUTH_DONE) }) },
  "tv-standings": {
    kind: "tv",
    build() {
      const h = createTestHarness<FlTvState, FlPlayerView>(game, { players: people(8), settings: { categories: ["essen"], rounds: 3 }, seed: 9 });
      h.advance(TIMING.introMs);
      writeAll(h);
      chooseAll(h, [1, 0, "t", 0, 2, "t", 0, 3]);
      h.skip();
      return { h };
    },
  },
  "tv-final": { kind: "tv", build: () => ({ h: playToFinal(6), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },
  "tv-final-8": { kind: "tv", build: () => ({ h: playToFinal(8), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },

  "ctl-intro": { kind: "ctl", build: () => ({ h: start(3), me: "p1" }) },
  "ctl-write": { kind: "ctl", build: () => ({ h: toWrite(start(3)), me: "p1" }) },
  "ctl-rejected": {
    kind: "ctl",
    build() {
      const h = toWrite(start(3));
      h.input("p1", { type: "lie", text: question(h).answer });
      return { h, me: "p1" };
    },
  },
  "ctl-locked": {
    kind: "ctl",
    build() {
      const h = toWrite(start(3));
      h.input("p1", { type: "lie", text: LONG[0]! });
      return { h, me: "p1" };
    },
  },
  "ctl-choose": { kind: "ctl", build: () => ({ h: writeAll(toWrite(start(3))), me: "p1" }) },
  "ctl-choose-9": { kind: "ctl", build: () => ({ h: writeAll(toWrite(start(8)), LONG), me: "p1" }) },
  "ctl-chosen": {
    kind: "ctl",
    build() {
      const h = writeAll(toWrite(start(4)), SHORT, 1);
      h.input("p1", { type: "choose", index: options(h).indexOf(SHORT[1]!) });
      return { h, me: "p4" };
    },
  },
  "ctl-chosen-me": {
    kind: "ctl",
    build() {
      const h = writeAll(toWrite(start(4)));
      h.input("p1", { type: "choose", index: options(h).indexOf(SHORT[1]!) });
      return { h, me: "p1" };
    },
  },
  "ctl-reveal-wait": { kind: "ctl", build: () => ({ h: chooseAll(writeAll(toWrite(start(5))), [1, 0, 0, "t", 0]), me: "p1" }) },
  "ctl-result-good": { kind: "ctl", build: () => ({ h: toStep(chooseAll(writeAll(toWrite(start(5))), ["t", 0, 0, "t", 0]), 1), me: "p1" }) },
  "ctl-result-fooled": { kind: "ctl", build: () => ({ h: toStep(chooseAll(writeAll(toWrite(start(5)), LONG), [1, 0, 0, "t", 0], LONG), 2), me: "p2" }) },
  "ctl-result-house": { kind: "ctl", build: () => ({ h: toStep(chooseAll(writeAll(toWrite(start(2))), ["h", 0]), 2), me: "p1" }) },
  "ctl-standings": {
    kind: "ctl",
    build() {
      const h = chooseAll(writeAll(toWrite(start(4))), ["t", 0, 0, 1]);
      h.skip();
      return { h, me: "p1" };
    },
  },
  "ctl-final": { kind: "ctl", build: () => ({ h: playToFinal(4), me: "p1" }) },
};

const FRAME_TV = `
:root { --bg:#120f24; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
html { font-size: calc(100vh / 60); }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: #f3f7ff; font-family: Roboto, "Segoe UI", Arial, system-ui, sans-serif; }
#root { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
`;
const FRAME_CTL = `
:root { --bg:#111528; --text:#f3f7ff; --ink:#0e1224; --p0:#ff4d4d; --p1:#4da6ff; --p2:#4dff88; --p3:#ffd24d; --p4:#c34dff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font: 16px/1.4 ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif; }
#root { height: 100%; }
.screen { height: 100%; box-sizing: border-box; display: flex; flex-direction: column; padding: 12px 20px 0; max-width: 560px; margin: 0 auto; }
.selfbar { display: flex; align-items: center; margin: -12px -20px 0; padding: 14px 20px; background: var(--p0); color: var(--ink); border-radius: 0 0 28px 28px; font-weight: 800; font-size: 1.25rem; }
.stage { flex: 1 0 auto; display: flex; flex-direction: column; margin: 0 -20px; }
.stage__view { flex: 1; display: flex; flex-direction: column; padding: 16px; }
`;

function main(): void {
  const params = new URLSearchParams(location.search);
  const name = params.get("scene") ?? "tv-reveal-lie";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, me, at, freeze = name.startsWith("tv-reveal") } = scene.build();
  const roomPlayers: Player[] = h.players.map((p, i) => ({ ...p, connected: i !== 2 || h.players.length < 5, isHost: i === 0 }));
  const s = h.lastTv()!;
  const clock = at ? at(s) : "endsAt" in s ? s.endsAt - 23_000 : 0;
  const base = { gameId: "flunkern", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
  const style = document.createElement("style");
  style.textContent = (scene.kind === "tv" ? FRAME_TV : FRAME_CTL) + (freeze ? "\n* { animation-play-state: paused !important; }" : "");
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
  // Vortippen: ?text=…
  const text = params.get("text");
  if (text) {
    setTimeout(() => {
      const input = root.querySelector<HTMLInputElement>("[data-testid=fl-input]");
      if (!input) return;
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, 50);
  }
}

main();
