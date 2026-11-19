// @vitest-environment happy-dom
// Rauchtest der Views mit echten Zuständen aus der Serverlogik.
import type { ControllerViewApi, TvViewApi } from "@couchplay/game-sdk/client";
import { createTestHarness, makePlayers } from "@couchplay/game-sdk/testing";
import type { Player, SettingsValues } from "@couchplay/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import controllerView from "../src/controller/index.js";
import { CUSTOM_STORAGE_KEY } from "../src/custom.js";
import { answerKey } from "../src/normalize.js";
import game, { createStadtlandGame } from "../src/server/index.js";
import { SEND_DEBOUNCE_MS, TIMING, type SlInput, type SlPlayerView, type SlTvState } from "../src/shared.js";
import tvView, { REEL_LENGTH, reelLetters } from "../src/tv/index.js";

// Echte Wortlisten nicht laden; Lexikon-Ansichten nutzen ein Fake-Lexikon (…ok = bekannt, sonst unbekannt).
vi.mock("../src/server/lexicon/index.js", () => ({ lookupAnswer: () => null, LEXICON_CATEGORIES: new Set() }));
const lexGame = createStadtlandGame((_c, text) => (answerKey(text).endsWith("ok") ? "known" : "unknown"));

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const harness = (players = 3, settings: SettingsValues = {}, g = game) =>
  createTestHarness<SlTvState, SlPlayerView>(g, { players, settings: { set: "klassisch", rounds: 3, roundSeconds: 60, check: "aus", ...settings } });
type H = ReturnType<typeof harness>;
/** Raumspieler: p1 ist Host. */
const ROOM: Player[] = makePlayers(3).map((p, i) => ({ ...p, connected: true, isHost: i === 0 }));
const api = (now: () => number) => ({
  gameId: "stadtland",
  settings: {},
  getPlayers: () => ROOM,
  getGamePlayerIds: () => ["p1", "p2", "p3"],
  serverNow: now,
});
const toWrite = (h: H) => {
  h.advance(TIMING.introMs + TIMING.letterMs);
  const s = h.lastTv()!;
  if (s.phase !== "write") throw new Error("write erwartet");
  return s.letter;
};

