// TV-View Vier gewinnt (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Großes Brett in der Mitte, links Platz 0, rechts Platz 1. Neue Steine fallen animiert in ihre
// Spalte, der Spieler am Zug lässt seinen Stein über der gewählten Spalte schweben.
// Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { de, seatName } from "../i18n/de.js";
import type { Seat, SeatIndex, VierGewinntTvState } from "../shared.js";
import { BOARD_CSS, Board, boardAspect, ensureStyles, seatColor, seatEmoji, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

/** Verfügbare Höhe und Breite fürs Brett (rem). */
const BOARD_MAX_H = 44;
const BOARD_MAX_W = 56;

function VierGewinntTv({ state, players, api }: TvComponentProps<VierGewinntTvState>) {
  ensureStyles("c4-board-css", BOARD_CSS);
  ensureStyles("c4-tv-css", TV_CSS);
  const ticking = state?.turnEndsAt != null && state.phase === "playing";
  const now = useServerNow(api.serverNow, ticking);
  if (!state) return <div class="c4-tv" />;

  const live = (seat: Seat): Player | undefined => (seat.kind === "human" ? players.find((p) => p.id === seat.playerId) : undefined);
  const name = (i: SeatIndex): string => live(state.seats[i])?.name ?? seatName(state.seats[i]);
  const colors: [string, string] = [seatColor(state.seats[0]), seatColor(state.seats[1])];
  const aim = state.phase === "playing" ? state.aims[state.turn] : null;
  const aspect = boardAspect(state.dims, true);
  const width = Math.min(BOARD_MAX_W, BOARD_MAX_H * aspect);
  const left = state.turnEndsAt !== null && ticking ? secondsLeft(state.turnEndsAt, now) : null;

  return (
    <div class={`c4-tv c4-tv--${state.phase}`} data-testid="c4-tv" data-phase={state.phase}>
      <SeatCard state={state} seat={0} name={name(0)} offline={isOffline(state, 0, live(state.seats[0]))} side="left" secondsLeft={left} />
      <main class="c4-tv__center" style={{ width: `${width}rem` }}>
        <p class="c4-tv__round" data-testid="c4-round">
          {de.tv.round(state.match.round)}
          {state.match.bestOf > 1 && <span class="c4-tv__sep">{de.tv.bestOf(state.match.bestOf)}</span>}
          {state.match.draws > 0 && <span class="c4-tv__sep">{de.tv.draws(state.match.draws)}</span>}
        </p>
        <Board
          dims={state.dims}
          grid={state.grid}
          colors={colors}
          lastMove={state.lastMove}
          winLines={state.winLines}
          hover={aim !== null ? { col: aim, color: colors[state.turn] } : null}
          hoverRow
          class="c4-tv__board"
          style={{ width: `${width}rem`, height: `${width / aspect}rem` }}
        />
        <TimerBar state={state} now={now} />
        <Status state={state} name={name} />
      </main>
      <SeatCard state={state} seat={1} name={name(1)} offline={isOffline(state, 1, live(state.seats[1]))} side="right" secondsLeft={left} />
    </div>
  );
}

const isOffline = (state: VierGewinntTvState, i: SeatIndex, player: Player | undefined): boolean => {
  const seat = state.seats[i];
  return seat.kind === "human" && (state.waitingFor.includes(seat.playerId) || player?.connected === false);
};

function SeatCard(props: { state: VierGewinntTvState; seat: SeatIndex; name: string; offline: boolean; side: "left" | "right"; secondsLeft: number | null }) {
  const { state, seat, name, offline, side } = props;
  const s = state.seats[seat];
  const active = state.phase === "playing" && state.turn === seat;
  const roundWon = state.roundOutcome?.winner === seat;
  const matchWon = state.outcome?.winner === seat;
  const lost = state.phase === "over" && state.outcome?.winner !== null && !matchWon;
  const wins = state.match.wins[seat];
  const cls = ["c4-card", `c4-card--${side}`, active ? "is-active" : "", roundWon || matchWon ? "is-winner" : "", lost ? "is-loser" : "", offline ? "is-offline" : ""].join(" ");
  return (
    <section class={cls} style={{ "--c": seatColor(s) }} data-testid={`c4-seat-${seat}`}>
      <div class="c4-card__avatar" aria-hidden="true">
        {seatEmoji(s)}
      </div>
      <h2 class="c4-card__name">{name}</h2>
      <p class="c4-card__sub">{s.kind === "bot" ? de.botLevel(de.difficulty[s.difficulty]) : " "}</p>
      <div class="c4-card__disc" aria-hidden="true" />
      {state.match.bestOf > 1 ? (
        <p class="c4-card__pips" aria-label={`${wins} ${de.tv.wins(wins)}`}>
          {Array.from({ length: state.match.needed }, (_, i) => (
            <i key={i} class={i < wins ? "is-on" : ""} />
          ))}
        </p>
      ) : (
        <p class="c4-card__pips" />
      )}
      <p class="c4-card__turn">
        {active && s.kind === "bot" && state.botThinking ? <Dots /> : active && props.secondsLeft !== null ? de.tv.seconds(props.secondsLeft) : de.tv.yourTurn}
      </p>
    </section>
  );
}

function Dots() {
  return (
    <span class="c4-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/** Ablaufender Balken für die Zugzeit (nur mit Zeitlimit, nur bei Menschen). */
function TimerBar({ state, now }: { state: VierGewinntTvState; now: number }) {
  const on = state.phase === "playing" && state.turnEndsAt !== null && state.turnTime > 0;
  const frac = on ? Math.max(0, Math.min(1, (state.turnEndsAt! - now) / (state.turnTime * 1000))) : 0;
  return (
    <div class={`c4-timer ${on ? "is-on" : ""} ${on && frac < 0.34 ? "is-low" : ""}`} aria-hidden="true">
      <span style={{ transform: `scaleX(${frac})`, background: seatColor(state.seats[state.turn]) }} />
    </div>
  );
}

function Status({ state, name }: { state: VierGewinntTvState; name: (i: SeatIndex) => string }) {
  if (state.phase === "over" && state.outcome) {
    const o = state.outcome;
    if (o.winner === null) {
      return (
        <div class="c4-banner c4-banner--draw" role="status" data-testid="c4-banner">
          {de.tv.draw}
        </div>
      );
    }
    const [a, b] = state.match.wins;
    const text = o.forfeit
      ? de.tv.winnerForfeit(name(o.winner))
      : state.match.bestOf > 1
        ? de.tv.winnerMatch(name(o.winner), Math.max(a, b), Math.min(a, b))
        : de.tv.winner(name(o.winner));
    return (
      <div class="c4-banner" role="status" style={{ "--c": seatColor(state.seats[o.winner]) }} data-testid="c4-banner">
        {text}
      </div>
    );
  }
  if (state.phase === "roundOver" && state.roundOutcome) {
    const w = state.roundOutcome.winner;
    return (
      <div class="c4-status c4-status--round" role="status" data-testid="c4-status">
        <strong style={w !== null ? { color: seatColor(state.seats[w]) } : undefined}>{w === null ? de.tv.roundDraw : de.tv.roundWinner(name(w))}</strong>
        <span>{de.tv.nextRound}</span>
      </div>
    );
  }
  if (state.phase === "paused") {
    // Wer fehlt, meldet das Plattform-Banner von tv-web; hier nur ein Pausensymbol.
    return (
      <p class="c4-status c4-status--paused" aria-label={de.tv.paused}>
        <span class="c4-pause" aria-hidden="true">
          <i />
          <i />
        </span>
      </p>
    );
  }
  const seat = state.seats[state.turn];
  const last = state.lastMove;
  const turnText = seat.kind === "bot" && state.botThinking ? de.tv.botThinking : last ? de.tv.turnOf(name(state.turn)) : de.tv.starts(name(state.turn));
  return (
    <div class="c4-status" role="status" style={{ "--c": seatColor(seat) }} data-testid="c4-status">
      {last?.auto && <strong class="c4-status__note">{de.tv.timeout(name(last.by), de.column(last.col))}</strong>}
      <span class="c4-status__turn">
        <span class="c4-status__dot" aria-hidden="true" />
        {turnText}
      </span>
    </div>
  );
}

export default preactTvView<VierGewinntTvState>(VierGewinntTv);
