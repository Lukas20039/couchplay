// Controller-View Schiffe versenken (Hochformat).
// Aufstellung: Schiff antippen, dann ein Feld für den Bug; Drehen/Zufällig/Bereit.
// Kampf: großes gegnerisches Gewässer zum Feuern, darunter die eigene Flotte.
// Zeigt nur den empfangenen Zustand; Regeln prüft der Server (lokal nur Vorprüfung für Hinweise).
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { useEffect, useState } from "preact/hooks";
import { de, seatName } from "../i18n/de.js";
import { UNKNOWN, fleetProblem, shipCells, type SchiffeInput, type SchiffePlayerView, type Ship } from "../shared.js";
import { BOARD_CSS, Board, FleetList, ensureStyles, playerColor, seatColor, seatEmoji } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<SchiffePlayerView, SchiffeInput>;

const VIBRATION = { win: [70, 60, 70, 60, 160], lose: [350] } as const;

function SchiffeController({ view, api, players, error }: Props) {
  ensureStyles("sv-board-css", BOARD_CSS);
  ensureStyles("sv-ctl-css", CONTROLLER_CSS);

  const result = view?.result ?? null;
  useEffect(() => {
    if (result) api.vibrate([...VIBRATION[result]]);
  }, [result]);

  if (!view) {
    return (
      <div class="sv-ctl">
        <p class="sv-ctl__status">{de.controller.loading}</p>
      </div>
    );
  }
  const oppName = view.opponent.kind === "bot" ? de.botName : (players.find((p) => p.id === (view.opponent as { playerId: string }).playerId)?.name ?? seatName(view.opponent));
  const style = { "--sv-me": playerColor(view.myColor), "--sv-opp": seatColor(view.opponent) };
  return (
    <div class={`sv-ctl sv-ctl--${view.phase} ${view.myTurn ? "is-myturn" : ""} ${result ? `is-${result}` : ""}`} style={style} data-testid="sv-controller" data-phase={view.phase}>
      {view.phase === "setup" ? (
        <Setup view={view} api={api} oppName={oppName} />
      ) : (
        <Battle view={view} api={api} oppName={oppName} players={players} rejected={error !== null} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Aufstellung

function Setup({ view, api, oppName }: { view: SchiffePlayerView; api: Props["api"]; oppName: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<Ship[] | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // Neue Ansicht vom Server ersetzt den vorläufigen Entwurf.
  useEffect(() => setDraft(null), [view]);

  const fleet = draft ?? view.fleet;
  const lengths = view.fleet.map((s) => s.len);
  const shipAt = (cell: number): Ship | undefined => fleet.find((s) => shipCells(s).includes(cell));

  const tryMove = (next: Ship): void => {
    const candidate = fleet.map((s) => (s.id === next.id ? next : s));
    if (fleetProblem(candidate, lengths, view.rules.touching) !== null) {
      setHint(de.controller.blocked);
      return;
    }
    setHint(null);
    setDraft(candidate);
    api.sendInput({ type: "move", ship: next.id, x: next.x, y: next.y, dir: next.dir });
  };

  const tap = (cell: number): void => {
    const hitShip = shipAt(cell);
    if (hitShip && hitShip.id !== selected) {
      setSelected(hitShip.id);
      setHint(null);
      return;
    }
    if (selected === null) {
      setHint(de.controller.pickFirst);
      return;
    }
    const ship = fleet[selected]!;
    if (hitShip?.id === selected && cell === shipCells(ship)[0]) return;
    tryMove({ ...ship, x: cell % 10, y: Math.floor(cell / 10) });
  };

  const rotate = (): void => {
    if (selected === null) return;
    const ship = fleet[selected]!;
    tryMove({ ...ship, dir: ship.dir === "h" ? "v" : "h" });
  };

  if (view.ready) {
    return (
      <>
        <h2 class="sv-ctl__title">{de.controller.ownTitle}</h2>
        <Board waters={view.own.cells} ships={fleet} class="sv-ctl__board" />
        <p class="sv-ctl__status" role="status" data-testid="sv-status">
          {de.controller.waitOpponent(oppName)}
        </p>
        <button type="button" class="sv-btn" data-testid="sv-unready" onClick={() => api.sendInput({ type: "unready" })}>
          {de.controller.change}
        </button>
      </>
    );
  }

  const info =
    hint ?? (selected !== null ? de.controller.selected(de.shipName(fleet[selected]!.len)) : view.opponentReady ? de.controller.opponentReady(oppName) : de.controller.setupHint);
  return (
    <>
      <h2 class="sv-ctl__title">{de.controller.setupTitle}</h2>
      {!view.rules.touching && <p class="sv-ctl__hint">{de.controller.setupNoTouch}</p>}
      <Board waters={view.own.cells} ships={fleet} selected={selected} onCell={tap} testId="sv-place" class="sv-ctl__board" />
      <p class={`sv-ctl__status ${hint ? "is-warn" : ""}`} role="status" data-testid="sv-status">
        {info}
      </p>
      <div class="sv-ctl__actions">
        <button type="button" class="sv-btn" disabled={selected === null} data-testid="sv-rotate" onClick={rotate}>
          ⟳ {de.controller.rotate}
        </button>
        <button
          type="button"
          class="sv-btn"
          data-testid="sv-shuffle"
          onClick={() => {
            setSelected(null);
            setHint(null);
            api.sendInput({ type: "shuffle" });
          }}
        >
          🎲 {de.controller.shuffle}
        </button>
        <button type="button" class="sv-btn sv-btn--primary" data-testid="sv-ready" onClick={() => api.sendInput({ type: "ready" })}>
          {de.controller.ready}
        </button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Kampf

function Battle(props: { view: SchiffePlayerView; api: Props["api"]; oppName: string; players: readonly Player[]; rejected: boolean }) {
  const { view, api, oppName, players, rejected } = props;
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => setPending(null), [view, rejected]);

  const canFire = (cell: number): boolean => view.myTurn && pending === null && view.target.cells[cell] === UNKNOWN;
  const fire = (cell: number): void => {
    if (!canFire(cell)) return;
    setPending(cell);
    api.sendInput({ type: "fire", cell });
  };
  const sunkIds = new Set(view.target.sunk.map((s) => s.id));
  const mine = view.lastShot?.by === view.mySeat ? view.lastShot : null;
  const theirs = view.lastShot && view.lastShot.by !== view.mySeat ? view.lastShot : null;

  return (
    <>
      <header class="sv-ctl__head">
        <span class="sv-ctl__side sv-ctl__side--me">
          {de.controller.you} <b>{view.score.me}</b>
        </span>
        <span class="sv-ctl__side sv-ctl__side--opp">
          <b>{view.score.opponent}</b> <span aria-hidden="true">{seatEmoji(view.opponent)}</span> {oppName}
        </span>
      </header>
      <BattleStatus view={view} oppName={oppName} players={players} rejected={rejected} />
      <Board
        waters={view.target.cells}
        ships={view.target.sunk}
        ghosts={(view.revealed ?? []).filter((s) => !sunkIds.has(s.id))}
        lastShot={mine}
        onCell={fire}
        enabled={canFire}
        testId="sv-cell"
        class={`sv-ctl__board sv-ctl__target ${pending !== null ? "is-pending" : ""}`}
      />
      <div class="sv-ctl__below">
        <div class="sv-ctl__own">
          <Board waters={view.own.cells} ships={view.fleet} lastShot={theirs} />
        </div>
        <div class="sv-ctl__fleets">
          <p class="sv-ctl__label">{de.controller.targetTitle}</p>
          <FleetList afloat={view.target.afloat} sunk={view.target.sunk.map((s) => s.len)} />
          <p class="sv-ctl__label">{de.controller.ownTitle}</p>
          <FleetList afloat={view.own.afloat} sunk={view.own.sunk.map((s) => s.len)} />
        </div>
      </div>
    </>
  );
}

function BattleStatus({ view, oppName, players, rejected }: { view: SchiffePlayerView; oppName: string; players: readonly Player[]; rejected: boolean }) {
  if (view.result) {
    const big = view.result === "win" ? (view.forfeit ? de.controller.winForfeit : de.controller.win) : de.controller.lose;
    return (
      <div class="sv-ctl__result" role="status" data-testid="sv-result">
        <strong>{big}</strong>
        <span>{de.controller.nextSoon}</span>
      </div>
    );
  }
  let text: string;
  if (view.phase === "paused") {
    const names = view.waitingFor.map((id) => players.find((p) => p.id === id)?.name ?? oppName);
    text = de.controller.waitingFor(names.join(", "));
  } else if (view.myTurn) {
    const again = view.lastShot?.by === view.mySeat && view.lastShot.result !== "miss";
    text = rejected ? de.controller.rejected : again ? de.controller.again : de.controller.yourTurn;
  } else if (view.opponent.kind === "bot" && view.botThinking) text = de.controller.botThinking;
  else text = de.controller.opponentTurn(oppName);
  return (
    <p class="sv-ctl__status" role="status" data-testid="sv-status">
      {text}
    </p>
  );
}

export default preactControllerView<SchiffePlayerView, SchiffeInput>(SchiffeController);
