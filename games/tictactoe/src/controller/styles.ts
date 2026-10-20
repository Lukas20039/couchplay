// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
// Das Brett ist quadratisch und so groß, wie Breite und Höhe (inkl. Safe-Area) erlauben.
export const CONTROLLER_CSS = /* css */ `
.ttt-ctl {
  --ttt-line: rgba(232, 226, 255, 0.22);
  --ttt-dim: #aaa1d2;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  min-height: 0;
  color: var(--text, #f8f4ff);
  font-variant-numeric: tabular-nums;
}
.ttt-ctl > :not(:first-child) { margin-top: 14px; }
.ttt-ctl *, .ttt-ctl *::before, .ttt-ctl *::after { box-sizing: border-box; }

/* ---------- Kopf: eigenes Symbol + Serienstand ---------- */
.ttt-ctl__head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
}
.ttt-ctl__head > :not(:first-child) { margin-left: 12px; }
.ttt-ctl__me {
  display: flex; align-items: center; 
  font-weight: 800; font-size: 1.05rem;
}
.ttt-ctl__me > :not(:first-child) { margin-left: 10px; }
.ttt-ctl__mymark {
  width: 44px; height: 44px;
  color: var(--me);
  padding: 4px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--me) 16%, transparent);
}
.ttt-ctl__score { display: flex;  margin: 0; }
.ttt-ctl__score > :not(:first-child) { margin-left: 14px; }
.ttt-ctl__side { display: flex; flex-direction: column; align-items: flex-end; min-width: 0; }
.ttt-ctl__side dt {
  font-size: 0.8rem; color: var(--ttt-dim);
  max-width: 7.5em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.ttt-ctl__side dd { margin: 0; font-size: 1.6rem; font-weight: 900; line-height: 1.1; }
.ttt-ctl__side--me dd { color: var(--me); }
.ttt-ctl__side--opp dd { color: var(--opp); }

/* ---------- Brett ---------- */
.ttt-ctl__board {
  position: relative;
  width: 100%;
  /* Fallback ohne dvh; Kopf, Status, App-Leiste ≈ 300px */
  max-width: calc(100vh - 300px - var(--sat, 0px) - var(--sab, 0px));
  max-width: calc(100dvh - 300px - var(--sat, 0px) - var(--sab, 0px));
  min-width: 220px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.035);
  transition: box-shadow 0.25s, background 0.25s;
}
.ttt-ctl__board::before { content: ""; display: block; padding-top: 100%; } /* quadratisch über padding-top (Chrome-64-kompatibel) */
.ttt-ctl.is-myturn .ttt-ctl__board {
  background: color-mix(in srgb, var(--me) 9%, transparent);
  box-shadow: 0 0 0 3px var(--me);
}
.ttt-ctl__svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 4%; overflow: visible; }
.ttt-ctl__grid path { fill: none; stroke: var(--ttt-line); stroke-width: 5; stroke-linecap: round; }
.ttt-ctl__mark .ttt-stroke { stroke-width: 12; }
.ttt-ctl__mark { transition: opacity 0.4s; }
.ttt-ctl__mark.is-pending { opacity: 0.5; }
.ttt-ctl__mark.is-dim { opacity: 0.25; }
.ttt-ctl__last { fill: var(--opp); opacity: 0.16; }
.ttt-ctl__winline {
  fill: none; stroke: currentColor; stroke-width: 12; stroke-linecap: round;
  animation: ttt-draw 0.5s cubic-bezier(.6,0,.2,1) 0.3s both;
}
.ttt-ctl__cells {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  padding: 4%;
  display: grid;
  grid-template: repeat(3, 1fr) / repeat(3, 1fr);
}
.ttt-ctl__cell {
  appearance: none;
  border: 0;
  margin: 6px;
  border-radius: 18px;
  background: transparent;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s, transform 0.1s;
}
.ttt-ctl__cell:disabled { cursor: default; }
.ttt-ctl.is-myturn .ttt-ctl__cell:not(:disabled) { background: color-mix(in srgb, var(--me) 10%, transparent); }
.ttt-ctl.is-myturn .ttt-ctl__cell:not(:disabled):active { background: color-mix(in srgb, var(--me) 32%, transparent); transform: scale(0.95); }
.ttt-ctl__cell:focus-visible { outline: 3px solid var(--me); outline-offset: -3px; }

/* ---------- Status / Ergebnis ---------- */
.ttt-ctl__status {
  margin: 0;
  min-height: 3em;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  font-size: 1.1rem; font-weight: 700;
  color: var(--ttt-dim);
}
.ttt-ctl.is-myturn .ttt-ctl__status { color: var(--text, #f8f4ff); }
.ttt-ctl--paused .ttt-ctl__status { color: #ffd23f; }
.ttt-ctl__result {
  display: flex; flex-direction: column; align-items: center; 
  text-align: center;
  animation: ttt-pop 0.4s cubic-bezier(.2,.9,.3,1.4) 0.6s both;
}
.ttt-ctl__result > :not(:first-child) { margin-top: 2px; }
.ttt-ctl__result strong { font-size: 2rem; font-weight: 900; line-height: 1.1; }
.ttt-ctl__result span { font-size: 0.9rem; color: var(--ttt-dim); }
.ttt-ctl.is-win .ttt-ctl__result strong { color: var(--me); }
.ttt-ctl.is-lose .ttt-ctl__result strong { color: var(--ttt-dim); }
@keyframes ttt-pop { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .ttt-ctl *, .ttt-ctl *::before, .ttt-ctl *::after { animation: none !important; transition: none !important; }
  .ttt-ctl__winline { stroke-dashoffset: 0 !important; }
}
`;
