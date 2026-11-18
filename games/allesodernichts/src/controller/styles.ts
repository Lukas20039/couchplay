// Stylesheet der Controller-View (Hochformat, Daumenbedienung).
// Chrome-64-kompatibel: kein gap in Flexbox, kein inset/clamp/aspect-ratio.
export const CONTROLLER_CSS = /* css */ `
.an-pad {
  --an-bg: #140d0a;
  --an-panel: #2a1a12;
  --an-ink: #fff6ee;
  --an-dim: #c4a99a;
  --an-accent: #ff9f1c;
  --an-good: #22b864;
  --an-bad: #e5484d;
  --an-a0: #e23d51;
  --an-a1: #2e6be6;
  --an-a2: #f4b400;
  --an-a3: #1e9e5a;
  box-sizing: border-box;
  position: relative;
  /* Füllt den Container der App (Stage) statt des Viewports – sonst rutschen Buttons unter SelfBar/Kopf. */
  flex: 1;
  min-height: 0;
  display: flex; flex-direction: column;
  padding: max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
  color: var(--an-ink);
  background: var(--an-bg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums;
  -webkit-tap-highlight-color: transparent;
  user-select: none; -webkit-user-select: none;
}
.an-pad > :not(:first-child) { margin-top: 12px; }
.an-pad *, .an-pad *::before, .an-pad *::after { box-sizing: border-box; }
.an-pad h1, .an-pad h2, .an-pad p, .an-pad ul { margin: 0; }

.an-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 15px; color: var(--an-dim); padding: 2px 4px; }
.an-top strong { color: var(--an-ink); font-size: 17px; }
.an-time { height: 6px; border-radius: 6px; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
.an-time span { display: block; height: 100%; background: var(--an-ink); transform-origin: left center; }
@keyframes an-drain { to { transform: scaleX(0); } }

/* Tippen */
.an-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px; min-height: 0; }
.an-btn {
  appearance: none; border: 0; margin: 0; font: inherit; color: #fff; cursor: pointer;
  border-radius: 18px; padding: 12px 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 104px;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.22);
  transition: transform 0.08s;
}
.an-btn > :not(:first-child) { margin-top: 10px; }
.an-btn:active { transform: scale(0.97); }
.an-btn:focus-visible, .an-abstain:focus-visible, .an-choice:focus-visible { outline: 4px solid #fff; outline-offset: 3px; }
.an-btn.a0 { background: var(--an-a0); } .an-btn.a1 { background: var(--an-a1); }
.an-btn.a2 { background: var(--an-a2); color: #261b00; } .an-btn.a3 { background: var(--an-a3); }
.an-btn .an-shape { width: 26%; max-width: 70px; min-width: 40px; height: auto; fill: currentColor; }
.an-btn-text { font-size: 15px; font-weight: 700; line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
.an-btn:disabled, .an-abstain:disabled, .an-choice:disabled { cursor: default; opacity: 0.6; }
.an-abstain {
  appearance: none; margin: 0; font: inherit; cursor: pointer;
  display: flex; align-items: baseline; justify-content: center;
  padding: 14px 16px; border-radius: 16px;
  background: transparent; color: var(--an-ink); border: 2px solid rgba(255, 255, 255, 0.28);
}
.an-abstain strong { font-size: 18px; }
.an-abstain span { font-size: 14px; color: var(--an-dim); margin-left: 10px; }

/* Gesperrt */
.an-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 22px; text-align: center; padding: 24px;
}
.an-locked > :not(:first-child) { margin-top: 16px; }
.an-locked.a0 { background: var(--an-a0); } .an-locked.a1 { background: var(--an-a1); }
.an-locked.a2 { background: var(--an-a2); color: #261b00; } .an-locked.a3 { background: var(--an-a3); }
.an-locked .an-shape { width: 100px; height: 100px; fill: currentColor; }
.an-locked h2 { font-size: 28px; font-weight: 800; }
.an-locked p { font-size: 16px; opacity: 0.88; }
.an-locked .an-chosen { font-size: 19px; font-weight: 700; opacity: 1; }
.an-panel {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 22px; text-align: center; padding: 24px; background: var(--an-panel);
}
.an-panel > :not(:first-child) { margin-top: 14px; }
.an-panel h2 { font-size: 28px; font-weight: 800; }
.an-panel p { font-size: 16px; color: var(--an-dim); }

/* Stand während der Eliminationen */
.an-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  padding: 18px 16px; border-radius: 20px; background: var(--an-panel);
  animation: an-pop 0.35s cubic-bezier(.2,.9,.3,1.3) both;
}
.an-state > :not(:first-child) { margin-top: 8px; }
.an-state h2 { font-size: 28px; font-weight: 900; letter-spacing: -0.01em; }
.an-state p { font-size: 15px; color: var(--an-dim); }
.an-state.is-in { background: rgba(255, 159, 28, 0.18); box-shadow: inset 0 0 0 2px var(--an-accent); }
.an-state.is-in h2 { color: var(--an-accent); }
.an-state.is-cashed { background: rgba(34, 184, 100, 0.2); box-shadow: inset 0 0 0 2px var(--an-good); }
.an-state.is-cashed h2 { color: #8ff0b9; }
.an-state.is-out { background: rgba(229, 72, 77, 0.22); box-shadow: inset 0 0 0 2px var(--an-bad); }
.an-state.is-out h2 { color: #ff9a9d; font-size: 40px; }
.an-state.is-pulse { animation: an-pulse 1.1s ease-in-out infinite; }
@keyframes an-pulse { 0%, 100% { transform: none; } 50% { transform: scale(1.03); } }

.an-list { list-style: none; padding: 0; display: flex; flex-direction: column; }
.an-list li {
  display: flex; align-items: center;
  padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.06);
  font-size: 15px; font-weight: 600; transition: opacity 0.3s;
}
.an-list li + li { margin-top: 8px; }
.an-list li > :not(:first-child) { margin-left: 10px; }
.an-list li span { flex: 1; overflow-wrap: anywhere; }
.an-list li em { font-style: normal; font-size: 12px; font-weight: 800; color: var(--an-accent); white-space: nowrap; }
.an-list .an-shape { width: 22px; height: 22px; flex: none; }
.an-list .a0 .an-shape { fill: var(--an-a0); } .an-list .a1 .an-shape { fill: var(--an-a1); }
.an-list .a2 .an-shape { fill: var(--an-a2); } .an-list .a3 .an-shape { fill: var(--an-a3); }
.an-list li.is-mine { box-shadow: inset 0 0 0 2px var(--an-accent); background: rgba(255, 159, 28, 0.12); }
.an-list li.is-struck { opacity: 0.35; }
.an-list li.is-struck span { text-decoration: line-through; }
.an-list li.is-correct { background: rgba(34, 184, 100, 0.25); box-shadow: inset 0 0 0 2px var(--an-good); opacity: 1; }

/* Entscheidung */
.an-ask { font-size: 24px; font-weight: 900; text-align: center; color: var(--an-accent); }
.an-choices { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.an-pad > .an-choices { margin-top: auto; }
.an-choice {
  appearance: none; border: 0; margin: 0; font: inherit; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 112px; padding: 14px 8px; border-radius: 20px;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.22);
  transition: transform 0.08s;
}
.an-choice > :not(:first-child) { margin-top: 6px; }
.an-choice:active { transform: scale(0.97); }
.an-choice strong { font-size: 21px; font-weight: 900; }
.an-choice span { text-align: center; }
.an-choice span { font-size: 16px; font-weight: 700; opacity: 0.9; }
.an-choice.is-cash { background: var(--an-good); color: #04170b; }
.an-choice.is-stay { background: var(--an-accent); color: #2b1600; }
.an-note { font-size: 13px; color: var(--an-dim); text-align: center; }

/* Ergebnis */
.an-result {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 22px; padding: 24px 18px; text-align: center;
  background: var(--an-panel);
  animation: an-pop 0.35s cubic-bezier(.2,.9,.3,1.3) both;
}
.an-result > :not(:first-child) { margin-top: 12px; }
.an-result.is-good { background: var(--an-good); color: #04170b; }
.an-result.is-cashed { background: rgba(34, 184, 100, 0.22); box-shadow: inset 0 0 0 3px var(--an-good); }
.an-result.is-bad { background: #3a1517; box-shadow: inset 0 0 0 3px #ff6b6f; }
.an-result.is-bad h2 { color: #ff9a9d; }
.an-result h2 { font-size: 36px; font-weight: 900; letter-spacing: -0.02em; }
.an-result .an-big { font-size: 60px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
.an-result p { font-size: 17px; }
.an-result .an-soft { opacity: 0.8; font-size: 15px; }
.an-bonus { font-weight: 800; }
.an-right {
  display: flex; align-items: center;
  padding: 10px 14px; border-radius: 14px; background: rgba(0, 0, 0, 0.22); font-size: 16px; font-weight: 600;
  max-width: 100%;
}
.an-right > :not(:first-child) { margin-left: 10px; }
.an-right .an-shape { width: 26px; height: 26px; flex: none; }
.an-right.a0 .an-shape { fill: var(--an-a0); } .an-right.a1 .an-shape { fill: var(--an-a1); }
.an-right.a2 .an-shape { fill: var(--an-a2); } .an-right.a3 .an-shape { fill: var(--an-a3); }
.an-place { font-size: 21px; font-weight: 800; }
@keyframes an-pop { from { transform: scale(0.92); opacity: 0; } to { transform: none; opacity: 1; } }

.an-info { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
.an-info > :not(:first-child) { margin-top: 16px; }
.an-info h2 { font-size: 30px; font-weight: 800; }
.an-info p { font-size: 17px; color: var(--an-dim); max-width: 28ch; }
.an-info .an-big { font-size: 64px; font-weight: 900; letter-spacing: -0.03em; color: var(--an-ink); }
.an-mini-shapes { display: flex; }
.an-mini-shapes > :not(:first-child) { margin-left: 10px; }
.an-mini-shapes .an-shape { width: 34px; height: 34px; }
.an-mini-shapes .a0 { fill: var(--an-a0); } .an-mini-shapes .a1 { fill: var(--an-a1); }
.an-mini-shapes .a2 { fill: var(--an-a2); } .an-mini-shapes .a3 { fill: var(--an-a3); }

.an-error { padding: 10px 14px; border-radius: 12px; background: rgba(255, 107, 125, 0.18); color: #ffb4bd; font-size: 15px; text-align: center; }

@media (prefers-reduced-motion: reduce) {
  .an-pad *, .an-pad *::before, .an-pad *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
`;
