// Ergebnisphase: Rangliste, „Nochmal“ (Revanche) und „Zur Lobby“.
import { useState } from "preact/hooks";
import { BOT_EMOJI } from "@couchplay/protocol/constants";
import type { GameManifest, Player, RoomState } from "@couchplay/protocol";
import { t } from "../i18n/index.js";
import { avatarEmoji, fill, gameIcon, playerColorVar } from "../lib/format.js";
import { botWon, dataPlayerName, rematchPlayerIds, selectedGame, startCheck } from "../state/selectors.js";
import { ChooseOverlay } from "./Choose.js";
import { BACK_LEVEL, useApi, useBack } from "./context.js";

export interface RankRow {
  playerId: string;
  rank: number;
  score: number;
  player: Player | null;
  /** Name aus results.data, falls der Spieler den Raum verlassen hat. */
  fallbackName: string | null;
}

/** Rangliste sortiert (Rang, dann Punkte absteigend), mit Spielerdaten verknüpft. */
export function rankingRows(room: RoomState): RankRow[] {
  const ranking = room.results?.ranking ?? [];
  return [...ranking]
    .sort((a, b) => a.rank - b.rank || b.score - a.score)
    .map((r) => ({
      ...r,
      player: room.players.find((p) => p.id === r.playerId) ?? null,
      fallbackName: dataPlayerName(room.results, r.playerId),
    }));
}

function playerName(r: RankRow): string {
  return r.player?.name ?? r.fallbackName ?? t.results.unknownPlayer;
}

function scoreText(score: number): string {
  return score === 1 ? t.results.point : fill(t.results.points, { n: score });
}

export function Results(props: { room: RoomState; catalog: readonly GameManifest[] }) {
  const { room, catalog } = props;
  const api = useApi();
  const [choosing, setChoosing] = useState(false);
  const game = selectedGame(room, catalog);
  const check = startCheck(room, catalog);
  const rows = rankingRows(room);
  // Computer hat gewonnen: Sockel 1 gehört (rein visuell) dem Computer, Menschen ab Sockel 2.
  const bot = botWon(room.results);
  const podiumSize = bot ? 2 : 3;
  const podium = rows.slice(0, podiumSize);
  const rest = rows.slice(podiumSize);

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
          {gameIcon(game)}
        </span>
        <div>
          <h1>{t.results.heading}</h1>
          {game && <p class="muted">{game.name}</p>}
        </div>
      </header>
      {/* Top 3 als Podium (DOM-Reihenfolge = Rang; optisch 2–1–3 per CSS order), Rest als Liste. */}
      {bot && (
        <p class="results-banner" role="status" data-testid="bot-wins">
          <span aria-hidden="true">{BOT_EMOJI}</span> {t.results.botWins}
        </p>
      )}
      <ol class="podium" data-testid="ranking">
        {bot && (
          <li key="bot" class="podium-place place-1 podium-bot" data-testid="podium-bot" aria-label={t.results.botName}>
            <span class="avatar podium-avatar" aria-hidden="true">
              {BOT_EMOJI}
            </span>
            <span class="podium-name">{t.results.botName}</span>
            <span class="podium-score">&nbsp;</span>
            <span class="podium-block">
              <span class="podium-rank">{fill(t.results.rank, { n: 1 })}</span>
            </span>
          </li>
        )}
        {podium.map((r, i) => (
          <li
            key={r.playerId}
            class={`podium-place place-${i + 1 + (bot ? 1 : 0)}`}
            style={{ "--pc": playerColorVar(r.player?.color ?? 0) }}
            data-testid="result-row"
            data-player-id={r.playerId}
            data-rank={r.rank}
            data-score={r.score}
          >
            <span class="avatar podium-avatar" aria-hidden="true">
              {avatarEmoji(r.player?.avatar ?? "")}
            </span>
            <span class="podium-name">{playerName(r)}</span>
            <span class="podium-score">{scoreText(r.score)}</span>
            <span class="podium-block">
              <span class="podium-rank">{fill(t.results.rank, { n: r.rank })}</span>
            </span>
          </li>
        ))}
      </ol>
      {rest.length > 0 && (
        <ol class="ranking" start={podiumSize + 1}>
          {rest.map((r) => (
            <li
              key={r.playerId}
              class="rank-row"
              style={{ "--pc": playerColorVar(r.player?.color ?? 0) }}
              data-testid="result-row"
              data-player-id={r.playerId}
              data-rank={r.rank}
              data-score={r.score}
            >
              <span class="rank-num">{fill(t.results.rank, { n: r.rank })}</span>
              <span class="avatar avatar-small" aria-hidden="true">
                {avatarEmoji(r.player?.avatar ?? "")}
              </span>
              <span class="rank-name">{playerName(r)}</span>
              <span class="rank-score">{scoreText(r.score)}</span>
            </li>
          ))}
        </ol>
      )}
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
