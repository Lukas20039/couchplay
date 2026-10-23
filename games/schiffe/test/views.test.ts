// @vitest-environment happy-dom
// Rauchtest der Views: rendern echte Zustände aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import game, { END_DELAY_MS } from "../src/server/index.js";
import { FLEETS, fleetProblem, shipCells, type SchiffePlayerView, type SchiffeTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

const base = {
  gameId: "schiffe",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ["p1", "p2"],
  serverNow: () => 0,
};

const harness = () => createTestHarness<SchiffeTvState, SchiffePlayerView>(game, { players: 2 });
const flush = () => new Promise((r) => setTimeout(r, 30)); // Preact-Effekte laufen asynchron

function mountCtl(h: ReturnType<typeof harness>, playerId: string) {
  const sendInput = vi.fn();
  const vibrate = vi.fn();
  const el = document.createElement("div");
  const v = controllerView();
  v.mount(el, { ...base, kind: "controller", playerId, isHost: () => false, sendInput, vibrate } satisfies ControllerViewApi);
  v.update(h.lastView(playerId)!);
  return { el, v, sendInput, vibrate };
}

describe("Views", () => {
  it("TV: Aufstellung, Schuss-Meldung und Sieger-Banner – Schiffe erst nach dem Versenken", () => {
    const h = harness();
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Stellt eure Flotten auf!");
    expect(el.querySelectorAll(".sv-ship")).toHaveLength(0);
    h.input("p1", { type: "ready" });
    h.input("p2", { type: "ready" });
    const enemy = h.lastView("p2")!.fleet.flatMap((s) => shipCells(s));
    h.input("p1", { type: "fire", cell: enemy[0]! });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sv-status]")?.textContent).toMatch(/Spieler 1: [A-J]\d+ – Treffer!/);
    for (const c of enemy.slice(1)) h.input("p1", { type: "fire", cell: c });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sv-banner]")?.textContent).toBe("Spieler 1 gewinnt!");
    expect(el.querySelectorAll("[data-testid=sv-board-1] .sv-ship")).toHaveLength(5);
    v.unmount();
  });

  it("Controller: Aufstellung – Schiff wählen, verschieben, bereit", async () => {
    const h = createTestHarness<SchiffeTvState, SchiffePlayerView>(game, { players: 2, settings: { touching: true } });
    const { el, sendInput } = mountCtl(h, "p1");
    const fleet = h.lastView("p1")!.fleet;
    const cell = (i: number) => el.querySelector<HTMLButtonElement>(`[data-testid=sv-place-${i}]`)!;
    const occupied = new Set(fleet.flatMap((s) => shipCells(s)));
    const small = fleet.at(-1)!;
    cell(shipCells(small)[0]!).click();
    await flush();
    expect(el.querySelector("[data-testid=sv-status]")?.textContent).toBe("Ausgewählt: U-Boot");
    const target = [...Array(100).keys()].find((c) => {
      if (occupied.has(c)) return false;
      const moved = fleet.map((s) => (s.id === small.id ? { ...s, x: c % 10, y: Math.floor(c / 10) } : s));
      return fleetProblem(moved, FLEETS.klassisch, true) === null;
    })!;
    cell(target).click();
    await flush();
    expect(sendInput).toHaveBeenCalledWith({ type: "move", ship: small.id, x: target % 10, y: Math.floor(target / 10), dir: small.dir });
    el.querySelector<HTMLButtonElement>("[data-testid=sv-ready]")!.click();
    expect(sendInput).toHaveBeenLastCalledWith({ type: "ready" });
  });

  it("Controller: Feuern nur am Zug auf unbekannte Felder, Vibration bei Ende", async () => {
    const h = harness();
    h.input("p1", { type: "ready" });
    h.input("p2", { type: "ready" });
    const p1 = mountCtl(h, "p1");
    const p2 = mountCtl(h, "p2");
    const target = (el: HTMLElement, i: number) => el.querySelector<HTMLButtonElement>(`[data-testid=sv-cell-${i}]`)!;
    expect(target(p2.el, 0).disabled).toBe(true);
    expect(p2.el.textContent).toContain("Spieler 1 zielt");
    expect(target(p1.el, 0).disabled).toBe(false);
    target(p1.el, 0).click();
    expect(p1.sendInput).toHaveBeenCalledWith({ type: "fire", cell: 0 });

    for (const c of h.lastView("p2")!.fleet.flatMap((s) => shipCells(s))) h.input("p1", { type: "fire", cell: c });
    p2.v.update(h.lastView("p2")!);
    expect(p2.el.querySelector("[data-testid=sv-result]")?.textContent).toContain("Verloren");
    await flush();
    expect(p2.vibrate).toHaveBeenCalledWith([350]);
    h.advance(END_DELAY_MS);
  });
});
