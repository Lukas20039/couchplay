// Vorschau der TV- und Controller-View mit echten Zuständen aus der Serverlogik.
// Aufruf: /?scene=<name>  – Liste siehe SCENES. Optional &text=… tippt am Handy einen Hinweis vor,
// &peek=1 hält die Rollenkarte gedrückt (aufgedeckt).
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers, type GameHarness } from "@couchplay/game-sdk/testing";
import type { AvatarId, Player, SettingsValues } from "@couchplay/protocol";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, voteSchedule, VERDICT_TIMES, type SpPlayerView, type SpTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

type H = GameHarness<SpTvState, SpPlayerView>;
const NAMES = ["Anna", "Ben", "Cleo", "Dino", "Ella", "Finn", "Greta", "Maximilian"];
const AVATARS: AvatarId[] = ["fuchs", "panda", "katze", "frosch", "eule", "tiger", "pinguin", "krake"];
const people = (n: number) => makePlayers(n).map((p, i) => ({ ...p, name: NAMES[i]!, avatar: AVATARS[i]!, color: i }));
/** Passende Hinweise zu „Strand“ – der Spion (klassisch) rät drauflos. */
const CLUES = ["Sonne", "Muscheln", "Handtuch", "Wellen", "Sandburg", "Urlaub", "Möwen", "Liegestuhl", "Barfuß", "Sonnencreme", "Ebbe", "Picknick", "Flut", "Palmen", "Eis", "Bikini"];
const SPY_CLUES = ["Entspannung", "Draußen", "Sommer"];

const BASE: SettingsValues = { categories: ["orte"], rounds: "5", clueRounds: 2, clueSeconds: 30, voteSeconds: 60 };

const tv = (h: H) => h.lastTv()!;
const phase = (h: H) => tv(h).phase;
const ids = (h: H) => h.players.map((p) => p.id);
const spyOf = (h: H): string => {
  const words = new Map(ids(h).map((id) => [id, h.lastView(id)?.secret] as const));
  const classic = [...words].find(([, s]) => s?.kind === "spy");
  if (classic) return classic[0];
  const count = new Map<string, number>();
  for (const s of words.values()) if (s?.kind === "word") count.set(s.word, (count.get(s.word) ?? 0) + 1);
  return [...words].find(([, s]) => s?.kind === "word" && count.get(s.word) === 1)![0];
};
const wordOf = (h: H): string => {
  const spy = spyOf(h);
  const s = h.lastView(ids(h).find((id) => id !== spy)!)!.secret;
  return s?.kind === "word" ? s.word : "";
};

/** Spiel mit „Strand“ als erstem Wort (Seed wird gesucht, damit die Hinweise passen). */
function start(n: number, settings: SettingsValues = {}, want = "Strand"): H {
  for (let seed = 1; seed < 2000; seed++) {
    const h = createTestHarness<SpTvState, SpPlayerView>(game, { players: people(n), settings: { ...BASE, ...settings }, seed });
    h.advance(TIMING.introMs);
    if (wordOf(h) === want) return h;
  }
  throw new Error(`Kein Seed für ${want}`);
}
const fresh = (n: number, settings: SettingsValues = {}): H =>
  createTestHarness<SpTvState, SpPlayerView>(game, { players: people(n), settings: { ...BASE, ...settings }, seed: 3 });
