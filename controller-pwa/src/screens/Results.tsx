// Ergebnis-Screen: eigener Platz groß, Rangliste; Host: „Nochmal“ / „Zur Lobby“.
import { useEffect } from "preact/hooks";
import { Avatar, SelfBar } from "../components/common.js";
import { useApp, useAppState } from "../hooks.js";
import { t } from "../i18n/index.js";
import { vibrate } from "../lib/platform.js";
import { isSelfHost, ownResult, selectedGame, selfPlayer } from "../state/store.js";

export function Results() {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const me = selfPlayer(s);
  const host = isSelfHost(s);
  const mine = ownResult(s);
  const game = selectedGame(s);
  const ranking = room.results?.ranking ?? [];
  const byId = new Map(room.players.map((p) => [p.id, p]));

  useEffect(() => {
    if (mine?.rank === 1) vibrate([60, 40, 120]);
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
        <h1 class="subtitle">
          {game ? t.results.titleGame(game.name) : t.results.title}
        </h1>
        {mine ? (
          <div class={`place${mine.rank === 1 ? " place--first" : ""}`} data-testid="own-place">
            <span class="place__rank">{t.results.yourPlace(mine.rank)}</span>
            <span class="place__score">{t.results.points(mine.score)}</span>
          </div>
        ) : (
          <p class="lead">{t.results.notRanked}</p>
        )}
        <ol class="ranking">
          {ranking.map((r) => {
            const p = byId.get(r.playerId);
            return (
              <li key={r.playerId} class={`ranking__row${r.playerId === s.playerId ? " ranking__row--me" : ""}`} style={p ? { "--c": `var(--p${p.color})` } : undefined}>
                <span class="ranking__rank">{r.rank}</span>
                {p && <Avatar player={p} size="s" />}
                <span class="ranking__name">{p?.name ?? t.results.unknownPlayer}</span>
                <span class="ranking__score">{r.score}</span>
              </li>
            );
          })}
        </ol>
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
