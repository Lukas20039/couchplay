// @vitest-environment happy-dom
// Rauchtest der Views: rendern echte Zustände aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import game, { COUNTDOWN_MS } from "../src/server/index.js";
import { SHAPES, fits, type BlockblastPlayerView, type BlockblastTvState } from "../src/shared.js";
import { bestMove } from "../src/testing.js";
import tvView from "../src/tv/index.js";

const base = { gameId: "blockblast", settings: {}, getPlayers: () => [], getGamePlayerIds: () => ["p1", "p2"], serverNow: () => 0 };
const flush = () => new Promise((r) => setTimeout(r, 30));
const harness = () => createTestHarness<BlockblastTvState, BlockblastPlayerView>(game, { players: 2 });

describe("Views", () => {
  it("TV: Countdown, Bretter aller Spieler, Punkte", () => {
    const h = harness();
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Gleich geht’s los!");
    h.advance(COUNTDOWN_MS);
    const view = h.lastView("p1")!;
    h.input("p1", { type: "place", ...bestMove(view.me.board, view.hand)! });
    v.update(h.lastTv()!);
    expect(el.querySelectorAll(".bb-panel")).toHaveLength(2);
    expect(Number(el.querySelector("[data-testid=bb-score-p1]")?.firstChild?.textContent)).toBeGreaterThan(0);
    expect(el.querySelectorAll("[data-testid=bb-panel-p1] .bb-cell.is-block").length).toBeGreaterThan(0);
    v.unmount();
  });

  it("Controller: Teil antippen, Feld wählen → place; ungültig → kein Senden", async () => {
    const h = harness();
    h.advance(COUNTDOWN_MS);
    const sendInput = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const v = controllerView();
    v.mount(el, { ...base, kind: "controller", playerId: "p1", isHost: () => true, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(h.lastView("p1")!);
    const shape = SHAPES[h.lastView("p1")!.hand[0]!]!;
    const slot = () => el.querySelector<HTMLButtonElement>("[data-testid=bb-slot-0]")!;
    slot().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
    slot().dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
    await flush();
    expect(slot().getAttribute("aria-pressed")).toBe("true");
    // Unten rechts passt nur ein 1×1-Teil.
    if (shape.w > 1 || shape.h > 1) {
      el.querySelector<HTMLButtonElement>("[data-testid=bb-cell-63]")!.click();
      expect(sendInput).not.toHaveBeenCalled();
    }
    expect(fits(h.lastView("p1")!.me.board, shape, 0, 0)).toBe(true);
    el.querySelector<HTMLButtonElement>("[data-testid=bb-cell-0]")!.click();
    expect(sendInput).toHaveBeenCalledWith({ type: "place", slot: 0, x: 0, y: 0 });
    await flush();
    // Vorläufig gelegt, bis der Server antwortet.
    expect(el.querySelector("[data-testid=bb-cell-0]")?.getAttribute("data-cell")).toBe(String(shape.color));
    v.unmount();
  });
});
