// @vitest-environment happy-dom
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTROLLER_SAMPLES, LIVE_PLAYERS, NOW, TV_SAMPLES } from "../preview/samples.js";
import controllerFactory from "../src/controller/index.js";
import type { AonInput, AonPlayerView, AonTvState } from "../src/shared.js";
import tvFactory from "../src/tv/index.js";

const base = {
  gameId: "allesodernichts",
  settings: {},
  getPlayers: () => LIVE_PLAYERS,
  getGamePlayerIds: () => LIVE_PLAYERS.map((p) => p.id),
  serverNow: () => NOW,
};

const mounted: Array<{ unmount(): void }> = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount();
});

function mountTv(state: AonTvState, serverNow = () => NOW) {
  const el = document.createElement("div");
  const view = tvFactory();
  view.mount(el, { ...base, serverNow, kind: "tv" } satisfies TvViewApi);
  view.update(state);
  mounted.push(view);
  return el;
}

function mountController(v: AonPlayerView | null) {
  const el = document.createElement("div");
  const sendInput = vi.fn<(input: AonInput) => void>();
  const vibrate = vi.fn<(p: number | number[]) => void>();
  const api: ControllerViewApi<AonInput> = { ...base, kind: "controller", playerId: "p3", isHost: () => false, sendInput, vibrate };
  const view = controllerFactory();
  view.mount(el, api);
  if (v) view.update(v);
  mounted.push(view);
  return { el, sendInput, vibrate, view };
}

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));

describe("TV-View", () => {
  it("rendert alle Phasen", () => {
    for (const [name, state] of Object.entries(TV_SAMPLES)) {
      const el = mountTv(state);
      expect(el.querySelector(".an-tv"), name).not.toBeNull();
      expect(el.querySelector(".an-tv")!.getAttribute("data-phase"), name).toBe(state.phase);
      expect(el.textContent!.length, name).toBeGreaterThan(10);
    }
  });

  it("Tippen: Frage, vier Antworten, Einsatzleiter, Countdown und wer gewählt hat", () => {
    const el = mountTv(TV_SAMPLES.pick!);
    expect(el.textContent).toContain("Frage 4 von 10");
    expect(el.textContent).toContain("Rechtschreibung");
    expect(el.querySelectorAll(".an-answer")).toHaveLength(4);
    expect(el.querySelectorAll(".an-stake")).toHaveLength(3);
    expect(el.querySelector(".an-stake.is-now")!.textContent).toContain("±1");
    expect(el.querySelector(".an-ring-num")!.textContent).toBe("13");
    expect(el.textContent).toContain("3 von 5 haben gewählt");
    expect(el.querySelector(".is-correct, .is-struck, .is-lit")).toBeNull();
  });

  it("Lauflicht: genau eine Antwort leuchtet, nach dem Stillstand wird das Ziel gestrichen", () => {
    const spin = mountTv(TV_SAMPLES.spin!);
    expect(spin.querySelectorAll(".an-answer.is-lit")).toHaveLength(1);
    expect(spin.querySelector(".is-hit")).toBeNull();
    expect(spin.textContent).toContain("Elimination 1 von 3");

    const hit = mountTv(TV_SAMPLES.hit!);
    const tiles = hit.querySelectorAll(".an-answer");
    expect(tiles[2]!.classList.contains("is-hit")).toBe(true);
    expect(tiles[3]!.classList.contains("is-struck")).toBe(true);
    expect(hit.textContent).toContain("Raus!");
    expect(hit.textContent).toContain("+1 gesichert");
    expect(hit.textContent).toContain("−1 raus");
  });

  it("Lauflicht bewegt sich mit der Serverzeit", async () => {
    let now = TV_SAMPLES.spin!.phase === "spin" ? TV_SAMPLES.spin!.startedAt : NOW;
    const el = mountTv(TV_SAMPLES.spin!, () => now);
    const lit = () => [...el.querySelectorAll(".an-answer")].findIndex((x) => x.classList.contains("is-lit"));
    const first = lit();
    now += 600;
    await tick(80);
    expect(lit()).not.toBe(first);
  });

  it("Entscheidung: Frage nach Aussteigen, Zähler, Status je Spieler", () => {
    const el = mountTv(TV_SAMPLES.decide!);
    expect(el.textContent).toContain("Aussteigen mit +1 oder weiter?");
    expect(el.textContent).toContain("2 von 3 haben entschieden");
    expect(el.querySelector('[data-testid="an-status-p1"]')!.textContent).toContain("entschieden");
    expect(el.querySelector('[data-testid="an-status-p2"]')!.textContent).toContain("drin");
    expect(el.querySelector('[data-testid="an-status-p3"]')!.textContent).toContain("enthalten");
    expect(el.querySelector(".an-stake.is-passed")!.textContent).toContain("±1");
  });

  it("Auflösung markiert die richtige Antwort, zeigt Tipps, Punkte und Bonus", () => {
    const el = mountTv(TV_SAMPLES.reveal!);
    const tiles = el.querySelectorAll(".an-answer");
    expect(tiles[1]!.classList.contains("is-correct")).toBe(true);
    expect(el.querySelectorAll(".an-answer.is-struck")).toHaveLength(3);
    expect(tiles[1]!.querySelectorAll(".an-mini")).toHaveLength(2);
    expect(el.textContent).toContain("Nur Anna hat durchgehalten");
    expect(el.textContent).toContain("+4 Volltreffer");
    expect(el.textContent).toContain("−2 raus");
  });

  it("Zwischenstand mit negativen Punkten und Podium", () => {
    const st = mountTv(TV_SAMPLES.standings!);
    expect(st.querySelectorAll(".an-row")).toHaveLength(5);
    expect(st.querySelectorAll(".an-delta.is-minus")).toHaveLength(2);
    expect(st.textContent).toContain("hat verlassen");
    const fin = mountTv(TV_SAMPLES.final!);
    expect([...fin.querySelectorAll(".an-block")].map((b) => b.textContent)).toEqual(["2", "1", "2"]);
    expect(fin.textContent).toContain("4 Volltreffer");
    expect(fin.textContent).toContain("−4 Pkt.");
  });
});

