// Verdrahtet Store, Verbindung und Browser-Ereignisse. Komponenten sprechen nur mit `AppController`.
import type { ClientMessage } from "@couchplay/protocol";
import { WS_PATH, type AvatarId } from "@couchplay/protocol/constants";
import { Connection, type WebSocketFactory, type WebSocketLike } from "./net/connection.js";
import { parseRoute, resetUrl } from "./lib/route.js";
import { loadSession, saveProfile, saveSession } from "./lib/storage.js";
import { createStore, initialState, type Store } from "./state/store.js";

export interface AppController {
  store: Store;
  connection: Connection;
  setCode(code: string): void;
  goToProfile(): void;
  goToCode(): void;
  join(name: string, avatar: AvatarId): void;
  send(msg: ClientMessage): boolean;
  leave(): void;
  abandon(): void;
  dismissNotice(): void;
}

export interface AppOptions {
  pathname?: string;
  url?: string;
  createSocket?: WebSocketFactory;
  /** Browser-Ereignisse (visibilitychange, pageshow, online/offline) verdrahten. */
  bindWindow?: boolean;
}

export function wsUrl(loc: Pick<Location, "protocol" | "host"> = location): string {
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}${WS_PATH}`;
}

export function createApp(opts: AppOptions = {}): AppController {
  const route = parseRoute(opts.pathname ?? location.pathname);
  const stored = loadSession();
  const store = createStore(initialState({ code: route.code, online: navigator.onLine !== false }));

  const connection = new Connection({
    url: opts.url ?? wsUrl(),
    createSocket: opts.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike),
    loadSession,
    saveSession,
    events: {
      message: (msg) => {
        store.dispatch({ type: "server", msg });
        if (msg.t === "room.joined") resetUrl();
      },
      status: (status) => store.dispatch({ type: "status", status }),
      joinError: (code) => store.dispatch({ type: "joinError", code }),
      ended: (reason) => {
        store.dispatch({ type: "ended", reason });
        resetUrl();
      },
    },
  });

  // Gespeicherte Sitzung nur aufnehmen, wenn kein anderer Raum per Link gewünscht ist.
  if (stored && (!route.code || route.code === stored.code)) connection.resume(stored);

  if (opts.bindWindow !== false) {
    const check = (): void => {
      if (document.visibilityState === "visible") connection.checkAlive();
    };
    document.addEventListener("visibilitychange", check);
    // iOS bfcache: Seite kommt eingefroren zurück, Sockets sind tot.
    window.addEventListener("pageshow", (e) => {
      if ((e as PageTransitionEvent).persisted) connection.checkAlive();
    });
    window.addEventListener("focus", check);
    window.addEventListener("online", () => {
      store.dispatch({ type: "online", online: true });
      connection.checkAlive();
    });
    window.addEventListener("offline", () => store.dispatch({ type: "online", online: false }));
  }

  return {
    store,
    connection,
    setCode: (code) => store.dispatch({ type: "code", code }),
    goToProfile: () => store.dispatch({ type: "step", step: "profile" }),
    goToCode: () => {
      store.dispatch({ type: "step", step: "code" });
      resetUrl();
    },
    join(name, avatar) {
      const { code } = store.getState();
      saveProfile({ name, avatar });
      store.dispatch({ type: "joinStart" });
      connection.join(code, name, avatar);
    },
    send: (msg) => connection.send(msg),
    leave: () => connection.leave(),
    abandon() {
      connection.abandon();
      store.dispatch({ type: "step", step: "code" });
    },
    dismissNotice: () => store.dispatch({ type: "dismissNotice" }),
  };
}
