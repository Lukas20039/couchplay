// Zeichenfläche des Zeichners: Pointer Events (Touch + Maus), lokal sofort zeichnen, Punkte geglättet
// (Mindestabstand) und gebündelt senden – höchstens alle DRAW_LIMITS.sendIntervalMs, je Nachricht
// höchstens DRAW_LIMITS.chunkPoints Punkte. Undo/Redo/Löschen wirken lokal sofort und gehen in derselben
// Warteschlange an den Server (Reihenfolge bleibt erhalten).
// Werkzeuge: Stift, Eimer (Füllung), Radierer (malt in der Blattfarbe), Linie/Rechteck/Kreis (werden beim
// Aufziehen nur lokal als Vorschau gezeichnet und beim Loslassen als ganzer Strich gesendet).
import type { ControllerViewApi } from "@couchplay/game-sdk/client";
import { useEffect, useRef, useState } from "preact/hooks";
import { CANVAS_UNITS, DEFAULT_SIZE, DRAW_LIMITS, PALETTE, QUICK_COLORS, SIZES } from "../constants.js";
import { COLOR_NAMES, SIZE_NAMES, t, TOOL_LABELS } from "../i18n/de.js";
import { strokeCost, type Stroke, type ZgInput, type ZgPlayerView } from "../shared.js";
import { fitCanvas, SheetRenderer } from "../ui/canvas.js";

type DrawView = Extract<ZgPlayerView, { phase: "draw"; role: "draw" }>;
type Outgoing = Extract<ZgInput, { type: "stroke" | "fill" | "undo" | "clear" }>;
type Tool = keyof typeof TOOL_LABELS;
type Shape = "line" | "rect" | "ellipse";

/** Höchstens so viele Nachrichten je Sendetakt (8/s × 2 = 16/s < Bucket-Nachfüllung 20/s). */
const MAX_PER_TICK = 2;
const TOOLS = Object.keys(TOOL_LABELS) as Tool[];
const isShape = (tool: Tool): tool is Shape => tool === "line" || tool === "rect" || tool === "ellipse";

/** Punkte einer Form von (x0, y0) bis (x1, y1); Rechteck und Kreis füllen das aufgezogene Rechteck aus. */
export function shapePoints(shape: Shape, x0: number, y0: number, x1: number, y1: number): number[] {
  if (shape === "line") return [x0, y0, x1, y1];
  if (shape === "rect") return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  const pts: number[] = [];
  for (let i = 0; i <= DRAW_LIMITS.ellipsePoints; i++) {
    const a = (i / DRAW_LIMITS.ellipsePoints) * Math.PI * 2;
    pts.push(Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a)));
  }
  return pts;
}

