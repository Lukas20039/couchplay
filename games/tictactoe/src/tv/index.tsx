// TV-View TicTacToe (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Großes Brett in der Mitte, links Platz X, rechts Platz O. Nur Darstellung des
// empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { de, seatName } from "../i18n/de.js";
import type { Seat, TicTacToeTvState } from "../shared.js";
import { GLYPH_CSS, Glyph, GlyphPaths, ensureStyles, seatColor, seatEmoji, winLineCoords } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

function TicTacToeTv({ state, players }: TvComponentProps<TicTacToeTvState>) {
  ensureStyles("ttt-glyph-css", GLYPH_CSS);
  ensureStyles("ttt-tv-css", TV_CSS);
  if (!state) return <div class="ttt-tv" />;

  const live = (seat: Seat): Player | undefined =>
    seat.kind === "human" ? players.find((p) => p.id === seat.playerId) : undefined;
  const name = (seat: Seat): string => live(seat)?.name ?? seatName(seat);

  const [sx, so] = state.seats;
  const turnSeat = state.turn === "X" ? sx : so;
  const round = state.series.games + (state.phase === "over" ? 0 : 1);

  return (
    <div class={`ttt-tv ttt-tv--${state.phase}`} data-testid="ttt-tv">
      <SeatCard seat={sx} state={state} name={name(sx)} offline={isOffline(sx, state, live(sx))} side="left" />
      <main class="ttt-tv__center">
        <p class="ttt-tv__round">
          {de.tv.round(round)}
          {state.series.draws > 0 && <span class="ttt-tv__draws">{de.tv.draws(state.series.draws)}</span>}
        </p>
        <Board state={state} />
        <Status state={state} turnName={name(turnSeat)} names={name} />
      </main>
      <SeatCard seat={so} state={state} name={name(so)} offline={isOffline(so, state, live(so))} side="right" />
    </div>
  );
}

const isOffline = (seat: Seat, state: TicTacToeTvState, player: Player | undefined): boolean =>
  seat.kind === "human" && (state.waitingFor.includes(seat.playerId) || player?.connected === false);

function SeatCard(props: { seat: Seat; state: TicTacToeTvState; name: string; offline: boolean; side: "left" | "right" }) {
  const { seat, state, name, offline, side } = props;
  const color = seatColor(seat);
  const active = state.phase === "playing" && state.turn === seat.mark;
  const won = state.outcome?.kind === "win" && state.outcome.mark === seat.mark;
  const id = seat.kind === "human" ? seat.playerId : "bot";
  const wins = state.series.wins[id] ?? 0;
  const cls = [
    "ttt-card",
    `ttt-card--${side}`,
    active ? "is-active" : "",
    won ? "is-winner" : "",
    offline ? "is-offline" : "",
    state.phase === "over" && !won && state.outcome?.kind === "win" ? "is-loser" : "",
  ].join(" ");
  return (
    <section class={cls} style={{ "--c": color }} data-testid={`ttt-seat-${seat.mark}`}>
      <div class="ttt-card__avatar" aria-hidden="true">
        {seatEmoji(seat)}
      </div>
      <h2 class="ttt-card__name">{name}</h2>
      <p class="ttt-card__sub">
        {seat.kind === "bot" ? de.botLevel(de.difficulty[seat.difficulty]) : " "}
      </p>
      <Glyph mark={seat.mark} class="ttt-card__mark" />
      <p class="ttt-card__wins">
        <span class="ttt-card__num">{wins}</span>
        <span class="ttt-card__label">{de.tv.wins(wins)}</span>
      </p>
      <p class="ttt-card__turn">
        {active && seat.kind === "bot" && state.botThinking ? <Dots /> : de.tv.yourTurn}
      </p>
    </section>
  );
}

function Dots() {
  return (
    <span class="ttt-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function Board({ state }: { state: TicTacToeTvState }) {
  const colorOf = (mark: "X" | "O") => seatColor(mark === "X" ? state.seats[0] : state.seats[1]);
  const win = state.winLine ? winLineCoords(state.winLine) : null;
  const winColor = state.outcome?.kind === "win" ? colorOf(state.outcome.mark) : undefined;
  return (
    <div class="ttt-board" role="img" aria-label={de.tv.boardLabel}>
      <svg viewBox="-12 -12 324 324">
        <g class="ttt-grid">
          <path d="M100 6 V294" />
          <path d="M200 6 V294" />
          <path d="M6 100 H294" />
          <path d="M6 200 H294" />
        </g>
        {state.board.map((mark, i) => {
          if (!mark) return null;
          const fresh = state.lastMove?.cell === i;
          const inLine = state.winLine?.includes(i) ?? false;
          const cls = `ttt-cellmark ${fresh ? "ttt-glyph--draw" : ""} ${state.winLine && !inLine ? "is-dim" : ""}`;
          return (
            <g key={`${i}${mark}`} class={cls} style={{ color: colorOf(mark) }} transform={`translate(${(i % 3) * 100} ${Math.floor(i / 3) * 100})`}>
              <GlyphPaths mark={mark} />
            </g>
          );
        })}
        {win && (
          <g class="ttt-winline" style={{ color: winColor }}>
            <line class="ttt-winline__glow" x1={win.x1} y1={win.y1} x2={win.x2} y2={win.y2} style={{ strokeDasharray: win.length, strokeDashoffset: win.length }} />
            <line class="ttt-winline__core" x1={win.x1} y1={win.y1} x2={win.x2} y2={win.y2} style={{ strokeDasharray: win.length, strokeDashoffset: win.length }} />
          </g>
        )}
      </svg>
    </div>
  );
}

function Status({ state, turnName, names }: { state: TicTacToeTvState; turnName: string; names: (s: Seat) => string }) {
  if (state.phase === "over" && state.outcome) {
    const o = state.outcome;
    if (o.kind === "draw") {
      return (
        <div class="ttt-banner ttt-banner--draw" role="status" data-testid="ttt-banner">
          {de.tv.draw}
        </div>
      );
    }
    const seat = o.mark === "X" ? state.seats[0] : state.seats[1];
    return (
      <div class="ttt-banner" role="status" style={{ "--c": seatColor(seat) }} data-testid="ttt-banner">
        {o.forfeit ? de.tv.winnerForfeit(names(seat)) : de.tv.winner(names(seat))}
      </div>
    );
  }
  if (state.phase === "paused") {
    // Wer fehlt, meldet das Plattform-Banner von tv-web; hier nur ein Pausensymbol (kein Text doppelt).
    return (
      <p class="ttt-status ttt-status--paused" aria-label={de.tv.paused}>
        <span class="ttt-pause" aria-hidden="true">
          <i />
          <i />
        </span>
      </p>
    );
  }
  const seat = state.turn === "X" ? state.seats[0] : state.seats[1];
  const text =
    seat.kind === "bot" && state.botThinking
      ? de.tv.botThinking
      : state.lastMove === null
        ? de.tv.starts(turnName)
        : de.tv.turnOf(turnName);
  return (
    <p class="ttt-status" role="status" style={{ "--c": seatColor(seat) }}>
      <span class="ttt-status__dot" aria-hidden="true" />
      {text}
    </p>
  );
}

export default preactTvView<TicTacToeTvState>(TicTacToeTv);
