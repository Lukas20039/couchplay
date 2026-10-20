// Ergebnis-Screen: eigener Platz, Top 3 als Podium, restliche Plätze als Liste;
// Host: „Nochmal“ / „Zur Lobby“.
import type { GameResults, Player, RankingEntry } from "@couchplay/protocol";
import { BOT_EMOJI } from "@couchplay/protocol/constants";
import { useEffect } from "preact/hooks";
import { Avatar, SelfBar } from "../components/common.js";
import { useApp, useAppState } from "../hooks.js";
import { t } from "../i18n/index.js";
import { firstTime, resultsKey } from "../lib/once.js";
import { vibrate } from "../lib/platform.js";
import { isSelfHost, ownResult, selectedGame, selfPlayer } from "../state/store.js";

/** Hat der Computer gewonnen? (TicTacToe: results.data.winnerId === "bot" + data.bot) */
export function botWon(results: GameResults | null | undefined): boolean {
  const data = results?.data;
  const isRec = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  return isRec(data) && data.winnerId === "bot" && isRec(data.bot);
}

type PodiumItem = { kind: "bot" } | { kind: "player"; entry: RankingEntry };

/** Podium-Reihenfolge links→rechts: 2., 1., 3. (bei weniger Einträgen entsprechend kürzer). */
export function podiumOrder<T>(top: readonly T[]): Array<{ entry: T; pos: number }> {
  const order = [1, 0, 2];
  return order.filter((i) => i < top.length).map((i) => ({ entry: top[i]!, pos: i }));
}

export function Results() {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const me = selfPlayer(s);
  const host = isSelfHost(s);
  const mine = ownResult(s);
  const game = selectedGame(s);
  const ranking = [...(room.results?.ranking ?? [])].sort((a, b) => a.rank - b.rank);
  const byId = new Map(room.players.map((p) => [p.id, p]));
  // Computer hat gewonnen: Sockel 1 gehört (rein visuell) dem Computer, Menschen ab Sockel 2.
  const bot = botWon(room.results);
  const podiumSize = bot ? 2 : 3;
  const top: PodiumItem[] = [
    ...(bot ? [{ kind: "bot" as const }] : []),
    ...ranking.slice(0, podiumSize).map((entry) => ({ kind: "player" as const, entry })),
  ];
  const rest = ranking.slice(podiumSize);

  // Nur wenn der Übergang Spiel → Ergebnis live erlebt wurde, und pro Runde nur einmal
  // (Reload/Reconnect auf dem Ergebnis-Screen vibriert nicht erneut).
  useEffect(() => {
    if (!bot && mine?.rank === 1 && s.resultsLive && firstTime(resultsKey(room))) vibrate([60, 40, 120]);
  }, []);

  const again = (): void => {
    // Revanche mit derselben Runde, sofern alle noch da sind – sonst Serverstandard.
    const prev = room.gamePlayerIds;
    const allThere = prev.length > 0 && prev.every((id) => byId.get(id)?.connected);
    app.send(allThere ? { t: "lobby.start", playerIds: [...prev] } : { t: "lobby.start" });
  };

  return (
    <main class="screen screen--results">
      {me && <SelfBar player={me} />}
      <section class="results" data-testid="results">
        <h1 class="subtitle">{game ? t.results.titleGame(game.name) : t.results.title}</h1>
        {bot ? (
          <div class="place place--bot" data-testid="bot-wins" role="status">
            <span class="place__rank">
              <span aria-hidden="true">{BOT_EMOJI}</span> {t.results.botWins}
            </span>
            {mine && <span class="place__score">{t.results.points(mine.score)}</span>}
          </div>
        ) : mine ? (
          <div class={`place${mine.rank === 1 ? " place--first" : ""}`} data-testid="own-place">
            <span class="place__rank">{t.results.yourPlace(mine.rank)}</span>
            <span class="place__score">{t.results.points(mine.score)}</span>
          </div>
        ) : (
          <p class="lead">{t.results.notRanked}</p>
        )}

        {top.length > 0 && (
          <ol class="podium" aria-label={t.results.podium} data-testid="podium">
            {podiumOrder(top).map(({ entry: item, pos }) =>
              item.kind === "bot" ? (
                <BotStep key="bot" />
              ) : (
                <PodiumStep
                  key={item.entry.playerId}
                  entry={item.entry}
                  pos={pos}
                  // Mit Computer auf Platz 1: Sockelnummer = Position (kein doppelter „1“-Sockel).
                  shownRank={bot ? pos + 1 : item.entry.rank}
                  player={byId.get(item.entry.playerId)}
                  me={item.entry.playerId === s.playerId}
                />
              ),
            )}
          </ol>
        )}

        {rest.length > 0 && (
          <ol class="ranking" start={podiumSize + 1}>
            {rest.map((r) => {
              const p = byId.get(r.playerId);
              return (
                <li
                  key={r.playerId}
                  class={`ranking__row${r.playerId === s.playerId ? " ranking__row--me" : ""}`}
                  style={p ? { "--c": `var(--p${p.color})` } : undefined}
                >
                  <span class="ranking__rank">{r.rank}</span>
                  {p && <Avatar player={p} size="s" />}
                  <span class="ranking__name">{p?.name ?? t.results.unknownPlayer}</span>
                  <span class="ranking__score">{r.score}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <footer class="actions">
        {host ? (
          <>
            <button type="button" class="btn btn--primary" data-testid="again-button" onClick={again}>
              {t.results.again}
            </button>
            <button type="button" class="btn btn--ghost" data-testid="to-lobby-button" onClick={() => app.send({ t: "room.toLobby" })}>
              {t.results.toLobby}
            </button>
          </>
        ) : (
          <p class="hint">{t.results.waitHost}</p>
        )}
      </footer>
    </main>
  );
}

function BotStep() {
  return (
    <li class="podium__step podium__step--1 podium__step--bot" style={{ "--c": "var(--muted)" }} data-testid="podium-bot" aria-label={t.results.botName}>
      <span class="avatar avatar--m" aria-hidden="true">
        {BOT_EMOJI}
      </span>
      <span class="podium__name">{t.results.botName}</span>
      <span class="podium__score">{"\u00a0"}</span>
      <span class="podium__block">
        <span class="podium__rank">1</span>
      </span>
    </li>
  );
}

interface PodiumStepProps {
  entry: RankingEntry;
  pos: number;
  shownRank: number;
  player: Player | undefined;
  me: boolean;
}

function PodiumStep({ entry, pos, shownRank, player, me }: PodiumStepProps) {
  return (
    <li
      class={`podium__step podium__step--${pos + 1}${me ? " podium__step--me" : ""}`}
      style={{ "--c": player ? `var(--p${player.color})` : "var(--line)" }}
      data-testid={`podium-${pos + 1}`}
    >
      {player ? <Avatar player={player} size="m" /> : <span class="avatar avatar--m" aria-hidden="true" />}
      <span class="podium__name">{player?.name ?? t.results.unknownPlayer}</span>
      <span class="podium__score">{entry.score}</span>
      <span class="podium__block">
        <span class="podium__rank">{shownRank}</span>
      </span>
    </li>
  );
}
