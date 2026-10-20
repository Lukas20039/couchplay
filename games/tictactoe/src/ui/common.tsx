// Gemeinsame UI-Bausteine für TV- und Controller-View: Zeichen X/O als SVG,
// Spielerfarben, Avatare und Stil-Injektion.
import type { Mark, Seat } from "../shared.js";

/** Länge der Striche im 100er-viewBox (für stroke-dashoffset-Animation). */
export const X_STROKE = 80; // Diagonale 22→78 ≈ 79,2
export const O_STROKE = 190; // Umfang r=30 ≈ 188,5

/**
 * X oder O als SVG. `draw` = Zeichen-Animation (stroke-dashoffset), `delay` in ms.
 * Klassen: ttt-glyph, ttt-glyph--draw.
 */
export function Glyph({ mark, draw = false, class: cls = "" }: { mark: Mark; draw?: boolean; class?: string }) {
  return (
    <svg class={`ttt-glyph ${draw ? "ttt-glyph--draw" : ""} ${cls}`} viewBox="0 0 100 100" aria-hidden="true">
      <GlyphPaths mark={mark} />
    </svg>
  );
}

/** Nur die Striche (für Einbettung in ein größeres SVG, Koordinaten 0–100). */
export function GlyphPaths({ mark }: { mark: Mark }) {
  if (mark === "X") {
    return (
      <>
        <path class="ttt-stroke ttt-stroke--x1" d="M22 22 L78 78" style={{ strokeDasharray: X_STROKE }} />
        <path class="ttt-stroke ttt-stroke--x2" d="M78 22 L22 78" style={{ strokeDasharray: X_STROKE }} />
      </>
    );
  }
  // Kreis als Pfad, beginnt oben und läuft im Uhrzeigersinn – wie von Hand gezogen.
  return <path class="ttt-stroke ttt-stroke--o" d="M50 20 A30 30 0 1 1 49.99 20" style={{ strokeDasharray: O_STROKE }} />;
}

/** CSS für Glyphen, von TV und Controller gemeinsam genutzt. */
export const GLYPH_CSS = /* css */ `
.ttt-glyph { display: block; overflow: visible; }
.ttt-stroke { fill: none; stroke: currentColor; stroke-width: 11; stroke-linecap: round; stroke-dashoffset: 0; }
.ttt-glyph--draw .ttt-stroke--x1,
.ttt-glyph--draw .ttt-stroke--x2,
.ttt-glyph--draw .ttt-stroke--o { animation: ttt-draw 0.26s cubic-bezier(.5,0,.3,1) both; }
.ttt-glyph--draw .ttt-stroke--x1 { stroke-dashoffset: ${X_STROKE}; }
.ttt-glyph--draw .ttt-stroke--x2 { stroke-dashoffset: ${X_STROKE}; animation-delay: 0.2s; }
.ttt-glyph--draw .ttt-stroke--o { stroke-dashoffset: ${O_STROKE}; animation-duration: 0.45s; }
@keyframes ttt-draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) {
  .ttt-glyph--draw .ttt-stroke--x1, .ttt-glyph--draw .ttt-stroke--x2, .ttt-glyph--draw .ttt-stroke--o {
    animation: none; stroke-dashoffset: 0;
  }
}
`;

const AVATAR_EMOJI: Record<string, string> = {
  fuchs: "🦊",
  katze: "🐱",
  hund: "🐶",
  panda: "🐼",
  eule: "🦉",
  frosch: "🐸",
  tiger: "🐯",
  einhorn: "🦄",
  pinguin: "🐧",
  krake: "🐙",
  roboter: "🤖",
  alien: "👽",
};
export const avatarEmoji = (avatar: string): string => AVATAR_EMOJI[avatar] ?? "🙂";
export const seatEmoji = (seat: Seat): string => (seat.kind === "bot" ? "🤖" : avatarEmoji(seat.avatar));

/** Spielerfarben der Apps (--p0 … --p7) mit Fallback; der Computer ist silbern. */
const FALLBACK = ["#ff5a5f", "#3fa7ff", "#3ddc84", "#ffc93c", "#b26bff", "#ff8a3d", "#2ee6d6", "#ff5fbf"];
export const BOT_COLOR = "#cdd2ec";
export const playerColor = (color: number): string => `var(--p${color % 8}, ${FALLBACK[color % 8]})`;
export const seatColor = (seat: Seat): string => (seat.kind === "bot" ? BOT_COLOR : playerColor(seat.color));

/** Fügt ein Stylesheet einmalig in <head> ein (robust gegen Tree-Shaking von CSS-Importen). */
export function ensureStyles(id: string, css: string): void {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Mittelpunkt eines Feldes im 300er-Brett-viewBox. */
export const cellCenter = (cell: number): [number, number] => [(cell % 3) * 100 + 50, Math.floor(cell / 3) * 100 + 50];

/** Gewinnlinie: von Mitte des ersten bis Mitte des letzten Feldes, an beiden Enden verlängert. */
export function winLineCoords(line: readonly number[], overshoot = 34): { x1: number; y1: number; x2: number; y2: number; length: number } {
  const [ax, ay] = cellCenter(line[0] ?? 0);
  const [bx, by] = cellCenter(line[line.length - 1] ?? 0);
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  return {
    x1: ax - ux * overshoot,
    y1: ay - uy * overshoot,
    x2: bx + ux * overshoot,
    y2: by + uy * overshoot,
    length: len + 2 * overshoot,
  };
}
