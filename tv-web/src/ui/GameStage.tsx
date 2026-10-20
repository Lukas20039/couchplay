// Spielphase: TV-View des Spiels per import() laden und mounten; Overlays für
// getrennte Spieler und das Pause-/Abbrechen-Menü (Zurück-Taste).
import { useEffect, useRef, useState } from "preact/hooks";
import type { GameTvView, TvViewApi } from "@couchplay/game-sdk/client";
import type { RoomState } from "@couchplay/protocol";
import { TV_VIEWS } from "../games.js";
import { t } from "../i18n/index.js";
import { fill } from "../lib/format.js";
import { disconnectedParticipants } from "../state/selectors.js";
import type { GameTvPacket } from "../state/store.js";
import { Overlay } from "./common.js";
import { BACK_LEVEL, useApi, useBack } from "./context.js";

type LoadState = "loading" | "ready" | "failed";

export function GameStage(props: { room: RoomState; game: GameTvPacket | null }) {
  const { room, game } = props;
  const api = useApi();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<GameTvView | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const gameRef = useRef(game);
  gameRef.current = game;
  const [load, setLoad] = useState<LoadState>("loading");
  const [menu, setMenu] = useState(false);
  const gameId = room.selectedGameId;

  useBack(BACK_LEVEL.screen, () => {
    setMenu(true);
    return true;
  });

  // View laden/mounten, sobald das Spiel feststeht; beim Verlassen unmounten.
  useEffect(() => {
    if (!gameId) return undefined;
    let cancelled = false;
    setLoad("loading");
    const loader = TV_VIEWS[gameId];
    if (!loader) {
      setLoad("failed");
      return undefined;
    }
    loader()
      .then((mod) => {
        const el = host.current;
        if (cancelled || !el) return;
        const v = mod.default();
        const viewApi: TvViewApi = {
          kind: "tv",
          gameId,
          settings: roomRef.current.settings,
          getPlayers: () => roomRef.current.players,
          getGamePlayerIds: () => roomRef.current.gamePlayerIds,
          serverNow: () => api.serverNow(),
        };
        v.mount(el, viewApi);
        view.current = v;
        const g = gameRef.current;
        if (g && g.gameId === gameId) v.update(g.state);
        setLoad("ready");
      })
      .catch(() => {
        if (!cancelled) setLoad("failed");
      });
    return () => {
      cancelled = true;
      try {
        view.current?.unmount();
      } finally {
        view.current = null;
      }
    };
  }, [gameId]);

  // Neue Zustände weiterreichen.
  useEffect(() => {
    if (view.current && game && game.gameId === gameId) view.current.update(game.state);
  }, [game?.seq]);

  useEffect(() => {
    view.current?.playersChanged?.(room.players);
  }, [room.players]);

  const missing = disconnectedParticipants(room);

  return (
    <div class="screen game-stage" data-testid="game-stage" data-game-id={gameId ?? ""}>
      <div class="game-host" ref={host} />
      {load === "loading" && <div class="center-message">{t.game.loading}</div>}
      {load === "failed" && <div class="center-message">{t.game.loadFailed}</div>}
      {missing.length > 0 && (
        <div class="banner banner-player" role="status" data-testid="player-disconnected">
          {fill(t.game.disconnected, { names: missing.map((p) => p.name).join(", ") })}
        </div>
      )}
      {menu && (
        <Overlay onClose={() => setMenu(false)} class="menu" testId="pause-menu">
          <h2>{t.game.menuHeading}</h2>
          <p class="muted">{t.game.menuHint}</p>
          <div class="button-col">
            <button class="btn btn-primary" data-nav="menu" data-nav-autofocus onClick={() => setMenu(false)}>
              {t.game.resume}
            </button>
            <button
              class="btn"
              data-nav="menu"
              data-testid="abort-game"
              onClick={() => {
                api.send({ t: "game.abort" });
                setMenu(false);
              }}
            >
              {t.game.abort}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
