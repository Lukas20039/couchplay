// @vitest-environment happy-dom
// Rauchtest der Views: rendern echte Zustände aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import { END_DELAY_MS, ROUND_DELAY_MS } from "../src/server/index.js";
import tvView from "../src/tv/index.js";
import { BOARD_SIZES } from "../src/shared.js";
import { drawSequence, drops, pvp, quickWin, vsBot, type H } from "./helpers.js";

const base = {
  gameId: "viergewinnt",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ["p1", "p2"],
  serverNow: () => 0,
};

const flush = () => new Promise((r) => setTimeout(r, 30)); // Preact-Effekte laufen asynchron

function mountTv(h: H) {
  const el = document.createElement("div");
  const v = tvView();
  v.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
  v.update(h.lastTv()!);
  return { el, v, refresh: () => v.update(h.lastTv()!) };
}

function mountCtl(h: H, playerId: string) {
  const sendInput = vi.fn();
  const vibrate = vi.fn();
  const el = document.createElement("div");
  const v = controllerView();
  v.mount(el, { ...base, kind: "controller", playerId, isHost: () => false, sendInput, vibrate } satisfies ControllerViewApi);
  v.update(h.lastView(playerId)!);
  return { el, v, sendInput, vibrate, refresh: () => v.update(h.lastView(playerId)!) };
}

