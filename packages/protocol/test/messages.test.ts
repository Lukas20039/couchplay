import { describe, expect, it } from "vitest";
import {
  CLIENT_MESSAGE_RULES,
  ClientMessageSchema,
  ERROR_CODES,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  ServerMessageSchema,
  encodeMessage,
  errorMessage,
  isHandshakeMessage,
  parseClientMessage,
  parseServerMessage,
  type ClientMessage,
  type RoomState,
  type ServerMessage,
} from "../src/index.js";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";

const room: RoomState = {
  code: "012345",
  phase: "lobby",
  joinUrl: "http://localhost:8080/j/012345",
  players: [{ id: "p_1", name: "Anna", avatar: "fuchs", color: 0, connected: true, isHost: true }],
  hostId: "p_1",
  tvConnected: true,
  selectedGameId: "quiz",
  playerLimits: { minPlayers: 1, maxPlayers: 8 },
  settings: { rounds: 10, categories: ["sport"] },
  gamePlayerIds: [],
  results: null,
  progress: { wortgarten: 420 },
};

/** Ein gültiges Beispiel pro Client-Nachrichtentyp (muss docs/protocol.md entsprechen). */
const clientExamples: ClientMessage[] = [
  { t: "room.create", v: PROTOCOL_VERSION, rid: "1" },
  { t: "room.resume", v: PROTOCOL_VERSION, code: "012345", tvToken: TOKEN },
  { t: "room.join", v: PROTOCOL_VERSION, code: "012345", name: "Anna", avatar: "fuchs" },
  { t: "room.rejoin", v: PROTOCOL_VERSION, code: "012345", playerId: "p_1", token: TOKEN },
  { t: "room.leave" },
  { t: "room.close" },
  { t: "player.update", name: "Anni" },
  { t: "player.progress", progress: { wortgarten: 420 } },
  { t: "player.kick", playerId: "p_2" },
  { t: "lobby.selectGame", gameId: "tictactoe" },
  { t: "lobby.updateSettings", settings: { difficulty: "leicht" } },
  { t: "lobby.start" },
  { t: "lobby.start", playerIds: ["p_1", "p_3"] },
  { t: "game.input", data: { type: "answer", index: 2 } },
  { t: "game.abort" },
  { t: "room.toLobby" },
  { t: "ping", ts: 123 },
];

const serverExamples: ServerMessage[] = [
  { t: "room.created", v: PROTOCOL_VERSION, code: "012345", joinUrl: room.joinUrl, tvToken: TOKEN, rid: "1" },
  { t: "room.resumed", v: PROTOCOL_VERSION, code: "012345", joinUrl: room.joinUrl },
  { t: "room.joined", v: PROTOCOL_VERSION, code: "012345", playerId: "p_1", token: TOKEN },
  { t: "room.state", room },
  {
    t: "catalog",
    games: [
      {
        id: "tictactoe",
        name: "TicTacToe",
        description: "",
        version: "1.0.0",
        minPlayers: 1,
        maxPlayers: 2,
        botSupport: true,
        settings: [
          { type: "select", key: "difficulty", label: "Stärke", options: [{ value: "leicht", label: "Leicht" }], default: "leicht" },
        ],
      },
    ],
  },
  { t: "game.tv", gameId: "quiz", seq: 1, state: { question: "?" } },
  { t: "game.view", gameId: "quiz", seq: 2, view: { buttons: 4 } },
  { t: "room.closed", reason: "idle" },
  { t: "error", code: "RATE_LIMITED", message: "langsam", retryAfterMs: 1000, rid: "9" },
  { t: "pong", ts: 123, serverTime: 456 },
];

describe("Client-Nachrichten", () => {
  it("deckt jeden Typ mit einem Beispiel ab", () => {
    const types = new Set(clientExamples.map((m) => m.t));
    const schemaTypes = ClientMessageSchema.options.map((o) => o.shape.t.value);
    expect([...types].sort()).toEqual([...schemaTypes].sort());
  });

  it.each(clientExamples)("parst $t", (msg) => {
    const res = parseClientMessage(encodeMessage(msg));
    expect(res).toEqual({ ok: true, msg });
  });

  it("hat Berechtigungsregeln für jeden Nicht-Handshake-Typ", () => {
    for (const msg of clientExamples) {
      if (isHandshakeMessage(msg)) continue;
      expect(CLIENT_MESSAGE_RULES[msg.t], msg.t).toBeDefined();
    }
    expect(isHandshakeMessage({ t: "room.join", v: 1, code: "123456", name: "x", avatar: "eule" })).toBe(true);
    expect(isHandshakeMessage({ t: "lobby.start" })).toBe(false);
  });

  it("entfernt unbekannte Felder", () => {
    const res = parseClientMessage(JSON.stringify({ t: "lobby.start", evil: true }));
    expect(res).toEqual({ ok: true, msg: { t: "lobby.start" } });
  });

  it("akzeptiert Buffer/Uint8Array/ArrayBuffer/Fragmente", () => {
    const json = JSON.stringify({ t: "ping" });
    const bytes = new TextEncoder().encode(json);
    expect(parseClientMessage(bytes).ok).toBe(true);
    expect(parseClientMessage(bytes.buffer).ok).toBe(true);
    expect(parseClientMessage([bytes.slice(0, 3), bytes.slice(3)]).ok).toBe(true);
  });
});