export function DrawPad({ v, api, locked }: { v: DrawView; api: ControllerViewApi<ZgInput>; locked: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef(new SheetRenderer());
  // Zustand der Zeichnung lebt in Refs (kein Re-Render pro Punkt).
  const strokes = useRef<Stroke[]>(v.strokes.map((s) => ({ ...s, points: s.points.slice() })));
  const points = useRef(v.strokes.reduce((n, s) => n + strokeCost(s), 0));
  /** Rückgängig gemachte Striche (für „Vor“); jede neue Aktion leert den Stapel. */
  const redoStack = useRef<Stroke[]>([]);
  // Neue IDs: nie unter dem, was der Server kennt; zeitbasiert, damit ein Reload mit leicht veraltetem
  // Stand keine schon benutzte ID erwischt.
  const nextId = useRef(Math.max(v.nextStrokeId, Math.floor(Date.now() / 100) % 900_000_000, ...v.strokes.map((s) => s.id + 1)));
  const rev = useRef(0);
  const active = useRef<{ pointerId: number; stroke: Stroke; shape?: Shape; x0: number; y0: number } | null>(null);
  const queue = useRef<Outgoing[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSend = useRef(0);
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(0);
  const [size, setSize] = useState<number>(DEFAULT_SIZE);
  const [menu, setMenu] = useState(false);
  const [full, setFull] = useState<"" | "points" | "fills">("");
  const [canRedo, setCanRedo] = useState(false);
  const [px, setPx] = useState(0);

  const redraw = (): void => {
    const a = active.current;
    renderer.current.render(canvas.current, strokes.current, rev.current, a?.shape ? a.stroke : undefined);
  };

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
    fitCanvas(c, px);
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
  const send = (msg: Outgoing): void => {
    queue.current.push(msg);
    scheduleFlush();
  };

  /** Punkt in die Sendewarteschlange (an den letzten Chunk desselben Strichs anhängen, solange Platz ist). */
  const enqueuePoint = (s: Stroke, x: number, y: number): void => {
    const last = queue.current.at(-1);
    if (last?.type === "stroke" && last.id === s.id && last.points.length < DRAW_LIMITS.chunkPoints * 2) last.points.push(x, y);
    else queue.current.push({ type: "stroke", id: s.id, color: s.color, size: s.size, points: [x, y] });
    scheduleFlush();
  };

  /** Fertigen Strich oder Füllung senden (Formen, „Vor“). */
  const sendWhole = (s: Stroke): void => {
    if (s.fill) return send({ type: "fill", id: s.id, color: s.color, x: s.points[0]!, y: s.points[1]! });
    for (let i = 0; i < s.points.length; i += DRAW_LIMITS.chunkPoints * 2) {
      send({ type: "stroke", id: s.id, color: s.color, size: s.size, points: s.points.slice(i, i + DRAW_LIMITS.chunkPoints * 2) });
    }
  };

  /** Prüft, ob `s` noch aufs Blatt passt (sonst Hinweis). */
  const fits = (s: Stroke): boolean => {
    if (s.fill && strokes.current.filter((x) => x.fill).length >= DRAW_LIMITS.fills) {
      setFull("fills");
      return false;
    }
    if (points.current + strokeCost(s) > DRAW_LIMITS.drawingPoints) {
      setFull("points");
      return false;
    }
    return true;
  };

  /** Neuer Strich/neue Füllung kommt dazu: zählen und „Vor“ verwerfen. */
  const commit = (s: Stroke): void => {
    strokes.current.push(s);
    points.current += strokeCost(s);
    if (redoStack.current.length > 0) {
      redoStack.current = [];
      setCanRedo(false);
    }
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
      setFull("points");
      return;
    }
    s.points.push(x, y);
    points.current++;
    enqueuePoint(s, x, y);
  };

  const onDown = (e: PointerEvent): void => {
    if (lockedRef.current || active.current || !e.isPrimary) return;
    e.preventDefault();
    setMenu(false);
    const [x, y] = toUnits(e);
    if (tool === "fill") {
      const f: Stroke = { id: nextId.current, color, size: 0, points: [x, y], fill: true };
      if (!fits(f)) return;
      nextId.current++;
      commit(f);
      sendWhole(f);
      redraw();
      return;
    }
    if (points.current >= DRAW_LIMITS.drawingPoints) {
      setFull("points");
      return;
    }
    canvas.current?.setPointerCapture?.(e.pointerId);
    const ink = tool === "eraser" ? renderer.current.paper : color;
    if (isShape(tool)) {
      active.current = { pointerId: e.pointerId, stroke: { id: -1, color: ink, size, points: [x, y] }, shape: tool, x0: x, y0: y };
      redraw();
      return;
    }
    const stroke: Stroke = { id: nextId.current++, color: ink, size, points: [x, y] };
    commit(stroke);
    active.current = { pointerId: e.pointerId, stroke, x0: x, y0: y };
    enqueuePoint(stroke, x, y);
    redraw();
  };

  const onMove = (e: PointerEvent): void => {
    const a = active.current;
    if (!a || a.pointerId !== e.pointerId) return;
    e.preventDefault();
    if (lockedRef.current) return onUp(e);
    if (a.shape) {
      const [x, y] = toUnits(e);
      a.stroke.points = shapePoints(a.shape, a.x0, a.y0, x, y);
      redraw();
      return;
    }
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
    active.current = null;
    if (lockedRef.current || e.type !== "pointerup") {
      if (a.shape) redraw();
      return;
    }
    const [x, y] = toUnits(e);
    if (a.shape) {
      // Form erst beim Loslassen übernehmen; ein bloßes Antippen ergibt einen Punkt.
      const s: Stroke = { ...a.stroke, id: nextId.current, points: x === a.x0 && y === a.y0 ? [x, y] : shapePoints(a.shape, a.x0, a.y0, x, y) };
      if (fits(s)) {
        nextId.current++;
        commit(s);
        sendWhole(s);
      }
    } else addPoint(a.stroke, x, y, true);
    redraw();
  };

  const undo = (): void => {
    if (active.current || lockedRef.current) return;
    const s = strokes.current.pop();
    if (!s) return;
    points.current -= strokeCost(s);
    redoStack.current.push(s);
    setCanRedo(true);
    setFull("");
    rev.current++;
    send({ type: "undo" });
    redraw();
  };

  const redo = (): void => {
    if (active.current || lockedRef.current) return;
    const s = redoStack.current.at(-1);
    if (!s) return;
    // Neue ID: der Server nimmt eine schon benutzte nicht noch einmal an.
    const again: Stroke = { ...s, id: nextId.current, points: s.points.slice() };
    if (!fits(again)) return;
    nextId.current++;
    redoStack.current.pop();
    setCanRedo(redoStack.current.length > 0);
    strokes.current.push(again);
    points.current += strokeCost(again);
    sendWhole(again);
    redraw();
  };

  const clear = (): void => {
    if (active.current || lockedRef.current || strokes.current.length === 0) return;
    strokes.current = [];
    points.current = 0;
    redoStack.current = [];
    setCanRedo(false);
    setFull("");
    rev.current++;
    send({ type: "clear" });
    redraw();
  };

  const pickColor = (i: number): void => {
    setColor(i);
    setMenu(false);
    if (tool === "eraser") setTool("pen");
  };
  const ink = tool === "eraser" ? renderer.current.paper : color;

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
        {menu && !locked && (
          <div class="zg-palette" role="listbox" aria-label={t.controller.moreColors} data-testid="zg-palette">
            {PALETTE.map((c, i) => (
              <button
                key={c}
                type="button"
                role="option"
                class={`zg-swatch ${color === i ? "is-on" : ""}`}
                style={{ "--sw": c }}
                aria-label={t.controller.colorLabel(COLOR_NAMES[i]!)}
                aria-selected={color === i}
                data-testid={`zg-color-${i}`}
                onClick={() => pickColor(i)}
              />
            ))}
          </div>
        )}
      </div>
      {full && !locked && (
        <p class="zg-full" role="status">
          {full === "fills" ? t.controller.fillsFull : t.controller.full}
        </p>
      )}
      <div class="zg-tools" aria-disabled={locked}>
        <div class="zg-tools__row">
          {PALETTE.slice(0, QUICK_COLORS).map((c, i) => (
            <button
              key={c}
              type="button"
              class={`zg-swatch ${color === i && tool !== "eraser" ? "is-on" : ""}`}
              style={{ "--sw": c }}
              aria-label={t.controller.colorLabel(COLOR_NAMES[i]!)}
              aria-pressed={color === i}
              data-testid={`zg-quick-${i}`}
              onClick={() => pickColor(i)}
            />
          ))}
          <button
            type="button"
            class={`zg-swatch zg-swatch--more ${color >= QUICK_COLORS && tool !== "eraser" ? "is-on" : ""} ${menu ? "is-open" : ""}`}
            style={{ "--sw": color >= QUICK_COLORS ? PALETTE[color] : "linear-gradient(135deg, #e5383b, #f7c600, #2bb34a, #1f7ae0, #8e44c9)" }}
            aria-label={t.controller.moreColors}
            aria-expanded={menu}
            data-testid="zg-more"
            onClick={() => setMenu(!menu)}
          >
            <span aria-hidden="true">▾</span>
          </button>
        </div>
        <div class="zg-tools__row">
          {TOOLS.map((id) => (
            <button
              key={id}
              type="button"
              class={`zg-tool zg-tool--pick ${tool === id ? "is-on" : ""}`}
              aria-label={TOOL_LABELS[id][2]}
              aria-pressed={tool === id}
              title={TOOL_LABELS[id][2]}
              data-testid={`zg-tool-${id}`}
              onClick={() => {
                setTool(id);
                setMenu(false);
              }}
            >
              <span aria-hidden="true">{TOOL_LABELS[id][0]}</span>
              <small>{TOOL_LABELS[id][1]}</small>
            </button>
          ))}
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
              <span style={{ width: `${4 + i * 5}px`, height: `${4 + i * 5}px`, background: PALETTE[ink] }} />
            </button>
          ))}
          <button type="button" class="zg-tool" aria-label={t.controller.undo} title={t.controller.undo} data-testid="zg-undo" onClick={undo} disabled={locked}>
            <span aria-hidden="true">↶</span>
            <small>{t.controller.undoShort}</small>
          </button>
          <button
            type="button"
            class="zg-tool"
            aria-label={t.controller.redo}
            title={t.controller.redo}
            data-testid="zg-redo"
            onClick={redo}
            disabled={locked || !canRedo}
          >
            <span aria-hidden="true">↷</span>
            <small>{t.controller.redoShort}</small>
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
