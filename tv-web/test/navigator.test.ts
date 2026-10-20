import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LONG_PRESS_MS, Navigator } from "../src/nav/navigator.js";

function key(type: "keydown" | "keyup", k: string, repeat = false): KeyboardEvent {
  return new KeyboardEvent(type, { key: k, repeat, bubbles: true, cancelable: true });
}

describe("Navigator (DOM)", () => {
  let nav: Navigator;
  let clock = 0;
  beforeEach(() => {
    clock = 0;
    document.body.innerHTML = `
      <button id="a" data-nav="g">A</button>
      <button id="b" data-nav="g" data-nav-autofocus>B</button>
      <button id="c" data-nav="g" aria-disabled="true">C</button>`;
    nav = new Navigator(document, () => clock);
    nav.install(window);
  });
  afterEach(() => nav.uninstall());

  it("ensureFocus wählt data-nav-autofocus", () => {
    nav.ensureFocus();
    expect(document.activeElement?.id).toBe("b");
  });

  it("OK löst click beim Loslassen aus, nicht bei aria-disabled", () => {
    const b = document.getElementById("b")!;
    const c = document.getElementById("c")!;
    const onB = vi.fn();
    const onC = vi.fn();
    b.addEventListener("click", onB);
    c.addEventListener("click", onC);
    b.focus();
    window.dispatchEvent(key("keydown", "Enter"));
    expect(onB).not.toHaveBeenCalled();
    window.dispatchEvent(key("keyup", "Enter"));
    expect(onB).toHaveBeenCalledTimes(1);
    c.focus();
    window.dispatchEvent(key("keydown", "Enter"));
    window.dispatchEvent(key("keyup", "Enter"));
    expect(onC).not.toHaveBeenCalled();
  });

  it("Langdruck OK öffnet das Menü statt zu klicken", () => {
    const onMenu = vi.fn();
    const onB = vi.fn();
    nav.onMenu = onMenu;
    const b = document.getElementById("b")!;
    b.addEventListener("click", onB);
    b.focus();
    window.dispatchEvent(key("keydown", "Enter"));
    clock = LONG_PRESS_MS + 10;
    window.dispatchEvent(key("keydown", "Enter", true));
    window.dispatchEvent(key("keydown", "Enter", true));
    window.dispatchEvent(key("keyup", "Enter"));
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(onB).not.toHaveBeenCalled();
  });

  it("Zurück: höchste Ebene zuerst, sonst Root-Handler", () => {
    const calls: string[] = [];
    nav.onRootBack = () => calls.push("root");
    const offScreen = nav.addBack(1, () => (calls.push("screen"), true));
    const offOverlay = nav.addBack(2, () => (calls.push("overlay"), true));
    window.dispatchEvent(key("keydown", "Escape"));
    offOverlay();
    window.dispatchEvent(new CustomEvent("couchplay:back", { cancelable: true }));
    offScreen();
    window.dispatchEvent(key("keydown", "Backspace"));
    expect(calls).toEqual(["overlay", "screen", "root"]);
  });

  it("natives Back-Event wird als verarbeitet markiert", () => {
    nav.onRootBack = () => {};
    const ev = new CustomEvent("couchplay:back", { cancelable: true });
    expect(window.dispatchEvent(ev)).toBe(false);
  });

  it("nur die oberste Ebene ist navigierbar", () => {
    const layer = document.createElement("div");
    layer.setAttribute("data-nav-layer", "");
    layer.innerHTML = `<button id="x" data-nav="o">X</button>`;
    document.body.appendChild(layer);
    expect(nav.focusables().map((e) => e.id)).toEqual(["x"]);
    nav.ensureFocus();
    expect(document.activeElement?.id).toBe("x");
  });
});
