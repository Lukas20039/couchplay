import { ERROR_CODES } from "@couchplay/protocol/errors";
import { describe, expect, it } from "vitest";
import { CONTROLLER_VIEWS } from "../src/games.js";
import { errorText } from "../src/i18n/index.js";

describe("controller-pwa Gerüst", () => {
  it("hat für jeden Fehlercode einen UI-Text", () => {
    for (const code of ERROR_CODES) expect(errorText(code)).toBeTruthy();
  });

  it("lädt die controller-Views aller eingebauten Spiele", async () => {
    expect(Object.keys(CONTROLLER_VIEWS).sort()).toEqual(["quiz", "tictactoe", "wortgarten"]);
    for (const load of Object.values(CONTROLLER_VIEWS)) {
      const mod = await load();
      const view = mod.default();
      expect(typeof view.mount).toBe("function");
      expect(typeof view.update).toBe("function");
      expect(typeof view.unmount).toBe("function");
    }
  });
});
