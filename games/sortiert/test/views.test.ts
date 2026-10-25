// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik, inklusive Tipp-Bedienung am Handy.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import { ALL_SETS } from "../src/data/index.js";
import { solutionOf } from "../src/scoring.js";
import game from "../src/server/index.js";
import { TIMING, cardRevealOffset, revealDurationMs, type SoPlayerView, type SoTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

const flush = () => new Promise((r) => setTimeout(r, 30));
const harness = (itemsPerRound = 4, categories = ["zeit"]) =>
  createTestHarness<SoTvState, SoPlayerView>(game, { players: 3, settings: { categories, rounds: 5, itemsPerRound, answerSeconds: 20 } });
const api = (now: () => number) => ({
  gameId: "sortiert",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ["p1", "p2", "p3"],
  serverNow: now,
});
type H = ReturnType<typeof harness>;
const solutionFor = (h: H) => {
  const v = h.lastView("p1")!;
  if (v.phase !== "sort") throw new Error("sort erwartet");
  const set = ALL_SETS.find((s) => s.id === v.setId)!;
  return solutionOf(
    v.cards.map((c) => set.items.find((i) => i.label === c.label)!.value),
    set.unit,
  );
};

describe("TV-View", () => {
  it("Intro, Sortierphase mit Karten, Richtung und ✅, Auflösung Platz für Platz, Perfekt!", () => {
    const h = harness(4);
    let now = 0;
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => now), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Reihenfolge");
    h.advance(TIMING.introMs);
    const sol = solutionFor(h);
    h.input("p1", { type: "order", order: sol, final: true });
    const s = h.lastTv()!;
    if (s.phase !== "sort") throw new Error("sort erwartet");
    now = s.endsAt - 10_000;
    v.update(s);
    expect(el.querySelector("[data-testid=so-prompt]")?.textContent).toBe(s.prompt);
    expect(el.querySelectorAll(".so-card")).toHaveLength(4);
    expect(el.querySelector("[data-testid=so-dir]")?.textContent).toContain("oben = am ältesten");
    expect(el.textContent).toContain("✅");
    expect(el.textContent).toContain("1 von 3 fertig");

    h.input("p2", { type: "order", order: [sol[1]!, sol[0]!, sol[2]!, sol[3]!], final: true });
    h.input("p3", { type: "order", order: [], final: false });
    h.advance(20_000);
    const r = h.lastTv()!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    // Mitten im Aufbau: zwei Karten offen, der Rest verdeckt, noch kein Perfekt.
    now = r.revealAt + cardRevealOffset(1) + 100;
    v.update(r);
    expect(el.querySelectorAll(".so-slot.is-open")).toHaveLength(2);
    expect(el.querySelector("[data-testid=so-value-2]")).toBeNull();
    expect(el.querySelector("[data-testid=so-value-0]")?.textContent).toBe(String(r.items[0]!.value));
    expect(el.querySelector("[data-testid=so-perfect]")).toBeNull();
    expect(el.querySelector("[data-testid=so-slot-0] .so-slot__who")?.children).toHaveLength(1);
    // Fertig aufgebaut: Punkte, Marken je Platz und Perfekt-Feier.
    now = r.resultAt + 100;
    v.update({ ...r });
    expect(el.querySelectorAll(".so-slot.is-open")).toHaveLength(4);
    expect(el.querySelector("[data-testid=so-perfect]")?.textContent).toContain("Perfekt!");
    expect(el.querySelector("[data-testid=so-perfect]")?.textContent).toContain("Spieler 1");
    expect(el.querySelector("[data-testid=so-res-p1]")?.classList.contains("is-perfect")).toBe(true);
    expect(el.querySelector("[data-testid=so-res-p1]")?.textContent).toContain("+600");
    expect(el.querySelector("[data-testid=so-res-p2]")?.textContent).toContain("≈≈✅✅");
    expect(el.querySelector("[data-testid=so-res-p3]")?.textContent).toContain("––––");

    h.advance(revealDurationMs(4));
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Zwischenstand");
    v.unmount();
  });

  it("Finale mit Podium", () => {
    const h = harness();
    for (let i = 0; i < 60 && h.lastTv()!.phase !== "final"; i++) h.skip() || h.advance(25_000);
    expect(h.lastTv()!.phase).toBe("final");
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.querySelectorAll(".so-step")).toHaveLength(3);
    v.unmount();
  });
});

