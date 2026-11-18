// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player, SettingsValues } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, type SlPlayerView, type SlTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<SlTvState, SlPlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn", "Greta", "Maximilian"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger", "pinguin", "krake"];
const people = (n: number) => makePlayers(n).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));

/** Antworten mit B je Spieler (Klassisch: Stadt, Land, Fluss, Name, Beruf, Tier). */
const CLASSIC_B: string[][] = [
  ["Berlin", "Belgien", "Bode", "Bernd", "Bäcker", "Biber"],
  ["Bonn", "Brasilien", "", "Bianca", "Busfahrer", "Bär"],
  ["berlin", "Bulgarien", "Brahmaputra", "Ben", "Der Bademeister", "Biene"],
  ["Bamberg", "Belgien!", "Bober", "Berta", "Bauer", "Büffel"],
  ["Hamburg", "Bolivien", "", "Bruno", "Bankkauffrau", "Blaumeise"],
  ["", "Botswana", "", "Bettina", "Bäcker", "Bär"],
  ["Bielefeld", "Bhutan", "Bille", "Benedikt", "Bildhauerin", "Bonobo"],
  ["Bad Tölz im schönen Isartal", "Bangladesch", "Bode", "Barbara", "Bergführer", "Bachstelze"],
];
const QUATSCH_B: string[][] = [
  ["Bahn hatte wieder Verspätung", "Bowlingkugel", "Bello", "Bananen leuchten lassen", "Bügeleisen", "Brennnessel"],
  ["Bettdecke war zu gemütlich", "Brennnessel", "Brösel", "", "Blumenerde", "Briefbeschwerer"],
  ["Bus ist ohne mich gefahren", "Bienenstock", "Bubi", "Bleistifte spitzen", "", "Bügelbrett"],
];

const SETTINGS: SettingsValues = { set: "klassisch", rounds: 5, roundSeconds: 90, categoryCount: 6 };
/** Ersten Seed suchen, bei dem Runde 1 mit `letter` beginnt (für lesbare Beispielantworten). */
function startWith(letter: string, n: number, settings: SettingsValues = SETTINGS): H {
  for (let seed = 1; seed < 500; seed++) {
    const h = createTestHarness<SlTvState, SlPlayerView>(game, { players: people(n), settings, seed });
    h.advance(TIMING.introMs);
    const s = h.lastTv()!;
    if (s.phase === "letter" && s.letter === letter) return h;
  }
  throw new Error(`kein Seed für ${letter}`);
}
const start = (n: number, settings: SettingsValues = SETTINGS): H => createTestHarness<SlTvState, SlPlayerView>(game, { players: people(n), settings, seed: 11 });
const toWrite = (h: H): H => {
  h.advance(TIMING.letterMs);
  return h;
};
const write = (n: number, answers = CLASSIC_B, settings?: SettingsValues, upto = 6): H => {
  const h = toWrite(startWith("B", n, settings));
  h.players.forEach((p, i) => h.input(p.id, { type: "answers", round: 0, answers: answers[i % answers.length]!.slice(0, upto) }));
  return h;
};
const toReview = (h: H): H => {
  const s = h.lastTv()!;
  if (s.phase === "write") h.advance(s.endsAt - h.clock.now());
  h.advance(TIMING.timeUpMs);
  return h;
};
const key = (h: H, id: string) => {
  const s = h.lastTv()!;
  return s.phase === "review" ? s.entries.find((e) => e.playerId === id)!.key : "";
};
const vote = (h: H, voter: string, target: string) => h.input(voter, { type: "challenge", round: 0, category: (h.lastTv() as { index: number }).index, key: key(h, target), on: true });

/** Spiel bis ins Finale spielen (mit Wertung). */
function playToFinal(n: number): H {
  const h = write(n);
  h.input("p1", { type: "stop", round: 0 });
  for (let i = 0; i < 2_000 && h.lastTv()!.phase !== "final"; i++) {
    const s = h.lastTv()!;
    if (s.phase === "write" && s.progress.every((p) => p.filled === 0)) {
      h.players.forEach((p, j) =>
        h.input(p.id, { type: "answers", round: s.round, answers: s.categories.map((_, c) => ((j + c + s.round) % 3 === 0 ? "" : `${s.letter}${"xyzuvw"[(j * c) % 6]}${j % 2}`)) }),
      );
      h.input(`p${(s.round % n) + 1}`, { type: "stop", round: s.round });
    }
    if (!h.skip()) h.advance(1_000);
  }
  return h;
}

