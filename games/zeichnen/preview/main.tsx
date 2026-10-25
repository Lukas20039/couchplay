// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, type ZgPlayerView, type ZgTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<ZgTvState, ZgPlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn", "Gustav-Adolf", "Hanna"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger", "pinguin", "krake"];
/** Spielerzahl per ?n=2…8 (Standard 6). */
const count = Math.min(8, Math.max(2, Number(new URLSearchParams(location.search).get("n") ?? 6)));
const players = makePlayers(count).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));

const newGame = (): H =>
  createTestHarness<ZgTvState, ZgPlayerView>(game, { players, settings: { categories: ["tiere", "haushalt", "natur"], drawSeconds: 80 }, seed: 4 });
const drawerOf = (h: H): string => (h.lastTv() as { drawer: { id: string } }).drawer.id;
const guessers = (h: H) => h.players.map((p) => p.id).filter((id) => id !== drawerOf(h));

/** Beispielzeichnung: Haus mit Sonne und Baum (Striche wie vom Handy, in Chunks). */
function sketch(h: H): void {
  const d = drawerOf(h);
  let id = 1;
  const line = (color: number, size: number, pts: number[]) => h.input(d, { type: "stroke", id: id++, color, size, points: pts });
  const circle = (cx: number, cy: number, r: number) =>
    Array.from({ length: 41 }, (_, i) => [Math.round(cx + r * Math.cos((i / 40) * Math.PI * 2)), Math.round(cy + r * Math.sin((i / 40) * Math.PI * 2))]).flat();
  line(0, 1, [220, 820, 220, 520, 560, 520, 560, 820, 220, 820]);
  line(1, 1, [190, 540, 390, 330, 590, 540]);
  line(7, 1, [350, 820, 350, 680, 430, 680, 430, 820]);
  line(5, 0, [260, 580, 330, 580, 330, 640, 260, 640, 260, 580]);
  line(3, 2, circle(800, 180, 70));
  line(3, 0, [800, 60, 800, 20]);
  line(3, 0, [920, 180, 970, 180]);
  line(3, 0, [680, 180, 630, 180]);
  line(4, 2, circle(780, 560, 90));
  line(7, 2, [780, 650, 780, 830]);
  line(4, 1, [80, 860, 300, 870, 520, 855, 760, 870, 940, 860]);
  h.advance(300);
}

function drawing(withGuesses: boolean): H {
  const h = newGame();
  h.advance(TIMING.introMs);
  h.input(drawerOf(h), { type: "choose", index: 1 });
  sketch(h);
  if (withGuesses) {
    const [a, b, c, d] = guessers(h);
    const word = (h.lastView(drawerOf(h)) as { word: string }).word;
    h.input(a!, { type: "guess", text: "Villa" });
    h.input(b!, { type: "guess", text: "Bauernhof" });
    h.input(c!, { type: "guess", text: word });
    h.advance(1500);
    h.input(a!, { type: "guess", text: "Garten" });
    h.input(d!, { type: "guess", text: "Ferienhaus mit Sonnenschein" });
    h.advance(41_000);
    h.input(b!, { type: "guess", text: word });
  }
  return h;
}

