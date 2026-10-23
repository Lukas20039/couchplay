// Controller-View Blockblast (Hochformat): eigenes Brett, darunter die Hand mit drei Teilen.
// Teil aufs Brett ziehen (schwebt über dem Finger, Vorschau rastet ein) oder antippen und dann ein Feld
// für die linke obere Ecke wählen. Zeigt bis zur Server-Antwort den Zug vorläufig an; Regeln prüft der Server.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { de } from "../i18n/de.js";
import { SHAPES, SIZE, fits, place, type BlockblastInput, type BlockblastPlayerView, type Shape } from "../shared.js";
import { BOARD_CSS, BoardView, PieceView, ensureStyles, playerColor, secondsLeft, shapeCellsAt, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<BlockblastPlayerView, BlockblastInput>;

/** So weit schwebt das gezogene Teil über dem Finger (px), damit man es sieht. */
const LIFT = 56;
/** Ab dieser Bewegung (px) wird aus Antippen ein Ziehen. */
const DRAG_START = 8;

interface Drag {
  slot: number;
  shape: Shape;
  /** Fingerposition (Viewport). */
  px: number;
  py: number;
  /** Zelle der linken oberen Ecke auf dem Brett, falls über dem Brett. */
  anchor: { x: number; y: number } | null;
}

function BlockblastController({ view, api, players }: Props) {
  ensureStyles("bb-board-css", BOARD_CSS);
  ensureStyles("bb-ctl-css", CONTROLLER_CSS);
  const now = useServerNow(api.serverNow, view !== null && view.phase !== "over");
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pending, setPending] = useState<{ board: string; slot: number } | null>(null);
  const [bad, setBad] = useState(0);
  /** Was zuletzt passiert ist (für die Statuszeile): eigener Zug oder eingehende Steine. */
  const [latest, setLatest] = useState<"move" | "incoming" | null>(null);
  const boardEl = useRef<HTMLDivElement | null>(null);
  const press = useRef<{ slot: number; x: number; y: number; dragging: boolean } | null>(null);

  // Neue Ansicht vom Server ersetzt den vorläufigen Zug.
  useEffect(() => setPending(null), [view]);

  const incomingSeq = view?.me.incoming?.seq ?? 0;
  useEffect(() => {
    if (incomingSeq === 0) return;
    setLatest("incoming");
    api.vibrate([120, 60, 120]);
  }, [incomingSeq]);
  const lines = view?.me.last?.lines ?? 0;
  const lastSeq = view?.me.last?.seq ?? 0;
  useEffect(() => {
    if (lastSeq === 0) return;
    setLatest("move");
    if (lines > 0) api.vibrate(lines >= 2 ? [40, 30, 40, 30, 80] : [40]);
  }, [lastSeq]);

  if (!view) {
    return (
      <div class="bb-ctl">
        <p class="bb-ctl__msg">{de.controller.loading}</p>
      </div>
    );
  }

  const me = view.me;
  const board = pending?.board ?? me.board;
  const hand = view.hand.map((id, i) => (pending?.slot === i ? null : id));
  const playing = view.phase === "playing" && me.alive;
  const secs = secondsLeft(view.endsAt, now);

  /** Zelle der linken oberen Ecke, wenn das Teil mittig über dem Finger schwebt. */
  const anchorAt = (shape: Shape, px: number, py: number): { x: number; y: number } | null => {
    const el = boardEl.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = r.width * 0.03;
    const cell = (r.width - 2 * pad) / SIZE;
    const left = px - (shape.w * cell) / 2;
    const top = py - LIFT - shape.h * cell;
    const x = Math.round((left - r.left - pad) / cell);
    const y = Math.round((top - r.top - pad) / cell);
    return x < 0 || y < 0 || x + shape.w > SIZE || y + shape.h > SIZE ? null : { x, y };
  };

  const commit = (slot: number, x: number, y: number): boolean => {
    const id = hand[slot];
    if (id === null || id === undefined || !playing) return false;
    const shape = SHAPES[id]!;
    if (!fits(board, shape, x, y)) {
      setBad((n) => n + 1);
      return false;
    }
    setPending({ board: place(board, shape, x, y).board, slot });
    setSelected(null);
    api.sendInput({ type: "place", slot, x, y });
    return true;
  };

  const onDown = (slot: number, e: PointerEvent): void => {
    if (!playing || hand[slot] === null) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    press.current = { slot, x: e.clientX, y: e.clientY, dragging: false };
  };
  const onMove = (e: PointerEvent): void => {
    const p = press.current;
    if (!p) return;
    const id = hand[p.slot];
    if (id === null || id === undefined) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START) return;
    p.dragging = true;
    const shape = SHAPES[id]!;
    setDrag({ slot: p.slot, shape, px: e.clientX, py: e.clientY, anchor: anchorAt(shape, e.clientX, e.clientY) });
  };
  const onUp = (): void => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (!p.dragging) {
      setSelected((s) => (s === p.slot ? null : p.slot)); // Antippen = auswählen
      return;
    }
    const d = drag;
    setDrag(null);
    if (d?.anchor) commit(d.slot, d.anchor.x, d.anchor.y);
  };

  const ghostShape = drag?.shape ?? null;
  const ghost =
    ghostShape && drag?.anchor
      ? { cells: shapeCellsAt(ghostShape, drag.anchor.x, drag.anchor.y) ?? [], ok: fits(board, ghostShape, drag.anchor.x, drag.anchor.y), color: ghostShape.color }
      : null;
  const boardCell = boardEl.current ? (boardEl.current.getBoundingClientRect().width * 0.94) / SIZE : 36;
  const leader = view.rivals[0];
  const attackTo = me.last?.attack ? (view.rivals.find((r) => r.id === me.last!.attack!.to)?.name ?? "") : null;
  const fromName = me.incoming ? (players.find((p) => p.id === me.incoming!.from)?.name ?? view.rivals.find((r) => r.id === me.incoming!.from)?.name ?? "") : "";

  return (
    <div class={`bb-ctl bb-ctl--${view.phase} ${me.alive ? "" : "is-out"}`} style={{ "--me": playerColor(me.color) }} data-testid="bb-controller" data-phase={view.phase}>
      <header class="bb-ctl__head">
        <div>
          <p class="bb-ctl__score" data-testid="bb-my-score">
            {de.fmt(me.score)}
          </p>
          <p class="bb-ctl__sub">
            {view.playerCount > 1 ? de.rank(me.rank, view.playerCount) : de.lines(me.lines)}
            {leader && view.playerCount > 1 && leader.score > me.score ? ` · ${leader.name} ${de.fmt(leader.score)}` : ""}
          </p>
        </div>
        <p class={`bb-ctl__clock ${secs <= 10 && view.phase === "playing" ? "is-hurry" : ""}`}>{view.phase === "countdown" ? "…" : de.time(secs)}</p>
      </header>

      <div class="bb-ctl__boardwrap">
        <BoardView
          board={board}
          ghost={ghost}
          flash={me.last?.cleared ?? []}
          stones={me.incoming?.cells ?? []}
          flashKey={`${me.last?.seq ?? 0}-${me.incoming?.seq ?? 0}`}
          onCell={(cell) => selected !== null && commit(selected, cell % SIZE, Math.floor(cell / SIZE))}
          testId="bb-cell"
          class={`bb-ctl__board ${bad > 0 ? `shake-${bad % 2}` : ""}`}
          boardRef={(el) => (boardEl.current = el)}
        />
        {view.phase === "countdown" && (
          <div class="bb-ctl__veil">
            <span>{Math.max(1, secs)}</span>
          </div>
        )}
        {!me.alive && view.phase !== "over" && (
          <div class="bb-ctl__veil bb-ctl__veil--out" data-testid="bb-out">
            <strong>{de.controller.outTitle}</strong>
            <span>{de.controller.outHint}</span>
          </div>
        )}
        {view.phase === "over" && (
          <div class="bb-ctl__veil bb-ctl__veil--over" data-testid="bb-result">
            <strong>{me.rank === 1 && view.playerCount > 1 ? de.controller.win : de.controller.over}</strong>
            <span>{view.playerCount > 1 ? de.controller.place(me.rank) : de.points(me.score)}</span>
          </div>
        )}
      </div>

      <p class="bb-ctl__msg" role="status" data-testid="bb-status">
        {latest === "incoming" && me.incoming
          ? de.controller.incoming(me.incoming.cells.length, fromName)
          : attackTo !== null && me.last?.attack
            ? de.controller.sent(me.last.attack.stones, attackTo)
            : me.last
              ? de.controller.gain(me.last.points, me.last.lines) + (me.last.streak >= 2 ? ` · ${de.combo(me.last.streak)}` : "")
              : de.controller.hint}
      </p>

      <div class="bb-ctl__hand">
        {hand.map((id, slot) => (
          <button
            key={`${slot}-${id ?? "x"}`}
            type="button"
            class={`bb-ctl__slot ${selected === slot ? "is-selected" : ""} ${drag?.slot === slot ? "is-dragging" : ""} ${
              id !== null && !canPlace(board, id) ? "is-blocked" : ""
            }`}
            disabled={id === null || !playing}
            aria-label={de.controller.piece(slot)}
            aria-pressed={selected === slot}
            data-testid={`bb-slot-${slot}`}
            data-shape={id ?? ""}
            onPointerDown={(e) => onDown(slot, e as unknown as PointerEvent)}
            onPointerMove={(e) => onMove(e as unknown as PointerEvent)}
            onPointerUp={onUp}
            onPointerCancel={() => {
              press.current = null;
              setDrag(null);
            }}
          >
            {id !== null && <PieceView shape={SHAPES[id]!} cell={pieceCell(SHAPES[id]!)} />}
          </button>
        ))}
      </div>

      {drag && (
        <div class="bb-ctl__float" style={{ left: `${drag.px - (drag.shape.w * boardCell) / 2}px`, top: `${drag.py - LIFT - drag.shape.h * boardCell}px` }}>
          <PieceView shape={drag.shape} cell={boardCell} />
        </div>
      )}
    </div>
  );
}

const canPlace = (board: string, id: number): boolean => {
  const s = SHAPES[id]!;
  for (let y = 0; y <= SIZE - s.h; y++) for (let x = 0; x <= SIZE - s.w; x++) if (fits(board, s, x, y)) return true;
  return false;
};

/** Zellgröße in der Hand: große Teile kleiner, damit alle drei nebeneinander passen. */
const pieceCell = (s: Shape): number => Math.min(22, Math.floor(84 / Math.max(s.w, s.h)));

export default preactControllerView<BlockblastPlayerView, BlockblastInput>(BlockblastController);
