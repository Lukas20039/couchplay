// Gemeinsame UI-Bausteine für TV- und Controller-View: Spielfeld (10 × 10), Farben, Avatare,
// Stil-Injektion. Nur Darstellung – die Regeln prüft der Server.
import { BOT_EMOJI, avatarEmoji } from "@couchplay/protocol";
import { de } from "../i18n/de.js";
import { CELLS, SIZE, type LastShot, type Seat, type Ship, type Waters } from "../shared.js";

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

const pct = (n: number): string => `${(n * 100) / SIZE}%`;

export interface BoardProps {
  waters: Waters;
  /** Sichtbare Schiffe (eigene Flotte, versenkte bzw. aufgedeckte gegnerische). */
  ships?: readonly Ship[];
  /** Schiffe, die nur als Umriss gezeigt werden (aufgedeckt bei Spielende, nicht versenkt). */
  ghosts?: readonly Ship[];
  lastShot?: LastShot | null;
  /** Ausgewähltes Schiff (Aufstellung). */
  selected?: number | null;
  /** Felder als Buttons (Handy). `enabled(cell)` entscheidet je Feld. */
  onCell?: (cell: number) => void;
  enabled?: (cell: number) => boolean;
  /** Präfix für data-testid der Feld-Buttons. */
  testId?: string;
  /** Spalten-/Zeilenbeschriftung (TV). */
  coords?: boolean;
  class?: string;
}

