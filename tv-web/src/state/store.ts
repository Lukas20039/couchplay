// Zentraler TV-Zustand: reiner Reducer + winziger Store (subscribe/dispatch).
// Seiteneffekte (WebSocket, localStorage) liegen in net/client.ts.
import type { ErrorCode } from "@couchplay/protocol/errors";
import type { GameManifest, RoomClosedReason, RoomState, ServerMessage } from "@couchplay/protocol";

export type ConnStatus = "connecting" | "online" | "reconnecting";

/** Zustände, aus denen der Client nicht selbst herauskommt (Nutzeraktion nötig). */
export type Fatal =
  | { kind: "version" }
  | { kind: "replaced" }
  | { kind: "closed"; reason: RoomClosedReason | "unknown" }
  | { kind: "error"; code: ErrorCode };

export interface GameTvPacket {
  gameId: string;
  seq: number;
  state: unknown;
}

export interface AppState {
  conn: { status: ConnStatus; attempt: number; retryAt: number | null };
  /** Raum, zu dem der TV gehört (aus room.created/room.resumed). */
  session: { code: string; joinUrl: string } | null;
  room: RoomState | null;
  catalog: GameManifest[];
  game: GameTvPacket | null;
  /** Höchste gesehene seq (game.tv); nach Reconnect zurückgesetzt. */
  lastSeq: number;
  fatal: Fatal | null;
  /** Letzter nicht-fataler Fehler (für Hinweis-Toast). */
  notice: { code: ErrorCode; id: number } | null;
}

export type Action =
  | { type: "server"; msg: ServerMessage }
  | { type: "conn"; status: ConnStatus; attempt?: number; retryAt?: number | null }
  | { type: "fatal"; fatal: Fatal }
  | { type: "notice"; code: ErrorCode }
  | { type: "dismissNotice" }
  /** Neuer Start (z. B. „Neuen Raum erstellen“): alles außer Katalog verwerfen. */
  | { type: "reset" };

export const initialState: AppState = {
  conn: { status: "connecting", attempt: 0, retryAt: null },
  session: null,
  room: null,
  catalog: [],
  game: null,
  lastSeq: -1,
  fatal: null,
  notice: null,
};

let noticeCounter = 0;

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "conn": {
      const conn = {
        status: action.status,
        attempt: action.attempt ?? (action.status === "online" ? 0 : state.conn.attempt),
        retryAt: action.retryAt ?? null,
      };
      // Neuer Verbindungsaufbau: seq-Zählung beginnt neu (Server sendet gecachten Zustand).
      return { ...state, conn, lastSeq: action.status === "online" ? state.lastSeq : -1 };
    }
    case "fatal":
      return { ...state, fatal: action.fatal };
    case "notice":
      return { ...state, notice: { code: action.code, id: ++noticeCounter } };
    case "dismissNotice":
      return state.notice ? { ...state, notice: null } : state;
    case "reset":
      return { ...initialState, catalog: state.catalog };
    case "server":
      return onServer(state, action.msg);
  }
}

function onServer(state: AppState, msg: ServerMessage): AppState {
  switch (msg.t) {
    case "room.created":
    case "room.resumed":
      return {
        ...state,
        session: { code: msg.code, joinUrl: msg.joinUrl },
        fatal: null,
        lastSeq: -1,
        // Bei neuem Raum gehört der alte Spielzustand nicht mehr dazu.
        game: msg.t === "room.created" ? null : state.game,
        room: msg.t === "room.created" ? null : state.room,
      };
    case "catalog":
      return { ...state, catalog: msg.games };
    case "room.state": {
      const room = msg.room;
      // Spielzustand nur behalten, solange dasselbe Spiel läuft.
      const keepGame = room.phase === "game" && state.game?.gameId === room.selectedGameId;
      return { ...state, room, game: keepGame ? state.game : null };
    }
    case "game.tv":
      if (msg.seq < state.lastSeq) return state; // veraltetes Paket
      return { ...state, lastSeq: msg.seq, game: { gameId: msg.gameId, seq: msg.seq, state: msg.state } };
    case "room.closed":
      return { ...state, fatal: { kind: "closed", reason: msg.reason } };
    case "error":
      return { ...state, notice: { code: msg.code, id: ++noticeCounter } };
    case "room.joined":
    case "game.view":
    case "pong":
      return state;
  }
}

export interface Store {
  get(): AppState;
  dispatch(action: Action): void;
  subscribe(fn: () => void): () => void;
}

export function createStore(start: AppState = initialState): Store {
  let state = start;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      state = next;
      for (const fn of listeners) fn();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
