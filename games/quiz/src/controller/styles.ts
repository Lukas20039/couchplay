// Stylesheet der Controller-View (Hochformat, Daumenbedienung).
export const CONTROLLER_CSS = /* css */ `
.qz-pad {
  --qz-bg: #110c22;
  --qz-panel: #1d1638;
  --qz-ink: #f4f1ff;
  --qz-dim: #a69fc4;
  --qz-good: #22b864;
  --qz-bad: #3a1526;
  --qz-a0: #e23d51;
  --qz-a1: #2e6be6;
  --qz-a2: #f4b400;
  --qz-a3: #1e9e5a;
  box-sizing: border-box;
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex; flex-direction: column;
  padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
  gap: 12px;
  color: var(--qz-ink);
  background: var(--qz-bg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums;
  -webkit-tap-highlight-color: transparent;
  user-select: none; -webkit-user-select: none;
}
.qz-pad *, .qz-pad *::before, .qz-pad *::after { box-sizing: border-box; }
.qz-pad h1, .qz-pad h2, .qz-pad p { margin: 0; }

.qz-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; color: var(--qz-dim); padding: 2px 4px; }
.qz-top strong { color: var(--qz-ink); font-size: 17px; }
.qz-time { height: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
.qz-time span { display: block; height: 100%; background: var(--qz-ink); transform-origin: left center; }
@keyframes qz-drain { to { transform: scaleX(0); } }

.qz-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px; }
.qz-btn {
  appearance: none; border: 0; margin: 0; font: inherit; color: #fff; cursor: pointer;
  border-radius: 18px; padding: 14px 10px 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  min-height: 120px;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.22);
  transition: transform 0.08s;
}
.qz-btn:active { transform: scale(0.97); }
.qz-btn:focus-visible { outline: 4px solid #fff; outline-offset: 3px; }
.qz-btn.a0 { background: var(--qz-a0); } .qz-btn.a1 { background: var(--qz-a1); }
.qz-btn.a2 { background: var(--qz-a2); color: #261b00; } .qz-btn.a3 { background: var(--qz-a3); }
.qz-btn .qz-shape { width: 30%; max-width: 88px; min-width: 48px; aspect-ratio: 1; fill: currentColor; }
.qz-btn-text { font-size: 14px; font-weight: 600; line-height: 1.2; text-align: center; opacity: 0.92; overflow-wrap: anywhere; }
.qz-btn:disabled { cursor: default; }

/* Gesperrt */
.qz-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  border-radius: 22px; text-align: center; padding: 24px;
}
.qz-locked.a0 { background: var(--qz-a0); } .qz-locked.a1 { background: var(--qz-a1); }
.qz-locked.a2 { background: var(--qz-a2); color: #261b00; } .qz-locked.a3 { background: var(--qz-a3); }
.qz-locked .qz-shape { width: 120px; height: 120px; fill: currentColor; }
.qz-locked h2 { font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 10px; }
.qz-locked p { font-size: 16px; opacity: 0.85; }
.qz-locked .qz-chosen { font-size: 18px; font-weight: 700; opacity: 1; }
.qz-lock-icon { width: 26px; height: 26px; fill: currentColor; }

/* Ergebnis */
.qz-result {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  border-radius: 22px; padding: 28px 20px; text-align: center;
  background: var(--qz-panel);
  animation: qz-pop 0.35s cubic-bezier(.2,.9,.3,1.3) both;
}
.qz-result.is-good { background: var(--qz-good); color: #04170b; }
.qz-result.is-bad { background: var(--qz-bad); box-shadow: inset 0 0 0 3px #ff6b7d; }
.qz-result.is-bad h2 { color: #ff8fa0; }
.qz-result h2 { font-size: 40px; font-weight: 900; letter-spacing: -0.02em; }
.qz-result .qz-big { font-size: 56px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
.qz-result p { font-size: 18px; }
.qz-result .qz-soft { opacity: 0.8; font-size: 16px; }
.qz-right {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: 14px; background: rgba(0, 0, 0, 0.22); font-size: 16px; font-weight: 600;
  max-width: 100%;
}
.qz-right .qz-shape { width: 26px; height: 26px; flex: none; }
.qz-right.a0 .qz-shape { fill: var(--qz-a0); } .qz-right.a1 .qz-shape { fill: var(--qz-a1); }
.qz-right.a2 .qz-shape { fill: var(--qz-a2); } .qz-right.a3 .qz-shape { fill: var(--qz-a3); }
.qz-place { font-size: 22px; font-weight: 800; }
@keyframes qz-pop { from { transform: scale(0.92); opacity: 0; } to { transform: none; opacity: 1; } }

.qz-info { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; padding: 24px; }
.qz-info h2 { font-size: 30px; font-weight: 800; }
.qz-info p { font-size: 17px; color: var(--qz-dim); max-width: 28ch; }
.qz-info .qz-big { font-size: 64px; font-weight: 900; letter-spacing: -0.03em; color: var(--qz-ink); }
.qz-mini-shapes { display: flex; gap: 10px; }
.qz-mini-shapes .qz-shape { width: 34px; height: 34px; }
.qz-mini-shapes .a0 { fill: var(--qz-a0); } .qz-mini-shapes .a1 { fill: var(--qz-a1); }
.qz-mini-shapes .a2 { fill: var(--qz-a2); } .qz-mini-shapes .a3 { fill: var(--qz-a3); }

.qz-error { padding: 10px 14px; border-radius: 12px; background: rgba(255, 107, 125, 0.18); color: #ffb4bd; font-size: 15px; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .qz-pad *, .qz-pad *::before, .qz-pad *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
`;