function revealed(): H {
  const h = drawing(true);
  while (h.lastTv()!.phase === "draw") h.advance(1000);
  return h;
}

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => { h: H; me?: (h: H) => string; clockOffset?: number } }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: newGame() }) },
  "tv-choose": {
    kind: "tv",
    build() {
      const h = newGame();
      h.advance(TIMING.introMs);
      return { h, clockOffset: 7_000 };
    },
  },
  "tv-draw": { kind: "tv", build: () => ({ h: drawing(true), clockOffset: 30_000 }) },
  "tv-reveal": { kind: "tv", build: () => ({ h: revealed() }) },
  "tv-standings": {
    kind: "tv",
    build() {
      const h = revealed();
      h.advance(TIMING.revealMs);
      return { h };
    },
  },
  "tv-final": {
    kind: "tv",
    build() {
      const h = revealed();
      if (guessers(h).length > 4) h.leave(guessers(h)[4]!);
      while (h.lastTv()!.phase !== "final") h.skip() || h.advance(80_000);
      return { h };
    },
  },
  "ctl-choose": {
    kind: "ctl",
    build() {
      const h = newGame();
      h.advance(TIMING.introMs);
      return { h, me: drawerOf, clockOffset: 6_000 };
    },
  },
  "ctl-wait": {
    kind: "ctl",
    build() {
      const h = newGame();
      h.advance(TIMING.introMs);
      return { h, me: (x) => guessers(x)[0]! };
    },
  },
  "ctl-draw": {
    kind: "ctl",
    build() {
      const h = drawing(false);
      const d = drawerOf(h);
      // Reconnect liefert die Striche mit (so sieht man sie auch in der Vorschau).
      h.setConnected(d, false);
      h.setConnected(d, true);
      return { h, me: drawerOf, clockOffset: 50_000 };
    },
  },
  "ctl-guess": {
    kind: "ctl",
    build() {
      const h = drawing(true);
      const a = guessers(h)[0]!;
      const word = (h.lastView(drawerOf(h)) as { word: string }).word;
      h.advance(1000);
      h.input(a, { type: "guess", text: `${word.slice(0, -1)}x` });
      return { h, me: (x) => guessers(x)[0]!, clockOffset: 30_000 };
    },
  },
  "ctl-success": { kind: "ctl", build: () => ({ h: drawing(true), me: (x) => guessers(x)[2]!, clockOffset: 30_000 }) },
  "ctl-reveal": { kind: "ctl", build: () => ({ h: revealed(), me: (x) => guessers(x)[1]! }) },
  "ctl-reveal-draw": { kind: "ctl", build: () => ({ h: revealed(), me: drawerOf }) },
};

const FRAME_TV = `
:root { --bg:#120f24; --p0:#ff4d4d; --p1:#4da6ff; --p2:#4dff88; --p3:#ffd24d; --p4:#c34dff; --p5:#ff9f4d; --p6:#4dfff0; --p7:#ff4dc4; color-scheme: dark; }
html { font-size: calc(100vh / 60); }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: #f8f4ff; font-family: Roboto, "Segoe UI", Arial, system-ui, sans-serif; }
#root { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
`;
const FRAME_CTL = `
:root { --bg:#0f0e17; --surface:#1a1826; --raised:#25223a; --line:#34304d; --text:#f5f3ff; --ink:#0f0e17; --p0:#ff4d4d; --p1:#4da6ff; --p2:#4dff88; --p3:#ffd24d; --p4:#c34dff; --p5:#ff9f4d; color-scheme: dark; }
html, body { margin: 0; height: 100%; overflow: hidden; background: var(--bg); color: var(--text); font: 16px/1.4 ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif; }
#root { height: 100%; }
.screen { min-height: 100%; display: flex; flex-direction: column; padding: 12px 20px 0; max-width: 560px; margin: 0 auto; box-sizing: border-box; }
.selfbar { display: flex; align-items: center; margin: -12px -20px 0; padding: 14px 20px; color: var(--ink); border-radius: 0 0 28px 28px; font-weight: 800; font-size: 1.25rem; }
.stage { flex: 1 0 auto; display: flex; flex-direction: column; margin: 0 -20px; }
.stage__view { flex: 1; display: flex; flex-direction: column; padding: 16px; }
`;

function main(): void {
  const name = new URLSearchParams(location.search).get("scene") ?? "tv-draw";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, me, clockOffset } = scene.build();
  const roomPlayers: Player[] = h.players.map((p, i) => ({ ...p, connected: true, isHost: i === 0 }));
  const s = h.lastTv()!;
  const clock = "endsAt" in s ? s.endsAt - (clockOffset ?? 4_000) : 0;
  const base = { gameId: "zeichnen", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
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
}

main();
