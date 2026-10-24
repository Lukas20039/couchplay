// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
export const CONTROLLER_CSS = /* css */ `
.kd-ctl {
  --kd-dim: #b3a9d6;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #f8f4ff); font-variant-numeric: tabular-nums;
}
.kd-ctl > :not(:first-child) { margin-top: 14px; }
.kd-ctl *, .kd-ctl *::before, .kd-ctl *::after { box-sizing: border-box; }
.kd-ctl h2, .kd-ctl p { margin: 0; }
.kd-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--kd-dim); }
.kd-msg { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.kd-big { font-size: 1.8rem; font-weight: 900; }
.kd-time { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; }
.kd-time span { display: block; height: 100%; background: #ff5fbf; transform-origin: left center; }
@keyframes kd-drain { to { transform: scaleX(0); } }
.kd-lead { font-weight: 800; font-size: 1rem; color: var(--kd-dim); }
.kd-lead.is-hot { color: var(--c); font-size: 1.15rem; }
.kd-q { font-size: 1.35rem; font-weight: 900; line-height: 1.25; }
.kd-btns { flex: 1; display: flex; flex-direction: column; }
.kd-btn {
  flex: 1; min-height: 64px; max-height: 120px; margin: 0; padding: 10px 14px; border: 0; border-radius: 18px; font: inherit;
  display: flex; align-items: center; text-align: left; color: #fff; background: var(--a); cursor: pointer;
  box-shadow: inset 0 -5px 0 rgba(0,0,0,0.22);
}
.kd-btn:not(:first-child) { margin-top: 10px; }
.kd-btn:active { transform: scale(0.98); }
.kd-btns--2 .kd-btn { max-height: 180px; }
.kd-letter {
  width: 40px; height: 40px; flex: none; border-radius: 12px; background: rgba(0,0,0,0.22); color: #fff;
  display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.3rem; margin-right: 12px;
}
.kd-btn__text { font-size: 1.15rem; font-weight: 800; }
.kd-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: 22px; background: var(--a); color: #fff; padding: 20px;
}
.kd-locked .kd-letter { margin: 0 0 12px; width: 64px; height: 64px; font-size: 2rem; }
.kd-locked strong { font-size: 1.5rem; }
.kd-locked span:last-child { margin-top: 10px; opacity: 0.9; }
.kd-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.kd-result strong { font-size: 1.8rem; font-weight: 900; }
.kd-result.is-good strong { color: #3ddc84; }
.kd-result > span { margin-top: 10px; font-size: 1.1rem; color: var(--kd-dim); }
.kd-answer-line b { color: #fff; }
.kd-gain { font-size: 2rem !important; font-weight: 900; color: #ffd24d !important; }
`;