describe("TV-View", () => {
  it("Intro, Walze mit dem Buchstaben zuletzt, Schreiben mit Fortschritt ohne Inhalte, Stopp, Stifte weg", () => {
    const h = harness();
    const now = 0;
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => now), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Stadt, Land, Fluss");
    expect(el.textContent).toContain("3 Runden · Klassisch");
    h.advance(TIMING.introMs);
    v.update(h.lastTv()!);
    const s = h.lastTv()!;
    if (s.phase !== "letter") throw new Error("letter erwartet");
    const items = [...el.querySelectorAll(".sl-reel__item")].map((x) => x.textContent);
    expect(items).toHaveLength(REEL_LENGTH);
    expect(items.at(-1)).toBe(s.letter);
    expect(items.slice(0, -1)).not.toContain(s.letter);
    expect(el.querySelector("[data-testid=sl-letter]")?.textContent).toBe(s.letter);

    h.advance(TIMING.letterMs);
    const L = s.letter;
    h.input("p1", { type: "answers", round: 0, answers: [`${L}geheim1`, `${L}geheim2`, "", "", "", ""] });
    h.input("p2", { type: "answers", round: 0, answers: Array.from({ length: 6 }, (_, i) => `${L}geheim${i}`) });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sl-letter]")?.textContent).toBe(L);
    expect(el.querySelectorAll("[data-testid=sl-catlist] li")).toHaveLength(6);
    expect(el.querySelector("[data-testid=sl-progress-p1]")?.getAttribute("data-filled")).toBe("2");
    expect(el.querySelector("[data-testid=sl-progress-p2]")?.textContent).toContain("✅");
    expect(el.textContent).toContain("1 von 3 sind fertig");
    expect(el.textContent).not.toContain("geheim");

    h.input("p2", { type: "stop", round: 0 });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sl-stop]")?.textContent).toContain("Spieler 2 ruft Stopp!");
    h.advance(TIMING.stopMs);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sl-timeup]")?.textContent).toContain("Stifte weg!");
    expect(el.textContent).toContain("Spieler 2 war am schnellsten");
    v.unmount();
  });

  it("Prüfung: Kategorie, Antworten mit Status, doppelt/Einzige:r, Daumen und Punkte; Zwischenstand", () => {
    const h = harness();
    const L = toWrite(h);
    const other = L === "A" ? "B" : "A";
    h.input("p1", { type: "answers", round: 0, answers: [`${L}gleich`, `${L}solo`] });
    h.input("p2", { type: "answers", round: 0, answers: [`${L}GLEICH`, `${other}falsch`] });
    h.input("p3", { type: "answers", round: 0, answers: [`${L}drei`] });
    h.advance(60_000 + TIMING.timeUpMs);
    const s = h.lastTv()!;
    if (s.phase !== "review") throw new Error("review erwartet");
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sl-category]")?.textContent).toBe("Stadt");
    expect(el.querySelector("[data-testid=sl-entry-p1]")?.textContent).toContain("doppelt");
    expect(el.querySelector("[data-testid=sl-entry-p1]")?.textContent).toContain("+5");
    expect(el.querySelector("[data-testid=sl-entry-p3]")?.textContent).toContain("+10");
    h.input("p3", { type: "challenge", round: 0, category: 0, key: s.entries[0]!.key, on: true });
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sl-votes-p1]")?.textContent).toBe("👎 1/1");
    // p3 ist bei „gleich“ einziger Stimmberechtigter → gestrichen.
    expect(el.querySelector("[data-testid=sl-entry-p1]")?.getAttribute("data-status")).toBe("rejected");
    expect(el.querySelector("[data-testid=sl-entry-p1]")?.textContent).toContain("gestrichen");
    h.skip();
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sl-category]")?.textContent).toBe("Land");
    expect(el.querySelector("[data-testid=sl-entry-p1]")?.textContent).toContain("Einzige:r!");
    expect(el.querySelector("[data-testid=sl-entry-p1]")?.textContent).toContain("+20");
    expect(el.querySelector("[data-testid=sl-entry-p2]")?.textContent).toContain("falscher Buchstabe");
    expect(el.querySelector("[data-testid=sl-entry-p3]")?.textContent).toContain("—");
    for (let i = 0; i < 5; i++) h.skip();
    v.update(h.lastTv()!);
    expect(el.textContent).toContain("Zwischenstand");
    expect(el.textContent).toContain("+20");
    v.unmount();
  });

  it("Finale mit Podium und Auszeichnungen", () => {
    const h = harness();
    const L = toWrite(h);
    h.input("p1", { type: "answers", round: 0, answers: Array.from({ length: 6 }, (_, i) => `${L}wort${i}`) });
    h.input("p1", { type: "stop", round: 0 });
    for (let i = 0; i < 300 && h.lastTv()!.phase !== "final"; i++) if (!h.skip()) h.advance(1_000);
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.querySelectorAll(".sl-step")).toHaveLength(3);
    expect(el.querySelector("[data-testid=sl-awards]")?.textContent).toContain("Einzelkämpfer");
    expect(el.querySelector("[data-testid=sl-awards]")?.textContent).toContain("Schnellster Stift");
    v.unmount();
  });

  it("Setup eigener Kategorien live; Intro zeigt die Liste und die Lexikon-Regel", () => {
    const h = harness(3, { set: "eigene", check: "streng" });
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    expect(el.querySelector("[data-testid=sl-setup]")?.textContent).toContain("Spieler 1 legt die Kategorien fest");
    expect(el.textContent).toContain("Noch keine Kategorien");
    h.input("p1", { type: "custom", categories: ["Städte", "Automarken"], done: false });
    v.update(h.lastTv()!);
    expect([...el.querySelectorAll("[data-testid=sl-setup-list] li")].map((x) => x.textContent)).toEqual(["Städte", "Automarken"]);
    h.input("p1", { type: "custom", categories: ["Städte", "Automarken", "Tiere"], done: true });
    v.update(h.lastTv()!);
    expect([...el.querySelectorAll("[data-testid=sl-intro-cats] span")].map((x) => x.textContent)).toEqual(["Städte", "Automarken", "Tiere"]);
    expect(el.textContent).toContain("3 Kategorien");
    expect(el.textContent).toContain("Das Lexikon prüft mit");
    h.skip();
    v.update(h.lastTv()!);
    expect(el.querySelector(".sl-cats")?.textContent).toContain("Automarken");
    v.unmount();
  });

  it("Prüfung mit Lexikon: gestrichen „nicht im Lexikon“, 👍-Stand, gerettet, ✓ im Lexikon", () => {
    const h = harness(3, { check: "streng" }, lexGame);
    const L = toWrite(h);
    h.input("p1", { type: "answers", round: 0, answers: [`${L}xyz`] });
    h.input("p2", { type: "answers", round: 0, answers: [`${L}aok`] });
    h.advance(60_000 + TIMING.timeUpMs);
    const el = document.createElement("div");
    const v = tvView();
    v.mount(el, { ...api(() => 0), kind: "tv" } satisfies TvViewApi);
    v.update(h.lastTv()!);
    const p1 = () => el.querySelector("[data-testid=sl-entry-p1]")!;
    expect(p1().getAttribute("data-status")).toBe("unlisted");
    expect(p1().textContent).toContain("nicht im Lexikon");
    expect(el.querySelector("[data-testid=sl-votes-p1]")?.textContent).toBe("👍 0/2");
    expect(el.querySelector("[data-testid=sl-entry-p2]")?.textContent).toContain("✓ im Lexikon");
    expect(el.textContent).toContain("👍 rettet");
    const s = h.lastTv()!;
    if (s.phase !== "review") throw new Error("review erwartet");
    const key = s.entries[0]!.key;
    h.input("p2", { type: "challenge", round: 0, category: 0, key, on: true });
    h.input("p3", { type: "challenge", round: 0, category: 0, key, on: true });
    v.update(h.lastTv()!);
    expect(p1().getAttribute("data-status")).toBe("ok");
    expect(p1().getAttribute("data-rescued")).toBe("true");
    expect(p1().textContent).toContain("👍 gerettet");
    expect(p1().textContent).toContain("+10");
    expect(el.querySelector("[data-testid=sl-votes-p1]")?.textContent).toBe("👍 2/2");
    v.unmount();
  });

  it("Walze ist deterministisch und endet immer auf dem Buchstaben", () => {
    expect(reelLetters("M", 2)).toEqual(reelLetters("M", 2));
    for (const l of ["A", "S", "Z"]) expect(reelLetters(l, 0).at(-1)).toBe(l);
  });
});

