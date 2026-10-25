// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
// Antwort-Buttons als Grid (Grid-gap ist auch in alten WebViews erlaubt); bis 9 Antworten passen ohne Scrollen.
export const CONTROLLER_CSS = /* css */ `
.fl-ctl {
  --fl-dim: #b9b3d6;
  --fl-accent: #ff8a3d;
  --fl-good: #3ddc84;
  --fl-lie: #ff4f6d;
  --fl-btn: #2a2149;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #f7f3ff); font-variant-numeric: tabular-nums;
}
.fl-ctl > :not(:first-child) { margin-top: 10px; }
.fl-ctl *, .fl-ctl *::before, .fl-ctl *::after { box-sizing: border-box; }
.fl-ctl h2, .fl-ctl p, .fl-ctl dl, .fl-ctl dd { margin: 0; }
.fl-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--fl-dim); }
.fl-msg { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.fl-msg__icon { font-size: 3.4rem; margin-bottom: 12px; }
.fl-big { font-size: 1.7rem; font-weight: 900; }
.fl-double { text-align: center; font-weight: 900; color: #1a1400; background: #ffd24d; border-radius: 99px; padding: 4px 12px; }
.fl-time { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; flex: none; }
.fl-time span { display: block; height: 100%; background: var(--fl-accent); transform-origin: left center; }
@keyframes fl-drain { to { transform: scaleX(0); } }
.fl-q { font-size: 1.25rem; font-weight: 800; line-height: 1.3; color: #ece6ff; }
.fl-q--small { font-size: 1rem; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; flex: none; }
.fl-q--small.is-dense { -webkit-line-clamp: 2; font-size: 0.92rem; }
.fl-lead { font-weight: 800; color: var(--fl-accent); }

/* Schreiben */
.fl-form { display: flex; flex-direction: column; }
.fl-form > :not(:first-child) { margin-top: 10px; }
.fl-label { display: flex; justify-content: space-between; align-items: baseline; font-weight: 800; color: var(--fl-dim); }
.fl-counter { font-size: 0.95rem; font-weight: 700; }
.fl-counter.is-over { color: var(--fl-lie); }
.fl-input {
  width: 100%; margin: 0; padding: 14px 16px; border: 2px solid rgba(255,138,61,0.55); border-radius: 16px; outline: none;
  font: inherit; font-size: 1.4rem; font-weight: 800; color: #fff; background: rgba(0,0,0,0.3);
}
.fl-input:focus { border-color: var(--fl-accent); box-shadow: 0 0 0 3px rgba(255,138,61,0.25); }
.fl-input::placeholder { color: rgba(255,255,255,0.35); font-weight: 600; }
.fl-rejected {
  padding: 10px 14px; border-radius: 14px; font-weight: 800; color: #ffd6dd;
  background: rgba(255,79,109,0.18); box-shadow: inset 0 0 0 2px var(--fl-lie); animation: fl-shake 0.4s;
}
.fl-submit {
  min-height: 60px; margin: 0; border: 0; border-radius: 18px; font: inherit; font-size: 1.4rem; font-weight: 900;
  color: #1e0d00; background: var(--fl-accent); box-shadow: inset 0 -5px 0 rgba(0,0,0,0.22); cursor: pointer; touch-action: manipulation;
}
.fl-submit:disabled { opacity: 0.35; }
.fl-submit:not(:disabled):active { transform: scale(0.98); }
.fl-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: 22px; background: rgba(255,138,61,0.14); box-shadow: inset 0 0 0 2px var(--fl-accent); padding: 20px;
}
.fl-locked span { font-weight: 800; color: var(--fl-dim); }
.fl-locked strong { font-size: 1.9rem; font-weight: 900; margin-top: 6px; word-break: break-word; }
.fl-locked small { margin-top: 14px; font-size: 1rem; color: var(--fl-dim); }

/* Wählen */
.fl-btns { flex: 1; display: grid; grid-template-columns: 1fr; grid-auto-rows: minmax(48px, 1fr); grid-gap: 8px; gap: 8px; min-height: 0; }
/* Ab 6 Antworten zwei Spalten, damit auch 9 Antworten auf ein kleines Handy passen. */
.fl-btns.is-dense { flex: none; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(46px, auto); grid-gap: 6px; gap: 6px; }
.fl-btns.is-dense .fl-btn { padding: 4px 6px; border-radius: 12px; overflow: hidden; }
.fl-btns.is-dense .fl-btn__own { font-size: 0.6rem; }
.fl-btn {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0; padding: 6px 12px;
  border: 0; border-radius: 14px; font: inherit; color: #fff; background: var(--fl-btn); text-align: center;
  box-shadow: inset 0 0 0 2px rgba(255,138,61,0.4), inset 0 -4px 0 rgba(0,0,0,0.3); cursor: pointer; touch-action: manipulation; min-height: 0;
}
.fl-btn__text { font-size: 1.1rem; font-weight: 800; line-height: 1.2; word-break: break-word; -webkit-hyphens: auto; hyphens: auto; }
.fl-btns.is-dense .fl-btn__text { font-size: 0.8rem; line-height: 1.12; }
.fl-btn:active:not(:disabled) { transform: scale(0.98); background: #3a2e66; }
.fl-btn.is-own { background: repeating-linear-gradient(135deg, #2a2149, #2a2149 10px, #31274f 10px, #31274f 20px); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.15); cursor: default; }
.fl-btn.is-own .fl-btn__text { opacity: 0.5; }
.fl-btn__own { font-size: 0.75rem; font-weight: 900; color: #ffc08f; text-transform: uppercase; letter-spacing: 0.05em; }
.fl-btn.is-picked { background: var(--fl-accent); color: #1e0d00; box-shadow: 0 0 0 3px #fff; }
.fl-btn.is-dim { opacity: 0.4; }

/* Ergebnis */
.fl-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.fl-result > strong { font-size: 1.7rem; font-weight: 900; line-height: 1.2; }
.fl-result.is-good > strong { color: var(--fl-good); }
.fl-result.is-bad > strong { color: var(--fl-lie); }
.fl-result > span { margin-top: 10px; font-size: 1.05rem; color: var(--fl-dim); }
.fl-facts { display: grid; grid-template-columns: auto 1fr; grid-gap: 6px 12px; gap: 6px 12px; margin-top: 16px !important; font-size: 1.05rem; text-align: left; }
.fl-facts dt { color: var(--fl-dim); font-weight: 700; }
.fl-facts dd { font-weight: 900; word-break: break-word; }
.fl-fooled { font-weight: 800; color: #ffd0ad !important; }
.fl-award { font-weight: 900; color: #ffd24d !important; }
.fl-gain { font-size: 2.2rem !important; font-weight: 900; color: #ffd24d !important; margin-top: 14px !important; }
@keyframes fl-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
`;
