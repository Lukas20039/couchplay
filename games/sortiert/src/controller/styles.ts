// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
// Ausgelegt auf 6 Karten auf kleinen Handys (360×640): Platzleiste kompakt, Auslage zweispaltig.
// Grid-gap ist auch in alten WebViews erlaubt, Flexbox-gap nicht.
export const CONTROLLER_CSS = /* css */ `
.sc-ctl {
  --sc-dim: #a9b8d6;
  --sc-accent: #3ddc97;
  --sc-gold: #ffd24d;
  --sc-near: #ffb347;
  --sc-card: #23305a;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #f3f7ff); font-variant-numeric: tabular-nums;
}
.sc-ctl > :not(:first-child) { margin-top: 7px; }
.sc-ctl *, .sc-ctl *::before, .sc-ctl *::after { box-sizing: border-box; }
.sc-ctl h2, .sc-ctl p, .sc-ctl ol { margin: 0; }
.sc-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--sc-dim); font-size: 0.95rem; }
.sc-msg { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.sc-big { font-size: 1.7rem; font-weight: 900; }
.sc-time { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); overflow: hidden; flex: none; }
.sc-time span { display: block; height: 100%; background: var(--sc-accent); transform-origin: left center; }
@keyframes sc-drain { to { transform: scaleX(0); } }
.sc-q { font-size: 1.05rem; font-weight: 800; line-height: 1.25; color: #e3edff; }
.sc-end { font-size: 0.82rem; font-weight: 800; color: var(--sc-accent); letter-spacing: 0.01em; }
.sc-ctl > .sc-end { margin-top: 4px; }

/* Platzleiste */
.sc-slots { list-style: none; padding: 0; display: flex; flex-direction: column; flex: none; }
.sc-ctl > .sc-slots { margin-top: 4px; }
.sc-slot { display: flex; min-height: 38px; }
.sc-slot + .sc-slot { margin-top: 4px; }
.sc-slot.is-empty {
  min-height: 30px; align-items: center; padding: 0 10px 0 6px; border-radius: 12px; border: 2px dashed rgba(255,255,255,0.18); color: rgba(255,255,255,0.35);
}
.sc-slot.is-empty.is-next { border-color: var(--sc-accent); color: var(--sc-accent); }
.sc-slot__btn {
  flex: 1; display: flex; align-items: center; margin: 0; padding: 4px 10px 4px 6px; border: 0; border-radius: 12px; text-align: left;
  font: inherit; color: #fff; background: rgba(61,220,151,0.18); box-shadow: inset 0 0 0 2px rgba(61,220,151,0.6);
  cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; animation: sc-in 0.18s both;
}
.sc-slot__btn:active { transform: scale(0.98); }
.sc-slot__btn:disabled { opacity: 1; cursor: default; }
.sc-slot__no {
  width: 26px; height: 26px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 0.9rem; font-weight: 900; background: rgba(255,255,255,0.12); margin-right: 8px;
}
.sc-slot__btn .sc-slot__no { background: var(--sc-accent); color: #062417; }
.sc-slot__label { flex: 1; min-width: 0; font-size: 0.98rem; font-weight: 800; line-height: 1.15; word-break: break-word; }
.sc-slot.is-empty .sc-slot__label { font-weight: 700; font-size: 0.9rem; }
.sc-slot__x { flex: none; font-size: 1.3rem; font-weight: 900; color: var(--sc-dim); margin-left: 6px; }

/* Auslage */
.sc-pool { flex: 1 0 auto; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(42px, auto); grid-gap: 6px; gap: 6px; align-content: start; min-height: 46px; }
.sc-card {
  margin: 0; padding: 6px 8px; border: 0; border-radius: 14px; font: inherit; font-size: 0.95rem; font-weight: 800; line-height: 1.15;
  color: #fff; background: var(--sc-card); box-shadow: inset 0 -4px 0 rgba(0,0,0,0.3), inset 0 0 0 2px rgba(255,255,255,0.08);
  cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none; word-break: break-word;
}
.sc-card:active { transform: scale(0.96); background: #2e3e70; }
.sc-hint { grid-column: 1 / -1; align-self: center; text-align: center; font-size: 0.9rem; color: var(--sc-dim); }
.sc-actions { display: grid; grid-template-columns: 2fr 3fr; grid-gap: 8px; gap: 8px; flex: none; }
.sc-reset, .sc-done {
  min-height: 52px; margin: 0; border: 0; border-radius: 16px; font: inherit; font-weight: 900; cursor: pointer; touch-action: manipulation;
}
.sc-reset { font-size: 1rem; color: #fff; background: #3a2340; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.3); }
.sc-done { font-size: 1.3rem; color: #062417; background: var(--sc-accent); box-shadow: inset 0 -5px 0 rgba(0,0,0,0.22); }
.sc-reset:disabled, .sc-done:disabled { opacity: 0.35; }
.sc-done:not(:disabled):active, .sc-reset:not(:disabled):active { transform: scale(0.98); }
.sc-slots.is-locked .sc-slot__btn { background: rgba(61,220,151,0.1); box-shadow: inset 0 0 0 2px rgba(61,220,151,0.35); }
.sc-locked {
  flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: 18px; background: rgba(61,220,151,0.14); padding: 12px; min-height: 80px;
}
.sc-locked strong { font-size: 1.5rem; font-weight: 900; color: var(--sc-accent); }
.sc-locked small { margin-top: 6px; font-size: 0.95rem; color: var(--sc-dim); }

/* Ergebnis */
.sc-res { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.sc-res > :not(:first-child) { margin-top: 8px; }
.sc-res__head { display: flex; align-items: baseline; justify-content: space-between; }
.sc-res__head strong { font-size: 1.4rem; font-weight: 900; }
.sc-res.is-perfect .sc-res__head strong { color: var(--sc-gold); font-size: 1.8rem; }
.sc-gain { font-size: 1.8rem; font-weight: 900; color: var(--sc-gold); }
.sc-res__list { list-style: none; padding: 0; }
.sc-res__row { display: flex; align-items: center; padding: 5px 8px; border-radius: 12px; background: rgba(255,255,255,0.05); min-height: 40px; }
.sc-res__row + .sc-res__row { margin-top: 4px; }
.sc-res__row.is-exact { background: rgba(61,220,151,0.16); }
.sc-res__row.is-near { background: rgba(255,179,71,0.14); }
.sc-res__row.is-miss { background: rgba(255,90,95,0.12); }
.sc-res__mark { width: 26px; flex: none; text-align: center; font-size: 1.1rem; font-weight: 900; }
.sc-res__row.is-near .sc-res__mark { color: var(--sc-near); font-size: 1.4rem; }
.sc-res__text { flex: 1; min-width: 0; display: flex; flex-direction: column; margin-left: 6px; line-height: 1.15; }
.sc-res__label { font-weight: 800; font-size: 0.95rem; word-break: break-word; }
.sc-res__label.is-empty { color: var(--sc-dim); font-weight: 700; }
.sc-res__correct { font-size: 0.78rem; color: var(--sc-dim); }
.sc-res__value { flex: none; font-weight: 900; font-size: 0.95rem; color: var(--sc-gold); margin-left: 8px; white-space: nowrap; }
.sc-res__rank { text-align: center; color: var(--sc-dim); font-weight: 800; }
.sc-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.sc-result > strong { font-size: 1.9rem; font-weight: 900; }
.sc-result > span { margin-top: 10px; font-size: 1.1rem; color: var(--sc-dim); }
.sc-result > .sc-gain { font-size: 2.2rem; color: var(--sc-gold); }
@keyframes sc-in { from { transform: scale(0.92); opacity: 0.4; } to { transform: none; opacity: 1; } }
@media (max-height: 680px) {
  .sc-q { font-size: 0.98rem; }
  .sc-slot, .sc-res__row { min-height: 34px; }
  .sc-slot.is-empty { min-height: 26px; }
  .sc-slot__no { width: 22px; height: 22px; font-size: 0.8rem; }
  .sc-slot__label { font-size: 0.92rem; }
  .sc-pool { grid-auto-rows: minmax(38px, auto); }
  .sc-card { font-size: 0.9rem; }
  .sc-reset, .sc-done { min-height: 46px; }
}
@media (max-height: 600px) {
  .sc-ctl > :not(:first-child) { margin-top: 5px; }
  .sc-ctl > .sc-end, .sc-ctl > .sc-slots { margin-top: 3px; }
  .sc-slot.is-empty { min-height: 24px; }
  .sc-pool { grid-auto-rows: minmax(36px, auto); }
  .sc-reset, .sc-done { min-height: 42px; }
}
`;
