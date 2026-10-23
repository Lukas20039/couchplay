// Wurzelkomponente: wählt den Bildschirm nach Verbindungs- und Raumphase.
import { useEffect, useMemo, useState } from "preact/hooks";
import { music } from "./audio/index.js";
import { trackFor } from "./audio/music.js";
import { exitApp, hasNative, openNativeSettings } from "./lib/native.js";
import { tvNav } from "./nav/navigator.js";
import type { TvClient } from "./net/client.js";
import type { AppState, Store } from "./state/store.js";
import { ReconnectBanner, Toast } from "./ui/common.js";
import { ApiContext, type AppApi } from "./ui/context.js";
import { GameStage } from "./ui/GameStage.js";
import { Lobby } from "./ui/Lobby.js";
import { Results } from "./ui/Results.js";
import { FatalScreen, StartScreen } from "./ui/Screens.js";

function useStore(store: Store): AppState {
  const [state, setState] = useState(store.get());
  useEffect(() => {
    setState(store.get());
    return store.subscribe(() => setState(store.get()));
  }, [store]);
  return state;
}

/** Oberste Ebene = kein Overlay offen und Start-/Lobby-/End-Bildschirm. */
function atRoot(state: AppState): boolean {
  if (document.querySelector("[data-nav-layer]")) return false;
  return state.fatal !== null || !state.room || state.room.phase === "lobby";
}

export function App(props: { store: Store; client: TvClient }) {
  const { store, client } = props;
  const state = useStore(store);

  const api = useMemo<AppApi>(
    () => ({
      send: (msg) => {
        client.send(msg);
      },
      serverNow: () => client.serverNow(),
      retryNow: () => client.retryNow(),
      newRoom: () => client.newRoom(),
      reload: () => location.reload(),
    }),
    [client],
  );

  // Zurück auf oberster Ebene → Android-Shell beenden lassen; Menü/Langdruck OK → Einstellungen.
  useEffect(() => {
    tvNav.onRootBack = () => exitApp();
    tvNav.onMenu = () => {
      if (hasNative() && atRoot(store.get())) openNativeSettings();
    };
  }, [store]);

  // Neuer Raum ohne Spielauswahl: erstes Katalogspiel vorwählen (spart Klicks).
  const autoSelected = useMemo(() => new Set<string>(), []);
  useEffect(() => {
    const { room, catalog, conn } = state;
    const first = catalog[0];
    if (!room || !first || conn.status !== "online" || room.phase !== "lobby" || room.selectedGameId) return;
    if (autoSelected.has(room.code)) return;
    autoSelected.add(room.code);
    client.send({ t: "lobby.selectGame", gameId: first.id });
  }, [state.room, state.catalog, state.conn.status]);

  // Hintergrundmusik passend zum Bildschirm; Autoplay-Sperre löst die erste Taste/Berührung.
  const track = state.fatal ? null : trackFor(state.room);
  useEffect(() => music().setTrack(track), [track]);
  useEffect(() => {
    const unlock = (): void => music().unlock();
    const visible = (): void => music().setSuspended(document.visibilityState === "hidden");
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("pointerdown", unlock, true);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  // Nach jedem Render: Fokus sicherstellen (neue Bildschirme, entfernte Elemente).
  useEffect(() => {
    const id = requestAnimationFrame(() => tvNav.ensureFocus());
    return () => cancelAnimationFrame(id);
  });

  const { room, fatal } = state;
  let screen;
  if (fatal) screen = <FatalScreen fatal={fatal} />;
  else if (!room) screen = <StartScreen conn={state.conn} resuming={client.session() !== null} />;
  else if (room.phase === "game") screen = <GameStage room={room} game={state.game} />;
  else if (room.phase === "results") screen = <Results room={room} catalog={state.catalog} />;
  else screen = <Lobby state={state} room={room} />;

  return (
    <ApiContext.Provider value={api}>
      {screen}
      {room && !fatal && <ReconnectBanner conn={state.conn} />}
      <Toast notice={state.notice} onDone={() => store.dispatch({ type: "dismissNotice" })} />
    </ApiContext.Provider>
  );
}
