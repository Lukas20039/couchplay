// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, type KdPlayerView, type KdTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

const base = { gameId: "kennstdu", settings: {}, getPlayers: () => [], getGamePlayerIds: () => ["p1", "p2", "p3"], serverNow: () => 0 };
const flush = () => new Promise((r) => setTimeout(r, 30));
const harness = () =>
  createTestHarness<KdTvState, KdPlayerView>(game, { players: 3, settings: { categories: ["freizeit"], turns: 1, answerSeconds: 15 } });

describe("Views", () => {
  it("TV: Intro, Frage mit Name, Auflösung mit Haken", () => {
    const h = harness();
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Reihum ist eine Person dran");
    h.advance(TIMING.introMs);
    const s = h.lastTv()!;
    v.update(s);
    if (s.phase !== "ask") throw new Error("ask erwartet");
    expect(el.querySelector("[data-testid=kd-question]")?.textContent).toContain(s.hotseat.name);
    h.input(s.hotseat.id, { type: "answer", index: 1 });
    h.advance(15_000);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=kd-answer-1]")?.classList.contains("is-chosen")).toBe(true);
    v.unmount();
  });

  it("Controller: Rolle, Antwort senden, Sperre, Gedächtnis melden", async () => {
    const h = harness();
    h.advance(TIMING.introMs);
    const s = h.lastTv()!;
    if (s.phase !== "ask") throw new Error("ask erwartet");
    const guesser = h.players.find((p) => p.id !== s.hotseat.id)!.id;
    const sendInput = vi.fn();
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...base, kind: "controller", playerId: guesser, isHost: () => false, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(h.lastView(guesser)!);
    await flush();
    expect(el.querySelector("[data-testid=kd-role]")?.getAttribute("data-role")).toBe("guess");
    expect(el.textContent).toContain(`Was hat ${s.hotseat.name} gewählt?`);
    el.querySelector<HTMLButtonElement>("[data-testid=kd-btn-0]")!.click();
    await flush();
    expect(sendInput.mock.calls.map(([i]) => i)).toEqual([{ type: "seen", ids: {} }, { type: "answer", index: 0 }]);
    expect(el.querySelector("[data-testid=kd-locked]")).not.toBeNull();
    expect(JSON.parse(localStorage.getItem("couchplay.kennstdu.seen")!)).toHaveLength(1);
    v.unmount();
  });
});
