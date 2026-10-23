// TV-View Schiffe versenken (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Zwei Gewässer nebeneinander; Schiffe sieht der TV erst, wenn sie versenkt sind oder das Spiel
// entschieden ist. Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { de, seatName } from "../i18n/de.js";
import { otherSeat, type SchiffeTvState, type Seat, type SeatIndex } from "../shared.js";
import { BOARD_CSS, Board, FleetList, ensureStyles, seatColor, seatEmoji } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

function SchiffeTv({ state, players }: TvComponentProps<SchiffeTvState>) {
  ensureStyles("sv-board-css", BOARD_CSS);
  ensureStyles("sv-tv-css", TV_CSS);
  if (!state) return <div class="sv-tv" />;

  const live = (seat: Seat): Player | undefined => (seat.kind === "human" ? players.find((p) => p.id === seat.playerId) : undefined);
  const name = (i: SeatIndex): string => live(state.seats[i])?.name ?? seatName(state.seats[i]);
  const round = state.series.games + (state.phase === "over" ? 0 : 1);

  return (
    <div class={`sv-tv sv-tv--${state.phase}`} data-testid="sv-tv" data-phase={state.phase}>
      <header class="sv-tv__head">
        <p class="sv-tv__round">{de.tv.round(round)}</p>
        <Status state={state} name={name} />
      </header>
      <main class="sv-tv__sides">
        <Side state={state} seat={0} name={name(0)} offline={isOffline(state, 0, live(state.seats[0]))} />
        <Side state={state} seat={1} name={name(1)} offline={isOffline(state, 1, live(state.seats[1]))} />
      </main>
    </div>
  );
}

const isOffline = (state: SchiffeTvState, i: SeatIndex, player: Player | undefined): boolean => {
  const seat = state.seats[i];
  return seat.kind === "human" && (state.waitingFor.includes(seat.playerId) || player?.connected === false);
};

function Side({ state, seat, name, offline }: { state: SchiffeTvState; seat: SeatIndex; name: string; offline: boolean }) {
  const s = state.seats[seat];
  const w = state.waters[seat];
  const id = s.kind === "human" ? s.playerId : "bot";
  const wins = state.series.wins[id] ?? 0;
  const shooter = otherSeat(seat);
  // Ziel ist das Gewässer des Gegners von dem, der am Zug ist.
  const isTarget = (state.phase === "battle" || state.phase === "paused") && state.turn === shooter;
  const won = state.outcome?.winner === seat;
  const revealed = state.revealed?.[seat] ?? [];
  const sunkIds = new Set(w.sunk.map((x) => x.id));
  const lastShot = state.lastShot?.by === shooter ? state.lastShot : null;
  const cls = ["sv-side", isTarget ? "is-target" : "", won ? "is-winner" : "", offline ? "is-offline" : ""].join(" ");
  return (
    <section class={cls} style={{ "--c": seatColor(s), "--shooter": seatColor(state.seats[shooter]) }} data-testid={`sv-side-${seat}`}>
      <div class="sv-side__card">
        <span class="sv-side__avatar" aria-hidden="true">
          {seatEmoji(s)}
        </span>
        <div class="sv-side__who">
          <h2 class="sv-side__name">{name}</h2>
          <p class="sv-side__sub">
            {s.kind === "bot" ? `${de.difficulty[s.difficulty]} · ` : ""}
            {de.tv.wins(wins)}
          </p>
        </div>
        <p class="sv-side__info">
          {state.phase === "setup" ? (
            <span class={`sv-side__ready ${state.ready[seat] ? "is-ready" : ""}`}>{state.ready[seat] ? `✓ ${de.tv.ready}` : de.tv.placing}</span>
          ) : (
            de.tv.accuracy(state.stats[seat].shots, state.stats[seat].hits)
          )}
        </p>
      </div>
      <div class="sv-side__board" data-testid={`sv-board-${seat}`}>
        <Board
          waters={w.cells}
          ships={w.sunk}
          ghosts={revealed.filter((x) => !sunkIds.has(x.id))}
          lastShot={lastShot}
          coords
        />
        {state.phase === "setup" && (
          <div class={`sv-side__veil ${state.ready[seat] ? "is-ready" : ""}`}>
            <span>{state.ready[seat] ? "✓" : "⚓"}</span>
          </div>
        )}
      </div>
      <div class="sv-side__fleet">
        <span class="sv-side__label">{de.tv.afloat}</span>
        <FleetList afloat={w.afloat} sunk={w.sunk.map((x) => x.len)} />
      </div>
    </section>
  );
}

function Status({ state, name }: { state: SchiffeTvState; name: (i: SeatIndex) => string }) {
  if (state.phase === "setup") {
    return (
      <div class="sv-status sv-status--setup" role="status">
        <strong>{de.tv.setupTitle}</strong>
        <span>{de.tv.setupHint}</span>
      </div>
    );
  }
  if (state.phase === "over" && state.outcome) {
    const w = state.outcome.winner;
    return (
      <div class="sv-banner" role="status" style={{ "--c": seatColor(state.seats[w]) }} data-testid="sv-banner">
        {state.outcome.forfeit ? de.tv.winnerForfeit(name(w)) : de.tv.winner(name(w))}
      </div>
    );
  }
  if (state.phase === "paused") {
    // Wer fehlt, meldet das Plattform-Banner von tv-web; hier nur ein Pausensymbol.
    return (
      <p class="sv-status sv-status--paused" aria-label={de.tv.paused}>
        <span class="sv-pause" aria-hidden="true">
          <i />
          <i />
        </span>
      </p>
    );
  }
  const shot = state.lastShot;
  const turnSeat = state.seats[state.turn];
  const shotText = shot
    ? shot.result === "sunk"
      ? de.tv.sunk(name(shot.by), de.shipAcc(shot.sunkLen ?? 0))
      : shot.result === "hit"
        ? de.tv.hit(name(shot.by), de.coord(shot.cell))
        : de.tv.miss(name(shot.by), de.coord(shot.cell))
    : null;
  const turnText = turnSeat.kind === "bot" && state.botThinking ? de.tv.botThinking : shot ? de.tv.turnOf(name(state.turn)) : de.tv.starts(name(state.turn));
  return (
    <div class="sv-status" role="status" style={{ "--c": seatColor(turnSeat) }} data-testid="sv-status">
      {shotText && (
        <strong key={`${shot!.by}-${shot!.cell}`} class={`sv-status__shot sv-status__shot--${shot!.result}`}>
          {shotText}
        </strong>
      )}
      <span class="sv-status__turn">
        <span class="sv-status__dot" aria-hidden="true" />
        {turnText}
      </span>
    </div>
  );
}

export default preactTvView<SchiffeTvState>(SchiffeTv);
