// Controller-View Vier gewinnt (Hochformat).
// Brett oben (zum Mitverfolgen und Antippen), darunter eine große Spaltenleiste und „Einwerfen“.
// Erstes Antippen einer Spalte = Vorschau (TV zeigt den schwebenden Stein), zweites Antippen
// oder „Einwerfen“ = Zug. Zeigt nur den empfangenen Zustand; Regeln prüft der Server.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { useEffect, useState } from "preact/hooks";
import { de, seatName } from "../i18n/de.js";
import { cellOf, landingRow, type VierGewinntInput, type VierGewinntPlayerView } from "../shared.js";
import { BOARD_CSS, Board, boardAspect, boardInsetPct, ensureStyles, playerColor, seatColor, seatEmoji, secondsLeft, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<VierGewinntPlayerView, VierGewinntInput>;

const VIBRATION = { win: [70, 60, 70, 60, 160], lose: [350], draw: [120] } as const;

function VierGewinntController({ view, api, players, error }: Props) {
  ensureStyles("c4-board-css", BOARD_CSS);
  ensureStyles("c4-ctl-css", CONTROLLER_CSS);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const myTurn = view?.myTurn ?? false;
  const now = useServerNow(api.serverNow, myTurn && view?.turnEndsAt != null);

  // Neue Ansicht vom Server: Zug bestätigt bzw. abgelehnt. Auswahl nur behalten, solange sie gültig ist.
  useEffect(() => {
    setPending(false);
    if (!view?.myTurn) setSelected(null);
    else setSelected((s) => (s !== null && landingRow(view.grid, view.dims, s) >= 0 ? s : view.aim));
  }, [view, error]);

  // Haptik: kurz, wenn man dran ist; Muster beim Match-Ende. Nur über api.vibrate (Replays stumm).
  useEffect(() => {
    if (myTurn) api.vibrate(40);
  }, [myTurn]);
  const result = view?.result ?? null;
  useEffect(() => {
    if (result) api.vibrate([...VIBRATION[result]]);
  }, [result]);

  if (!view) {
    return (
      <div class="c4-ctl">
        <p class="c4-ctl__status">{de.controller.loading}</p>
      </div>
    );
  }

  const opp = view.opponent;
  const oppName = opp.kind === "bot" ? de.botName : (players.find((p) => p.id === opp.playerId)?.name ?? seatName(opp));
  const me = playerColor(view.myColor);
  const them = seatColor(opp);
  const colors: [string, string] = view.mySeat === 0 ? [me, them] : [them, me];
  const canPlay = view.myTurn && !pending;
  const free = (col: number): number => landingRow(view.grid, view.dims, col) + 1;

  const drop = (col: number): void => {
    if (!canPlay || free(col) === 0) return;
    setPending(true);
    api.sendInput({ type: "drop", col });
  };
  const tap = (col: number): void => {
    if (!canPlay || free(col) === 0) return;
    if (selected === col) return drop(col);
    setSelected(col);
    api.sendInput({ type: "aim", col });
  };

  const ghostRow = selected !== null && canPlay ? landingRow(view.grid, view.dims, selected) : -1;
  const cols = Array.from({ length: view.dims.cols }, (_, c) => c);
  const inset = boardInsetPct(view.dims);

  return (
    <div
      class={`c4-ctl c4-ctl--${view.phase} ${view.myTurn ? "is-myturn" : ""} ${result ? `is-${result}` : ""}`}
      style={{ "--me": me, "--opp": them, "--aspect": String(boardAspect(view.dims, false)) }}
      data-testid="c4-controller"
      data-phase={view.phase}
    >
      <header class="c4-ctl__head">
        <span class="c4-ctl__side c4-ctl__side--me">
          <i class="c4-ctl__disc" aria-hidden="true" />
          {de.controller.you} <b>{view.match.me}</b>
        </span>
        <span class="c4-ctl__round">{de.controller.round(view.match.round, view.match.bestOf)}</span>
        <span class="c4-ctl__side c4-ctl__side--opp">
          <b>{view.match.opponent}</b> <span aria-hidden="true">{seatEmoji(opp)}</span> {oppName}
        </span>
      </header>

      <Status view={view} oppName={oppName} players={players} rejected={error !== null} selected={selected} now={now} />

      <div class="c4-ctl__boardwrap">
        <Board
          dims={view.dims}
          grid={view.grid}
          colors={colors}
          lastMove={view.lastMove}
          winLines={view.winLines}
          ghost={ghostRow >= 0 ? { cell: cellOf(view.dims, selected!, ghostRow), color: me } : null}
          highlightCol={canPlay ? selected : null}
          class="c4-ctl__board"
          style={{ paddingTop: `${100 / boardAspect(view.dims, false)}%` }}
        />
        {/* Ganze Spalten des Bretts sind ebenfalls antippbar (die Leiste darunter ist die zugängliche Variante). */}
        <div class="c4-ctl__hit" aria-hidden="true" style={{ left: `${inset}%`, right: `${inset}%` }}>
          {cols.map((c) => (
            <span key={c} onClick={() => tap(c)} />
          ))}
        </div>
      </div>

      <div class="c4-ctl__bar" role="group">
        {cols.map((c) => {
          const n = free(c);
          return (
            <button
              key={c}
              type="button"
              class={`c4-col ${selected === c && canPlay ? "is-selected" : ""}`}
              disabled={!canPlay || n === 0}
              aria-pressed={selected === c}
              aria-label={de.controller.columnLabel(de.column(c), n)}
              data-testid={`c4-col-${c}`}
              onClick={() => tap(c)}
            >
              <span aria-hidden="true">▼</span>
              <small>{de.column(c)}</small>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        class="c4-btn c4-btn--primary"
        disabled={!canPlay || selected === null}
        data-testid="c4-drop"
        onClick={() => selected !== null && drop(selected)}
      >
        {selected !== null && canPlay ? de.controller.dropCol(de.column(selected)) : de.controller.drop}
      </button>
    </div>
  );
}

function Status(props: { view: VierGewinntPlayerView; oppName: string; players: readonly Player[]; rejected: boolean; selected: number | null; now: number }) {
  const { view, oppName, players, rejected, selected, now } = props;
  if (view.result) {
    const big = view.result === "win" ? (view.forfeit ? de.controller.winForfeit : de.controller.win) : view.result === "lose" ? de.controller.lose : de.controller.draw;
    return (
      <div class="c4-ctl__result" role="status" data-testid="c4-result">
        <strong>{big}</strong>
        <span>
          {view.match.bestOf > 1 ? `${view.match.me} : ${view.match.opponent} · ` : ""}
          {de.controller.nextSoon}
        </span>
      </div>
    );
  }
  if (view.phase === "roundOver") {
    const text = view.roundResult === "win" ? de.controller.roundWin : view.roundResult === "lose" ? de.controller.roundLose : de.controller.roundDraw;
    return (
      <div class="c4-ctl__result c4-ctl__result--round" role="status" data-testid="c4-result">
        <strong>{text}</strong>
        <span>{de.controller.nextSoon}</span>
      </div>
    );
  }
  let text: string;
  let timer: number | null = null;
  if (view.phase === "paused") {
    const names = view.waitingFor.map((id) => players.find((p) => p.id === id)?.name ?? oppName);
    text = de.controller.waitingFor(names.join(", "));
  } else if (view.myTurn) {
    text = rejected ? de.controller.rejected : selected !== null ? de.controller.aimed(de.column(selected)) : de.controller.yourTurn;
    if (view.turnEndsAt !== null) timer = secondsLeft(view.turnEndsAt, now);
  } else if (view.lastMove?.auto && view.lastMove.by === view.mySeat) text = de.controller.timeout;
  else if (view.opponent.kind === "bot" && view.botThinking) text = de.controller.botThinking;
  else text = de.controller.opponentTurn(oppName);
  return (
    <p class={`c4-ctl__status ${timer !== null && timer <= 5 ? "is-low" : ""}`} role="status" data-testid="c4-status">
      <span>{text}</span>
      {timer !== null && <b class="c4-ctl__timer">{de.controller.secondsLeft(timer)}</b>}
    </p>
  );
}

export default preactControllerView<VierGewinntPlayerView, VierGewinntInput>(VierGewinntController);
