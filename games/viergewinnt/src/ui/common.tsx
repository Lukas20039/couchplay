// Gemeinsame UI-Bausteine für TV- und Controller-View: Spielbrett (SVG), Farben, Avatare,
// Serverzeit, Stil-Injektion. Nur Darstellung – die Regeln prüft der Server.
import { BOT_EMOJI, avatarEmoji } from "@couchplay/protocol";
import { useEffect, useState } from "preact/hooks";
import { de } from "../i18n/de.js";
import { EMPTY, type Dims, type Grid, type LastMove, type Seat } from "../shared.js";

/** Spielerfarben der Apps (--p0 … --p7) mit Fallback; der Computer ist silbern. */
const FALLBACK = ["#ff5a5f", "#3fa7ff", "#3ddc84", "#ffc93c", "#b26bff", "#ff8a3d", "#2ee6d6", "#ff5fbf"];
export const BOT_COLOR = "#cdd2ec";
export const playerColor = (color: number): string => `var(--p${color % 8}, ${FALLBACK[color % 8]})`;
export const seatColor = (seat: Seat): string => (seat.kind === "bot" ? BOT_COLOR : playerColor(seat.color));
export const seatEmoji = (seat: Seat): string => (seat.kind === "bot" ? BOT_EMOJI : avatarEmoji(seat.avatar));

/** Fügt ein Stylesheet einmalig in <head> ein (robust gegen Tree-Shaking von CSS-Importen). */
export function ensureStyles(id: string, css: string): void {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Serverzeit, die alle `intervalMs` neu gerendert wird (nur solange `active`). */
export function useServerNow(serverNow: () => number, active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(serverNow());
    if (!active) return;
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [active, serverNow, intervalMs]);
  return now;
}

export const secondsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));

// ------------------------------------------------------------------ Brett

/** Kantenlänge eines Felds im SVG (Nutzereinheiten). */
const CELL = 100;
const PAD = 14;
const STONE_R = 40;
/** Höhe der Zeile über dem Brett für den schwebenden Stein (Vorschau). */
const HOVER = 104;
/** Größte Fallhöhe in Feldern (größtes Brett hat 7 Zeilen + Zeile über dem Brett). */
const MAX_DROP = 8;

const cx = (col: number): number => col * CELL + CELL / 2;
const cy = (row: number): number => row * CELL + CELL / 2;

/** Seitenverhältnis Breite/Höhe des Bretts inkl. Schwebezeile – für die Größe in rem/px. */
export const boardAspect = (d: Dims, hover: boolean): number => (d.cols * CELL + 2 * PAD) / (d.rows * CELL + 2 * PAD + (hover ? HOVER : 0));

/** Seitlicher Rand des Bretts in Prozent der Breite (zum Ausrichten von Antippflächen über den Spalten). */
export const boardInsetPct = (d: Dims): number => (PAD * 100) / (d.cols * CELL + 2 * PAD);

