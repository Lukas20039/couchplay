// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
export const CONTROLLER_CSS = /* css */ `
.bb-ctl {
  --bb-dim: #aaa1d2;
  flex: 1; display: flex; flex-direction: column; align-items: center; min-height: 0;
  color: var(--text, #f8f4ff); font-variant-numeric: tabular-nums;
  -webkit-user-select: none; user-select: none;
}
.bb-ctl > :not(:first-child) { margin-top: 10px; }
.bb-ctl *, .bb-ctl *::before, .bb-ctl *::after { box-sizing: border-box; }
.bb-ctl p { margin: 0; }

.bb-ctl__head { width: 100%; max-width: 440px; display: flex; align-items: flex-end; justify-content: space-between; }
.bb-ctl__score { font-size: 2rem; font-weight: 900; line-height: 1.05; color: var(--me); }
.bb-ctl__sub { font-size: 0.85rem; color: var(--bb-dim); }
.bb-ctl__clock { font-size: 1.6rem; font-weight: 900; }
.bb-ctl__clock.is-hurry { color: #ff5a5f; }

/* Brett so groß wie Breite und Höhe erlauben (Rest: Kopf, Status, Hand). */
.bb-ctl__boardwrap { position: relative; width: 100%; max-width: calc(100vh - 330px); min-width: 230px; }
.bb-ctl__board { font-size: 14px; }
.bb-ctl__board.shake-0 { animation: bb-shake0 0.3s; }
.bb-ctl__board.shake-1 { animation: bb-shake1 0.3s; }
@keyframes bb-shake0 { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@keyframes bb-shake1 { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.bb-ctl__veil {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 16px;
  background: rgba(18,15,36,0.72);
}
.bb-ctl__veil > span:only-child { font-size: 5rem; font-weight: 900; color: var(--me); }
.bb-ctl__veil strong { font-size: 1.6rem; font-weight: 900; }
.bb-ctl__veil span { color: var(--bb-dim); margin-top: 6px; }
.bb-ctl__veil--over strong { color: var(--me); }

.bb-ctl__msg { min-height: 2.4em; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 700; font-size: 1rem; padding: 0 8px; }

.bb-ctl__hand { width: 100%; max-width: 440px; display: flex; justify-content: space-between; }
.bb-ctl__slot {
  flex: 1; height: 104px; margin: 0; padding: 0; border: 0; border-radius: 16px; font: inherit;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); touch-action: none; cursor: grab; -webkit-tap-highlight-color: transparent;
}
.bb-ctl__slot:not(:first-child) { margin-left: 10px; }
.bb-ctl__slot:disabled { cursor: default; }
.bb-ctl__slot.is-selected { box-shadow: inset 0 0 0 3px var(--me); background: rgba(255,255,255,0.12); }
.bb-ctl__slot.is-dragging .bb-piece { opacity: 0.25; }
.bb-ctl__slot.is-blocked .bb-piece { opacity: 0.35; filter: grayscale(0.8); }
.bb-ctl__float { position: fixed; z-index: 50; pointer-events: none; filter: drop-shadow(0 8px 14px rgba(0,0,0,0.5)); }
.bb-ctl.is-out .bb-ctl__hand { opacity: 0.4; }
`;
