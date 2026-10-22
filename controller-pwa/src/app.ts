// Verdrahtet Store, Verbindung und Browser-Ereignisse. Komponenten sprechen nur mit `AppController`.
import type { ClientMessage, GameManifest, ProgressValues } from "@couchplay/protocol";
import { WS_PATH, type AvatarId } from "@couchplay/protocol/constants";
import { Connection, type WebSocketFactory, type WebSocketLike } from "./net/connection.js";
import { suggestName } from "./lib/names.js";
import { resetUrl } from "./lib/route.js";
import { decideStart } from "./lib/start.js";
import { loadProfile, loadSession, saveProfile, saveSession } from "./lib/storage.js";
import { createStore, initialState, type Store } from "./state/store.js";

export interface AppController {
  store: Store;
  connection: Connection;
  setCode(code: string): void;
  goToProfile(): void;
  goToCode(): void;
  join(name: string, avatar: AvatarId): void;
  /** Eigenen Namen/Avatar in Lobby/Ergebnis ändern (player.update). */
  updateProfile(name: string, avatar: AvatarId): boolean;
  /** Automatischen Beitritt abbrechen → Name/Avatar-Seite. */
  cancelAutoJoin(): void;
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

/** Gespeicherter Fortschritt je Spiel mit `progressKey` (localStorage, ganze Zahl > 0). */
export function readProgress(catalog: readonly GameManifest[], storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): ProgressValues {
  const out: ProgressValues = {};
  for (const g of catalog) {
    if (!g.progressKey) continue;
    let raw: string | null = null;
    try {
      raw = storage?.getItem(g.progressKey) ?? null;
    } catch {
      // Speicher gesperrt (privater Modus) → kein Fortschritt.
    }
    const v = Number.parseInt(raw ?? "", 10);
    if (Number.isFinite(v) && v > 0) out[g.id] = Math.min(v, 1_000_000_000);
  }
  return out;
}

export function wsUrl(loc: Pick<Location, "protocol" | "host"> = location): string {
  return `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}${WS_PATH}`;
}

export function createApp(opts: AppOptions = {}): AppController {
  const decision = decideStart(opts.pathname ?? location.pathname, loadSession(), loadProfile());
  const plan = decision.plan;
  // QR/Link hat Vorrang: Sitzung eines anderen Raums verwerfen (Platz dort verfällt nach der Gnadenfrist).
  if (decision.discardSession) saveSession(null);
  const linkCode = plan.kind === "autoJoin" || plan.kind === "profile" ? plan.code : null;
  const store = createStore(
    initialState({ code: linkCode, online: navigator.onLine !== false, linkInvalid: plan.kind === "code" && plan.invalidLink }),
  );
  /** Beim automatischen Beitritt wird NAME_TAKEN genau einmal mit einem Vorschlag wiederholt. */
  let autoRetried = false;
  let lastAvatar: AvatarId | null = null;
  /** Zuletzt an diese Verbindung gemeldeter Fortschritt (JSON); null = noch nichts gemeldet. */
  let sentProgress: string | null = null;

  /** In Lobby/Ergebnissen den gespeicherten Fortschritt melden (Spiele speichern ihn am Spielende). */
  const reportProgress = (): void => {
    const st = store.getState();
    if (!st.playerId || (st.room?.phase !== "lobby" && st.room?.phase !== "results")) return;
    const progress = readProgress(st.catalog);
    const json = JSON.stringify(progress);
    if (json === sentProgress || (sentProgress === null && json === "{}")) return;
    if (connection.send({ t: "player.progress", progress })) sentProgress = json;
  };

  const connection = new Connection({
    url: opts.url ?? wsUrl(),
    createSocket: opts.createSocket ?? ((url) => new WebSocket(url) as unknown as WebSocketLike),
    loadSession,
    saveSession,
    events: {
      message: (msg) => {
        store.dispatch({ type: "server", msg });
        if (msg.t === "room.joined") {
          resetUrl();
          sentProgress = null;
        }
        if (msg.t === "room.state") reportProgress();
      },
      status: (status) => store.dispatch({ type: "status", status }),
      joinError: (code) => {
        const st = store.getState();
        if (st.autoJoin && code === "NAME_TAKEN" && !autoRetried && st.attemptedName && lastAvatar) {
          // Typisch: früherer Beitritt wurde angenommen, die Antwort ging verloren → „Anna2“.
          autoRetried = true;
          const name = suggestName(st.attemptedName);
          store.dispatch({ type: "joinStart", name, auto: true });
          connection.join(st.code, name, lastAvatar);
          return;
        }
        store.dispatch({ type: "joinError", code });
      },
      ended: (reason) => {
        store.dispatch({ type: "ended", reason });
        resetUrl();
      },
    },
  });

  if (plan.kind === "resume") connection.resume(plan.session);
  if (plan.kind === "autoJoin") {
    lastAvatar = plan.avatar;
    store.dispatch({ type: "joinStart", name: plan.name, auto: true });
    connection.join(plan.code, plan.name, plan.avatar);
  }
  if (plan.kind === "code" && plan.invalidLink) resetUrl();

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
      lastAvatar = avatar;
      store.dispatch({ type: "joinStart", name });
      connection.join(code, name, avatar);
    },
    cancelAutoJoin() {
      connection.abandon();
      store.dispatch({ type: "autoJoinCancel" });
    },
    updateProfile(name, avatar) {
      const st = store.getState();
      const me = st.room?.players.find((p) => p.id === st.playerId);
      if (!me) return false;
      const msg: ClientMessage = { t: "player.update" };
      if (name !== me.name) msg.name = name;
      if (avatar !== me.avatar) msg.avatar = avatar;
      if (msg.name === undefined && msg.avatar === undefined) return true;
      return connection.send(msg);
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
