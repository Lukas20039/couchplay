// Zeichenfläche des Zeichners: Pointer Events (Touch + Maus), lokal sofort zeichnen, Punkte geglättet
// (Mindestabstand) und gebündelt senden – höchstens alle DRAW_LIMITS.sendIntervalMs, je Nachricht
// höchstens DRAW_LIMITS.chunkPoints Punkte. Undo/Löschen wirken lokal sofort und gehen in derselben
// Warteschlange an den Server (Reihenfolge bleibt erhalten).
import type { ControllerViewApi } from "@couchplay/game-sdk/client";
import { useEffect, useRef, useState } from "preact/hooks";
import { CANVAS_UNITS, DRAW_LIMITS, ERASER, PALETTE, SIZES } from "../constants.js";
import { COLOR_NAMES, SIZE_NAMES, t } from "../i18n/de.js";
import type { Stroke, ZgInput, ZgPlayerView } from "../shared.js";
import { fitCanvas, SheetRenderer } from "../ui/canvas.js";

type DrawView = Extract<ZgPlayerView, { phase: "draw"; role: "draw" }>;
type Outgoing = Extract<ZgInput, { type: "stroke" | "undo" | "clear" }>;

/** Höchstens so viele Nachrichten je Sendetakt (8/s × 2 = 16/s < Bucket-Nachfüllung 20/s). */
const MAX_PER_TICK = 2;