describe("Controller-View", () => {
  const mount = (h: H, now: () => number = () => 0) => {
    const sendInput = vi.fn();
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...api(now), kind: "controller", playerId: "p1", isHost: () => false, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(h.lastView("p1")!);
    return { el, v, sendInput };
  };
  const tap = async (el: HTMLElement, sel: string) => {
    el.querySelector<HTMLButtonElement>(sel)!.click();
    await flush();
  };
  const slotTexts = (el: HTMLElement) => [...el.querySelectorAll("[data-testid^=sc-slot-] .sc-slot__label")].map((x) => x.textContent);
  const orders = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([i]) => i).filter((i) => i.type === "order");

  it("Antippen in Reihenfolge, Herausnehmen, Zurücksetzen, letzte Karte automatisch, Fertig", async () => {
    const h = harness(6);
    h.advance(TIMING.introMs);
    const { el, v, sendInput } = mount(h);
    await flush();
    const view = h.lastView("p1") as Extract<SoPlayerView, { phase: "sort" }>;
    const label = (i: number) => view.cards[i]!.label;
    expect(sendInput.mock.calls[0]![0]).toEqual({ type: "seen", ids: {} });
    expect(el.querySelector("[data-testid=sc-prompt]")?.textContent).toBe(view.prompt);
    expect(el.textContent).toContain("oben = am ältesten");
    expect(el.textContent).toContain("unten = am neuesten");
    expect(el.querySelectorAll(".sc-card")).toHaveLength(6);
    expect(el.querySelector<HTMLButtonElement>("[data-testid=sc-done]")!.disabled).toBe(true);
    expect(el.querySelector<HTMLButtonElement>("[data-testid=sc-reset]")!.disabled).toBe(true);

    await tap(el, "[data-testid=sc-card-3]");
    await tap(el, "[data-testid=sc-card-0]");
    await tap(el, "[data-testid=sc-card-5]");
    expect(slotTexts(el).slice(0, 3)).toEqual([label(3), label(0), label(5)]);
    expect(el.querySelectorAll(".sc-card")).toHaveLength(3);
    // Herausnehmen: die folgenden rücken nach.
    await tap(el, "[data-testid=sc-slot-0] button");
    expect(slotTexts(el).slice(0, 2)).toEqual([label(0), label(5)]);
    // Zurücksetzen.
    await tap(el, "[data-testid=sc-reset]");
    expect(el.querySelectorAll(".sc-card")).toHaveLength(6);
    expect(el.querySelectorAll(".sc-slot.is-empty")).toHaveLength(6);
    // Fünf antippen → die sechste rutscht automatisch ans Ende.
    for (const i of [4, 2, 1, 0, 5]) await tap(el, `[data-testid=sc-card-${i}]`);
    expect(slotTexts(el)).toEqual([4, 2, 1, 0, 5, 3].map(label));
    expect(el.querySelector("[data-testid=sc-pool]")?.textContent).toContain("Antippen nimmt");
    expect(el.querySelector<HTMLButtonElement>("[data-testid=sc-done]")!.disabled).toBe(false);
    // Herausnehmen füllt nicht automatisch wieder auf.
    await tap(el, "[data-testid=sc-slot-1] button");
    expect(slotTexts(el).filter((x) => x !== "frei")).toEqual([4, 1, 0, 5, 3].map(label));
    expect(el.querySelector<HTMLButtonElement>("[data-testid=sc-done]")!.disabled).toBe(true);
    await tap(el, "[data-testid=sc-card-2]");
    expect(slotTexts(el)).toEqual([4, 1, 0, 5, 3, 2].map(label));

    // Jede Änderung ging als Zwischenstand raus.
    expect(orders(sendInput).map((i) => i.order)).toEqual([
      [3],
      [3, 0],
      [3, 0, 5],
      [0, 5],
      [],
      [4],
      [4, 2],
      [4, 2, 1],
      [4, 2, 1, 0],
      [4, 2, 1, 0, 5, 3],
      [4, 1, 0, 5, 3],
      [4, 1, 0, 5, 3, 2],
    ]);
    expect(orders(sendInput).every((i) => i.final === false)).toBe(true);
    // Fertig: fix, „Abgegeben!“ mit der eigenen Reihenfolge.
    await tap(el, "[data-testid=sc-done]");
    expect(orders(sendInput).at(-1)).toEqual({ type: "order", order: [4, 1, 0, 5, 3, 2], final: true });
    expect(el.querySelector("[data-testid=sc-locked]")?.textContent).toContain("Abgegeben!");
    expect(el.querySelector(".sc-card")).toBeNull();
    expect(slotTexts(el)).toEqual([4, 1, 0, 5, 3, 2].map(label));
    expect(JSON.parse(localStorage.getItem("couchplay.sortiert.seen")!)).toEqual([view.setId]);
    v.unmount();
  });

  it("Reconnect: Zwischenstand aus der Server-Ansicht; Auflösung erst nach dem TV-Aufbau", async () => {
    const h = harness(4);
    h.advance(TIMING.introMs);
    const sol = solutionFor(h);
    h.input("p1", { type: "order", order: [sol[0]!, sol[2]!], final: false });
    let now = 0;
    const { el, v } = mount(h, () => now);
    await flush();
    expect(el.querySelectorAll(".sc-slot.is-empty")).toHaveLength(2);
    expect(el.querySelectorAll(".sc-card")).toHaveLength(2);

    h.advance(20_000);
    const r = h.lastView("p1")!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    now = r.revealAt + 1000;
    v.update(r);
    await flush();
    expect(el.textContent).toContain("Schau auf den Fernseher");
    expect(el.textContent).not.toContain(String(r.items[0]!.value));
    now = r.resultAt + 10;
    v.update({ ...r });
    await flush();
    const res = el.querySelector("[data-testid=sc-result]")!;
    expect(res.textContent).toContain("+150");
    expect(res.textContent).toContain("Zwischenstand wurde gewertet");
    expect(res.textContent).toContain(String(r.items[0]!.value));
    expect([...res.querySelectorAll(".sc-res__mark")].map((x) => x.textContent)).toEqual(["✅", "≈", "–", "–"]);
    v.unmount();
  });
});
