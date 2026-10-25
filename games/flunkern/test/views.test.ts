// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import { ALL_QUESTIONS } from "../src/data/index.js";
import game from "../src/server/index.js";
import { TIMING, type FlPlayerView, type FlTvState } from "../src/shared.js";
import tvView, { gridColumns } from "../src/tv/index.js";

const flush = () => new Promise((r) => setTimeout(r, 30));
const harness = (players = 3) =>
  createTestHarness<FlTvState, FlPlayerView>(game, { players, settings: { categories: ["kurioses"], rounds: 3, writeSeconds: 60 } });
const api = (now: () => number) => ({
  gameId: "flunkern",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ["p1", "p2", "p3"],
  serverNow: now,
});
const questionOf = (h: ReturnType<typeof harness>) => {
  const v = h.lastView("p1")!;
  if (v.phase !== "write") throw new Error("write erwartet");
  return ALL_QUESTIONS.find((q) => q.id === v.questionId)!;
};
const tvOptions = (h: ReturnType<typeof harness>) => {
  const s = h.lastTv()!;
  if (s.phase !== "choose") throw new Error("choose erwartet");
  return s.options;
};

describe("TV-View", () => {
  it("Intro, Schreiben mit ✅, Wählen als Kacheln, Auflösung mit Stempel und Autor, Wahrheit, Zwischenstand", () => {
    const h = harness();
    let now = 0;
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => now), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("wer lügt am besten");
    h.advance(TIMING.introMs);
    const q = questionOf(h);
    h.input("p1", { type: "lie", text: "Gartenzwerg-Steuer" });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=fl-question]")?.textContent).toBe(q.question);
    expect(el.textContent).toContain("✅");
    expect(el.textContent).toContain("1 von 3 haben gelogen");
    expect(el.textContent).not.toContain("Gartenzwerg");

    h.input("p2", { type: "lie", text: "Blockflötenverbot" });
    h.input("p3", { type: "lie", text: "Tanzende Kühe" });
    const opts = tvOptions(h);
    v.update(h.lastTv()!);
    expect(el.querySelectorAll(".fl-tile")).toHaveLength(4);
    expect(el.querySelector("[data-testid=fl-grid]")?.getAttribute("data-cols")).toBe("2");

    h.input("p1", { type: "choose", index: opts.indexOf(q.answer) });
    h.input("p2", { type: "choose", index: opts.indexOf("Gartenzwerg-Steuer") });
    h.input("p3", { type: "choose", index: opts.indexOf("Gartenzwerg-Steuer") });
    const r = h.lastTv()!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    now = r.stepAt + 2_000;
    v.update(r);
    expect(el.querySelector("[data-testid=fl-stage]")?.getAttribute("data-kind")).toBe("lie");
    expect(el.querySelector("[data-testid=fl-card-text]")?.textContent).toBe("Gartenzwerg-Steuer");
    expect(el.textContent).toContain("GELOGEN!");
    expect(el.querySelector("[data-testid=fl-author]")?.textContent).toContain("Gelogen von Spieler 1!");
    expect(el.querySelector("[data-testid=fl-author]")?.textContent).toContain("+500");
    expect(el.querySelectorAll("[data-testid=fl-fallers] .fl-faller")).toHaveLength(2);

    h.advance(TIMING.revealLieMs);
    const truth = h.lastTv()!;
    if (truth.phase !== "reveal") throw new Error("reveal erwartet");
    now = truth.stepAt + 5_000;
    v.update(truth);
    expect(el.querySelector("[data-testid=fl-stage]")?.getAttribute("data-kind")).toBe("truth");
    expect(el.querySelector("[data-testid=fl-card-text]")?.textContent).toBe(q.answer);
    expect(el.textContent).toContain("WAHR!");
    expect(el.textContent).toContain("Und die Wahrheit ist");
    if (q.fact) expect(el.querySelector("[data-testid=fl-fact]")?.textContent).toContain(q.fact);

    h.advance(TIMING.revealTruthMs);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Zwischenstand");
    expect(el.textContent).toContain("+1.000");
    v.unmount();
  });

  it("Hauslüge in der Auflösung und 3 Spalten ab 7 Antworten", () => {
    expect([4, 6, 7, 9].map(gridColumns)).toEqual([2, 2, 3, 3]);
    const h = harness(2);
    h.advance(TIMING.introMs);
    const q = questionOf(h);
    h.input("p1", { type: "lie", text: "Gartenzwerg-Steuer" });
    h.input("p2", { type: "lie", text: "Blockflötenverbot" });
    const house = tvOptions(h).findIndex((o) => q.lies.includes(o));
    h.input("p1", { type: "choose", index: house });
    h.input("p2", { type: "choose", index: house });
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=fl-author]")?.textContent).toContain("Hauslüge");
    v.unmount();
  });

  it("Finale mit Podium und Auszeichnungen", () => {
    const h = harness();
    h.advance(TIMING.introMs);
    const q = questionOf(h);
    h.input("p1", { type: "lie", text: "Gartenzwerg-Steuer" });
    h.input("p2", { type: "lie", text: "Blockflötenverbot" });
    h.input("p3", { type: "lie", text: "Tanzende Kühe" });
    const opts = tvOptions(h);
    h.input("p1", { type: "choose", index: opts.indexOf(q.answer) });
    h.input("p2", { type: "choose", index: opts.indexOf("Gartenzwerg-Steuer") });
    h.input("p3", { type: "choose", index: opts.indexOf(q.answer) });
    for (let i = 0; i < 30 && h.lastTv()!.phase !== "final"; i++) h.skip() || h.advance(60_000);
    expect(h.lastTv()!.phase).toBe("final");
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.querySelectorAll(".fl-step")).toHaveLength(3);
    expect(el.querySelector("[data-testid=fl-awards]")?.textContent).toContain("Größter Lügenbaron");
    expect(el.querySelector("[data-testid=fl-awards]")?.textContent).toContain("Wahrheitsfinder");
    v.unmount();
  });
});

