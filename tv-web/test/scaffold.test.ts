import { ERROR_CODES } from "@couchplay/protocol/errors";
import { describe, expect, it } from "vitest";
import { TV_VIEWS } from "../src/games.js";
import { errorText } from "../src/i18n/index.js";

describe("tv-web Gerüst", () => {
  it("hat für jeden Fehlercode einen UI-Text", () => {
    for (const code of ERROR_CODES) expect(errorText(code)).toBeTruthy();
  });

  it("lädt die tv-Views aller eingebauten Spiele", async () => {
    expect(Object.keys(TV_VIEWS).sort()).toEqual(["quiz", "tictactoe", "wortgarten"]);
    for (const load of Object.values(TV_VIEWS)) {
      const mod = await load();
      const view = mod.default();
      expect(typeof view.mount).toBe("function");
      expect(typeof view.update).toBe("function");
      expect(typeof view.unmount).toBe("function");
    }
  });
});
