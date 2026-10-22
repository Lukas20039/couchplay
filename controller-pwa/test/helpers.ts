// Test-Hilfen: gemockter WebSocket und Beispielobjekte.
import type { Player, RoomState, ServerMessage } from "@couchplay/protocol";
import type { WebSocketLike } from "../src/net/connection.js";

export class MockSocket implements WebSocketLike {
  static all: MockSocket[] = [];
  static last(): MockSocket {
    const s = MockSocket.all.at(-1);
    if (!s) throw new Error("kein Socket");
    return s;
  }
  static reset(): void {
    MockSocket.all = [];
  }

  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closedWith: number | null = null;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;

  constructor(public url: string) {
    MockSocket.all.push(this);
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close(code?: number): void {
    this.closedWith = code ?? 1000;
    this.readyState = 3;
  }

  // --- Steuerung aus dem Test ---
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  receive(msg: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  /** Server/Netz trennt die Verbindung. */
  drop(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  /** Socket stirbt still (iOS-Standby): kein close-Event. */
  dieSilently(): void {
    this.readyState = 3;
  }
  lastSent(): Record<string, unknown> | undefined {
    return this.sent.at(-1);
  }
}

export const TOKEN = "q8V0mZ2pYwL4nB7cR1sT6uX9dE3fG5hJ";

export function player(id: string, extra: Partial<Player> = {}): Player {
  return { id, name: id.toUpperCase(), avatar: "fuchs", color: 0, connected: true, isHost: false, ...extra };
}

export function room(extra: Partial<RoomState> = {}): RoomState {
  return {
    progress: {},
    code: "042137",
    phase: "lobby",
    joinUrl: "http://localhost/j/042137",
    players: [player("p1", { isHost: true }), player("p2", { color: 1 })],
    hostId: "p1",
    tvConnected: true,
    selectedGameId: null,
    playerLimits: null,
    settings: {},
    gamePlayerIds: [],
    results: null,
    ...extra,
  };
}