describe("Controller-View", () => {
  const mount = (h: ReturnType<typeof harness>, id: string, now: () => number = () => 0) => {
    const sendInput = vi.fn();
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...api(now), kind: "controller", playerId: id, isHost: () => false, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(h.lastView(id)!);
    return { el, v, sendInput };
  };
  const type = async (el: HTMLElement, text: string) => {
    const input = el.querySelector<HTMLInputElement>("[data-testid=fl-input]")!;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  };
  const submit = async (el: HTMLElement) => {
    el.querySelector<HTMLFormElement>("[data-testid=fl-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  };

  it("Textfeld mit Zähler, Abschicken, Ablehnung zu naher Wahrheit, danach fix; Gedächtnis gemeldet", async () => {
    const h = harness();
    h.advance(TIMING.introMs);
    const q = questionOf(h);
    const { el, v, sendInput } = mount(h, "p1");
    await flush();
    expect(el.querySelector<HTMLButtonElement>("[data-testid=fl-submit]")!.disabled).toBe(true);
    await type(el, `  ${q.answer}  `);
    expect(el.querySelector("[data-testid=fl-counter]")?.textContent).toBe(`${[...q.answer].length}/40`);
    await submit(el);
    expect(sendInput.mock.calls.map(([i]) => i)).toEqual([{ type: "seen", ids: {} }, { type: "lie", text: q.answer }]);
    expect(el.querySelector("[data-testid=fl-locked]")).not.toBeNull();
    // Server lehnt ab → Hinweis, Feld wieder frei.
    h.input("p1", { type: "lie", text: q.answer });
    v.update(h.lastView("p1")!);
    await flush();
    expect(el.querySelector("[data-testid=fl-rejected]")?.textContent).toBe("Zu nah an der Wahrheit – denk dir was anderes aus!");
    expect(el.querySelector("[data-testid=fl-locked]")).toBeNull();
    await type(el, "Gartenzwerg-Steuer");
    await submit(el);
    h.input("p1", { type: "lie", text: "Gartenzwerg-Steuer" });
    v.update(h.lastView("p1")!);
    await flush();
    expect(el.querySelector("[data-testid=fl-locked]")?.textContent).toContain("Gartenzwerg-Steuer");
    expect(el.textContent).toContain("Warte auf die anderen");
    expect(JSON.parse(localStorage.getItem("couchplay.flunkern.seen")!)).toEqual([q.id]);
    v.unmount();
  });

  it("Wählen: eigene Lüge markiert und gesperrt; Ergebnis erst nach dem Aufdecken der Wahrheit", async () => {
    const h = harness();
    h.advance(TIMING.introMs);
    const q = questionOf(h);
    h.input("p1", { type: "lie", text: "Gartenzwerg-Steuer" });
    h.input("p2", { type: "lie", text: "Blockflötenverbot" });
    h.input("p3", { type: "lie", text: "Tanzende Kühe" });
    const opts = tvOptions(h);
    const { el, v, sendInput } = mount(h, "p1");
    await flush();
    const own = el.querySelector<HTMLButtonElement>(`[data-testid=fl-btn-${opts.indexOf("Gartenzwerg-Steuer")}]`)!;
    expect(own.disabled).toBe(true);
    expect(own.textContent).toContain("Deine Lüge");
    const truthBtn = el.querySelector<HTMLButtonElement>(`[data-testid=fl-btn-${opts.indexOf(q.answer)}]`)!;
    truthBtn.click();
    await flush();
    expect(sendInput.mock.calls.at(-1)![0]).toEqual({ type: "choose", index: opts.indexOf(q.answer) });
    expect(el.textContent).toContain("Gewählt");
    h.input("p1", { type: "choose", index: opts.indexOf(q.answer) });
    h.input("p2", { type: "choose", index: opts.indexOf("Gartenzwerg-Steuer") });
    h.input("p3", { type: "choose", index: opts.indexOf("Gartenzwerg-Steuer") });
    v.update(h.lastView("p1")!);
    await flush();
    expect(el.textContent).toContain("Schau auf den Fernseher");
    expect(el.textContent).not.toContain("Wahrheit gefunden");
    h.advance(TIMING.revealLieMs);
    v.update(h.lastView("p1")!);
    await flush();
    const res = el.querySelector("[data-testid=fl-result]")!;
    expect(res.textContent).toContain("Wahrheit gefunden!");
    expect(res.textContent).toContain(q.answer);
    expect(el.querySelector("[data-testid=fl-fooled]")?.textContent).toBe("Auf deine Lüge reingefallen: Spieler 2 & Spieler 3");
    expect(res.textContent).toContain("+1.000");
    v.unmount();
  });
});