/** Rahmen mit runden Löchern (evenodd): Steine dahinter sind nur durch die Löcher sichtbar. */
function framePath(d: Dims): string {
  const w = d.cols * CELL + 2 * PAD;
  const h = d.rows * CELL + 2 * PAD;
  const r = 26;
  let p = `M${-PAD + r} ${-PAD}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
  const hole = STONE_R + 3;
  for (let row = 0; row < d.rows; row++) {
    for (let col = 0; col < d.cols; col++) {
      p += `M${cx(col) - hole} ${cy(row)}a${hole} ${hole} 0 1 0 ${2 * hole} 0a${hole} ${hole} 0 1 0 ${-2 * hole} 0Z`;
    }
  }
  return p;
}

const frames = new Map<string, string>();
const frameFor = (d: Dims): string => {
  const key = `${d.cols}x${d.rows}`;
  let p = frames.get(key);
  if (!p) frames.set(key, (p = framePath(d)));
  return p;
};

export interface BoardProps {
  dims: Dims;
  grid: Grid;
  /** Farben der Plätze 0 und 1. */
  colors: [string, string];
  lastMove?: LastMove | null;
  winLines?: readonly number[][];
  /** Schwebender Stein über einer Spalte (TV: Vorschau des Spielers am Zug). */
  hover?: { col: number; color: string } | null;
  /** Platz für die Schwebezeile reservieren (auch wenn gerade nichts schwebt). */
  hoverRow?: boolean;
  /** Vorschau-Stein an der Landestelle (Handy). */
  ghost?: { cell: number; color: string } | null;
  /** Hervorgehobene Spalte (Handy: gewählt). */
  highlightCol?: number | null;
  class?: string;
  /** Größe per CSS – das SVG füllt seinen Container. */
  style?: Record<string, string>;
}

/** Spielbrett als SVG. Neue Steine fallen von oben in ihre Zeile (CSS-Animation je Fallhöhe). */
export function Board(props: BoardProps) {
  const { dims, grid, colors, lastMove = null, winLines = [], hover = null, hoverRow = false, ghost = null, highlightCol = null } = props;
  const w = dims.cols * CELL + 2 * PAD;
  const h = dims.rows * CELL + 2 * PAD;
  const top = hoverRow ? HOVER : 0;
  const inLine = new Set(winLines.flat());
  const decided = winLines.length > 0;
  const stones = [];
  for (let i = 0; i < grid.length; i++) {
    const ch = grid[i];
    if (ch === EMPTY || ch === undefined) continue;
    const col = i % dims.cols;
    const row = Math.floor(i / dims.cols);
    const fresh = lastMove?.cell === i;
    const drop = Math.min(MAX_DROP, row + 1 + (hoverRow ? 1 : 0));
    const cls = ["c4-stone", inLine.has(i) ? "is-win" : decided ? "is-dim" : "", fresh ? "is-last" : ""].join(" ");
    stones.push(
      <g key={`${i}${ch}`} class={cls} transform={`translate(${cx(col)} ${cy(row)})`} style={{ color: colors[ch === "0" ? 0 : 1] }} data-cell={i}>
        <g class={fresh ? `c4-fall c4-fall-${drop}` : undefined} style={fresh ? { animationDuration: `${0.2 + drop * 0.07}s` } : undefined}>
          <g class="c4-stone__body">
            <circle r={STONE_R} class="c4-stone__disc" />
            <circle r={STONE_R - 12} class="c4-stone__ring" />
          </g>
        </g>
      </g>,
    );
  }
  return (
    <div class={`c4-board ${props.class ?? ""}`} style={props.style} role="img" aria-label={de.tv.boardLabel(dims.cols, dims.rows)}>
      <svg viewBox={`${-PAD} ${-PAD - top} ${w} ${h + top}`} preserveAspectRatio="xMidYMid meet">
        <rect class="c4-board__back" x={-PAD} y={-PAD} width={w} height={h} rx={26} />
        {ghost && (
          <circle class="c4-ghost" cx={cx(ghost.cell % dims.cols)} cy={cy(Math.floor(ghost.cell / dims.cols))} r={STONE_R} style={{ color: ghost.color }} />
        )}
        <g class="c4-stones">{stones}</g>
        <path class="c4-board__frame" d={frameFor(dims)} fill-rule="evenodd" />
        {highlightCol !== null && <rect class="c4-board__col" x={highlightCol * CELL + 4} y={-PAD + 4} width={CELL - 8} height={h - 8} rx={CELL / 2 - 4} />}
        {winLines.map((line) => {
          const a = line[0]!;
          const b = line[line.length - 1]!;
          const x1 = cx(a % dims.cols);
          const y1 = cy(Math.floor(a / dims.cols));
          const x2 = cx(b % dims.cols);
          const y2 = cy(Math.floor(b / dims.cols));
          const len = Math.round(Math.hypot(x2 - x1, y2 - y1));
          return (
            <line key={`${a}-${b}`} class="c4-winline" x1={x1} y1={y1} x2={x2} y2={y2} style={{ strokeDasharray: len, strokeDashoffset: len }} />
          );
        })}
        {hover && (
          <g key={`h${hover.col}`} class="c4-hover" transform={`translate(${cx(hover.col)} ${-HOVER / 2 - PAD / 2})`} style={{ color: hover.color }}>
            <g class="c4-hover__bob">
              <circle r={STONE_R} class="c4-stone__disc" />
              <circle r={STONE_R - 12} class="c4-stone__ring" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/** Fall-Animationen je Fallhöhe (1 … MAX_DROP Felder). Keine var() in Keyframes (alte WebViews). */
const FALL_CSS = Array.from({ length: MAX_DROP }, (_, k) => {
  const n = k + 1;
  const d = n * CELL;
  return `@keyframes c4-fall-${n} {
  0% { transform: translateY(-${d}px); animation-timing-function: cubic-bezier(.55,0,1,.45); }
  72% { transform: translateY(0); animation-timing-function: cubic-bezier(0,.55,.45,1); }
  86% { transform: translateY(-${Math.min(22, 6 + n * 3)}px); animation-timing-function: cubic-bezier(.55,0,1,.45); }
  100% { transform: translateY(0); }
}
.c4-fall-${n} { animation-name: c4-fall-${n}; }`;
}).join("\n");

/** CSS des Spielbretts, von TV und Controller gemeinsam genutzt (Chrome-64-tauglich). */
export const BOARD_CSS = /* css */ `
.c4-board { position: relative; }
.c4-board svg { display: block; width: 100%; height: 100%; overflow: visible; }
.c4-board__back { fill: #0b0a1c; }
.c4-board__frame { fill: #2457d6; stroke: #4f7dff; stroke-width: 4; }
.c4-board__col { fill: rgba(255,255,255,0.1); stroke: rgba(255,255,255,0.55); stroke-width: 4; }
.c4-stone__disc { fill: currentColor; }
.c4-stone__ring { fill: none; stroke: rgba(0,0,0,0.2); stroke-width: 6; }
.c4-stone { transition: opacity 0.5s 0.2s; }
.c4-stone.is-dim { opacity: 0.35; }
.c4-stone.is-win .c4-stone__disc { stroke: #fff; stroke-width: 7; }
.c4-stone.is-win .c4-stone__body { animation: c4-pulse 0.9s ease-in-out 0.5s infinite alternate; }
.c4-fall { animation-fill-mode: both; animation-duration: 0.5s; }
.c4-ghost { fill: currentColor; opacity: 0.55; stroke: currentColor; stroke-width: 5; stroke-dasharray: 14 10; }
.c4-winline { fill: none; stroke: #fff; stroke-width: 14; stroke-linecap: round; opacity: 0.9; animation: c4-draw 0.5s cubic-bezier(.6,0,.2,1) 0.45s forwards; }
.c4-hover__bob { animation: c4-bob 1.4s ease-in-out infinite; }
@keyframes c4-pulse { from { transform: scale(1); } to { transform: scale(1.1); } }
@keyframes c4-draw { to { stroke-dashoffset: 0; } }
@keyframes c4-bob { 0%, 100% { transform: translateY(-8px); } 50% { transform: translateY(6px); } }
${FALL_CSS}
@media (prefers-reduced-motion: reduce) {
  .c4-fall, .c4-hover__bob, .c4-stone.is-win .c4-stone__body { animation: none !important; }
  .c4-winline { animation: none; stroke-dashoffset: 0 !important; }
}
`;
