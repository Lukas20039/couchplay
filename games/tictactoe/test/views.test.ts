// @vitest-environment happy-dom
// Rauchtest der Views: rendern echte Zustände aus der Serverlogik; Controller sendet nur, wenn man am Zug ist.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import type { TicTacToePlayerView, TicTacToeTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

const base = {
  gameId: "tictactoe",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ["p1", "p2"],
  serverNow: () => 0,
};

const harness = () => createTestHarness<TicTacToeTvState, TicTacToePlayerView>(game, { players: 2 });

describe("Views", () => {
  it("TV zeigt Spieler, Zug und Ergebnis-Banner", () => {
    const h = harness();
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Spieler 1 beginnt");
    for (const [p, c] of [["p1", 4], ["p2", 0], ["p1", 2], ["p2", 1], ["p1", 6]] as const) h.input(p, { type: "place", cell: c });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=ttt-banner]")?.textContent).toBe("Spieler 1 gewinnt!");
    expect(el.querySelectorAll(".ttt-winline line")).toHaveLength(2);
    v.unmount();
  });

  it("Controller: Felder nur am Zug aktiv, Tippen sendet place, Vibration bei Ende", async () => {
    const h = harness();
    const sendInput = vi.fn();
    const vibrate = vi.fn();
    const mount = (playerId: string) => {
      const el = document.createElement("div");
      const v = controllerView();
      v.mount(el, { ...base, kind: "controller", playerId, isHost: () => false, sendInput, vibrate } satisfies ControllerViewApi);
      v.update(h.lastView(playerId)!);
      return { el, v };
    };
    const p2 = mount("p2");
    const cell = (el: HTMLElement, i: number) => el.querySelector<HTMLButtonElement>(`[data-testid=ttt-cell-${i}]`)!;
    expect(cell(p2.el, 4).disabled).toBe(true);
    expect(p2.el.textContent).toContain("Spieler 1 ist am Zug");

    const p1 = mount("p1");
    expect(cell(p1.el, 4).disabled).toBe(false);
    cell(p1.el, 4).click();
    expect(sendInput).toHaveBeenCalledWith({ type: "place", cell: 4 });

    for (const [p, c] of [["p1", 4], ["p2", 0], ["p1", 2], ["p2", 1], ["p1", 6]] as const) h.input(p, { type: "place", cell: c });
    p2.v.update(h.lastView("p2")!);
    expect(p2.el.querySelector("[data-testid=ttt-result]")?.textContent).toContain("Verloren");
    await new Promise((r) => setTimeout(r, 50)); // Preact-Effekte laufen asynchron
    expect(vibrate).toHaveBeenCalledWith([350]);
  });
});
