// Controller-View TicTacToe (Hochformat). Quadratisches 3×3-Brett, aktiv nur wenn
// man am Zug ist. Zeigt nur den empfangenen Zustand; Regeln prüft der Server.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { useEffect, useState } from "preact/hooks";
import { de, seatName } from "../i18n/de.js";
import type { Seat, TicTacToeInput, TicTacToePlayerView } from "../shared.js";
import { GLYPH_CSS, Glyph, GlyphPaths, ensureStyles, playerColor, seatColor, seatEmoji, winLineCoords } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<TicTacToePlayerView, TicTacToeInput>;

const VIBRATION = { win: [70, 60, 70, 60, 160], lose: [350], draw: [120] } as const;

function TicTacToeController({ view, api, players, error }: Props) {
  ensureStyles("ttt-glyph-css", GLYPH_CSS);
  ensureStyles("ttt-ctl-css", CONTROLLER_CSS);
  const [pending, setPending] = useState<number | null>(null);

  // Neue Ansicht vom Server ersetzt den vorläufig gesetzten Zug.
  useEffect(() => setPending(null), [view, error]);

  // Haptik beim Spielende. Nur über api.vibrate – die Plattform schaltet Replays (Rejoin) stumm.
  const result = view?.result ?? null;
  useEffect(() => {
    if (result) api.vibrate([...VIBRATION[result]]);
  }, [result]);

  if (!view) {
    return (
      <div class="ttt-ctl">
        <p class="ttt-ctl__status">{de.controller.loading}</p>
      </div>
    );
  }

  const opp = view.opponent;
  const oppName = opponentName(opp, players);
  const me = playerColor(view.myColor);
  const them = seatColor(opp);
  const colorOf = (mark: "X" | "O") => (mark === view.myMark ? me : them);
  const canPlay = view.myTurn && pending === null;
  const win = view.winLine ? winLineCoords(view.winLine, 26) : null;
  const lastOpp = view.opponentMoves.at(-1);

  const tap = (cell: number): void => {
    if (!canPlay || view.board[cell] !== null) return;
    setPending(cell);
    api.sendInput({ type: "place", cell });
  };

  return (
    <div
      class={`ttt-ctl ttt-ctl--${view.phase} ${view.myTurn ? "is-myturn" : ""} ${result ? `is-${result}` : ""}`}
      style={{ "--me": me, "--opp": them }}
      data-testid="ttt-controller"
    >
      <header class="ttt-ctl__head">
        <div class="ttt-ctl__me">
          <Glyph mark={view.myMark} class="ttt-ctl__mymark" />
          <span>{de.controller.youPlay}</span>
        </div>
        <dl class="ttt-ctl__score">
          <div class="ttt-ctl__side ttt-ctl__side--me">
            <dt>{de.controller.you}</dt>
            <dd>{view.score.me}</dd>
          </div>
          <div class="ttt-ctl__side ttt-ctl__side--opp">
            <dt>
              <span aria-hidden="true">{seatEmoji(opp)}</span> {oppName}
            </dt>
            <dd>{view.score.opponent}</dd>
          </div>
          {view.score.draws > 0 && (
            <div class="ttt-ctl__side ttt-ctl__side--draws">
              <dt>{de.controller.draws}</dt>
              <dd>{view.score.draws}</dd>
            </div>
          )}
        </dl>
      </header>

      <div class="ttt-ctl__board">
        <svg class="ttt-ctl__svg" viewBox="0 0 300 300" aria-hidden="true">
          {lastOpp !== undefined && !win && (
            <rect class="ttt-ctl__last" x={(lastOpp % 3) * 100 + 8} y={Math.floor(lastOpp / 3) * 100 + 8} width="84" height="84" rx="18" />
          )}
          <g class="ttt-ctl__grid">
            <path d="M100 4 V296" />
            <path d="M200 4 V296" />
            <path d="M4 100 H296" />
            <path d="M4 200 H296" />
          </g>
          {view.board.map((mark, i) => {
            const m = mark ?? (pending === i ? view.myMark : null);
            if (!m) return null;
            const cls = [
              "ttt-ctl__mark",
              i === lastOpp || pending === i ? "ttt-glyph--draw" : "",
              pending === i && !mark ? "is-pending" : "",
              view.winLine && !view.winLine.includes(i) ? "is-dim" : "",
            ].join(" ");
            return (
              <g key={`${i}${m}`} class={cls} style={{ color: colorOf(m) }} transform={`translate(${(i % 3) * 100} ${Math.floor(i / 3) * 100})`}>
                <GlyphPaths mark={m} />
              </g>
            );
          })}
          {win && (
            <line
              class="ttt-ctl__winline"
              x1={win.x1}
              y1={win.y1}
              x2={win.x2}
              y2={win.y2}
              style={{ color: colorOf(view.result === "win" ? view.myMark : opp.mark), strokeDasharray: win.length, strokeDashoffset: win.length }}
            />
          )}
        </svg>
        <div class="ttt-ctl__cells">
          {view.board.map((mark, i) => (
            <button
              key={i}
              type="button"
              class="ttt-ctl__cell"
              disabled={!canPlay || mark !== null}
              aria-label={de.controller.cellLabel(
                i + 1,
                (mark ?? de.controller.cellEmpty) + (i === lastOpp ? `, ${de.controller.lastMove}` : ""),
              )}
              data-testid={`ttt-cell-${i}`}
              onClick={() => tap(i)}
            />
          ))}
        </div>
      </div>

      <Status view={view} oppName={oppName} players={players} rejected={error !== null} />
    </div>
  );
}

function opponentName(opp: Seat, players: readonly Player[]): string {
  if (opp.kind === "bot") return de.botName;
  return players.find((p) => p.id === opp.playerId)?.name ?? seatName(opp);
}

function Status({ view, oppName, players, rejected }: { view: TicTacToePlayerView; oppName: string; players: readonly Player[]; rejected: boolean }) {
  if (view.result) {
    const big =
      view.result === "win" ? (view.forfeit ? de.controller.winForfeit : de.controller.win) : view.result === "lose" ? de.controller.lose : de.controller.draw;
    return (
      <div class="ttt-ctl__result" role="status" data-testid="ttt-result">
        <strong>{big}</strong>
        <span>{de.controller.nextSoon}</span>
      </div>
    );
  }
  let text: string;
  if (view.phase === "paused") {
    const names = view.waitingFor.map((id) => players.find((p) => p.id === id)?.name ?? oppName);
    text = de.controller.waitingFor(names.join(", "));
  } else if (view.myTurn) text = rejected ? de.controller.rejected : de.controller.yourTurn;
  else if (view.opponent.kind === "bot" && view.botThinking) text = de.controller.botThinking;
  else text = de.controller.opponentTurn(oppName);
  return (
    <p class="ttt-ctl__status" role="status" data-testid="ttt-status">
      {text}
    </p>
  );
}

export default preactControllerView<TicTacToePlayerView, TicTacToeInput>(TicTacToeController);
