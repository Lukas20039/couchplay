// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness } from "@couchplay/game-sdk/testing";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import game from "../src/server/index.js";
import { TIMING, type ZgPlayerView, type ZgTvState } from "../src/shared.js";
import tvView from "../src/tv/index.js";

const base = { gameId: "zeichnen", settings: {}, getPlayers: () => [], getGamePlayerIds: () => ["p1", "p2", "p3"], serverNow: () => 0 };
const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const harness = () =>
  createTestHarness<ZgTvState, ZgPlayerView>(game, { players: 3, settings: { categories: ["tiere"], drawSeconds: 60, turns: 1 } });
const drawerOf = (s: ZgTvState) => (s.phase === "choose" || s.phase === "draw" || s.phase === "reveal" ? s.drawer.id : "");

function mountController(h: ReturnType<typeof harness>, playerId: string, now = () => 0) {
  const sendInput = vi.fn();
  const el = document.createElement("div");
  document.body.appendChild(el);
  const v = controllerView();
  v.mount(el, { ...base, serverNow: now, kind: "controller", playerId, isHost: () => false, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
  v.update(h.lastView(playerId)!);
  return { el, v, sendInput };
}

describe("TV", () => {
  it("Intro, Wortwahl, Zeichnen mit Lücken und Sprechblasen, Auflösung mit Wort, Finale mit Podium", () => {
    const h = harness();
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Reihum zeichnet eine Person");
    h.advance(TIMING.introMs);
    v.update(h.lastTv()!);
    const drawer = drawerOf(h.lastTv()!);
    expect(el.querySelector("[data-testid=zg-choosing]")?.textContent).toContain("wählt einen Begriff");
    h.input(drawer, { type: "choose", index: 0 });
    const dv = h.lastView(drawer)!;
    const word = dv.phase === "draw" && dv.role === "draw" ? dv.word : "";
    const guesser = h.players.find((p) => p.id !== drawer)!;
    h.input(guesser.id, { type: "guess", text: "Bratpfanne" });
    h.input(drawer, { type: "stroke", id: 1, color: 1, size: 1, points: [10, 10, 500, 500] });
    h.advance(200);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=zg-canvas]")).not.toBeNull();
    expect(el.querySelectorAll(".zg-hint__cell").length).toBeGreaterThan(0);
    expect(el.querySelector("[data-testid=zg-bubbles]")?.textContent).toContain("Bratpfanne");
    expect(el.textContent).not.toContain(word);
    h.advance(1000);
    h.input(guesser.id, { type: "guess", text: word });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=zg-bubbles]")?.textContent).toContain(`${guesser.name} hat’s! ✅`);
    h.advance(60_000);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=zg-word]")?.textContent).toBe(word);
    while (h.lastTv()!.phase !== "final") h.advance(1000);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=zg-podium]")).not.toBeNull();
    v.unmount();
  });
});

describe("Controller", () => {
  it("Zeichner: Begriff wählen, zeichnen, rückgängig – gebündelt gesendet", async () => {
    const h = harness();
    h.advance(TIMING.introMs);
    const drawer = drawerOf(h.lastTv()!);
    const { el, v, sendInput } = mountController(h, drawer);
    await flush();
    el.querySelector<HTMLButtonElement>("[data-testid=zg-option-2]")!.click();
    await flush();
    expect(sendInput.mock.calls.map(([i]) => i)).toEqual([{ type: "seen", ids: {} }, { type: "choose", index: 2 }]);
    h.input(drawer, { type: "choose", index: 2 });
    v.update(h.lastView(drawer)!);
    await flush();
    expect(el.querySelector("[data-testid=zg-drawword]")?.textContent).toBeTruthy();
    const pad = el.querySelector<HTMLCanvasElement>("[data-testid=zg-pad]")!;
    const fire = (type: string, x: number, y: number) =>
      pad.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, isPrimary: true, bubbles: true }));
    fire("pointerdown", 0, 0);
    fire("pointermove", 1, 1);
    fire("pointerup", 1, 1);
    el.querySelector<HTMLButtonElement>("[data-testid=zg-undo]")!.click();
    await flush(400);
    const sent = sendInput.mock.calls.map(([i]) => i).slice(2);
    expect(sent[0]).toMatchObject({ type: "stroke", color: 0, size: 1 });
    expect(sent.at(-1)).toEqual({ type: "undo" });
    // Server akzeptiert die Nachrichten.
    for (const msg of sent) expect(h.input(drawer, msg).ok).toBe(true);
    expect(JSON.parse(localStorage.getItem("couchplay.zeichnen.seen")!)).toHaveLength(1);
    v.unmount();
  });

  it("Rater: Tipp senden, „Knapp daneben!“, Erfolgsbildschirm", async () => {
    const h = harness();
    h.advance(TIMING.introMs);
    const drawer = drawerOf(h.lastTv()!);
    h.input(drawer, { type: "choose", index: 0 });
    const guesser = h.players.find((p) => p.id !== drawer)!.id;
    const { el, v, sendInput } = mountController(h, guesser);
    await flush();
    const input = el.querySelector<HTMLInputElement>("[data-testid=zg-input]")!;
    expect(document.activeElement).not.toBe(input);
    input.value = "Bratpfanne";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
    el.querySelector<HTMLFormElement>("[data-testid=zg-form]")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
    expect(sendInput.mock.calls.at(-1)?.[0]).toEqual({ type: "guess", text: "Bratpfanne" });
    const close: ZgPlayerView = { ...(h.lastView(guesser) as Extract<ZgPlayerView, { phase: "draw"; role: "guess" }>), guesses: [{ text: "Hunt", close: true }], guessSeq: 2 };
    v.update(close);
    await flush();
    expect(el.querySelector("[data-testid=zg-close]")?.textContent).toBe("Knapp daneben!");
    v.update({ ...close, correct: true, roundPoints: 100 });
    await flush();
    expect(el.querySelector("[data-testid=zg-success]")?.textContent).toContain("+100");
    v.unmount();
  });
});