describe("TV", () => {
  it("zeigt Steine, schwebende Vorschau, fallenden letzten Stein und Gewinnreihe", () => {
    const h = pvp({ settings: { bestOf: "3" } });
    const { el, refresh, v } = mountTv(h);
    expect(el.querySelector("[data-testid=c4-status]")?.textContent).toContain("Spieler 1 beginnt");
    expect(el.querySelector("[data-testid=c4-round]")?.textContent).toContain("Best of 3");
    expect(el.querySelectorAll(".c4-stone")).toHaveLength(0);
    // Löcher: 7 × 6 Felder im Rahmenpfad.
    expect(el.querySelector(".c4-board__frame")?.getAttribute("d")?.match(/M/g)).toHaveLength(1 + 42);

    h.input("p1", { type: "aim", col: 2 });
    refresh();
    expect(el.querySelector(".c4-hover")?.getAttribute("transform")).toMatch(/^translate\(250 /);

    drops(h, [2, 3]);
    refresh();
    expect(el.querySelectorAll(".c4-stone")).toHaveLength(2);
    expect(el.querySelector(".c4-stone.is-last .c4-fall")?.getAttribute("class")).toMatch(/c4-fall-\d/);
    expect(el.querySelector(".c4-hover")).toBeNull();
    expect(el.querySelector("[data-testid=c4-status]")?.textContent).toContain("Spieler 1 ist am Zug");

    drops(h, [2, 3, 2, 3, 2]);
    refresh();
    expect(el.querySelectorAll(".c4-stone.is-win")).toHaveLength(4);
    expect(el.querySelectorAll(".c4-winline")).toHaveLength(1);
    expect(el.querySelector("[data-testid=c4-status]")?.textContent).toContain("Spieler 1 gewinnt die Partie!");
    expect(el.querySelectorAll("[data-testid=c4-seat-0] .c4-card__pips i.is-on")).toHaveLength(1);

    h.advance(ROUND_DELAY_MS);
    quickWin(h); // Spieler 2 beginnt und gewinnt
    h.advance(ROUND_DELAY_MS);
    quickWin(h);
    refresh();
    expect(el.querySelector("[data-testid=c4-banner]")?.textContent).toBe("Spieler 1 gewinnt 2 : 1!");
    v.unmount();
  });

  it("Unentschieden, kampfloser Sieg und Computer-Karte", () => {
    const draw = pvp({ settings: { bestOf: "1" } });
    drops(draw, drawSequence(BOARD_SIZES["7x6"]));
    expect(mountTv(draw).el.querySelector("[data-testid=c4-banner]")?.textContent).toBe("Unentschieden!");

    const forfeit = pvp({ settings: { bestOf: "1" } });
    forfeit.leave("p2");
    expect(mountTv(forfeit).el.querySelector("[data-testid=c4-banner]")?.textContent).toBe("Spieler 1 gewinnt kampflos");

    const bot = vsBot({ settings: { difficulty: "schwer" } });
    bot.input("p1", { type: "drop", col: 3 });
    const { el } = mountTv(bot);
    expect(el.querySelector("[data-testid=c4-seat-1]")?.textContent).toContain("Stärke: Schwer");
    expect(el.querySelector("[data-testid=c4-status]")?.textContent).toContain("Der Computer überlegt");
  });
});

describe("Controller", () => {
  it("Spaltenleiste: nur am Zug aktiv; erstes Antippen = Vorschau, zweites = Einwerfen", async () => {
    const h = pvp();
    const p1 = mountCtl(h, "p1");
    const p2 = mountCtl(h, "p2");
    const col = (c: { el: HTMLElement }, i: number) => c.el.querySelector<HTMLButtonElement>(`[data-testid=c4-col-${i}]`)!;
    const dropBtn = (c: { el: HTMLElement }) => c.el.querySelector<HTMLButtonElement>("[data-testid=c4-drop]")!;

    expect(p1.el.querySelectorAll(".c4-col")).toHaveLength(7);
    expect(col(p2, 0).disabled).toBe(true);
    expect(p2.el.textContent).toContain("Spieler 1 ist am Zug");
    expect(col(p1, 0).disabled).toBe(false);
    expect(dropBtn(p1).disabled).toBe(true);

    col(p1, 4).click();
    await flush();
    expect(p1.sendInput).toHaveBeenLastCalledWith({ type: "aim", col: 4 });
    expect(p1.el.querySelector("[data-testid=c4-status]")?.textContent).toContain("Spalte 5");
    expect(p1.el.querySelector(".c4-ghost")).not.toBeNull();
    expect(dropBtn(p1).disabled).toBe(false);
    expect(dropBtn(p1).textContent).toBe("Einwerfen in Spalte 5");

    col(p1, 4).click();
    expect(p1.sendInput).toHaveBeenLastCalledWith({ type: "drop", col: 4 });
    // Bis zur Antwort des Servers keine Doppel-Eingaben.
    await flush();
    col(p1, 2).click();
    expect(p1.sendInput).toHaveBeenCalledTimes(2);
  });

  it("Einwerfen-Knopf, volle Spalte gesperrt, Ergebnis und Vibration", async () => {
    const h = pvp({ settings: { bestOf: "1" } });
    drops(h, [0, 0, 0, 0, 1, 0, 0]); // Spalte 0 voll, Spieler 2 am Zug
    const p2 = mountCtl(h, "p2");
    expect(p2.el.querySelector<HTMLButtonElement>("[data-testid=c4-col-0]")!.disabled).toBe(true);
    expect(p2.el.querySelector("[data-testid=c4-col-0]")?.getAttribute("aria-label")).toBe("Spalte 1: voll");
    p2.el.querySelector<HTMLButtonElement>("[data-testid=c4-col-6]")!.click();
    await flush();
    p2.el.querySelector<HTMLButtonElement>("[data-testid=c4-drop]")!.click();
    expect(p2.sendInput).toHaveBeenLastCalledWith({ type: "drop", col: 6 });

    const p1 = mountCtl(h, "p1");
    h.input("p2", { type: "drop", col: 6 });
    drops(h, [1, 6, 1, 6, 1]); // Spieler 1 gewinnt senkrecht in Spalte 1
    p1.refresh();
    p2.refresh();
    expect(p2.el.querySelector("[data-testid=c4-result]")?.textContent).toContain("Verloren");
    expect(p1.el.querySelector("[data-testid=c4-result]")?.textContent).toContain("Gewonnen!");
    await flush();
    expect(p2.vibrate).toHaveBeenCalledWith([350]);
    h.advance(END_DELAY_MS);
  });

  it("zeigt die Restzeit, wenn ein Zeitlimit läuft", () => {
    const h = pvp({ settings: { turnTime: "15" } });
    const sendInput = vi.fn();
    const el = document.createElement("div");
    const v = controllerView();
    v.mount(el, { ...base, serverNow: () => h.clock.now() + 4_200, kind: "controller", playerId: "p1", isHost: () => true, sendInput, vibrate: vi.fn() });
    v.update(h.lastView("p1")!);
    expect(el.querySelector(".c4-ctl__timer")?.textContent).toBe("noch 11 s");
    v.unmount();
  });
});
