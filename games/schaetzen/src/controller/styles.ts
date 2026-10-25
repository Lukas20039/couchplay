// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
// Ziffernfeld als Grid (Grid-gap ist auch in alten WebViews erlaubt).
export const CONTROLLER_CSS = /* css */ `
.es-ctl {
  --es-dim: #a9b8d6;
  --es-accent: #3fb6ff;
  --es-key: #1f2a4a;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #f3f7ff); font-variant-numeric: tabular-nums;
}
.es-ctl > :not(:first-child) { margin-top: 12px; }
.es-ctl *, .es-ctl *::before, .es-ctl *::after { box-sizing: border-box; }
.es-ctl h2, .es-ctl p, .es-ctl dl, .es-ctl dd { margin: 0; }
.es-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--es-dim); }
.es-msg { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.es-big { font-size: 1.7rem; font-weight: 900; }
.es-time { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; flex: none; }
.es-time span { display: block; height: 100%; background: var(--es-accent); transform-origin: left center; }
@keyframes es-drain { to { transform: scaleX(0); } }
.es-q { font-size: 1.1rem; font-weight: 800; line-height: 1.3; color: #dce8ff; }
.es-display {
  display: flex; align-items: baseline; justify-content: flex-end; min-height: 72px; padding: 10px 16px;
  border-radius: 18px; background: rgba(0,0,0,0.3); box-shadow: inset 0 0 0 2px rgba(63,182,255,0.5); overflow: hidden;
}
.es-display__num { font-size: 2.4rem; font-weight: 900; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: ltr; }
.es-display.is-empty .es-display__num { color: rgba(255,255,255,0.3); }
.es-display__unit { font-size: 1.3rem; font-weight: 800; color: var(--es-accent); margin-left: 10px; white-space: nowrap; }
.es-pad { flex: 1; display: grid; grid-template-columns: 1fr 1fr 1fr; grid-auto-rows: 1fr; grid-gap: 8px; gap: 8px; min-height: 220px; }
.es-key {
  margin: 0; padding: 0; border: 0; border-radius: 16px; font: inherit; font-size: 1.8rem; font-weight: 800;
  color: #fff; background: var(--es-key); box-shadow: inset 0 -4px 0 rgba(0,0,0,0.3); cursor: pointer; min-height: 52px;
  touch-action: manipulation; user-select: none; -webkit-user-select: none;
}
.es-key:active { transform: scale(0.96); background: #2b3a63; }
.es-key.is-del { font-size: 1.5rem; background: #3a2340; }
.es-key:disabled { opacity: 0.25; background: transparent; box-shadow: none; }
.es-done {
  flex: none; min-height: 60px; margin: 0; border: 0; border-radius: 18px; font: inherit; font-size: 1.4rem; font-weight: 900;
  color: #04121e; background: var(--es-accent); box-shadow: inset 0 -5px 0 rgba(0,0,0,0.22); cursor: pointer; touch-action: manipulation;
}
.es-done:disabled { opacity: 0.35; }
.es-done:not(:disabled):active { transform: scale(0.98); }
.es-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: 22px; background: rgba(63,182,255,0.16); box-shadow: inset 0 0 0 2px var(--es-accent); padding: 20px;
}
.es-locked span { font-weight: 800; color: var(--es-dim); }
.es-locked strong { font-size: 2.4rem; font-weight: 900; margin-top: 6px; word-break: break-all; }
.es-locked small { margin-top: 14px; font-size: 1rem; color: var(--es-dim); }
.es-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.es-result > strong { font-size: 1.9rem; font-weight: 900; }
.es-result.is-good > strong { color: #3ddc84; }
.es-result > span { margin-top: 10px; font-size: 1.1rem; color: var(--es-dim); }
.es-facts { display: grid; grid-template-columns: auto auto; grid-gap: 6px 14px; gap: 6px 14px; margin-top: 16px !important; font-size: 1.15rem; text-align: left; }
.es-facts dt { color: var(--es-dim); font-weight: 700; }
.es-facts dd { font-weight: 900; }
.es-gain { font-size: 2.2rem !important; font-weight: 900; color: #ffd24d !important; margin-top: 14px !important; }
`;