describe("Controller-View", () => {
  afterEach(() => localStorage.clear());
  const mount = (h: H, id: string, now: () => number = () => 0) => {
    const sendInput = vi.fn<(i: SlInput) => void>();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const v = controllerView();
    v.mount(el, { ...api(now), kind: "controller", playerId: id, isHost: () => id === "p1", sendInput, vibrate: vi.fn() } satisfies ControllerViewApi<SlInput>);
    v.update(h.lastView(id)!);
    return { el, v, sendInput };
  };
  const type = async (el: HTMLElement, i: number, text: string) => {
    const input = el.querySelector<HTMLInputElement>(`[data-testid=sl-input-${i}]`)!;
    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush(5);
  };
  const sent = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.map(([x]) => x as SlInput);

  it("Buchstabe erst nach der Walze; Felder je Kategorie, entprellt senden, Enter springt weiter, Stopp erst mit allem", async () => {
    const h = harness();
    h.advance(TIMING.introMs);
    const { el, v, sendInput } = mount(h, "p1");
    await flush();
    expect(el.textContent).toContain("gleich kommt der Buchstabe");
    h.advance(TIMING.letterMs);
    const w = h.lastView("p1")!;
    if (w.phase !== "write") throw new Error("write erwartet");
    v.update(w);
    await flush();
    expect(el.querySelector("[data-testid=sl-letter]")?.textContent).toBe(w.letter);
    expect(el.querySelectorAll(".sl-input")).toHaveLength(6);
    expect(el.textContent).toContain("Stadt");
    const stop = el.querySelector<HTMLButtonElement>("[data-testid=sl-stop]")!;
    expect(stop.disabled).toBe(true);

    await type(el, 0, `${w.letter}eins`);
    await type(el, 0, `${w.letter}einsa`);
    expect(sendInput).not.toHaveBeenCalled();
    await flush(SEND_DEBOUNCE_MS + 50);
    expect(sent(sendInput)).toEqual([{ type: "answers", round: 0, answers: [`${w.letter}einsa`, "", "", "", "", ""] }]);

    // Enter springt ins nächste Feld.
    const first = el.querySelector<HTMLInputElement>("[data-testid=sl-input-0]")!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(el.querySelector("[data-testid=sl-input-1]"));

    // Hinweis bei falschem Buchstaben (nur Hilfe).
    const other = w.letter === "A" ? "B" : "A";
    await type(el, 1, `${other}xyz`);
    expect(el.textContent).toContain(`beginnt nicht mit ${w.letter}`);

    for (let i = 1; i < 6; i++) await type(el, i, `${w.letter}wort${i}`);
    expect(stop.disabled).toBe(false);
    stop.click();
    await flush();
    const calls = sent(sendInput);
    // Stopp schickt vorher sofort den letzten Stand.
    expect(calls.at(-2)).toEqual({ type: "answers", round: 0, answers: [`${w.letter}einsa`, ...[1, 2, 3, 4, 5].map((i) => `${w.letter}wort${i}`)] });
    expect(calls.at(-1)).toEqual({ type: "stop", round: 0 });
    v.unmount();
    el.remove();
  });

  it("Reconnect/Reload: Antworten vom Server stehen wieder in den Feldern; beim Sperren wird sofort gesendet", async () => {
    const h = harness();
    const L = toWrite(h);
    h.input("p1", { type: "answers", round: 0, answers: [`${L}gespeichert`] });
    let now = 0;
    const { el, v, sendInput } = mount(h, "p1", () => now);
    await flush();
    expect(el.querySelector<HTMLInputElement>("[data-testid=sl-input-0]")!.value).toBe(`${L}gespeichert`);
    expect(sendInput).not.toHaveBeenCalled();
    // Tippen kurz vor Schluss, dann läuft die Zeit ab → Feld gesperrt, sofort gesendet (ohne Entprellung).
    await type(el, 1, `${L}last`);
    h.advance(60_000);
    now = h.clock.now();
    v.update(h.lastView("p1")!);
    await flush(5);
    expect(sent(sendInput).at(-1)).toEqual({ type: "answers", round: 0, answers: [`${L}gespeichert`, `${L}last`, "", "", "", ""] });
    expect(el.querySelector<HTMLInputElement>("[data-testid=sl-input-1]")!.disabled).toBe(true);
    expect(el.textContent).toContain("Stifte weg!");
    // Der Server nimmt das in der Gnadenfrist noch an.
    h.input("p1", sent(sendInput).at(-1)!);
    const tu = h.lastView("p1")!;
    expect(tu.phase === "timeup" && tu.answers[1]).toBe(`${L}last`);
    v.unmount();
    el.remove();
  });

  it("Stopp eines anderen wird angezeigt", async () => {
    const h = harness();
    const L = toWrite(h);
    h.input("p2", { type: "answers", round: 0, answers: Array.from({ length: 6 }, (_, i) => `${L}x${i}`) });
    h.input("p2", { type: "stop", round: 0 });
    const { el, v } = mount(h, "p1", () => h.clock.now());
    await flush();
    expect(el.querySelector("[data-testid=sl-stopbar]")?.textContent).toContain("Spieler 2 ruft Stopp!");
    expect(el.querySelector("[data-testid=sl-stopbar]")?.textContent).toContain("Noch 5 s");
    v.unmount();
    el.remove();
  });

  it("Setup am Host-Handy: Vorbelegung, entprellt senden, Vorschläge, Doppelte, „Los geht’s“ speichert", async () => {
    const h = harness(3, { set: "eigene" });
    const { el, v, sendInput } = mount(h, "p1");
    await flush();
    const fields = () => [...el.querySelectorAll<HTMLInputElement>(".sl-setup__row .sl-input")];
    // Ohne gespeicherte Liste: Klassik-Vorbelegung, sofort an den Server (TV zeigt mit).
    expect(fields().map((f) => f.value)).toEqual(["Stadt", "Land", "Fluss", "Name", "Beruf", "Tier"]);
    expect(sent(sendInput)).toEqual([{ type: "custom", categories: ["Stadt", "Land", "Fluss", "Name", "Beruf", "Tier"], done: false }]);
    expect(el.querySelector("[data-testid=sl-custom-add]")).toBeNull();
    // Feld entfernen, umbenennen → entprellt.
    el.querySelector<HTMLButtonElement>("[data-testid=sl-custom-remove-5]")!.click();
    el.querySelector<HTMLButtonElement>("[data-testid=sl-custom-remove-4]")!.click();
    await flush(5);
    const f0 = fields()[0]!;
    f0.value = "Automarken";
    f0.dispatchEvent(new Event("input", { bubbles: true }));
    await flush(SEND_DEBOUNCE_MS + 50);
    expect(sent(sendInput).at(-1)).toEqual({ type: "custom", categories: ["Automarken", "Land", "Fluss", "Name"], done: false });
    // Vorschlag antippen fügt hinzu; Doppeltes wird markiert.
    const chip = [...el.querySelectorAll<HTMLButtonElement>("[data-testid=sl-custom-chips] button")].find((b) => b.textContent === "Tier")!;
    chip.click();
    await flush(5);
    expect(fields().map((f) => f.value)).toEqual(["Automarken", "Land", "Fluss", "Name", "Tier"]);
    const f1 = fields()[1]!;
    f1.value = "fluss";
    f1.dispatchEvent(new Event("input", { bubbles: true }));
    await flush(5);
    expect(el.textContent).toContain("doppelt");
    el.querySelector<HTMLButtonElement>("[data-testid=sl-custom-go]")!.click();
    await flush(5);
    expect(sent(sendInput).at(-1)).toEqual({ type: "custom", categories: ["Automarken", "fluss", "Name", "Tier"], done: true });
    expect(JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY)!)).toEqual(["Automarken", "fluss", "Name", "Tier"]);
    expect(el.querySelector<HTMLButtonElement>("[data-testid=sl-custom-go]")!.disabled).toBe(true);
    v.unmount();
    el.remove();
  });

  it("Setup: gespeicherte Liste als Vorbelegung, „Los“ erst ab 3; andere Handys warten mit Hostname", async () => {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(["Automarken", "Dinge im Bad", "Tiere"]));
    const h = harness(3, { set: "eigene" });
    const host = mount(h, "p1");
    await flush();
    expect(sent(host.sendInput)[0]).toEqual({ type: "custom", categories: ["Automarken", "Dinge im Bad", "Tiere"], done: false });
    const f2 = host.el.querySelector<HTMLInputElement>("[data-testid=sl-custom-2]")!;
    f2.value = "";
    f2.dispatchEvent(new Event("input", { bubbles: true }));
    await flush(5);
    expect(host.el.querySelector<HTMLButtonElement>("[data-testid=sl-custom-go]")!.disabled).toBe(true);
    expect(host.el.textContent).toContain("Mindestens 3 Kategorien");
    host.v.unmount();
    host.el.remove();
    h.input("p1", { type: "custom", categories: ["Automarken", "Dinge im Bad"], done: false });
    const guest = mount(h, "p2");
    await flush();
    expect(guest.el.querySelector("[data-testid=sl-setup-wait]")?.textContent).toContain("Spieler 1 legt die Kategorien fest");
    expect(guest.el.textContent).toContain("Dinge im Bad");
    expect(guest.el.querySelector("[data-testid=sl-setup-editor]")).toBeNull();
    expect(guest.sendInput).not.toHaveBeenCalled();
    guest.v.unmount();
    guest.el.remove();
  });

  it("Prüfung mit Lexikon: 👍 für Gestrichenes, Markierungen", async () => {
    const h = harness(3, { check: "streng" }, lexGame);
    const L = toWrite(h);
    h.input("p2", { type: "answers", round: 0, answers: [`${L}xyz`] });
    h.input("p3", { type: "answers", round: 0, answers: [`${L}aok`] });
    h.advance(60_000 + TIMING.timeUpMs);
    const { el, v, sendInput } = mount(h, "p1");
    await flush();
    expect(el.textContent).toContain("👍 rettet");
    const up = el.querySelector<HTMLButtonElement>("[data-testid=sl-thumb-p2]")!;
    expect(up.getAttribute("data-kind")).toBe("up");
    expect(up.textContent).toContain("👍");
    expect(up.getAttribute("aria-label")).toContain("zählt doch");
    expect(el.querySelector("[data-testid=sl-entry-p2]")?.textContent).toContain("nicht im Lexikon");
    expect(el.querySelector("[data-testid=sl-thumb-p3]")?.getAttribute("data-kind")).toBe("down");
    expect(el.querySelector("[data-testid=sl-entry-p3]")?.textContent).toContain("✓ Lexikon");
    up.click();
    await flush();
    h.input("p1", sent(sendInput).at(-1)!);
    h.input("p3", { ...(sent(sendInput).at(-1) as Extract<SlInput, { type: "challenge" }>) });
    v.update(h.lastView("p1")!);
    await flush();
    expect(el.querySelector("[data-testid=sl-entry-p2]")?.getAttribute("data-status")).toBe("ok");
    expect(el.querySelector("[data-testid=sl-entry-p2]")?.textContent).toContain("gerettet");
    v.unmount();
    el.remove();
  });

  it("Prüfung: Daumen nur für fremde gültige Antworten, „Passt – weiter“", async () => {
    const h = harness();
    const L = toWrite(h);
    h.input("p1", { type: "answers", round: 0, answers: [`${L}eins`] });
    h.input("p2", { type: "answers", round: 0, answers: [`${L}zwei`] });
    h.advance(60_000 + TIMING.timeUpMs);
    const { el, v, sendInput } = mount(h, "p1");
    await flush();
    expect(el.querySelector("[data-testid=sl-category]")?.textContent).toContain("Stadt");
    expect(el.querySelector("[data-testid=sl-thumb-p1]")).toBeNull();
    expect(el.querySelector("[data-testid=sl-thumb-p3]")).toBeNull();
    const thumb = el.querySelector<HTMLButtonElement>("[data-testid=sl-thumb-p2]")!;
    expect(thumb.textContent).toContain("0/2");
    thumb.click();
    await flush();
    const key = sent(sendInput).at(-1);
    expect(key).toMatchObject({ type: "challenge", round: 0, category: 0, on: true });
    expect(thumb.getAttribute("aria-pressed")).toBe("true");
    h.input("p1", key!);
    v.update(h.lastView("p1")!);
    await flush();
    expect(el.querySelector("[data-testid=sl-thumb-p2]")!.textContent).toContain("1/2");
    el.querySelector<HTMLButtonElement>("[data-testid=sl-ready]")!.click();
    await flush();
    expect(sent(sendInput).at(-1)).toEqual({ type: "ready", round: 0, category: 0 });
    expect(el.querySelector<HTMLButtonElement>("[data-testid=sl-ready]")!.disabled).toBe(true);
    expect(el.textContent).toContain("Warte auf die anderen");
    v.unmount();
    el.remove();
  });
});
