// Spielphase: Controller-View des Spiels per import() mounten oder Zuschauer-Screen zeigen.
import type { ControllerViewApi, GameControllerView } from "@couchplay/game-sdk/client";
import { isSpectator } from "@couchplay/protocol";
import { useEffect, useRef, useState } from "preact/hooks";
import { SelfBar } from "../components/common.js";
import { CONTROLLER_VIEWS } from "../games.js";
import { useApp, useAppState } from "../hooks.js";
import { errorText, t } from "../i18n/index.js";
import { vibrate } from "../lib/platform.js";
import { isSelfHost, selectedGame, selfPlayer } from "../state/store.js";

export function GameScreen() {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const me = selfPlayer(s);
  const host = isSelfHost(s);
  const spectator = !!s.playerId && isSpectator(room, s.playerId);
  const gameId = room.selectedGameId;

  const abort = host ? (
    <button
      type="button"
      class="link link--quiet"
      data-testid="abort-button"
      onClick={() => {
        if (confirm(t.game.abortConfirm)) app.send({ t: "game.abort" });
      }}
    >
      {t.game.abort}
    </button>
  ) : null;

  return (
    <main class="screen screen--game">
      {me && <SelfBar player={me} right={abort} />}
      {spectator || !gameId ? <Spectator /> : <GameStage key={gameId} gameId={gameId} />}
    </main>
  );
}

function Spectator() {
  const s = useAppState();
  const game = selectedGame(s);
  return (
    <section class="spectator" data-testid="spectator-screen">
      <div class="spectator__eye" aria-hidden="true">
        📺
      </div>
      <h1 class="title">{t.game.spectatorTitle}</h1>
      {game && <p class="chip">{game.name}</p>}
      <p class="lead">{t.game.spectatorLead}</p>
    </section>
  );
}

type StageStatus = "loading" | "ready" | "failed" | "unknown";

function GameStage({ gameId }: { gameId: string }) {
  const app = useApp();
  const s = useAppState();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<GameControllerView | null>(null);
  const [status, setStatus] = useState<StageStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const loader = CONTROLLER_VIEWS[gameId];
    if (!loader) {
      setStatus("unknown");
      return;
    }
    let cancelled = false;
    let view: GameControllerView | null = null;
    setStatus("loading");
    loader()
      .then((mod) => {
        const el = hostRef.current;
        if (cancelled || !el) return;
        const state = () => app.store.getState();
        const api: ControllerViewApi = {
          kind: "controller",
          gameId,
          settings: state().room?.settings ?? {},
          playerId: state().playerId ?? "",
          isHost: () => isSelfHost(state()),
          sendInput: (input) => {
            app.send({ t: "game.input", data: input });
          },
          vibrate,
          getPlayers: () => state().room?.players ?? [],
          getGamePlayerIds: () => state().room?.gamePlayerIds ?? [],
          serverNow: () => app.connection.serverNow(),
        };
        view = mod.default();
        view.mount(el, api);
        viewRef.current = view;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      viewRef.current = null;
      try {
        view?.unmount();
      } catch {
        // Fehler einer Spiel-View dürfen die App nicht abschießen.
      }
    };
  }, [gameId, attempt]);

  const gv = s.gameView;
  useEffect(() => {
    if (status === "ready" && gv && gv.gameId === gameId) viewRef.current?.update(gv.view);
  }, [gv, status]);

  const players = s.room?.players;
  useEffect(() => {
    if (status === "ready" && players) viewRef.current?.playersChanged?.(players);
  }, [players]);

  const err = s.gameError;
  useEffect(() => {
    if (err) viewRef.current?.onError?.(err.code, errorText(err.code));
  }, [err?.id]);

  return (
    <section class="stage" data-testid="game-stage" data-game={gameId}>
      {/* Gehört komplett der Spiel-View – Preact rendert hier keine Kinder. */}
      <div ref={hostRef} class="stage__view" />
      {status !== "ready" && (
        <div class="stage__overlay" role="status">
          {status === "loading" && <p class="lead">{t.game.loading}</p>}
          {status === "unknown" && <p class="lead">{t.game.unknownGame}</p>}
          {status === "failed" && (
            <>
              <p class="lead">{t.game.loadFailed}</p>
              <button type="button" class="btn btn--small" onClick={() => setAttempt((n) => n + 1)}>
                {t.game.retry}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
