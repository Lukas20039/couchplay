// Ergebnisphase: Rangliste, „Nochmal“ (Revanche) und „Zur Lobby“.
import { useState } from "preact/hooks";
import type { GameManifest, Player, RoomState } from "@couchplay/protocol";
import { t } from "../i18n/index.js";
import { avatarEmoji, fill, gameIcon, playerColorVar } from "../lib/format.js";
import { rematchPlayerIds, selectedGame, startCheck } from "../state/selectors.js";
import { ChooseOverlay } from "./Choose.js";
import { BACK_LEVEL, useApi, useBack } from "./context.js";

export interface RankRow {
  playerId: string;
  rank: number;
  score: number;
  player: Player | null;
}

/** Rangliste sortiert (Rang, dann Punkte absteigend), mit Spielerdaten verknüpft. */
export function rankingRows(room: RoomState): RankRow[] {
  const ranking = room.results?.ranking ?? [];
  return [...ranking]
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .map((r) => ({ ...r, player: room.players.find((p) => p.id === r.playerId) ?? null }));
}

export function Results(props: { room: RoomState; catalog: readonly GameManifest[] }) {
  const { room, catalog } = props;
  const api = useApi();
  const [choosing, setChoosing] = useState(false);
  const game = selectedGame(room, catalog);
  const check = startCheck(room, catalog);
  const rows = rankingRows(room);

  const toLobby = (): void => api.send({ t: "room.toLobby" });
  useBack(BACK_LEVEL.screen, () => {
    toLobby();
    return true;
  });

  const again = (): void => {
    const ids = rematchPlayerIds(room);
    if (ids) api.send({ t: "lobby.start", playerIds: ids });
    else if (check.kind === "choose") setChoosing(true);
    else if (check.kind === "ready") api.send({ t: "lobby.start" });
  };
  const canAgain = rematchPlayerIds(room) !== undefined || check.kind === "ready" || check.kind === "choose";

  return (
    <div class="screen results" data-testid="results">
      <header class="results-head">
        <span class="results-icon" aria-hidden="true">
          {gameIcon(room.selectedGameId ?? "")}
        </span>
        <div>
          <h1>{t.results.heading}</h1>
          {game && <p class="muted">{game.name}</p>}
        </div>
      </header>
      <ol class="ranking" data-testid="ranking">
        {rows.map((r) => (
          <li
            key={r.playerId}
            class={`rank-row rank-${Math.min(r.rank, 4)}`}
            style={{ "--pc": playerColorVar(r.player?.color ?? 0) }}
            data-testid="result-row"
            data-player-id={r.playerId}
            data-rank={r.rank}
            data-score={r.score}
          >
            <span class="rank-num">{fill(t.results.rank, { n: r.rank })}</span>
            <span class="avatar" aria-hidden="true">
              {avatarEmoji(r.player?.avatar ?? "")}
            </span>
            <span class="rank-name">{r.player?.name ?? t.results.unknownPlayer}</span>
            <span class="rank-score">{r.score === 1 ? t.results.point : fill(t.results.points, { n: r.score })}</span>
          </li>
        ))}
      </ol>
      <div class="button-row results-actions">
        <button
          class={`btn btn-primary ${canAgain ? "" : "is-disabled"}`}
          data-nav="results"
          data-nav-autofocus
          data-testid="play-again"
          aria-disabled={canAgain ? undefined : "true"}
          onClick={() => canAgain && again()}
        >
          {t.results.again}
        </button>
        <button class="btn" data-nav="results" data-testid="to-lobby" onClick={toLobby}>
          {t.results.toLobby}
        </button>
      </div>
      {choosing && check.kind === "choose" && (
        <ChooseOverlay room={room} min={check.min} max={check.max} onClose={() => setChoosing(false)} />
      )}
    </div>
  );
}
