// Stylesheet der Controller-View (Hochformat, Daumenbedienung).
export const CONTROLLER_CSS = /* css */ `
.wg-pad {
  --wg-bg: #0d1712;
  --wg-panel: #16261d;
  --wg-ink: #f4f0e2;
  --wg-dim: #a9b8a4;
  --wg-leaf: #6fbf73;
  --wg-sun: #f2c14e;
  --wg-bad: #ff8a7a;
  --wg-tile: #f3e6c8;
  --wg-tile-ink: #3a2a18;
  box-sizing: border-box;
  position: relative;
  /* Füllt den Container der App (Stage) statt des Viewports. */
  flex: 1;
  min-height: 0;
  display: flex; flex-direction: column;
  padding: max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom));
  color: var(--wg-ink);
  background: radial-gradient(420px 220px at 50% -60px, rgba(111, 191, 115, 0.2), transparent 70%), var(--wg-bg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums;
  -webkit-tap-highlight-color: transparent;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
}
.wg-pad > * + *, .wg-pad > p.wg-error { margin-top: 8px; }
.wg-pad *, .wg-pad *::before, .wg-pad *::after { box-sizing: border-box; }
.wg-pad h2, .wg-pad p { margin: 0; }

.wg-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; color: var(--wg-dim); padding: 0 4px; }
.wg-top strong { color: var(--wg-ink); font-size: 16px; }
.wg-top span { color: var(--wg-ink); font-weight: 800; font-size: 18px; }
.wg-time { height: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.1); overflow: hidden; flex: none; }
.wg-time span { display: block; height: 100%; background: var(--wg-leaf); transform-origin: left center; }
.wg-time.is-low span { background: var(--wg-bad); }
@keyframes wg-drain { to { transform: scaleX(0); } }

/* Aktuelles Wort / Rückmeldung */
.wg-current {
  flex: none; height: 46px; display: flex; align-items: center; justify-content: center;
  font-size: 30px; font-weight: 900; letter-spacing: 0.06em; text-align: center;
  white-space: nowrap; overflow: hidden;
}
.wg-current.is-empty { font-size: 14px; font-weight: 600; letter-spacing: 0; color: var(--wg-dim); }
.wg-current b { margin-left: 10px; color: var(--wg-leaf); }
.wg-current small { margin-left: 8px; font-size: 16px; color: var(--wg-sun); letter-spacing: 0; }
.wg-current.is-ok { animation: wg-pop 0.35s cubic-bezier(.2,.9,.3,1.4) both; }
.wg-current.is-bad { color: var(--wg-bad); animation: wg-shake 0.35s both; }
.wg-current.is-bad s { opacity: 0.75; }
.wg-current.is-bad small { color: var(--wg-bad); font-size: 15px; }
@keyframes wg-pop { from { transform: scale(0.7); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes wg-shake { 0%, 100% { transform: none; } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }

/* Raster zum Wischen */
.wg-trace-wrap { flex: 1; min-height: 160px; display: flex; align-items: center; justify-content: center; }
.wg-trace {
  --n: 4;
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  grid-template-rows: repeat(var(--n), 1fr);
  touch-action: none;
  border-radius: 18px;
  padding: 0;
  background: linear-gradient(160deg, #4b3420, #2e1f12);
}
.wg-trace.s5 { --n: 5; }
.wg-trace.s6 { --n: 6; }
.wg-trace.is-disabled { opacity: 0.5; }
.wg-cell { position: relative; display: grid; place-items: center; padding: 5%; pointer-events: none; }
.wg-trace.s6 .wg-cell { padding: 4%; }
.wg-cell span {
  width: 100%; height: 100%; display: grid; place-items: center;
  border-radius: 22%;
  background: linear-gradient(180deg, #fbf1d9, var(--wg-tile));
  color: var(--wg-tile-ink);
  box-shadow: inset 0 -4px 0 rgba(90, 60, 30, 0.25);
  font-weight: 900; font-size: calc(var(--side, 340px) / var(--n) * 0.5);
  transition: transform 0.08s, background 0.08s;
}
.wg-cell.is-gold span { background: linear-gradient(180deg, #ffe9a3, #f2c14e); box-shadow: inset 0 -4px 0 rgba(140, 90, 0, 0.35), 0 0 12px rgba(242, 193, 78, 0.6); }
.wg-cell.is-on span { background: linear-gradient(180deg, #b9f0b4, #6fbf73); color: #0e2a12; transform: scale(0.94); }
.wg-cell.is-last span { background: linear-gradient(180deg, #fff6c9, #f2c14e); color: #3a2600; }
.wg-cell.is-tip span { box-shadow: inset 0 -4px 0 rgba(90, 60, 30, 0.25), 0 0 0 3px #fff, 0 0 16px rgba(255, 255, 255, 0.7); animation: wg-pulse 1.2s ease-in-out infinite; }
@keyframes wg-pulse { 50% { transform: scale(0.9); } }
.wg-trace-line { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; overflow: visible; }
.wg-trace-line polyline { fill: none; stroke: rgba(255, 255, 255, 0.45); stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }

/* Werkzeuge */
.wg-tools { flex: none; display: flex; align-items: center; justify-content: space-between; min-height: 40px; }
.wg-btn {
  appearance: none; border: 0; margin: 0; font: inherit; cursor: pointer;
  padding: 9px 14px; border-radius: 12px; font-size: 15px; font-weight: 700;
  color: #241a00; background: var(--wg-sun); white-space: nowrap;
  box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.2);
}
.wg-btn:disabled { opacity: 0.35; cursor: default; }
.wg-btn:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
.wg-tip { font-size: 15px; color: var(--wg-ink); }
.wg-tip b { letter-spacing: 0.12em; font-size: 18px; }
.wg-tip small { color: var(--wg-dim); margin-left: 4px; }
.wg-combo { position: relative; overflow: hidden; padding: 7px 12px 9px; border-radius: 12px; background: rgba(255, 138, 76, 0.18); color: #ffc49a; font-weight: 800; font-size: 15px; white-space: nowrap; animation: wg-pop 0.3s both; }
.wg-combo span { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: #ff9a5c; transform-origin: left center; }

/* Gefundene Wörter */
.wg-found { flex: none; display: flex; overflow-x: auto; overflow-y: hidden; padding: 2px 0 4px; scrollbar-width: none; min-height: 34px; align-items: center; }
.wg-found::-webkit-scrollbar { display: none; }
.wg-found.is-wrap { flex-wrap: wrap; justify-content: center; overflow: visible; }
.wg-chip { flex: none; margin: 3px; padding: 5px 10px; border-radius: 10px; background: rgba(255, 255, 255, 0.08); font-size: 14px; font-weight: 700; letter-spacing: 0.03em; }
.wg-chip small { color: var(--wg-dim); margin-left: 3px; font-size: 11px; }
.wg-chip.is-unique { background: rgba(242, 193, 78, 0.2); color: #ffe39a; }
.wg-soft { color: var(--wg-dim); font-size: 14px; }

/* Info-Screens */
.wg-info { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 16px; overflow-y: auto; }
.wg-info.is-top { justify-content: flex-start; padding-top: 24px; }
.wg-pad .wg-info > * + * { margin-top: 12px; }
.wg-info h2 { font-size: 26px; font-weight: 800; }
.wg-info p { font-size: 16px; max-width: 32ch; }
.wg-logo { font-size: 64px; line-height: 1; animation: wg-pop 0.5s both; }
.wg-big { font-size: 56px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
.wg-gold { color: var(--wg-sun); font-weight: 700; }
.wg-place { font-size: 20px; font-weight: 800; }
.wg-pill { padding: 6px 14px; border-radius: 99px; background: rgba(111, 191, 115, 0.16); color: #d7e8c9; font-size: 14px !important; font-weight: 700; }
.wg-level-mini { width: 100%; max-width: 320px; padding: 12px 14px; border-radius: 14px; background: var(--wg-panel); }
.wg-level-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; color: var(--wg-dim); white-space: nowrap; }
.wg-level-row b { color: var(--wg-ink); }
.wg-bar { margin-top: 8px; height: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.wg-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--wg-leaf), var(--wg-sun)); transform-origin: left center; transition: transform 1s; }
.wg-unlock { padding: 10px 12px; border-radius: 12px; background: rgba(242, 193, 78, 0.14); font-size: 14px !important; }

.wg-error { padding: 8px 12px; border-radius: 12px; background: rgba(255, 107, 125, 0.18); color: #ffb4bd; font-size: 14px; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .wg-pad *, .wg-pad *::before, .wg-pad *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
`;
