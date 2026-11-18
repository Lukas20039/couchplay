// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { describe, expect, it, vi } from "vitest";
import controllerView, { HOLD_MS, PEEK_MS } from "../src/controller/index.js";
import { normalizeWord } from "../src/normalize.js";
import { TIMING, voteSchedule, VERDICT_TIMES } from "../src/shared.js";
import tvView, { gridColumns } from "../src/tv/index.js";
import { allAccuse, as, giveClues, ids, others, phase, setup, spyOf, toClues, toRole, toVote, view, wordOf, type H } from "./helpers.js";

const flush = () => new Promise((r) => setTimeout(r, 30));
const api = (h: H, now: () => number) => ({
  gameId: "spion",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => ids(h),
  serverNow: now,
});
const mountTv = (h: H, now: () => number = () => 0) => {
  const el = document.createElement("div");
  const v = tvView();
  v.mount(el, { ...api(h, now), kind: "tv" } satisfies TvViewApi);
  v.update(h.lastTv()!);
  return { el, v };
};
const mountCtl = (h: H, id: string, now: () => number = () => 0) => {
  const sendInput = vi.fn();
  const el = document.createElement("div");
  const v = controllerView();
  v.mount(el, { ...api(h, now), kind: "controller", playerId: id, isHost: () => false, sendInput, vibrate: vi.fn() } satisfies ControllerViewApi);
  v.update(h.lastView(id)!);
  return { el, v, sendInput };
};
const contains = (el: HTMLElement, text: string) => normalizeWord(el.textContent ?? "").includes(normalizeWord(text));
const fire = (el: Element, type: string) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

describe("TV-View", () => {
  it("Intro, Rolle mit ✅, Hinweise mit Zug-Markierung – nie das Wort", () => {
    const h = setup(4);
    const { el, v } = mountTv(h);
    expect(el.textContent).toContain("einer von euch ist ein Spion");
    expect(el.textContent).toContain("Modus: Klassisch");
    toRole(h);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sp-tv]")?.getAttribute("data-phase")).toBe("role");
    expect(el.textContent).toContain("Schaut heimlich auf euer Handy");
    h.input("p1", { type: "ready" });
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("1 von 4 haben ihre Rolle gesehen");
    toClues(h);
    const c = as(h, "clue");
    h.input(c.turn, { type: "clue", text: "Sonnig" });
    v.update(h.lastTv()!);
    const now = as(h, "clue");
    expect(el.querySelector("[data-testid=sp-turn]")?.textContent).toContain(`${h.players.find((p) => p.id === now.turn)!.name} ist dran`);
    expect(el.querySelector(`[data-testid=sp-card-${now.turn}]`)?.className).toContain("is-turn");
    expect(el.querySelector(`[data-testid=sp-clues-${c.turn}]`)?.textContent).toContain("Sonnig");
    expect(el.querySelectorAll(`[data-testid=sp-clues-${c.turn}] .sp-clue`)).toHaveLength(2);
    expect(el.querySelector("[data-testid=sp-grid]")?.getAttribute("data-cols")).toBe("4");
    expect(contains(el, wordOf(h))).toBe(false);
    v.unmount();
  });

  it("Abstimmung, Auszählen, Urteil mit Stempel, Raten mit acht Wörtern, Ergebnis mit Wort", () => {
    expect([3, 4, 5, 6, 7, 8].map(gridColumns)).toEqual([3, 4, 3, 3, 4, 4]);
    const h = setup(5, undefined, 11);
    toVote(h);
    const spy = spyOf(h);
    const word = wordOf(h);
    let now = 0;
    const { el, v } = mountTv(h, () => now);
    expect(el.querySelector("[data-testid=sp-vote-title]")?.textContent).toContain("Wer ist der Spion?");
    h.input(others(h, spy)[0]!, { type: "vote", target: spy });
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("1 von 5 haben abgestimmt");
    allAccuse(h, spy);
    const r = as(h, "reveal");
    now = r.stepAt + voteSchedule(r.flights.length).doneMs - 10;
    v.update(r);
    expect(el.querySelector("[data-testid=sp-accuse]")?.textContent).toContain(`Die Gruppe beschuldigt ${h.players.find((p) => p.id === spy)!.name}!`);
    expect(el.querySelector(`[data-testid=sp-votes-${spy}]`)?.textContent).toBe("4 Stimmen");
    expect(el.querySelectorAll(`[data-testid=sp-card-${spy}] .sp-av--vote`)).toHaveLength(4);
    expect(el.textContent).not.toContain("SPION!");
    h.advance(voteSchedule(r.flights.length).doneMs);
    const vd = as(h, "reveal");
    now = vd.stepAt + VERDICT_TIMES.spyMs;
    v.update(vd);
    expect(el.querySelector("[data-testid=sp-verdict]")?.textContent).toContain("ist der Spion!");
    expect(el.textContent).toContain("SPION!");
    expect(contains(el, word)).toBe(false);
    h.advance(TIMING.verdictMs);
    v.update(h.lastTv()!);
    expect(el.querySelectorAll("[data-testid=sp-options] .sp-option")).toHaveLength(8);
    h.advance(TIMING.guessMs);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sp-word]")?.textContent).toContain(word);
    expect(el.querySelector("[data-testid=sp-banner]")?.textContent).toContain("die Agenten gewinnen");
    expect(el.textContent).toContain("Der Spion hat nicht getippt.");
    v.unmount();
  });

  it("falscher Verdacht: UNSCHULDIG und der echte Spion; Undercover zeigt beide Wörter", () => {
    const h = setup(4, { rounds: "3", mode: "undercover" }, 5);
    toVote(h);
    const spy = spyOf(h);
    const wrong = others(h, spy)[0]!;
    allAccuse(h, wrong);
    h.advance(voteSchedule(as(h, "reveal").flights.length).doneMs);
    const vd = as(h, "reveal");
    const { el, v } = mountTv(h, () => vd.stepAt + 5_000);
    expect(el.textContent).toContain("UNSCHULDIG");
    expect(el.querySelector("[data-testid=sp-real-spy]")?.textContent).toContain(h.players.find((p) => p.id === spy)!.name);
    h.skip();
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sp-spyword]")).not.toBeNull();
    expect(el.querySelector("[data-testid=sp-banner]")?.textContent).toContain("Falscher Verdacht");
    v.unmount();
  });

  it("Finale mit Podium, Gewinnern und Auszeichnungen", () => {
    const h = setup(3, undefined, 8);
    for (let i = 0; i < 200 && phase(h) !== "final"; i++) {
      if (phase(h) === "vote") allAccuse(h, spyOf(h));
      else if (phase(h) === "clue") giveClues(h);
      else if (phase(h) === "role") toClues(h);
      else if (!h.skip()) h.advance(1_000);
    }
    const { el, v } = mountTv(h);
    expect(el.querySelectorAll(".sp-pod")).toHaveLength(3);
    expect(el.querySelector("[data-testid=sp-winners]")?.textContent).toContain("Gewinner:");
    expect(el.querySelector("[data-testid=sp-awards]")?.textContent).toContain("Spürnase");
    v.unmount();
  });
});