describe("Ungültige Client-Nachrichten", () => {
  const bad: Array<[string, string]> = [
    ["kein JSON", "{nope"],
    ["Array", "[]"],
    ["ohne t", JSON.stringify({ v: 1 })],
    ["unbekannter Typ", JSON.stringify({ t: "hack" })],
    ["Code zu kurz", JSON.stringify({ t: "room.join", v: 1, code: "12345", name: "A", avatar: "fuchs" })],
    ["Code mit Buchstaben", JSON.stringify({ t: "room.join", v: 1, code: "12345a", name: "A", avatar: "fuchs" })],
    ["unbekannter Avatar", JSON.stringify({ t: "room.join", v: 1, code: "123456", name: "A", avatar: "drache" })],
    ["Version fehlt", JSON.stringify({ t: "room.create" })],
    ["Token zu kurz", JSON.stringify({ t: "room.rejoin", v: 1, code: "123456", playerId: "p", token: "abc" })],
    ["Spiel-ID ungültig", JSON.stringify({ t: "lobby.selectGame", gameId: "Quiz!" })],
    ["doppelte Teilnehmer", JSON.stringify({ t: "lobby.start", playerIds: ["p1", "p1"] })],
    ["leere Teilnehmerliste", JSON.stringify({ t: "lobby.start", playerIds: [] })],
    ["Settings-Wert Objekt", JSON.stringify({ t: "lobby.updateSettings", settings: { a: { b: 1 } } })],
  ];

  it.each(bad)("%s → BAD_MESSAGE", (_label, raw) => {
    const res = parseClientMessage(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("BAD_MESSAGE");
  });

  it("spiegelt rid auch bei ungültiger Nachricht", () => {
    const res = parseClientMessage(JSON.stringify({ t: "lobby.selectGame", rid: "r7" }));
    expect(res).toMatchObject({ ok: false, code: "BAD_MESSAGE", rid: "r7" });
  });

  it("lehnt zu große Nachrichten ab", () => {
    const raw = JSON.stringify({ t: "game.input", data: "x".repeat(MAX_MESSAGE_BYTES) });
    expect(parseClientMessage(raw)).toMatchObject({ ok: false, code: "MESSAGE_TOO_LARGE" });
    const multibyte = JSON.stringify({ t: "game.input", data: "ä".repeat(MAX_MESSAGE_BYTES / 2) });
    expect(parseClientMessage(multibyte)).toMatchObject({ ok: false, code: "MESSAGE_TOO_LARGE" });
  });
});

describe("Server-Nachrichten", () => {
  it("deckt jeden Typ mit einem Beispiel ab", () => {
    const schemaTypes = ServerMessageSchema.options.map((o) => o.shape.t.value);
    expect(serverExamples.map((m) => m.t).sort()).toEqual([...schemaTypes].sort());
  });

  it.each(serverExamples)("parst $t", (msg) => {
    expect(parseServerMessage(encodeMessage(msg))).toEqual({ ok: true, msg });
  });

  it("lehnt Raum mit mehr als 8 Spielern ab", () => {
    const players = Array.from({ length: 9 }, (_, i) => ({ ...room.players[0]!, id: `p${i}` }));
    expect(parseServerMessage(JSON.stringify({ t: "room.state", room: { ...room, players } })).ok).toBe(false);
  });

  it("errorMessage baut gültige Fehlerpakete", () => {
    for (const code of ERROR_CODES) {
      const msg = errorMessage(code, "x", { rid: "a", fatal: true });
      expect(ServerMessageSchema.safeParse(msg).success).toBe(true);
    }
    expect(errorMessage("INTERNAL", "x")).toEqual({ t: "error", code: "INTERNAL", message: "x" });
  });
});
