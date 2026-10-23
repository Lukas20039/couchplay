// Gemeinsame UI-Bausteine für TV- und Controller-View: Brett, Teile, Farben, Stil-Injektion.
import { avatarEmoji } from "@couchplay/protocol";
import { useEffect, useState } from "preact/hooks";
import { CELLS, EMPTY, SIZE, STONE, type Board, type Shape } from "../shared.js";

/** Farben der Teile (Index = Shape.color). */
export const BLOCK_COLORS = ["#ff5a5f", "#ff9f3d", "#ffd84d", "#3ddc84", "#2ee6d6", "#3fa7ff", "#b26bff"];
const FALLBACK = ["#ff5a5f", "#3fa7ff", "#3ddc84", "#ffc93c", "#b26bff", "#ff8a3d", "#2ee6d6", "#ff5fbf"];
export const playerColor = (color: number): string => `var(--p${color % 8}, ${FALLBACK[color % 8]})`;
export { avatarEmoji };

/** Fügt ein Stylesheet einmalig in <head> ein (robust gegen Tree-Shaking von CSS-Importen). */
export function ensureStyles(id: string, css: string): void {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Server-Uhr, solange `active` alle 250 ms neu gelesen. */
export function useServerNow(serverNow: () => number, active: boolean): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(serverNow());
    if (!active) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [active, serverNow]);
  return now;
}

export const secondsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));

export interface BoardProps {
  board: Board;
  /** Vorschau eines Teils: Felder + ob es passt. */
  ghost?: { cells: number[]; ok: boolean; color: number } | null;
  /** Gerade geräumte Felder (Aufblitzen) – `flashKey` startet die Animation neu. */
  flash?: number[];
  /** Gerade gelandete Steine (Wackeln). */
  stones?: number[];
  flashKey?: string;
  onCell?: (cell: number) => void;
  testId?: string;
  class?: string;
  boardRef?: (el: HTMLDivElement | null) => void;
}

/** 8 × 8-Brett aus der Zeichenkette (siehe shared.Board). */
export function BoardView(props: BoardProps) {
  const { board, ghost = null, flash = [], stones = [], flashKey = "", onCell, testId } = props;
  const ghostSet = new Set(ghost?.cells ?? []);
  const flashSet = new Set(flash);
  const stoneSet = new Set(stones);
  return (
    <div class={`bb-board ${props.class ?? ""}`} ref={props.boardRef}>
      <div class="bb-board__in">
        {Array.from({ length: CELLS }, (_, i) => {
          const c = board[i] ?? EMPTY;
          const isGhost = ghostSet.has(i);
          const cls = [
            "bb-cell",
            c === STONE ? "is-stone" : c !== EMPTY ? "is-block" : "",
            isGhost ? (ghost!.ok ? "is-ghost" : "is-ghost-bad") : "",
            flashSet.has(i) ? "is-flash" : "",
            stoneSet.has(i) ? "is-landed" : "",
          ].join(" ");
          const color = c !== EMPTY && c !== STONE ? BLOCK_COLORS[Number(c)] : isGhost ? BLOCK_COLORS[ghost!.color] : undefined;
          const style = color ? { "--b": color } : undefined;
          return onCell ? (
            <button
              key={`${i}-${flashSet.has(i) || stoneSet.has(i) ? flashKey : ""}`}
              type="button"
              class={cls}
              style={style}
              data-testid={testId ? `${testId}-${i}` : undefined}
              data-cell={c}
              onClick={() => onCell(i)}
            />
          ) : (
            <span key={`${i}-${flashSet.has(i) || stoneSet.has(i) ? flashKey : ""}`} class={cls} style={style} data-cell={c} />
          );
        })}
      </div>
    </div>
  );
}

/** Ein Teil als kleines Raster (Hand am Handy, Vorschau). */
export function PieceView({ shape, cell, class: cls = "" }: { shape: Shape; cell: number; class?: string }) {
  const set = new Set(shape.cells.map(([x, y]) => y * shape.w + x));
  return (
    <span
      class={`bb-piece ${cls}`}
      style={{ width: `${shape.w * cell}px`, height: `${shape.h * cell}px`, "--b": BLOCK_COLORS[shape.color] }}
      aria-hidden="true"
    >
      {Array.from({ length: shape.w * shape.h }, (_, i) => (
        <i key={i} class={set.has(i) ? "on" : ""} style={{ width: `${cell}px`, height: `${cell}px` }} />
      ))}
    </span>
  );
}

/** Felder des Teils bei linker oberer Ecke (x, y), außerhalb → null. */
export function shapeCellsAt(shape: Shape, x: number, y: number): number[] | null {
  if (x < 0 || y < 0 || x + shape.w > SIZE || y + shape.h > SIZE) return null;
  return shape.cells.map(([dx, dy]) => (y + dy) * SIZE + x + dx);
}

/** CSS für Brett und Teile, von TV und Controller gemeinsam genutzt (Chrome-64-tauglich). */
export const BOARD_CSS = /* css */ `
.bb-board { position: relative; width: 100%; }
.bb-board::before { content: ""; display: block; padding-top: 100%; }
.bb-board__in {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); grid-gap: 0.18em;
  padding: 3%; border-radius: 0.7em; background: #1b1640; box-shadow: inset 0 0 0 2px rgba(255,255,255,0.08);
}
.bb-cell {
  display: block; margin: 0; padding: 0; border: 0; border-radius: 0.22em; background: rgba(255,255,255,0.06);
  -webkit-tap-highlight-color: transparent; font: inherit;
}
.bb-cell.is-block {
  background: var(--b);
  box-shadow: inset 0 -0.18em 0 rgba(0,0,0,0.25), inset 0 0.12em 0 rgba(255,255,255,0.35);
}
.bb-cell.is-stone {
  background: #5d5975;
  background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.18) 0 0.2em, transparent 0.2em 0.45em);
  box-shadow: inset 0 -0.18em 0 rgba(0,0,0,0.35);
}
.bb-cell.is-ghost { background: var(--b); opacity: 0.5; }
.bb-cell.is-ghost-bad { background: rgba(255,90,95,0.35); }
.bb-cell.is-flash { animation: bb-flash 0.55s ease-out both; }
.bb-cell.is-landed { animation: bb-land 0.5s cubic-bezier(.3,1.7,.5,1) both; }
@keyframes bb-flash { 0% { background: #fff; transform: scale(1.15); } 100% { transform: scale(1); } }
@keyframes bb-land { 0% { transform: translateY(-1.5em) scale(1.3); opacity: 0; } 100% { transform: none; opacity: 1; } }
.bb-piece { display: inline-flex; flex-wrap: wrap; vertical-align: middle; }
.bb-piece i { display: block; box-sizing: border-box; padding: 1px; }
.bb-piece i.on::before {
  content: ""; display: block; width: 100%; height: 100%; border-radius: 22%; background: var(--b);
  box-shadow: inset 0 -2px 0 rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.35);
}
@media (prefers-reduced-motion: reduce) { .bb-cell.is-flash, .bb-cell.is-landed { animation: none; } }
`;