const allReady = (h: H, except: string[] = []): H => {
  for (const id of ids(h)) if (phase(h) === "role" && !except.includes(id)) h.input(id, { type: "ready" });
  return h;
};
/** `count` Züge spielen (passende Hinweise, Spion vage). */
function clues(h: H, count = 99): H {
  const spy = spyOf(h);
  let i = 0;
  let s = 0;
  for (let k = 0; k < count && phase(h) === "clue"; k++) {
    const turn = (tv(h) as Extract<SpTvState, { phase: "clue" }>).turn;
    const text = turn === spy ? SPY_CLUES[s++ % SPY_CLUES.length]! : CLUES[i++ % CLUES.length]!;
    h.input(turn, { type: "clue", text });
  }
  return h;
}
const toVote = (h: H): H => clues(allReady(h));
/** votes: Index des Wählers → Ziel ("spy" = Spion, Zahl = Index des Spielers). */
function vote(h: H, pick: (id: string, spy: string, i: number) => string | null): H {
  const spy = spyOf(h);
  ids(h).forEach((id, i) => {
    const target = pick(id, spy, i);
    if (target && phase(h) === "vote") h.input(id, { type: "vote", target });
  });
  return h;
}
const others = (h: H, id: string) => ids(h).filter((x) => x !== id);
/** Alle (außer einem Abweichler) tippen auf den Spion. */
const caught = (h: H): H => vote(h, (id, spy, i) => (id === spy ? others(h, spy)[0]! : i === 1 && id !== spy ? others(h, spy).find((o) => o !== id)! : spy));
const toVerdict = (h: H): H => {
  const s = tv(h) as Extract<SpTvState, { phase: "reveal" }>;
  h.advance(voteSchedule(s.flights.length).doneMs);
  return h;
};

type Built = { h: H; me?: string | ((h: H) => string); at?: (s: SpTvState) => number; freeze?: boolean };
const stepAt = (offset: number) => (s: SpTvState) => (s.phase === "reveal" ? s.stepAt + offset : 0);
const countDone = (s: SpTvState) => (s.phase === "reveal" ? s.stepAt + voteSchedule(s.flights.length).doneMs - 200 : 0);
const notSpy = (h: H) => others(h, spyOf(h))[0]!;

function playToFinal(n: number): H {
  const h = fresh(n, { rounds: "3", clueRounds: 1 });
  for (let i = 0; i < 400 && phase(h) !== "final"; i++) {
    const p = phase(h);
    if (p === "role") allReady(h);
    else if (p === "clue") clues(h);
    else if (p === "vote") (h.lastTv()!.round % 2 === 0 ? caught(h) : vote(h, (id, spy) => (id === spy ? others(h, spy)[1]! : others(h, id).find((o) => o !== spy)!)));
    else if (p === "guess") {
      const g = tv(h) as Extract<SpTvState, { phase: "guess" }>;
      h.input(g.spyId, { type: "guess", index: g.round === 2 ? g.options.indexOf(wordOf(h)) : 0 });
    } else if (!h.skip()) h.advance(1000);
  }
  return h;
}

