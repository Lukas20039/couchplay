// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, revealSchedule, statement, type WePlayerView, type WeTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

const flush = () => new Promise((r) => setTimeout(r, 30));
const harness = (players = 3, extra: SettingsValues = {}) =>
  createTestHarness<WeTvState, WePlayerView>(game, { players, settings: { categories: ["alltag"], rounds: 5, voteSeconds: 20, ...extra } });
const api = (now: () => number) => ({
  gameId: "wuerdeeher",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ["p1", "p2", "p3"],
  serverNow: now,
});

describe("TV-View", () => {
  it("Intro, Abstimmung mit ✅, Auflösung mit einfliegenden Stimmen, Krone und Aussage, Zwischenstand", () => {
    const h = harness(3);
    let now = 0;
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => now), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Wer würde eher");
    h.advance(TIMING.introMs);
    h.input("p1", { type: "vote", target: "p2" });
    const s = h.lastTv()!;
    if (s.phase !== "vote") throw new Error("vote erwartet");
    v.update(s);
    expect(el.querySelector("[data-testid=we-prompt]")?.textContent).toBe(s.text);
    expect(el.querySelector("[data-testid=we-voter-p1]")?.getAttribute("data-voted")).toBe("1");
    expect(el.querySelector("[data-testid=we-voter-p2]")?.getAttribute("data-voted")).toBe("0");
    expect(el.textContent).toContain("1 von 3 haben abgestimmt");

    h.input("p2", { type: "vote", target: "p2" });
    h.input("p3", { type: "vote", target: "p1" });
    const r = h.lastTv()!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    const plan = revealSchedule(3);
    // Vor den ersten Stimmen: alle Säulen leer, noch keine Krone.
    now = r.revealAt;
    v.update(r);
    expect(el.querySelectorAll(".we-chip")).toHaveLength(0);
    expect(el.querySelector("[data-testid=we-crowned]")).toBeNull();
    // Nach zwei Stimmen.
    now = r.revealAt + plan.firstMs + plan.stepMs + 10;
    v.update({ ...r });
    expect(el.querySelectorAll(".we-chip")).toHaveLength(2);
    // Nach der Krönung: Aussage mit Namen, Krone, +100 für die Mehrheit.
    now = r.revealAt + plan.pointsMs + 10;
    v.update({ ...r });
    expect(el.querySelectorAll(".we-chip")).toHaveLength(3);
    expect(el.querySelector("[data-testid=we-col-p2]")?.getAttribute("data-count")).toBe("2");
    expect(el.querySelector("[data-testid=we-col-p2]")?.classList.contains("is-win")).toBe(true);
    expect(el.querySelector("[data-testid=we-crowned]")?.textContent).toBe(`Spieler 2 würde eher ${statement(r.text)}!`);
    expect(el.querySelector("[data-testid=we-pts-p1]")?.textContent).toBe("+100");
    expect(el.querySelector("[data-testid=we-pts-p3]")?.textContent).toBe("");

    h.advance(TIMING.revealMs);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Zwischenstand");
    v.unmount();
  });

  it("anonym: neutrale Chips, keine Avatare der Wähler; Gleichstand mit mehreren Kronen", () => {
    const h = harness(4, { anonymous: "anonym" });
    h.advance(TIMING.introMs);
    for (const [a, b] of [["p1", "p2"], ["p2", "p1"], ["p3", "p1"], ["p4", "p2"]]) h.input(a!, { type: "vote", target: b! });
    const r = h.lastTv()!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => r.revealAt + 60_000), kind: "tv" } satisfies TvViewApi);
    v.update(r);
    expect(el.querySelectorAll(".we-chip.is-anon")).toHaveLength(4);
    expect(el.querySelectorAll(".we-crown")).toHaveLength(2);
    expect(el.querySelector("[data-testid=we-crowned]")?.textContent).toContain("Spieler 1 & Spieler 2 würden eher");
    expect(el.textContent).toContain("Alle lagen mit der Mehrheit");
    v.unmount();
  });

  it("Finale mit Podium und Titeln für alle Spieler", () => {
    const h = harness(4);
    h.advance(TIMING.introMs);
    for (let i = 0; i < 60 && h.lastTv()!.phase !== "final"; i++) {
      const s = h.lastTv()!;
      if (s.phase === "vote") for (const p of h.players) h.input(p.id, { type: "vote", target: i % 2 ? "p1" : "p3" });
      else h.skip() || h.advance(1_000);
    }
    const f = h.lastTv()!;
    expect(f.phase).toBe("final");
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(f);
    expect(el.querySelectorAll(".we-step")).toHaveLength(3);
    expect(el.querySelectorAll(".we-title-row")).toHaveLength(4);
    expect(el.querySelector("[data-testid=we-title-p1]")?.textContent).toMatch(/– würde eher .*\(4 Stimmen\)/);
    expect(el.querySelector("[data-testid=we-title-p2]")?.classList.contains("is-none")).toBe(true);
    v.unmount();
  });
});

describe("Controller-View", () => {
  it("Kacheln mit „Ich“, Tippen sendet Stimme, danach fix; Gedächtnis gemeldet und gemerkt", async () => {
    const h = harness(3);
    h.advance(TIMING.introMs);
    const sendInput = vi.fn();
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...api(() => 0), kind: "controller", playerId: "p1", isHost: () => false, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(h.lastView("p1")!);
    await flush();
    expect(el.querySelectorAll(".we-tile")).toHaveLength(3);
    expect(el.querySelector("[data-testid=we-tile-p1]")?.textContent).toContain("Ich");
    expect(el.querySelector("[data-testid=we-tile-p2]")?.textContent).not.toContain("Ich");
    el.querySelector<HTMLButtonElement>("[data-testid=we-tile-p2]")!.click();
    await flush();
    expect(sendInput.mock.calls.map(([i]) => i)).toEqual([{ type: "seen", ids: {} }, { type: "vote", target: "p2" }]);
    const locked = el.querySelector("[data-testid=we-locked]")?.textContent ?? "";
    expect(locked).toContain("Deine Stimme:");
    expect(locked).toContain("Spieler 2");
    expect(el.querySelector(".we-tile")).toBeNull();
    expect(JSON.parse(localStorage.getItem("couchplay.wuerdeeher.seen")!)).toHaveLength(1);
    v.unmount();
  });

  it("Auflösung erst nach der Krönung am TV: Gewinner, Mehrheit +100, eigene Stimmen", async () => {
    const h = harness(3);
    h.advance(TIMING.introMs);
    h.input("p1", { type: "vote", target: "p2" });
    h.input("p2", { type: "vote", target: "p2" });
    h.input("p3", { type: "vote", target: "p2" });
    const r = h.lastView("p2")!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    let now = r.revealAt + 500;
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...api(() => now), kind: "controller", playerId: "p2", isHost: () => false, sendInput: vi.fn(), vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(r);
    await flush();
    expect(el.textContent).toContain("Schau auf den Fernseher");
    now = r.revealAt + revealSchedule(r.voteCount).crownMs + 10;
    v.update({ ...r });
    await flush();
    const res = el.querySelector("[data-testid=we-result]")!.textContent!;
    expect(res).toContain("Mit der Mehrheit!");
    expect(res).toContain("+100");
    expect(res).toContain("Das bist du!");
    expect(res).toContain("Für dich: 3 Stimmen");
    v.unmount();
  });
});
