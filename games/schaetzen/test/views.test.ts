// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import { ALL_QUESTIONS } from "../src/data/index.js";
import game from "../src/server/index.js";
import { REVEAL_STEPS, TIMING, type EsPlayerView, type EsTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

const flush = () => new Promise((r) => setTimeout(r, 30));
const harness = (categories = ["geschichte"]) =>
  createTestHarness<EsTvState, EsPlayerView>(game, { players: 3, settings: { categories, rounds: 5, answerSeconds: 20 } });
const api = (now: () => number) => ({
  gameId: "schaetzen",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ["p1", "p2", "p3"],
  serverNow: now,
});

describe("TV-View", () => {
  it("Intro, Frage mit Einheit und ✅, Auflösung mit Zahlenstrahl, Lösung und Nächstem", () => {
    const h = harness();
    let now = 0;
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => now), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Schätzfragen");
    h.advance(TIMING.introMs);
    const v1 = h.lastView("p1")!;
    if (v1.phase !== "question") throw new Error("question erwartet");
    const q = ALL_QUESTIONS.find((x) => x.id === v1.questionId)!;
    h.input("p1", { type: "guess", value: q.answer - 5 });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=es-question]")?.textContent).toBe(q.question);
    expect(el.querySelector("[data-testid=es-unit]")?.textContent).toBe("Jahreszahl");
    expect(el.textContent).toContain("✅");
    expect(el.textContent).toContain("1 von 3 fertig");

    h.input("p2", { type: "guess", value: q.answer + 3 });
    h.input("p3", { type: "guess", value: 1 });
    const r = h.lastTv()!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    // Mitten in der Animation: Pins da, Lösung noch nicht.
    now = r.revealAt + REVEAL_STEPS.drumMs + 100;
    v.update(r);
    expect(el.querySelectorAll(".es-pin")).toHaveLength(3);
    expect(el.querySelector("[data-testid=es-answer]")).toBeNull();
    expect(el.textContent).toContain("Und die Lösung ist");
    // Danach: Lösung, Abstände, Nächster hervorgehoben, Ausreißer geklemmt.
    now = r.revealAt + REVEAL_STEPS.resultMs + 100;
    v.update({ ...r });
    expect(el.querySelector("[data-testid=es-answer]")?.textContent).toBe(String(q.answer));
    expect(el.querySelector("[data-testid=es-outcome]")?.textContent).toContain("Am nächsten dran: Spieler 2!");
    expect(el.querySelector("[data-testid=es-pin-p2]")?.classList.contains("is-best")).toBe(true);
    expect(el.querySelector("[data-testid=es-pin-p3]")?.classList.contains("is-clamped")).toBe(true);
    expect(el.textContent).toContain("3 Jahre");

    h.advance(TIMING.revealAnimMs + TIMING.revealHoldMs);
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
    expect(el.querySelectorAll(".es-step")).toHaveLength(3);
    v.unmount();
  });
});

describe("Controller-View", () => {
  it("Ziffernfeld mit Tausenderpunkten, Fertig sendet Tipp, danach fix; Gedächtnis gemeldet", async () => {
    // Erste Frage ohne Jahreszahl suchen (Komma muss erlaubt sein), unabhängig vom Datenbestand.
    const h = (() => {
      for (let seed = 1; ; seed++) {
        const x = createTestHarness<EsTvState, EsPlayerView>(game, { players: 3, settings: { categories: ["weltall", "technik"], rounds: 5, answerSeconds: 20 }, seed });
        x.advance(TIMING.introMs);
        const q = ALL_QUESTIONS.find((y) => y.id === (x.lastView("p1") as { questionId: string }).questionId)!;
        if (q.unit !== "Jahr") return x;
      }
    })();
    const sendInput = vi.fn();
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...api(() => 0), kind: "controller", playerId: "p1", isHost: () => false, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(h.lastView("p1")!);
    await flush();
    const press = async (k: string) => {
      el.querySelector<HTMLButtonElement>(`[data-testid=es-key-${k}]`)!.click();
      await flush();
    };
    expect(el.querySelector<HTMLButtonElement>("[data-testid=es-done]")!.disabled).toBe(true);
    for (const k of ["8", "0", "0", "0", "0", "0", "0", "comma", "5"]) await press(k);
    expect(el.querySelector("[data-testid=es-display]")?.textContent).toContain("8.000.000,5");
    await press("del");
    await press("del");
    expect(el.querySelector("[data-testid=es-display]")?.textContent).toContain("8.000.000");
    el.querySelector<HTMLButtonElement>("[data-testid=es-done]")!.click();
    await flush();
    expect(sendInput.mock.calls.map(([i]) => i)).toEqual([{ type: "seen", ids: {} }, { type: "guess", value: 8_000_000 }]);
    expect(el.querySelector("[data-testid=es-locked]")?.textContent).toContain("8.000.000");
    expect(JSON.parse(localStorage.getItem("couchplay.schaetzen.seen")!)).toHaveLength(1);
    v.unmount();
  });

  it("Jahreszahl ohne Komma; Auflösung erst nach der TV-Animation", async () => {
    const h = harness();
    h.advance(TIMING.introMs);
    let now = 0;
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...api(() => now), kind: "controller", playerId: "p1", isHost: () => false, sendInput: vi.fn(), vibrate: vi.fn() } satisfies ControllerViewApi);
    v.update(h.lastView("p1")!);
    await flush();
    expect(el.querySelector<HTMLButtonElement>("[data-testid=es-key-comma]")!.disabled).toBe(true);
    const q = ALL_QUESTIONS.find((x) => x.id === (h.lastView("p1") as { questionId: string }).questionId)!;
    h.input("p1", { type: "guess", value: q.answer });
    h.advance(20_000);
    const r = h.lastView("p1")!;
    if (r.phase !== "reveal") throw new Error("reveal erwartet");
    now = r.revealAt + 1000;
    v.update(r);
    await flush();
    expect(el.textContent).toContain("Schau auf den Fernseher");
    expect(el.textContent).not.toContain(String(q.answer));
    now = r.revealAt + REVEAL_STEPS.resultMs + 10;
    v.update({ ...r });
    await flush();
    expect(el.querySelector("[data-testid=es-result]")?.textContent).toContain("Volltreffer!");
    expect(el.textContent).toContain("+150");
    v.unmount();
  });
});
