// App-Zustand als reiner Reducer + winziger Store (keine Fremdbibliothek).
import type { GameManifest, RoomState, ServerMessage } from "@couchplay/protocol";
import type { ErrorCode } from "@couchplay/protocol/errors";
import type { ConnStatus, EndReason } from "../net/connection.js";

export type JoinStep = "code" | "profile";

export interface GameViewPacket {
  gameId: string;
  seq: number;
  view: unknown;
}

export interface AppState {
  conn: ConnStatus;
  online: boolean;
  /** Join-Ablauf (solange nicht im Raum). */
  step: JoinStep;
  code: string;
  joinPending: boolean;
  joinError: ErrorCode | "connect" | null;
  /** Meldung auf der Startseite nach Sitzungsende. */
  notice: EndReason | null;
  playerId: string | null;
  room: RoomState | null;
  catalog: GameManifest[];
  gameView: GameViewPacket | null;
  /** Zuletzt gesehenes seq (game.view); kleinere werden verworfen. */
  lastSeq: number;
  /** Fehler für die Spiel-View (onError), mit laufender ID für Effekte. */
  gameError: { code: ErrorCode; id: number } | null;
  /** Allgemeiner Fehlerhinweis (Toast). */
  toast: { code: ErrorCode; id: number } | null;
}

export type Action =
  | { type: "server"; msg: ServerMessage }
  | { type: "status"; status: ConnStatus }
  | { type: "online"; online: boolean }
  | { type: "code"; code: string }
  | { type: "step"; step: JoinStep }
  | { type: "joinStart" }
  | { type: "joinError"; code: ErrorCode | "connect" }
  | { type: "ended"; reason: EndReason }
  | { type: "dismissNotice" }
  | { type: "toastClear"; id: number };

export function initialState(init: { code?: string | null; online?: boolean } = {}): AppState {
  const code = init.code ?? "";
  return {
    conn: "idle",
    online: init.online ?? true,
    step: code ? "profile" : "code",
    code,
    joinPending: false,
    joinError: null,
    notice: null,
    playerId: null,
    room: null,
    catalog: [],
    gameView: null,
    lastSeq: -1,
    gameError: null,
    toast: null,
  };
}

/** Fehler, die die laufende Spiel-View selbst anzeigt (statt Toast). */
const GAME_VIEW_ERRORS: readonly ErrorCode[] = ["INVALID_INPUT"];

let nextId = 1;

function onServer(s: AppState, msg: ServerMessage): AppState {
  switch (msg.t) {
    case "room.joined":
      return {
        ...s,
        playerId: msg.playerId,
        code: msg.code,
        joinPending: false,
        joinError: null,
        notice: null,
        // Nach (Re-)Connect beginnt seq neu; gecachte View folgt.
        lastSeq: -1,
        gameView: null,
      };
    case "catalog":
      return { ...s, catalog: msg.games };
    case "room.state": {
      const room = msg.room;
      const keepView = room.phase === "game" && s.gameView?.gameId === room.selectedGameId;
      return { ...s, room, gameView: keepView ? s.gameView : null, lastSeq: keepView ? s.lastSeq : -1 };
    }
    case "game.view":
      if (msg.seq < s.lastSeq) return s;
      return { ...s, gameView: { gameId: msg.gameId, seq: msg.seq, view: msg.view }, lastSeq: msg.seq };
    case "error":
      if (s.room?.phase === "game" && GAME_VIEW_ERRORS.includes(msg.code)) {
        return { ...s, gameError: { code: msg.code, id: nextId++ } };
      }
      return { ...s, toast: { code: msg.code, id: nextId++ } };
    default:
      return s;
  }
}

export function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "server":
      return onServer(s, a.msg);
    case "status":
      return { ...s, conn: a.status };
    case "online":
      return { ...s, online: a.online };
    case "code":
      return { ...s, code: a.code, joinError: null };
    case "step":
      return { ...s, step: a.step, joinError: a.step === "code" ? s.joinError : null };
    case "joinStart":
      return { ...s, joinPending: true, joinError: null, notice: null };
    case "joinError": {
      // Falscher Code → zurück zur Code-Eingabe; sonst (Name vergeben, voll, …) beim Profil bleiben.
      const backToCode = a.code === "ROOM_NOT_FOUND";
      return { ...s, joinPending: false, joinError: a.code, step: backToCode ? "code" : s.step };
    }
    case "ended":
      return {
        ...initialState({ online: s.online }),
        conn: s.conn,
        catalog: s.catalog,
        notice: a.reason,
      };
    case "dismissNotice":
      return { ...s, notice: null };
    case "toastClear":
      return s.toast?.id === a.id ? { ...s, toast: null } : s;
  }
}

export interface Store {
  getState(): AppState;
  dispatch(a: Action): void;
  subscribe(fn: () => void): () => void;
}

export function createStore(initial: AppState): Store {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(a) {
      const next = reducer(state, a);
      if (next === state) return;
      state = next;
      for (const fn of [...subs]) fn();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

// ---------------------------------------------------------------------------
// Abgeleitete Werte
// ---------------------------------------------------------------------------

export function selfPlayer(s: AppState) {
  return s.room?.players.find((p) => p.id === s.playerId) ?? null;
}

export function isSelfHost(s: AppState): boolean {
  return !!s.playerId && s.room?.hostId === s.playerId;
}

export function selectedGame(s: AppState): GameManifest | null {
  const id = s.room?.selectedGameId;
  return (id && s.catalog.find((g) => g.id === id)) || null;
}

/** Eigener Ergebniseintrag (oder null, wenn nicht teilgenommen). */
export function ownResult(s: AppState) {
  return s.room?.results?.ranking.find((r) => r.playerId === s.playerId) ?? null;
}