export function DrawPad({ v, api, locked }: { v: DrawView; api: ControllerViewApi<ZgInput>; locked: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef(new SheetRenderer());
  // Zustand der Zeichnung lebt in Refs (kein Re-Render pro Punkt).
  const strokes = useRef<Stroke[]>(v.strokes.map((s) => ({ ...s, points: s.points.slice() })));
  const points = useRef(v.strokes.reduce((n, s) => n + s.points.length / 2, 0));
  // Neue IDs: nie unter dem, was der Server kennt; zeitbasiert, damit ein Reload mit leicht veraltetem
  // Stand keine schon benutzte ID erwischt.
  const nextId = useRef(Math.max(v.nextStrokeId, Math.floor(Date.now() / 100) % 900_000_000, ...v.strokes.map((s) => s.id + 1)));
  const rev = useRef(0);
  const active = useRef<{ pointerId: number; stroke: Stroke } | null>(null);
  const queue = useRef<Outgoing[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSend = useRef(0);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const [color, setColor] = useState(0);
  const [size, setSize] = useState(1);
  const [full, setFull] = useState(false);
  const [px, setPx] = useState(0);

  const redraw = (): void => renderer.current.render(canvas.current, strokes.current, rev.current);

  // Größe: quadratisch, so groß wie der freie Platz erlaubt.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = (): void => setPx(Math.max(0, Math.floor(Math.min(el.clientWidth, el.clientHeight))));
    measure();
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    const ro = RO ? new RO(measure) : null;
    ro?.observe(el);
    addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c || px <= 0) return;
    if (fitCanvas(c, px)) renderer.current.invalidate();
    redraw();
  }, [px]);

  // Beim Verlassen noch Ausstehendes senden.
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      for (const msg of queue.current) api.sendInput(msg);
      queue.current = [];
    },
    [],
  );

  const flush = (): void => {
    flushTimer.current = null;
    lastSend.current = Date.now();
    for (let i = 0; i < MAX_PER_TICK && queue.current.length > 0; i++) api.sendInput(queue.current.shift()!);
    if (queue.current.length > 0) scheduleFlush();
  };
  const scheduleFlush = (): void => {
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(flush, Math.max(0, lastSend.current + DRAW_LIMITS.sendIntervalMs - Date.now()));
  };

  /** Punkt in die Sendewarteschlange (an den letzten Chunk desselben Strichs anhängen, solange Platz ist). */
  const enqueuePoint = (s: Stroke, x: number, y: number): void => {
    const last = queue.current.at(-1);
    if (last?.type === "stroke" && last.id === s.id && last.points.length < DRAW_LIMITS.chunkPoints * 2) last.points.push(x, y);
    else queue.current.push({ type: "stroke", id: s.id, color: s.color, size: s.size, points: [x, y] });
    scheduleFlush();
  };

  const toUnits = (e: PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    const clamp = (n: number) => Math.min(CANVAS_UNITS, Math.max(0, Math.round(n)));
    return [clamp(((e.clientX - r.left) / (r.width || 1)) * CANVAS_UNITS), clamp(((e.clientY - r.top) / (r.height || 1)) * CANVAS_UNITS)];
  };

  /** Fügt einen Punkt hinzu (Glättung: nur ab Mindestabstand, außer `force`). */
  const addPoint = (s: Stroke, x: number, y: number, force: boolean): void => {
    const n = s.points.length;
    const dx = x - s.points[n - 2]!;
    const dy = y - s.points[n - 1]!;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0 || (!force && dist < DRAW_LIMITS.minDistance)) return;
    if (points.current >= DRAW_LIMITS.drawingPoints) {
      setFull(true);
      return;
    }
    s.points.push(x, y);
    points.current++;
    enqueuePoint(s, x, y);
  };

  const onDown = (e: PointerEvent): void => {
    if (lockedRef.current || active.current || !e.isPrimary) return;
    e.preventDefault();
    if (points.current >= DRAW_LIMITS.drawingPoints) {
      setFull(true);
      return;
    }
    canvas.current?.setPointerCapture?.(e.pointerId);
    const [x, y] = toUnits(e);
    const stroke: Stroke = { id: nextId.current++, color, size, points: [x, y] };
    strokes.current.push(stroke);
    points.current++;
    active.current = { pointerId: e.pointerId, stroke };
    enqueuePoint(stroke, x, y);
    redraw();
  };

  const onMove = (e: PointerEvent): void => {
    const a = active.current;
    if (!a || a.pointerId !== e.pointerId) return;
    e.preventDefault();
    if (lockedRef.current) return onUp(e);
    const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    for (const ev of events.length > 0 ? events : [e]) {
      const [x, y] = toUnits(ev);
      addPoint(a.stroke, x, y, false);
    }
    redraw();
  };

  const onUp = (e: PointerEvent): void => {
    const a = active.current;
    if (!a || a.pointerId !== e.pointerId) return;
    if (!lockedRef.current && e.type === "pointerup") {
      const [x, y] = toUnits(e);
      addPoint(a.stroke, x, y, true);
      redraw();
    }
    active.current = null;
  };

  const undo = (): void => {
    if (active.current || lockedRef.current) return;
    const s = strokes.current.pop();
    if (!s) return;
    points.current -= s.points.length / 2;
    setFull(false);
    rev.current++;
    queue.current.push({ type: "undo" });
    scheduleFlush();
    redraw();
  };

  const clear = (): void => {
    if (active.current || lockedRef.current || strokes.current.length === 0) return;
    strokes.current = [];
    points.current = 0;
    setFull(false);
    rev.current++;
    queue.current.push({ type: "clear" });
    scheduleFlush();
    redraw();
  };

  return (
    <>
      <div class="zg-pad-wrap" ref={wrap}>
        <canvas
          ref={canvas}
          class={`zg-pad ${locked ? "is-locked" : ""}`}
          style={{ width: `${px}px`, height: `${px}px` }}
          data-testid="zg-pad"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        {locked && <div class="zg-pad-lock">{t.controller.timeUp}</div>}
      </div>
      {full && !locked && (
        <p class="zg-full" role="status">
          {t.controller.full}
        </p>
      )}
      <div class="zg-tools" aria-disabled={locked}>
        <div class="zg-tools__row">
          {PALETTE.slice(0, ERASER).map((c, i) => (
            <button
              key={c}
              type="button"
              class={`zg-swatch ${color === i ? "is-on" : ""}`}
              style={{ "--sw": c }}
              aria-label={t.controller.colorLabel(COLOR_NAMES[i]!)}
              aria-pressed={color === i}
              data-testid={`zg-color-${i}`}
              onClick={() => setColor(i)}
            />
          ))}
          <button
            type="button"
            class={`zg-swatch zg-swatch--eraser ${color === ERASER ? "is-on" : ""}`}
            aria-label={t.controller.eraser}
            aria-pressed={color === ERASER}
            data-testid="zg-eraser"
            onClick={() => setColor(ERASER)}
          >
            🧽
          </button>
        </div>
        <div class="zg-tools__row">
          {SIZES.map((s, i) => (
            <button
              key={s}
              type="button"
              class={`zg-size ${size === i ? "is-on" : ""}`}
              aria-label={t.controller.sizeLabel(SIZE_NAMES[i]!)}
              aria-pressed={size === i}
              data-testid={`zg-size-${i}`}
              onClick={() => setSize(i)}
            >
              <span style={{ width: `${6 + i * 7}px`, height: `${6 + i * 7}px`, background: color === ERASER ? "#ffffff" : PALETTE[color] }} />
            </button>
          ))}
          <button type="button" class="zg-tool" aria-label={t.controller.undo} title={t.controller.undo} data-testid="zg-undo" onClick={undo} disabled={locked}>
            <span aria-hidden="true">↶</span>
            <small>{t.controller.undoShort}</small>
          </button>
          <button
            type="button"
            class="zg-tool zg-tool--danger"
            aria-label={t.controller.clear}
            title={t.controller.clear}
            data-testid="zg-clear"
            onClick={clear}
            disabled={locked}
          >
            <span aria-hidden="true">🗑</span>
            <small>{t.controller.clearShort}</small>
          </button>
        </div>
      </div>
    </>
  );
}