describe("Controller-View", () => {
  it("meldet einmal die gesehenen Fragen und merkt sich die aktuelle", async () => {
    localStorage.setItem("couchplay.allesodernichts.seen", JSON.stringify(["geo-007", "rs-120"]));
    const { sendInput } = mountController(CONTROLLER_SAMPLES.pick!);
    await tick();
    const seen = sendInput.mock.calls.map(([i]) => i).filter((i) => i.type === "seen");
    expect(seen).toEqual([{ type: "seen", ids: { geo: [7], rs: [120] } }]);
    expect(JSON.parse(localStorage.getItem("couchplay.allesodernichts.seen")!)).toEqual(["geo-007", "rs-120", "rs-017"]);
    localStorage.clear();
  });

  it("vier Antworten plus Enthalten; Tippen sendet genau eine Eingabe und sperrt", async () => {
    const { el, sendInput } = mountController(CONTROLLER_SAMPLES.pick!);
    const buttons = el.querySelectorAll<HTMLButtonElement>("button.an-btn");
    expect(buttons).toHaveLength(4);
    expect(buttons[1]!.textContent).toContain("Lappalie");
    expect(el.querySelector("[data-testid=an-abstain]")).not.toBeNull();
    buttons[2]!.click();
    await tick(60);
    const picks = sendInput.mock.calls.map(([i]) => i).filter((i) => i.type !== "seen");
    expect(picks).toEqual([{ type: "pick", index: 2 }]);
    expect(el.textContent).toContain("Antwort gesperrt");
    expect(el.querySelectorAll("button.an-btn")).toHaveLength(0);
  });

  it("Enthalten sendet abstain", async () => {
    const { el, sendInput } = mountController(CONTROLLER_SAMPLES.pick!);
    el.querySelector<HTMLButtonElement>("[data-testid=an-abstain]")!.click();
    await tick(60);
    expect(sendInput.mock.calls.map(([i]) => i).filter((i) => i.type !== "seen")).toEqual([{ type: "abstain" }]);
    expect(el.textContent).toContain("Du enthältst dich");
  });

  it("gesperrte Zustände vom Server", () => {
    expect(mountController(CONTROLLER_SAMPLES.locked!).el.textContent).toContain("Lappalie");
    expect(mountController(CONTROLLER_SAMPLES.abstained!).el.textContent).toContain("Du enthältst dich");
  });

  it("Entscheidung: Aussteigen oder Weiter mit Einsätzen; Tippen sendet decide", async () => {
    const { el, sendInput } = mountController(CONTROLLER_SAMPLES.decide!);
    expect(el.textContent).toContain("Deine Antwort ist noch drin!");
    expect(el.querySelector("[data-testid=an-cash]")!.textContent).toContain("+1 sichern");
    expect(el.querySelector("[data-testid=an-stay]")!.textContent).toContain("+2 oder −2");
    expect(el.querySelector(".an-list li.is-struck")).not.toBeNull();
    el.querySelector<HTMLButtonElement>("[data-testid=an-stay]")!.click();
    await tick(60);
    expect(sendInput.mock.calls.map(([i]) => i).filter((i) => i.type === "decide")).toEqual([{ type: "decide", stay: true }]);
    expect(el.textContent).toContain("Du zockst weiter!");
  });

  it("Stand während der Eliminationen: drin, entschieden, raus (mit Vibration), gesichert", async () => {
    expect(mountController(CONTROLLER_SAMPLES.spin!).el.textContent).toContain("Daumen drücken");
    expect(mountController(CONTROLLER_SAMPLES.decided!).el.textContent).toContain("Du zockst weiter!");
    const out = mountController(CONTROLLER_SAMPLES.out!);
    await tick();
    expect(out.el.textContent).toContain("Raus!");
    expect(out.el.textContent).toContain("−1");
    expect(out.el.querySelector("[data-testid=an-cash]")).toBeNull();
    expect(out.vibrate).toHaveBeenCalledWith([250]);
    expect(mountController(CONTROLLER_SAMPLES.cashed!).el.textContent).toContain("+1 gesichert");
  });

  it("Auflösung: Volltreffer mit Bonus, verloren mit richtiger Antwort", async () => {
    const won = mountController(CONTROLLER_SAMPLES.won!);
    await tick();
    expect(won.el.textContent).toContain("Volltreffer!");
    expect(won.el.textContent).toContain("+4");
    expect(won.el.textContent).toContain("+1 Bonus");
    expect(won.vibrate).toHaveBeenCalledTimes(1);
    const lost = mountController(CONTROLLER_SAMPLES.lost!);
    expect(lost.el.textContent).toContain("−2");
    expect(lost.el.textContent).toContain("Richtig war: Lappalie");
  });

  it("Fehler des Servers wird übersetzt angezeigt", () => {
    const { el, view } = mountController(CONTROLLER_SAMPLES.pick!);
    view.onError?.("INVALID_INPUT", "interne Meldung");
    expect(el.textContent).toContain("Diese Eingabe konnte nicht gesendet werden.");
    expect(el.textContent).not.toContain("interne Meldung");
  });

  it("rendert Warte-, Intro-, Zwischenstand- und Final-Zustand", () => {
    expect(mountController(null).el.textContent).toContain("Gleich geht’s los");
    expect(mountController(CONTROLLER_SAMPLES.intro!).el.textContent).toContain("Mach dich bereit");
    expect(mountController(CONTROLLER_SAMPLES.standings!).el.textContent).toContain("1 Platz nach oben");
    expect(mountController(CONTROLLER_SAMPLES.final!).el.textContent).toContain("Du hast gewonnen!");
  });
});