/** Spielfeld: Wasser, Schiffe, Markierungen und optional antippbare Felder. */
export function Board(props: BoardProps) {
  const { waters, ships = [], ghosts = [], lastShot = null, selected = null, onCell, enabled, testId, coords = false } = props;
  const grid = (
    <div class={`sv-board ${props.class ?? ""}`}>
      <div class="sv-board__in">
        <div class="sv-board__water" />
        {ghosts.map((s) => (
          <ShipShape key={`g${s.id}`} ship={s} cls="sv-ship--ghost" />
        ))}
        {ships.map((s) => (
          <ShipShape key={`s${s.id}`} ship={s} cls={s.id === selected ? "is-selected" : ""} />
        ))}
        <div class="sv-board__marks">
          {[...waters].map((c, i) => (
            <span
              key={i}
              class={`sv-mark sv-mark--${markClass(c)} ${lastShot?.cell === i ? "is-last" : ""}`}
              style={{ left: pct(i % SIZE), top: pct(Math.floor(i / SIZE)) }}
            />
          ))}
        </div>
        {onCell && (
          <div class="sv-board__cells">
            {Array.from({ length: CELLS }, (_, i) => (
              <button
                key={i}
                type="button"
                class="sv-cell"
                disabled={enabled ? !enabled(i) : false}
                aria-label={de.controller.cellLabel(de.coord(i), de.controller.state[waters[i] ?? "."] ?? "")}
                data-testid={testId ? `${testId}-${i}` : undefined}
                onClick={() => onCell(i)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
  if (!coords) return grid;
  return (
    <div class="sv-coords">
      <span />
      <div class="sv-coords__cols">
        {de.cols.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div class="sv-coords__rows">
        {Array.from({ length: SIZE }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      {grid}
    </div>
  );
}

const markClass = (c: string): string => ({ o: "miss", x: "hit", "#": "sunk", "~": "clear" })[c] ?? "none";

function ShipShape({ ship, cls }: { ship: Ship; cls: string }) {
  const h = ship.dir === "h";
  return (
    <span
      class={`sv-ship ${cls}`}
      style={{
        left: pct(ship.x),
        top: pct(ship.y),
        width: pct(h ? ship.len : 1),
        height: pct(h ? 1 : ship.len),
      }}
    />
  );
}

/** Kleine Schiffssymbole für „noch im Wasser“ / versenkt. */
export function FleetList({ afloat, sunk }: { afloat: readonly number[]; sunk: readonly number[] }) {
  const all = [...afloat.map((len) => ({ len, sunk: false })), ...sunk.map((len) => ({ len, sunk: true }))].sort(
    (a, b) => b.len - a.len || Number(a.sunk) - Number(b.sunk),
  );
  return (
    <ul class="sv-fleet" aria-label={de.tv.afloat}>
      {all.map((s, i) => (
        <li key={i} class={`sv-fleet__ship ${s.sunk ? "is-sunk" : ""}`} title={de.shipName(s.len)}>
          {Array.from({ length: s.len }, (_, j) => (
            <i key={j} />
          ))}
        </li>
      ))}
    </ul>
  );
}

/** CSS des Spielfelds, von TV und Controller gemeinsam genutzt (Chrome-64-tauglich). */
export const BOARD_CSS = /* css */ `
/* Quadratisch über ::before (Prozent-Padding bezieht sich auf die Breite des Felds selbst). */
.sv-board { position: relative; width: 100%; }
.sv-board::before { content: ""; display: block; padding-top: 100%; }
.sv-board__in { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.sv-board__water {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 0.6em;
  background-color: #0d3a63;
  background-image:
    linear-gradient(rgba(255,255,255,0.13) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.13) 1px, transparent 1px),
    radial-gradient(circle at 30% 20%, #15528a, #0b2f52);
  background-size: 10% 10%, 10% 10%, 100% 100%;
  box-shadow: inset 0 0 0 2px rgba(120,190,255,0.35);
}
.sv-ship {
  position: absolute; box-sizing: border-box; border: 0.18em solid transparent; background-clip: padding-box;
  border-radius: 999px; background-color: #9aa8bd;
  background-image: linear-gradient(180deg, rgba(255,255,255,0.35), rgba(0,0,0,0.15));
  box-shadow: 0 0.1em 0.3em rgba(0,0,0,0.45);
}
.sv-ship.is-selected { background-color: var(--sv-me, #ffd24d); box-shadow: 0 0 0 0.15em #fff, 0 0 0.9em var(--sv-me, #ffd24d); }
.sv-ship--ghost { background: transparent; border: 0.18em dashed rgba(255,255,255,0.75); box-shadow: none; }
.sv-board__marks, .sv-board__cells { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
.sv-mark { position: absolute; width: 10%; height: 10%; pointer-events: none; }
.sv-mark::after { content: ""; position: absolute; top: 50%; left: 50%; border-radius: 50%; transform: translate(-50%, -50%); }
.sv-mark--miss::after { width: 26%; height: 26%; background: rgba(220,236,255,0.85); }
.sv-mark--clear::after { width: 16%; height: 16%; background: rgba(220,236,255,0.35); }
.sv-mark--hit::after { width: 62%; height: 62%; background: radial-gradient(circle, #ffe08a 0, #ff8a3d 45%, #e8342f 75%); box-shadow: 0 0 0.6em #ff6a3d; }
.sv-mark--sunk { background: rgba(120,10,20,0.55); }
.sv-mark--sunk::after { width: 50%; height: 50%; background: #2a0b10; border: 0.12em solid #ff5a5f; box-sizing: border-box; }
.sv-mark.is-last::before {
  content: ""; position: absolute; top: 4%; left: 4%; width: 92%; height: 92%; box-sizing: border-box;
  border: 0.16em solid #fff; border-radius: 0.3em; animation: sv-ping 1.2s ease-out 2;
}
@keyframes sv-ping { 0% { transform: scale(1.8); opacity: 0; } 40% { opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
.sv-board__cells { display: grid; grid-template-columns: repeat(10, 1fr); grid-template-rows: repeat(10, 1fr); }
.sv-cell { margin: 0; padding: 0; border: 0; background: transparent; border-radius: 0.3em; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.sv-cell:disabled { cursor: default; }
.sv-cell:not(:disabled):active { background: rgba(255,255,255,0.25); }
.sv-coords { display: grid; grid-template-columns: 1.4em 1fr; grid-template-rows: 1.4em 1fr; }
.sv-coords__cols, .sv-coords__rows { display: flex; color: rgba(255,255,255,0.55); font-weight: 700; font-size: 0.8em; }
.sv-coords__cols span { flex: 1; text-align: center; line-height: 1.6em; }
.sv-coords__rows { flex-direction: column; }
.sv-coords__rows span { flex: 1; display: flex; align-items: center; justify-content: center; }
.sv-fleet { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; }
.sv-fleet__ship { display: flex; margin: 0 0.6em 0.4em 0; }
.sv-fleet__ship i { display: block; width: 0.7em; height: 0.7em; margin-right: 0.12em; border-radius: 0.2em; background: #9aa8bd; }
.sv-fleet__ship.is-sunk i { background: #ff5a5f; opacity: 0.45; }
@media (prefers-reduced-motion: reduce) { .sv-mark.is-last::before { animation: none; } }
`;