const SCENES: Record<string, { kind: "tv" | "ctl"; build: () => Built }> = {
  "tv-intro": { kind: "tv", build: () => ({ h: fresh(5) }) },
  "tv-intro-undercover": { kind: "tv", build: () => ({ h: fresh(8, { mode: "undercover" }) }) },
  "tv-role": { kind: "tv", build: () => ({ h: allReady(start(5), ["p2", "p4"]) }) },
  "tv-clue": { kind: "tv", build: () => ({ h: clues(allReady(start(5)), 3) }) },
  "tv-clue-8": { kind: "tv", build: () => ({ h: clues(allReady(start(8, { clueRounds: 3 })), 13) }) },
  "tv-vote": {
    kind: "tv",
    build() {
      const h = toVote(start(5));
      h.input("p1", { type: "vote", target: "p3" });
      h.input("p4", { type: "vote", target: "p2" });
      return { h };
    },
  },
  "tv-vote-runoff": {
    kind: "tv",
    build() {
      const h = toVote(start(4));
      const spy = spyOf(h);
      const [a, b, c] = others(h, spy) as [string, string, string];
      h.input(a, { type: "vote", target: spy });
      h.input(b, { type: "vote", target: spy });
      h.input(spy, { type: "vote", target: a });
      h.input(c, { type: "vote", target: a });
      h.skip();
      return { h };
    },
  },
  "tv-reveal-fly": { kind: "tv", build: () => ({ h: caught(toVote(start(5))), at: stepAt(1_800) }) },
  "tv-reveal-accuse": { kind: "tv", build: () => ({ h: caught(toVote(start(5))), at: countDone }) },
  "tv-reveal-tie": {
    kind: "tv",
    build() {
      const h = toVote(start(4));
      const spy = spyOf(h);
      const [a, b, c] = others(h, spy) as [string, string, string];
      vote(h, (id) => (id === a || id === b ? spy : a));
      void c;
      return { h, at: countDone };
    },
  },
  "tv-reveal-drum": { kind: "tv", build: () => ({ h: toVerdict(caught(toVote(start(5)))), at: stepAt(900) }) },
  "tv-reveal-caught": { kind: "tv", build: () => ({ h: toVerdict(caught(toVote(start(5)))), at: stepAt(VERDICT_TIMES.spyMs + 1_500) }) },
  "tv-reveal-innocent": {
    kind: "tv",
    build() {
      const h = toVote(start(5));
      const wrong = notSpy(h);
      vote(h, (id, spy) => (id === wrong ? spy : wrong));
      return { h: toVerdict(h), at: stepAt(VERDICT_TIMES.spyMs + 1_500) };
    },
  },
  "tv-guess": {
    kind: "tv",
    build() {
      const h = caught(toVote(start(5)));
      h.skip();
      return { h };
    },
  },
  "tv-result-caught": {
    kind: "tv",
    build() {
      const h = caught(toVote(start(5)));
      h.skip();
      const g = tv(h) as Extract<SpTvState, { phase: "guess" }>;
      h.input(g.spyId, { type: "guess", index: g.options.findIndex((o) => o !== "Strand") });
      return { h };
    },
  },
  "tv-result-guessed": {
    kind: "tv",
    build() {
      const h = caught(toVote(start(6)));
      h.skip();
      const g = tv(h) as Extract<SpTvState, { phase: "guess" }>;
      h.input(g.spyId, { type: "guess", index: g.options.indexOf("Strand") });
      return { h };
    },
  },
  "tv-result-undercover": {
    kind: "tv",
    build() {
      const h = toVote(start(5, { mode: "undercover" }));
      const wrong = notSpy(h);
      vote(h, (id, spy) => (id === wrong ? spy : wrong));
      h.skip();
      return { h };
    },
  },
  "tv-final": { kind: "tv", build: () => ({ h: playToFinal(5), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },
  "tv-final-8": { kind: "tv", build: () => ({ h: playToFinal(8), at: (s) => ("endsAt" in s ? s.endsAt - 6_000 : 0) }) },

  "ctl-intro": { kind: "ctl", build: () => ({ h: fresh(4), me: "p1" }) },
  "ctl-role": { kind: "ctl", build: () => ({ h: start(4), me: notSpy }) },
  "ctl-role-shown": { kind: "ctl", build: () => ({ h: start(4), me: notSpy }) },
  "ctl-role-spy": { kind: "ctl", build: () => ({ h: start(4), me: spyOf }) },
  "ctl-role-undercover": { kind: "ctl", build: () => ({ h: start(4, { mode: "undercover" }), me: spyOf }) },
  "ctl-clue-wait": {
    kind: "ctl",
    build() {
      const h = clues(allReady(start(5)), 1);
      const turn = (tv(h) as Extract<SpTvState, { phase: "clue" }>).turn;
      return { h, me: (x) => others(x, turn).find((o) => o !== spyOf(x))! };
    },
  },
  "ctl-clue-turn": {
    kind: "ctl",
    build() {
      const h = allReady(start(5));
      const spy = spyOf(h);
      while ((tv(h) as Extract<SpTvState, { phase: "clue" }>).turn === spy) clues(h, 1);
      return { h, me: (x) => (tv(x) as Extract<SpTvState, { phase: "clue" }>).turn };
    },
  },
  "ctl-clue-rejected": {
    kind: "ctl",
    build() {
      const h = allReady(start(5));
      const spy = spyOf(h);
      while ((tv(h) as Extract<SpTvState, { phase: "clue" }>).turn === spy) clues(h, 1);
      const me = (tv(h) as Extract<SpTvState, { phase: "clue" }>).turn;
      h.input(me, { type: "clue", text: "Sandstrand" });
      return { h, me };
    },
  },
  "ctl-vote": { kind: "ctl", build: () => ({ h: toVote(start(8, { clueRounds: 1 })), me: "p1" }) },
  "ctl-vote-locked": {
    kind: "ctl",
    build() {
      const h = toVote(start(5));
      h.input("p1", { type: "vote", target: "p3" });
      return { h, me: "p1" };
    },
  },
  "ctl-reveal": { kind: "ctl", build: () => ({ h: caught(toVote(start(4))), me: "p1" }) },
  "ctl-guess-spy": {
    kind: "ctl",
    build() {
      const h = caught(toVote(start(5)));
      h.skip();
      return { h, me: spyOf };
    },
  },
  "ctl-guess-wait": {
    kind: "ctl",
    build() {
      const h = caught(toVote(start(5)));
      h.skip();
      return { h, me: notSpy };
    },
  },
  "ctl-result-won": {
    kind: "ctl",
    build() {
      const h = caught(toVote(start(5)));
      h.skip();
      h.advance(TIMING.guessMs);
      return { h, me: (x) => others(x, spyOf(x)).find((id) => (x.lastView(id) as { votedRight?: boolean }).votedRight)! };
    },
  },
  "ctl-result-spy": {
    kind: "ctl",
    build() {
      const h = toVote(start(5, { mode: "undercover" }));
      const wrong = notSpy(h);
      vote(h, (id, spy) => (id === wrong ? spy : wrong));
      h.skip();
      return { h, me: spyOf };
    },
  },
  "ctl-final": { kind: "ctl", build: () => ({ h: playToFinal(4), me: "p1" }) },
};

const FRAME_TV = `
:root { --bg:#0b1220; --p0:#ff5a5f; --p1:#3fa7ff; --p2:#3ddc84; --p3:#ffc93c; --p4:#b26bff; --p5:#ff8a3d; --p6:#2ee6d6; --p7:#ff5fbf; color-scheme: dark; }
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
  const name = params.get("scene") ?? "tv-reveal-caught";
  const scene = SCENES[name];
  const root = document.getElementById("root")!;
  if (!scene) {
    root.textContent = `Unbekannte Szene. Verfügbar: ${Object.keys(SCENES).join(", ")}`;
    return;
  }
  const { h, me, at, freeze = name.startsWith("tv-reveal") } = scene.build();
  const roomPlayers: Player[] = h.players.map((p, i) => ({ ...p, connected: i !== 2 || h.players.length < 5, isHost: i === 0 }));
  const s = h.lastTv()!;
  const clock = at ? at(s) : "endsAt" in s ? s.endsAt - 17_000 : 0;
  const base = { gameId: "spion", settings: {}, getPlayers: () => roomPlayers, getGamePlayerIds: () => h.players.map((p) => p.id), serverNow: () => clock };
  const style = document.createElement("style");
  style.textContent = (scene.kind === "tv" ? FRAME_TV : FRAME_CTL) + (freeze ? "\n* { animation-play-state: paused !important; }" : "");
  document.head.appendChild(style);
  if (scene.kind === "tv") {
    const v = tvView();
    v.mount(root, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(s);
    return;
  }
  const id = typeof me === "function" ? me(h) : me!;
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
  setTimeout(() => {
    // Rollenkarte gedrückt halten: ?peek=1 bzw. Szenen mit Rolle „aufgedeckt“.
    if (params.get("peek") === "1" || /^ctl-role-(shown|spy|undercover)$/.test(name)) {
      root.querySelector("[data-testid=sp-secret]")?.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    }
    const text = params.get("text");
    const input = root.querySelector<HTMLInputElement>("[data-testid=sp-input]");
    if (text && input) {
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, 50);
}

main();