describe("Controller-View", () => {
  it("Rollenkarte verdeckt; Halten zeigt sie nur solange gedrückt, Antippen kurz; „Verstanden“ erst nach dem Ansehen", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    try {
      const h = toRole(setup(3));
      const spy = spyOf(h);
      const me = others(h, spy)[0]!;
      const word = wordOf(h);
      const { el, v, sendInput } = mountCtl(h, me);
      const card = () => el.querySelector<HTMLElement>("[data-testid=sp-secret]")!;
      const ready = () => el.querySelector<HTMLButtonElement>("[data-testid=sp-ready]")!;
      await vi.advanceTimersByTimeAsync(10);
      expect(card().getAttribute("data-shown")).toBe("0");
      expect(contains(el, word)).toBe(false);
      expect(ready().disabled).toBe(true);
      // Halten
      fire(card(), "pointerdown");
      await vi.advanceTimersByTimeAsync(HOLD_MS + 50);
      expect(el.querySelector("[data-testid=sp-secret-text]")?.textContent).toBe(word);
      fire(card(), "pointerup");
      await vi.advanceTimersByTimeAsync(10);
      expect(card().getAttribute("data-shown")).toBe("0");
      expect(contains(el, word)).toBe(false);
      // Antippen: bleibt kurz offen, dann wieder verdeckt
      fire(card(), "pointerdown");
      await vi.advanceTimersByTimeAsync(50);
      fire(card(), "pointerup");
      await vi.advanceTimersByTimeAsync(100);
      expect(card().getAttribute("data-shown")).toBe("1");
      await vi.advanceTimersByTimeAsync(PEEK_MS);
      expect(card().getAttribute("data-shown")).toBe("0");
      expect(ready().disabled).toBe(false);
      ready().click();
      await vi.advanceTimersByTimeAsync(10);
      expect(sendInput.mock.calls.map(([i]) => i)).toEqual([{ type: "seen", ids: {} }, { type: "ready" }]);
      expect(ready().textContent).toContain("Warte auf die anderen");
      // Spion: „Du bist der Spion!“ mit Kategorie, ohne Wort
      const s = mountCtl(h, spy);
      await vi.advanceTimersByTimeAsync(10);
      fire(s.el.querySelector("[data-testid=sp-secret]")!, "pointerdown");
      await vi.advanceTimersByTimeAsync(10);
      expect(s.el.querySelector("[data-testid=sp-secret-text]")?.textContent).toBe("Du bist der Spion!");
      expect(s.el.textContent).toContain("Kategorie:");
      expect(contains(s.el, word)).toBe(false);
      v.unmount();
      s.v.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("Hinweis: wer dran ist, tippt ein Wort (Zähler, „nur ein Wort“, Ablehnung); die anderen sehen, wer dran ist", async () => {
    const h = toClues(setup(3));
    const spy = spyOf(h);
    while (as(h, "clue").turn === spy) h.input(spy, { type: "pass" });
    const me = as(h, "clue").turn;
    const other = others(h, me)[0]!;
    const word = wordOf(h);
    const o = mountCtl(h, other);
    await flush();
    expect(o.el.querySelector("[data-testid=sp-wait]")?.textContent).toContain(`${h.players.find((p) => p.id === me)!.name} ist dran`);
    expect(o.el.querySelector("[data-testid=sp-input]")).toBeNull();
    const { el, v, sendInput } = mountCtl(h, me);
    await flush();
    expect(el.textContent).toContain("Du bist dran!");
    const input = el.querySelector<HTMLInputElement>("[data-testid=sp-input]")!;
    input.value = "zwei Wörter";
    fire(input, "input");
    await flush();
    expect(el.querySelector("[data-testid=sp-one-word]")).not.toBeNull();
    expect(el.querySelector<HTMLButtonElement>("[data-testid=sp-submit]")!.disabled).toBe(true);
    const bad = word.replace(/\s+/g, "");
    input.value = bad;
    fire(input, "input");
    await flush();
    expect(el.querySelector("[data-testid=sp-counter]")?.textContent).toBe(`${[...bad].length}/24`);
    fire(el.querySelector("[data-testid=sp-form]")!, "submit");
    await flush();
    expect(sendInput.mock.calls.at(-1)![0]).toEqual({ type: "clue", text: bad });
    h.input(me, { type: "clue", text: bad });
    v.update(view(h, me));
    await flush();
    expect(el.querySelector("[data-testid=sp-rejected]")?.textContent).toContain("verrät dein Wort");
    el.querySelector<HTMLButtonElement>("[data-testid=sp-pass]")!.click();
    await flush();
    expect(sendInput.mock.calls.at(-1)![0]).toEqual({ type: "pass" });
    v.unmount();
    o.v.unmount();
  });

  it("Abstimmen: Kacheln ohne einen selbst, danach fix; Raten nur für den Spion; Ergebnis mit Wort", async () => {
    const h = toVote(setup(4, undefined, 21));
    const spy = spyOf(h);
    const me = others(h, spy)[0]!;
    const { el, v, sendInput } = mountCtl(h, me);
    await flush();
    expect(el.querySelector(`[data-testid=sp-tile-${me}]`)).toBeNull();
    expect(el.querySelectorAll(".sp-tile")).toHaveLength(3);
    el.querySelector<HTMLButtonElement>(`[data-testid=sp-tile-${spy}]`)!.click();
    await flush();
    expect(sendInput.mock.calls.at(-1)![0]).toEqual({ type: "vote", target: spy });
    expect(el.querySelector("[data-testid=sp-locked]")).not.toBeNull();
    allAccuse(h, spy);
    h.skip();
    expect(phase(h)).toBe("guess");
    v.update(view(h, me));
    await flush();
    expect(el.querySelector("[data-testid=sp-guess-wait]")?.textContent).toContain("rät jetzt das Wort");
    const s = mountCtl(h, spy);
    await flush();
    const btns = s.el.querySelectorAll<HTMLButtonElement>("[data-testid^=sp-guess-]");
    expect(btns).toHaveLength(8);
    btns[0]!.click();
    await flush();
    expect(s.sendInput.mock.calls.at(-1)![0]).toEqual({ type: "guess", index: 0 });
    h.input(spy, { type: "guess", index: 0 });
    v.update(view(h, me));
    s.v.update(view(h, spy));
    await flush();
    expect(el.querySelector("[data-testid=sp-result-word]")?.textContent).toBe(wordOf(h));
    expect(JSON.parse(localStorage.getItem("couchplay.spion.seen")!)).toHaveLength(1);
    expect(s.el.textContent).toContain("Du warst der Spion!");
    v.unmount();
    s.v.unmount();
  });
});
