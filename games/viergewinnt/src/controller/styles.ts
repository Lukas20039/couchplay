// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
export const CONTROLLER_CSS = /* css */ `
.c4-ctl {
  --c4-dim: #aaa1d2;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 0;
  color: var(--text, #f8f4ff);
  font-variant-numeric: tabular-nums;
  -webkit-user-select: none;
  user-select: none;
}
.c4-ctl > :not(:first-child) { margin-top: 10px; }
.c4-ctl *, .c4-ctl *::before, .c4-ctl *::after { box-sizing: border-box; }
.c4-ctl p { margin: 0; }

.c4-ctl__head { width: 100%; max-width: 460px; display: flex; align-items: center; justify-content: space-between; font-weight: 700; }
.c4-ctl__side { display: flex; align-items: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 38%; }
.c4-ctl__side b { font-size: 1.35rem; margin: 0 5px; }
.c4-ctl__side--me b { color: var(--me); }
.c4-ctl__side--opp b { color: var(--opp); }
.c4-ctl__disc { display: inline-block; width: 16px; height: 16px; border-radius: 50%; margin-right: 6px; background: var(--me); box-shadow: inset 0 0 0 3px rgba(0,0,0,0.2); }
.c4-ctl__round { font-size: 0.8rem; color: var(--c4-dim); text-align: center; }

.c4-ctl__status {
  min-height: 2.6em; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  font-weight: 700; font-size: 1.05rem;
}
.c4-ctl.is-myturn .c4-ctl__status { color: var(--me); }
.c4-ctl__timer { font-size: 0.9rem; color: var(--text, #f8f4ff); opacity: 0.8; }
.c4-ctl__status.is-low .c4-ctl__timer { color: #ff6b6b; opacity: 1; }

/* Brett so groß wie Breite und Höhe erlauben (Rest: Kopf, Status, Leiste, Knopf). */
.c4-ctl__boardwrap { position: relative; width: 100%; max-width: 460px; }
@media (max-height: 760px) { .c4-ctl__boardwrap { max-width: calc((100vh - 370px) * var(--aspect)); min-width: 220px; } }
.c4-ctl__board { width: 100%; height: 0; }
.c4-ctl__board svg { position: absolute; top: 0; left: 0; }
.c4-ctl__hit { position: absolute; top: 0; bottom: 0; display: flex; }
.c4-ctl__hit span { flex: 1; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.c4-ctl:not(.is-myturn) .c4-ctl__hit { pointer-events: none; }

/* Spaltenleiste: groß und daumenfreundlich, eine Taste je Spalte. */
.c4-ctl__bar { width: 100%; max-width: 460px; display: flex; }
.c4-col {
  flex: 1; min-width: 0; height: 64px; margin: 0 2px; padding: 0; border: 0; border-radius: 14px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font: inherit; font-weight: 800; color: var(--text, #f8f4ff); background: rgba(255,255,255,0.1);
  cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 0.15s, transform 0.1s;
}
.c4-col span { font-size: 1.2rem; line-height: 1; }
.c4-col small { font-size: 0.75rem; opacity: 0.7; margin-top: 3px; }
.c4-col:disabled { opacity: 0.3; cursor: default; }
.c4-ctl.is-myturn .c4-col:not(:disabled) { background: rgba(255,255,255,0.16); }
.c4-col.is-selected { background: var(--me) !important; color: var(--ink, #120f24); transform: translateY(-3px); }
.c4-col:not(:disabled):active { transform: scale(0.95); }

.c4-btn {
  width: 100%; max-width: 460px; min-height: 58px; padding: 0 12px; border: 0; border-radius: 18px;
  font: inherit; font-weight: 900; font-size: 1.1rem; color: var(--text, #f8f4ff); background: rgba(255,255,255,0.1); cursor: pointer;
}
.c4-btn--primary { background: var(--me); color: var(--ink, #120f24); }
.c4-btn:disabled { opacity: 0.35; cursor: default; }
.c4-btn:not(:disabled):active { transform: scale(0.98); }

.c4-ctl__result { min-height: 2.6em; display: flex; flex-direction: column; align-items: center; text-align: center; }
.c4-ctl__result strong { font-size: 1.7rem; font-weight: 900; }
.c4-ctl__result--round strong { font-size: 1.35rem; }
.c4-ctl.is-win .c4-ctl__result strong { color: var(--me); }
.c4-ctl__result span { color: var(--c4-dim); margin-top: 2px; }
`;
