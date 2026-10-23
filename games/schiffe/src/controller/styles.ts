// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
export const CONTROLLER_CSS = /* css */ `
.sv-ctl {
  --sv-dim: #aaa1d2;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  color: var(--text, #f8f4ff);
  font-variant-numeric: tabular-nums;
}
.sv-ctl > :not(:first-child) { margin-top: 10px; }
.sv-ctl *, .sv-ctl *::before, .sv-ctl *::after { box-sizing: border-box; }
.sv-ctl h2, .sv-ctl p { margin: 0; }

.sv-ctl__title { font-size: 1.25rem; font-weight: 800; text-align: center; }
.sv-ctl__hint { font-size: 0.9rem; color: var(--sv-dim); text-align: center; }
/* Feld so groß wie Breite und Höhe erlauben (Rest: Kopfleiste, Status, Knöpfe bzw. eigene Flotte). */
.sv-ctl__board { width: 100%; max-width: 440px; font-size: 14px; }
.sv-ctl--setup .sv-ctl__board { max-width: calc(100vh - 340px); min-width: 220px; }
.sv-ctl__target { max-width: calc(100vh - 330px); min-width: 220px; }
.sv-ctl__target.is-pending { opacity: 0.8; }
.sv-ctl--battle.is-myturn .sv-ctl__target .sv-board__water { box-shadow: inset 0 0 0 3px var(--sv-me); }
.sv-ctl__status {
  min-height: 2.4em; display: flex; align-items: center; justify-content: center; text-align: center;
  font-weight: 700; font-size: 1.05rem;
}
.sv-ctl__status.is-warn { color: #ffb15c; }
.sv-ctl--battle.is-myturn .sv-ctl__status { color: var(--sv-me); }

.sv-ctl__actions { display: flex; width: 100%; max-width: 440px; }
.sv-ctl__actions > * { flex: 1; }
.sv-ctl__actions > :not(:first-child) { margin-left: 10px; }
.sv-btn {
  min-height: 50px; padding: 0 8px; border: 0; border-radius: 16px; font: inherit; font-weight: 800; font-size: 0.95rem; white-space: nowrap;
  color: var(--text, #f8f4ff); background: rgba(255,255,255,0.1); cursor: pointer;
}
.sv-btn:disabled { opacity: 0.4; cursor: default; }
.sv-btn:not(:disabled):active { transform: scale(0.97); }
.sv-btn--primary { background: var(--sv-me); color: var(--ink, #120f24); }

.sv-ctl__head { width: 100%; max-width: 440px; display: flex; justify-content: space-between; font-weight: 700; }
.sv-ctl__side b { font-size: 1.3rem; margin: 0 4px; }
.sv-ctl__side--me b { color: var(--sv-me); }
.sv-ctl__side--opp b { color: var(--sv-opp); }

.sv-ctl__below { width: 100%; max-width: 440px; display: flex; align-items: flex-start; }
.sv-ctl__own { width: 34%; flex: none; font-size: 6px; margin-right: 14px; }
.sv-ctl__fleets { flex: 1; min-width: 0; font-size: 13px; }
.sv-ctl__label { font-size: 0.8rem; color: var(--sv-dim); margin: 2px 0 6px !important; }

.sv-ctl__result { display: flex; flex-direction: column; align-items: center; text-align: center; }
.sv-ctl__result strong { font-size: 1.8rem; font-weight: 900; }
.sv-ctl.is-win .sv-ctl__result strong { color: var(--sv-me); }
.sv-ctl__result span { color: var(--sv-dim); margin-top: 4px; }
`;
