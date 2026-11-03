// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
export const CONTROLLER_CSS = /* css */ `
.zg-ctl {
  --zg-dim: #b3a9d6;
  --zg-accent: #ffb020;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #f8f4ff); font-variant-numeric: tabular-nums;
}
.zg-ctl > :not(:first-child) { margin-top: 12px; }
.zg-ctl *, .zg-ctl *::before, .zg-ctl *::after { box-sizing: border-box; }
.zg-ctl h2, .zg-ctl p { margin: 0; }
.zg-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--zg-dim); }
.zg-msg { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.zg-big { font-size: 1.8rem; font-weight: 900; }
.zg-time { height: 8px; flex: none; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; }
.zg-time span { display: block; height: 100%; background: var(--zg-accent); transform-origin: left center; }
@keyframes zg-drain { to { transform: scaleX(0); } }
.zg-lead { display: flex; align-items: center; font-weight: 800; font-size: 1.05rem; color: var(--zg-dim); }
.zg-lead.is-me { color: var(--zg-accent); font-size: 1.2rem; margin-top: 14px; }
.zg-mini { width: 30px; height: 30px; flex: none; border-radius: 50%; background: var(--c); display: inline-flex; align-items: center; justify-content: center; margin-right: 10px; font-size: 1.1rem; }

/* Wortwahl */
.zg-options { flex: 1; display: flex; flex-direction: column; margin-top: 14px; }
.zg-option {
  flex: 1; min-height: 70px; max-height: 140px; margin: 0; padding: 12px 16px; border: 0; border-radius: 18px; font: inherit;
  display: flex; flex-direction: column; align-items: center; justify-content: center; color: #1b1300; background: var(--zg-accent);
  box-shadow: inset 0 -5px 0 rgba(0,0,0,0.2); cursor: pointer;
}
.zg-option:not(:first-child) { margin-top: 12px; }
.zg-option small { font-size: 0.85rem; font-weight: 800; opacity: 0.7; }
.zg-option strong { font-size: 1.5rem; font-weight: 900; margin-top: 2px; }
.zg-option:disabled { opacity: 0.4; }
.zg-option.is-on { opacity: 1; box-shadow: 0 0 0 4px #fff; }
.zg-option:active { transform: scale(0.98); }

/* Zeichnen */
.zg-draw { flex: 1; display: flex; flex-direction: column; min-height: 0; -webkit-user-select: none; user-select: none; }
.zg-draw > :not(:first-child) { margin-top: 8px; }
.zg-wordbar { display: flex; align-items: baseline; flex-wrap: wrap; }
.zg-wordbar span { font-weight: 800; color: var(--zg-dim); margin-right: 8px; }
.zg-wordbar strong { font-size: 1.6rem; font-weight: 900; color: var(--zg-accent); line-height: 1.1; }
.zg-wordbar small { margin-left: auto; padding-left: 8px; font-weight: 700; color: var(--zg-dim); }
.zg-pad-wrap { position: relative; flex: 1 1 0; min-height: 120px; display: flex; align-items: center; justify-content: center; }
.zg-pad {
  display: block; background: #fff; border-radius: 14px; touch-action: none; -ms-touch-action: none;
  -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; box-shadow: 0 6px 20px rgba(0,0,0,0.35);
}
.zg-pad.is-locked { opacity: 0.6; }
.zg-pad-lock {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 10px 18px; border-radius: 14px;
  background: rgba(15,14,23,0.85); font-size: 1.3rem; font-weight: 900; pointer-events: none;
}
.zg-full { text-align: center; font-weight: 800; color: #ff8c8c; font-size: 0.95rem; }
.zg-tools { flex: none; padding-bottom: 2px; }
.zg-tools[aria-disabled="true"] { opacity: 0.5; pointer-events: none; }
.zg-tools__row { display: flex; align-items: center; justify-content: space-between; }
.zg-tools__row + .zg-tools__row { margin-top: 8px; }
.zg-swatch {
  width: 30px; height: 30px; flex: none; padding: 0; margin: 0; border: 0; border-radius: 50%; background: var(--sw);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.25); cursor: pointer; font-size: 1rem; line-height: 1;
}
.zg-swatch.is-on { box-shadow: 0 0 0 2px var(--bg, #0f0e17), 0 0 0 4px #fff; }
.zg-swatch--more { background: var(--sw); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.8rem; text-shadow: 0 0 3px #000; }
.zg-swatch--more.is-open { box-shadow: 0 0 0 2px var(--bg, #0f0e17), 0 0 0 4px var(--zg-accent); }
.zg-palette {
  position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 2; padding: 12px; border-radius: 18px;
  width: 100%; max-width: 344px; display: grid; grid-template-columns: repeat(8, 1fr); gap: 10px; background: rgba(15,14,23,0.94);
  box-shadow: 0 10px 30px rgba(0,0,0,0.5);
}
.zg-palette .zg-swatch { width: 100%; height: 0; padding-top: 100%; }
.zg-size, .zg-tool {
  height: 42px; margin: 0; border: 0; border-radius: 12px; background: var(--raised, #25223a); color: inherit; font: inherit;
  font-weight: 800; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.zg-size { width: 34px; flex: none; }
.zg-size span { display: block; flex: none; border-radius: 50%; box-shadow: 0 0 0 1px rgba(255,255,255,0.4); }
.zg-size.is-on { box-shadow: inset 0 0 0 3px var(--zg-accent); }
.zg-tool { flex: 1; min-width: 0; margin-left: 6px; padding: 0 2px; flex-direction: column; white-space: nowrap; overflow: hidden; line-height: 1.1; }
.zg-tool span { font-size: 1.15rem; }
.zg-tool small { font-size: 0.66rem; font-weight: 800; letter-spacing: -0.02em; }
.zg-tool--danger { color: #ff8c8c; }
.zg-tool--pick:first-child { margin-left: 0; }
.zg-tool--pick.is-on { box-shadow: inset 0 0 0 3px var(--zg-accent); color: var(--zg-accent); }
.zg-size + .zg-tool { margin-left: 8px; }
.zg-tool:disabled { opacity: 0.5; }
@media (max-width: 370px) {
  .zg-tool small { display: none; }
  .zg-tool span { font-size: 1.3rem; }
  .zg-size { width: 30px; }
  .zg-palette { gap: 7px; padding: 10px; }
}

/* Raten */
.zg-guess { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.zg-guess > :not(:first-child) { margin-top: 12px; }
.zg-hintmini { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; font-weight: 900; font-size: 1.3rem; }
.zg-hintmini b {
  width: 0.85em; height: 1.3em; margin: 0 2px; display: flex; align-items: flex-end; justify-content: center;
  border-bottom: 3px solid rgba(255,255,255,0.7); text-transform: uppercase; color: var(--zg-accent);
}
.zg-hintmini .gap { width: 0.7em; }
.zg-form { display: flex; flex: none; }
.zg-input {
  flex: 1; min-width: 0; height: 56px; padding: 0 14px; border: 2px solid var(--line, #34304d); border-radius: 16px;
  background: var(--surface, #1a1826); color: inherit; font: inherit; font-size: 16px; font-weight: 700; outline: none;
}
.zg-input:focus { border-color: var(--zg-accent); }
.zg-send {
  flex: none; height: 56px; margin-left: 8px; padding: 0 18px; border: 0; border-radius: 16px; font: inherit; font-weight: 900; font-size: 1.05rem;
  background: var(--zg-accent); color: #1b1300; cursor: pointer; min-width: 96px;
}
.zg-send:disabled { opacity: 0.45; }
.zg-close { text-align: center; font-weight: 900; font-size: 1.2rem; color: var(--zg-accent); animation: zg-shake 0.4s both; }
@keyframes zg-shake { 0%, 100% { transform: none; } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.zg-mine { list-style: none; margin: 0; padding: 0; flex: 1 1 0; min-height: 0; overflow: auto; }
.zg-mine li {
  display: inline-block; margin: 0 6px 6px 0; padding: 6px 12px; border-radius: 12px; background: var(--raised, #25223a);
  color: var(--zg-dim); font-weight: 700; text-decoration: line-through; text-decoration-color: rgba(255,90,95,0.7); max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.zg-mine li.is-close { text-decoration: none; color: var(--zg-accent); box-shadow: inset 0 0 0 2px var(--zg-accent); }
.zg-success { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border-radius: 22px; background: rgba(61,220,132,0.14); padding: 20px; }
.zg-success__icon { font-size: 4rem; animation: zg-pop 0.5s cubic-bezier(.3,1.6,.5,1) both; }
.zg-success strong { font-size: 2.2rem; font-weight: 900; color: #3ddc84; margin-top: 6px; }
.zg-success > span:last-child { margin-top: 12px; color: var(--zg-dim); font-weight: 700; }
@keyframes zg-pop { from { transform: scale(0.4); opacity: 0; } to { transform: none; opacity: 1; } }

/* Auflösung / Ende */
.zg-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.zg-result > span { color: var(--zg-dim); font-weight: 700; }
.zg-result strong { font-size: 1.8rem; font-weight: 900; }
.zg-result__word { font-size: 2.2rem !important; color: var(--zg-accent); margin-top: 4px; word-wrap: break-word; max-width: 100%; }
.zg-result__line { margin-top: 14px; font-size: 1.15rem; color: #fff !important; }
.zg-result.is-good .zg-result__line { color: #3ddc84 !important; }
.zg-gain { font-size: 2rem !important; font-weight: 900 !important; color: #ffd24d !important; margin-top: 8px; }
@media (prefers-reduced-motion: reduce) { .zg-close, .zg-success__icon { animation: none; } }
`;
