// TV-View Blockblast (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Alle Bretter gleichzeitig, Größe je nach Spielerzahl; Countdown, Uhr, Angriffs-Meldungen.
// Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import { de } from "../i18n/de.js";
import type { BlockblastTvState, BoardInfo } from "../shared.js";
import { BOARD_CSS, BoardView, avatarEmoji, ensureStyles, playerColor, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

function BlockblastTv({ state, api, players }: TvComponentProps<BlockblastTvState>) {
  ensureStyles("bb-board-css", BOARD_CSS);
  ensureStyles("bb-tv-css", TV_CSS);
  const now = useServerNow(api.serverNow, state !== null && state.phase !== "over");
  if (!state) return <div class="bb-tv" />;

  const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? state.players.find((p) => p.id === id)?.name ?? "";
  const n = state.players.length;
  const layout = n <= 2 ? "duo" : n <= 4 ? "quad" : "many";
  const secs = secondsLeft(state.endsAt, now);
  const leaders = state.players.filter((p) => p.rank === 1);

  return (
    <div class={`bb-tv bb-tv--${state.phase} bb-tv--${layout}`} data-testid="bb-tv" data-phase={state.phase}>
      <header class="bb-tv__head">
        <h1 class="bb-tv__title">🧱 {de.title}</h1>
        {state.phase === "playing" && (
          <p class={`bb-tv__clock ${secs <= 10 ? "is-hurry" : ""}`} data-testid="bb-clock">
            {de.time(secs)}
          </p>
        )}
        {state.phase === "over" && (
          <p class="bb-tv__banner" data-testid="bb-banner" style={{ "--c": playerColor(leaders[0]?.color ?? 0) }}>
            {leaders.length === 1 ? de.tv.winner(nameOf(leaders[0]!.id)) : de.tv.tie}
          </p>
        )}
      </header>
      <main class="bb-tv__boards">
        {state.players.map((p) => (
          <Panel key={p.id} p={p} nameOf={nameOf} over={state.phase === "over"} />
        ))}
      </main>
      {state.phase === "countdown" && (
        <div class="bb-tv__countdown" role="status">
          <span key={secs} class="bb-tv__count">
            {Math.max(1, secs)}
          </span>
          <p>{de.countdown}</p>
          <p class="bb-tv__rules">{de.tv.rules}</p>
          {state.attacks && <p class="bb-tv__rules">{de.tv.rulesAttack}</p>}
        </div>
      )}
    </div>
  );
}

function Panel({ p, nameOf, over }: { p: BoardInfo; nameOf: (id: string) => string; over: boolean }) {
  const last = p.last;
  const cls = ["bb-panel", !p.alive ? "is-out" : "", over && p.rank === 1 ? "is-winner" : ""].join(" ");
  return (
    <section class={cls} style={{ "--c": playerColor(p.color) }} data-testid={`bb-panel-${p.id}`}>
      <div class="bb-panel__head">
        <span class="bb-panel__avatar" aria-hidden="true">
          {avatarEmoji(p.avatar as never)}
        </span>
        <span class="bb-panel__name">{nameOf(p.id) || p.name}</span>
        <span class="bb-panel__rank">#{p.rank}</span>
      </div>
      <p class="bb-panel__score" data-testid={`bb-score-${p.id}`}>
        {de.fmt(p.score)}
        {last && last.points > 0 && (
          <span key={last.seq} class="bb-panel__gain">
            {de.tv.gain(last.points)}
          </span>
        )}
      </p>
      <div class="bb-panel__board">
        <BoardView
          board={p.board}
          flash={last?.cleared ?? []}
          stones={p.incoming?.cells ?? []}
          flashKey={`${last?.seq ?? 0}-${p.incoming?.seq ?? 0}`}
        />
        {!p.alive && <div class="bb-panel__veil">{p.left ? de.left : de.out}</div>}
        {last && last.streak >= 2 && p.alive && (
          <span key={`c${last.seq}`} class="bb-panel__combo">
            {de.combo(last.streak)}
          </span>
        )}
      </div>
      <p class="bb-panel__foot">
        {last?.attack ? (
          <span key={`a${last.seq}`} class="bb-panel__attack">
            {de.tv.attack(last.attack.stones, nameOf(last.attack.to))}
          </span>
        ) : (
          de.lines(p.lines)
        )}
      </p>
    </section>
  );
}

export default preactTvView<BlockblastTvState>(BlockblastTv);