type Built = { h: H; me?: string; at?: (s: SlTvState) => number; freeze?: boolean };
const sinceStart = (offset: number) => (s: SlTvState) => ("endsAt" in s && "durationMs" in s ? s.endsAt - s.durationMs + offset : 0);

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => Built }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: start(5) }) },
  "tv-letter-spin": { kind: "tv", build: () => ({ h: startWith("B", 4), at: sinceStart(1_100), freeze: true }) },
  "tv-letter": { kind: "tv", build: () => ({ h: startWith("B", 4), at: sinceStart(3_900), freeze: true }) },
  "tv-write": { kind: "tv", build: () => ({ h: write(5, CLASSIC_B, SETTINGS, 4), at: (s) => ("endsAt" in s ? s.endsAt - 48_000 : 0) }) },
  "tv-write-8": {
    kind: "tv",
    build() {
      const h = write(8, QUATSCH_B, { ...SETTINGS, set: "quatsch" }, 3);
      h.input("p2", { type: "answers", round: 0, answers: ["Bxx", "Byy", "Bzz", "Buu", "Bvv", "Bww"] });
      return { h, at: (s) => ("endsAt" in s ? s.endsAt - 8_000 : 0) };
    },
  },
  "tv-stop": {
    kind: "tv",
    build() {
      const h = write(4);
      h.advance(20_000);
      h.input("p3", { type: "stop", round: 0 });
      return { h, at: (s) => ("endsAt" in s ? s.endsAt - 3_200 : 0) };
    },
  },
  "tv-timeup": {
    kind: "tv",
    build() {
      const h = write(4);
      h.input("p2", { type: "stop", round: 0 });
      h.advance(TIMING.stopMs);
      return { h };
    },
  },
  "tv-review": {
    kind: "tv",
    build() {
      const h = toReview(write(4));
      vote(h, "p2", "p4");
      vote(h, "p1", "p4");
      vote(h, "p1", "p2");
      h.input("p3", { type: "ready", round: 0, category: 0 });
      return { h, at: (s) => ("endsAt" in s ? s.endsAt - 17_000 : 0) };
    },
  },
  "tv-review-8": {
    kind: "tv",
    build() {
      const h = toReview(write(8));
      vote(h, "p2", "p7");
      for (const id of ["p1", "p2", "p3", "p4", "p6"]) vote(h, id, "p8");
      return { h, at: (s) => ("endsAt" in s ? s.endsAt - 12_000 : 0) };
    },
  },
  "tv-review-quatsch": {
    kind: "tv",
    build() {
      const h = toReview(write(3, QUATSCH_B, { ...SETTINGS, set: "quatsch" }));
      return { h, at: (s) => ("endsAt" in s ? s.endsAt - 20_000 : 0) };
    },
  },
  "tv-standings": {
    kind: "tv",
    build() {
      const h = toReview(write(6));
      for (let i = 0; i < 6; i++) h.skip();
      return { h };
    },
  },
  "tv-final": { kind: "tv", build: () => ({ h: playToFinal(5), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },
  "tv-final-8": { kind: "tv", build: () => ({ h: playToFinal(8), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },

  "ctl-intro": { kind: "ctl", build: () => ({ h: start(3), me: "p1" }) },
  "ctl-letter": { kind: "ctl", build: () => ({ h: startWith("B", 3), me: "p1" }) },
  "ctl-write": { kind: "ctl", build: () => ({ h: write(3, CLASSIC_B, SETTINGS, 4), me: "p2", at: (s) => ("endsAt" in s ? s.endsAt - 52_000 : 0) }) },
  "ctl-write-empty": { kind: "ctl", build: () => ({ h: toWrite(startWith("B", 3)), me: "p1", at: (s) => ("endsAt" in s ? s.endsAt - 88_000 : 0) }) },
  "ctl-write-quatsch": {
    kind: "ctl",
    build: () => ({ h: write(3, QUATSCH_B, { ...SETTINGS, set: "quatsch" }), me: "p1", at: (s) => ("endsAt" in s ? s.endsAt - 30_000 : 0) }),
  },
  "ctl-stop-other": {
    kind: "ctl",
    build() {
      const h = write(3, CLASSIC_B, SETTINGS);
      h.input("p1", { type: "answers", round: 0, answers: ["Berlin", "Belgien", "", "Bernd", "", ""] });
      h.input("p3", { type: "stop", round: 0 });
      return { h, me: "p1", at: (s) => ("endsAt" in s ? s.endsAt - 3_200 : 0) };
    },
  },
  "ctl-timeup": {
    kind: "ctl",
    build() {
      const h = write(3);
      h.advance(90_000);
      return { h, me: "p1" };
    },
  },
  "ctl-review": {
    kind: "ctl",
    build() {
      const h = toReview(write(4));
      vote(h, "p1", "p4");
      vote(h, "p2", "p4");
      return { h, me: "p1", at: (s) => ("endsAt" in s ? s.endsAt - 15_000 : 0) };
    },
  },
  "ctl-review-8": {
    kind: "ctl",
    build() {
      const h = toReview(write(8));
      vote(h, "p1", "p8");
      return { h, me: "p1", at: (s) => ("endsAt" in s ? s.endsAt - 15_000 : 0) };
    },
  },
  "ctl-standings": {
    kind: "ctl",
    build() {
      const h = toReview(write(4));
      for (let i = 0; i < 6; i++) h.skip();
      return { h, me: "p1" };
    },
  },
  "ctl-final": { kind: "ctl", build: () => ({ h: playToFinal(4), me: "p1" }) },
};

const FRAME_TV = `
:root { --bg:#0d1a1d; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
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
  const name = params.get("scene") ?? "tv-review";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, me, at, freeze = false } = scene.build();
  const roomPlayers: Player[] = h.players.map((p, i) => ({ ...p, connected: i !== 2 || h.players.length < 5, isHost: i === 0 }));
  const s = h.lastTv()!;
  const clock = at ? at(s) : "endsAt" in s ? s.endsAt - 5_000 : h.clock.now();
  const base = { gameId: "stadtland", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
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
}

main();
