// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { ControllerViewApi, TvViewApi } from "../src/client.js";
import { preactControllerView, preactTvView } from "../src/preact.js";

const base = {
  gameId: "quiz",
  settings: {},
  getPlayers: () => [],
  getGamePlayerIds: () => [],
  serverNow: () => 0,
};

describe("Preact-Adapter", () => {
  it("rendert TV-Zustand und räumt auf", () => {
    const view = preactTvView<{ n: number }>(({ state }) => <p>Wert {state?.n ?? "-"}</p>)();
    const el = document.createElement("div");
    const api: TvViewApi = { ...base, kind: "tv" };
    view.mount(el, api);
    expect(el.textContent).toBe("Wert -");
    view.update({ n: 3 });
    expect(el.textContent).toBe("Wert 3");
    view.unmount();
    expect(el.innerHTML).toBe("");
  });

  it("leitet Controller-Eingaben und Fehler weiter", () => {
    const sent: unknown[] = [];
    const view = preactControllerView<{ label: string }, { type: "tap" }>(({ view: v, api, error }) => (
      <button type="button" onClick={() => api.sendInput({ type: "tap" })}>
        {error ? error.code : (v?.label ?? "")}
      </button>
    ))();
    const el = document.createElement("div");
    const api: ControllerViewApi<{ type: "tap" }> = {
      ...base,
      kind: "controller",
      playerId: "p1",
      isHost: () => false,
      sendInput: (i) => sent.push(i),
      vibrate: () => {},
    };
    view.mount(el, api);
    view.update({ label: "Los" });
    expect(el.textContent).toBe("Los");
    el.querySelector("button")?.click();
    expect(sent).toEqual([{ type: "tap" }]);
    view.onError?.("INVALID_INPUT", "x");
    expect(el.textContent).toBe("INVALID_INPUT");
    view.unmount();
  });
});
