// @vitest-environment happy-dom
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTROLLER_SAMPLES, LIVE_PLAYERS, NOW, TV_SAMPLES } from "../preview/samples.js";
import controllerFactory from "../src/controller/index.js";
import { XP_STORAGE_KEY, type WgInput, type WgPlayerView, type WgTvState } from "../src/shared.js";
import tvFactory from "../src/tv/index.js";

const base = {
  gameId: "wortgarten",
  settings: {},
  getPlayers: () => LIVE_PLAYERS,
  getGamePlayerIds: () => LIVE_PLAYERS.map((p) => p.id),
  serverNow: () => NOW,
};

const mounted: Array<{ unmount(): void }> = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount();
});
beforeEach(() => localStorage.clear());

/** Preact führt useEffect nach dem Zeichnen aus – kurz warten. */
const flush = () => new Promise((r) => setTimeout(r, 150));

function mountTv(state: WgTvState) {
  const el = document.createElement("div");
  const view = tvFactory();
  view.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
  view.update(state);
  mounted.push(view);
  return el;
}

function mountController(v: WgPlayerView | null) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const sendInput = vi.fn<(input: WgInput) => void>();
  const api: ControllerViewApi<WgInput> = { ...base, kind: "controller", playerId: "p3", isHost: () => false, sendInput, vibrate: () => {} };
  const view = controllerFactory();
  view.mount(el, api);
  if (v) view.update(v);
  mounted.push(view);
  return { el, sendInput, view };
}

describe("TV-View", () => {
  it("rendert alle Phasen", () => {
    for (const [name, state] of Object.entries(TV_SAMPLES)) {
      const el = mountTv(state);
      expect(el.querySelector(".wg-tv"), name).not.toBeNull();
      expect(el.textContent!.length, name).toBeGreaterThan(10);
    }
  });

  it("Runde: Raster mit Goldfeldern, Blumen statt Wörtern, Countdown", () => {
    const el = mountTv(TV_SAMPLES.round!);
    expect(el.querySelectorAll(".wg-tile")).toHaveLength(25);
    expect(el.querySelectorAll(".wg-tile.is-gold")).toHaveLength(2);
    expect(el.querySelectorAll(".wg-bed")).toHaveLength(4);
    expect(el.textContent).toContain("9 Wörter");
    expect(el.querySelector(".wg-ring-num")!.textContent).toBe("47");
  });

  it("Ernte: einzigartige Wörter markiert, verpasste Wörter, längstes Wort", () => {
    const el = mountTv(TV_SAMPLES.roundEnd!);
    expect(el.querySelectorAll(".wg-word.is-unique").length).toBeGreaterThanOrEqual(4);
    expect(el.textContent).toContain("BLUMEN");
    expect(el.textContent).toContain("GÄRTEN");
    expect(el.textContent).toContain("Diesmal keine Wörter");
  });

  it("Finale: neue Freischaltung", () => {
    const el = mountTv(TV_SAMPLES.final!);
    expect(el.textContent).toContain("Blitz-Modus");
    expect(el.textContent).toContain("Gartenstufe 5");
  });
});

describe("Controller-View", () => {
  it("rendert alle Phasen", () => {
    for (const [name, v] of Object.entries(CONTROLLER_SAMPLES)) {
      const { el } = mountController(v);
      expect(el.querySelector(".wg-pad"), name).not.toBeNull();
    }
  });

  it("Intro meldet die gespeicherte Erfahrung genau einmal", () => {
    localStorage.setItem(XP_STORAGE_KEY, "321");
    const intro = { ...CONTROLLER_SAMPLES.intro!, helloReceived: false } as WgPlayerView;
    const { sendInput, view } = mountController(intro);
    view.update({ ...intro });
    expect(sendInput.mock.calls).toEqual([[{ type: "hello", xp: 321 }]]);
  });

  it("Finale speichert die neue Erfahrung (nie weniger als vorher)", async () => {
    localStorage.setItem(XP_STORAGE_KEY, "100");
    mountController(CONTROLLER_SAMPLES.final!);
    await flush();
    expect(localStorage.getItem(XP_STORAGE_KEY)).toBe("445");
    localStorage.setItem(XP_STORAGE_KEY, "9999");
    mountController(CONTROLLER_SAMPLES.final!);
    await flush();
    expect(localStorage.getItem(XP_STORAGE_KEY)).toBe("9999");
  });

  it("Runde: Tipp-Knopf sendet tip; Rückmeldung und Combo sichtbar", () => {
    const { el, sendInput } = mountController(CONTROLLER_SAMPLES.round!);
    expect(el.querySelectorAll(".wg-cell")).toHaveLength(25);
    expect(el.textContent).toContain("BLUME");
    expect(el.textContent).toContain("Combo ×1,5");
    el.querySelector<HTMLButtonElement>(".wg-btn")!.click();
    expect(sendInput).toHaveBeenCalledWith({ type: "tip" });
  });

  it("Tipp: Anfang, Länge und markiertes Startfeld", async () => {
    const { el } = mountController(CONTROLLER_SAMPLES.tip!);
    await flush();
    expect(el.querySelector(".wg-tip")!.textContent).toContain("BL _ _ _");
    expect(el.querySelectorAll(".wg-cell.is-tip")).toHaveLength(1);
    expect(el.textContent).toContain("Kein Wort im Wörterbuch");
  });
});
