// @vitest-environment happy-dom
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTROLLER_SAMPLES, LIVE_PLAYERS, NOW, TV_SAMPLES } from "../preview/samples.js";
import controllerFactory from "../src/controller/index.js";
import type { QuizInput, QuizPlayerView, QuizTvState } from "../src/shared.js";
import tvFactory from "../src/tv/index.js";

const base = {
  gameId: "quiz",
  settings: {},
  getPlayers: () => LIVE_PLAYERS,
  getGamePlayerIds: () => LIVE_PLAYERS.map((p) => p.id),
  serverNow: () => NOW,
};

const mounted: Array<{ unmount(): void }> = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount();
});

function mountTv(state: QuizTvState) {
  const el = document.createElement("div");
  const view = tvFactory();
  view.mount(el, { ...base, kind: "tv" } satisfies TvViewApi);
  view.update(state);
  mounted.push(view);
  return el;
}

function mountController(v: QuizPlayerView | null) {
  const el = document.createElement("div");
  const sendInput = vi.fn<(input: QuizInput) => void>();
  const vibrate = vi.fn<(p: number | number[]) => void>();
  const api: ControllerViewApi<QuizInput> = { ...base, kind: "controller", playerId: "p3", isHost: () => false, sendInput, vibrate };
  const view = controllerFactory();
  view.mount(el, api);
  if (v) view.update(v);
  mounted.push(view);
  return { el, sendInput, vibrate, view };
}

describe("TV-View", () => {
  it("rendert alle Phasen", () => {
    for (const [name, state] of Object.entries(TV_SAMPLES)) {
      const el = mountTv(state);
      expect(el.querySelector(".qz-tv"), name).not.toBeNull();
      expect(el.textContent!.length, name).toBeGreaterThan(10);
    }
  });

  it("Frage: Text, Fortschritt, vier Antworten mit Form, Countdown und Antwortstatus", () => {
    const el = mountTv(TV_SAMPLES.question!);
    expect(el.textContent).toContain("Frage 7 von 10");
    expect(el.textContent).toContain("Geografie");
    expect(el.querySelectorAll(".qz-answer")).toHaveLength(4);
    expect(el.querySelectorAll(".qz-answer svg.qz-shape")).toHaveLength(4);
    expect(el.querySelector(".qz-ring-num")!.textContent).toBe("13");
    expect(el.querySelectorAll(".qz-avatar.is-done")).toHaveLength(3);
    expect(el.textContent).toContain("3 von 5 haben geantwortet");
    expect(el.querySelector(".is-correct")).toBeNull();
  });

  it("Auflösung markiert die richtige Antwort und zeigt die Verteilung", () => {
    const el = mountTv(TV_SAMPLES.reveal!);
    const tiles = el.querySelectorAll(".qz-answer");
    expect(tiles[1]!.classList.contains("is-correct")).toBe(true);
    expect(el.querySelectorAll(".qz-answer.is-wrong")).toHaveLength(3);
    expect(el.textContent).toContain("+912");
  });

  it("Zwischenstand und Podium zeigen Gleichstand und verlassene Spieler", () => {
    const st = mountTv(TV_SAMPLES.standings!);
    expect(st.querySelectorAll(".qz-row")).toHaveLength(6);
    expect(st.textContent).toContain("hat verlassen");
    const fin = mountTv(TV_SAMPLES.final!);
    const blocks = [...fin.querySelectorAll(".qz-block")].map((b) => b.textContent);
    expect(blocks).toEqual(["2", "1", "3"]);
  });
});

describe("Controller-View", () => {
  it("vier Buttons mit Form und Text; Tippen sendet genau eine Antwort und sperrt", async () => {
    const { el, sendInput } = mountController(CONTROLLER_SAMPLES.question!);
    const buttons = el.querySelectorAll<HTMLButtonElement>("button.qz-btn");
    expect(buttons).toHaveLength(4);
    expect(buttons[1]!.textContent).toContain("Totes Meer");
    expect(buttons[0]!.querySelector("svg")).not.toBeNull();
    buttons[2]!.click();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 60));
    expect(sendInput).toHaveBeenCalledTimes(1);
    expect(sendInput).toHaveBeenCalledWith({ type: "answer", index: 2 });
    expect(el.textContent).toContain("Antwort gesperrt");
    expect(el.querySelectorAll("button.qz-btn")).toHaveLength(0);
  });

  it("gesperrter Zustand vom Server", () => {
    const { el } = mountController(CONTROLLER_SAMPLES.locked!);
    expect(el.textContent).toContain("Antwort gesperrt");
    expect(el.textContent).toContain("Baikalsee");
  });

  it("Auflösung: richtig/falsch, Punkte, Platz und Vibration", async () => {
    const good = mountController(CONTROLLER_SAMPLES.correct!);
    await new Promise((r) => setTimeout(r, 60));
    expect(good.el.textContent).toContain("Richtig!");
    expect(good.el.textContent).toContain("+875");
    expect(good.el.textContent).toContain("Platz 3 von 6");
    expect(good.vibrate).toHaveBeenCalledTimes(1);

    const bad = mountController(CONTROLLER_SAMPLES.wrong!);
    await new Promise((r) => setTimeout(r, 60));
    expect(bad.el.textContent).toContain("Leider falsch");
    expect(bad.el.textContent).toContain("Totes Meer");
    expect(bad.vibrate).toHaveBeenCalledWith([250]);
  });

  it("Fehler des Servers wird übersetzt angezeigt", () => {
    const { el, view } = mountController(CONTROLLER_SAMPLES.question!);
    view.onError?.("INVALID_INPUT", "interne Meldung");
    expect(el.textContent).toContain("Diese Antwort konnte nicht gesendet werden.");
    expect(el.textContent).not.toContain("interne Meldung");
  });

  it("rendert Warte-, Intro-, Zwischenstand- und Final-Zustand", () => {
    expect(mountController(null).el.textContent).toContain("Gleich geht’s los");
    expect(mountController(CONTROLLER_SAMPLES.intro!).el.textContent).toContain("Mach dich bereit");
    expect(mountController(CONTROLLER_SAMPLES.standings!).el.textContent).toContain("1 Platz nach oben");
    expect(mountController(CONTROLLER_SAMPLES.final!).el.textContent).toContain("Du hast gewonnen!");
  });
});
