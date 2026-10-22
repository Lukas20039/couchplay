// Fortschrittsmeldung (player.progress): Lobby zeigt nur freigeschaltete Optionen.
import type { GameManifest } from "@couchplay/protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, readProgress } from "../src/app.js";
import { MockSocket, room, TOKEN } from "./helpers.js";

const game = (id: string, progressKey?: string): GameManifest => ({
  id,
  name: id,
  description: "",
  version: "0.1.0",
  minPlayers: 1,
  maxPlayers: 8,
  botSupport: false,
  settings: [],
  ...(progressKey ? { progressKey } : {}),
});
const catalog = [game("wortgarten", "couchplay.wortgarten.xp"), game("quiz")];

beforeEach(() => {
  localStorage.clear();
  MockSocket.reset();
});

describe("readProgress", () => {
  it("liest nur Spiele mit progressKey, ignoriert Unsinn", () => {
    expect(readProgress(catalog)).toEqual({});
    localStorage.setItem("couchplay.wortgarten.xp", "420");
    expect(readProgress(catalog)).toEqual({ wortgarten: 420 });
    localStorage.setItem("couchplay.wortgarten.xp", "abc");
    expect(readProgress(catalog)).toEqual({});
  });
});

describe("player.progress", () => {
  it("meldet den Fortschritt in der Lobby einmal und nach Änderung erneut", () => {
    localStorage.setItem("couchplay.wortgarten.xp", "120");
    const app = createApp({ pathname: "/", url: "ws://test/ws", createSocket: (u) => new MockSocket(u), bindWindow: false });
    app.join("Anna", "fuchs");
    const ws = MockSocket.last();
    ws.open();
    ws.receive({ t: "room.joined", v: 1, code: "042137", playerId: "p1", token: TOKEN });
    ws.receive({ t: "catalog", games: catalog });
    ws.receive({ t: "room.state", room: room() });
    ws.receive({ t: "room.state", room: room() });
    const progress = () => ws.sent.filter((m) => m.t === "player.progress");
    expect(progress()).toEqual([{ t: "player.progress", progress: { wortgarten: 120 } }]);

    // Im Spiel nicht, danach mit dem neuen Wert.
    localStorage.setItem("couchplay.wortgarten.xp", "500");
    ws.receive({ t: "room.state", room: room({ phase: "game", gamePlayerIds: ["p1"] }) });
    expect(progress()).toHaveLength(1);
    ws.receive({ t: "room.state", room: room({ phase: "results" }) });
    expect(progress().at(-1)).toEqual({ t: "player.progress", progress: { wortgarten: 500 } });
  });
});
