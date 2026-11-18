// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa). Agenten-Look wie am TV.
// Die Rollenkarte ist verdeckt „STRENG GEHEIM“ und zeigt das Geheimnis nur beim Halten/Antippen.
export const CONTROLLER_CSS = /* css */ `
.sp-ctl {
  --sp-dim: #9fb0c8;
  --sp-accent: #e63946;
  --sp-good: #3ddc84;
  --sp-gold: #ffd24d;
  --sp-btn: #1e2a40;
  --sp-paper: #eadfc4;
  --sp-ink: #2b2118;
  --sp-mono: "Courier New", Courier, "Liberation Mono", monospace;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #eef3fb); font-variant-numeric: tabular-nums;
}
.sp-ctl > :not(:first-child) { margin-top: 10px; }
.sp-ctl *, .sp-ctl *::before, .sp-ctl *::after { box-sizing: border-box; }
.sp-ctl h2, .sp-ctl p, .sp-ctl dl, .sp-ctl dd { margin: 0; }
.sp-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--sp-dim); }
.sp-msg { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.sp-msg__icon { font-size: 3.4rem; margin-bottom: 12px; }
.sp-big { font-size: 1.7rem; font-weight: 900; }
.sp-time { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; flex: none; }
.sp-time span { display: block; height: 100%; background: var(--sp-accent); transform-origin: left center; }
@keyframes sp-drain { to { transform: scaleX(0); } }
.sp-lead { font-weight: 900; font-size: 1.2rem; color: var(--sp-accent); text-align: center; }
.sp-lead.is-runoff { color: var(--sp-gold); }
.sp-lead--turn { font-size: 1.6rem; color: var(--sp-gold); }
.sp-lead small { display: block; font-size: 0.85rem; color: var(--sp-dim); font-weight: 700; }
.sp-note { text-align: center; font-weight: 800; color: var(--sp-gold); }

/* Geheime Rolle */
.sp-secret {
  position: relative; flex: 1; min-height: 180px; display: flex; align-items: center; justify-content: center; text-align: center;
  border-radius: 20px; padding: 16px; cursor: pointer; touch-action: none; outline: none;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
  background: repeating-linear-gradient(135deg, #1a2436, #1a2436 14px, #1e2a3f 14px, #1e2a3f 28px);
  box-shadow: inset 0 0 0 2px rgba(230,57,70,0.6), 0 6px 18px rgba(0,0,0,0.35);
}
.sp-secret:focus-visible { box-shadow: inset 0 0 0 3px #fff; }
.sp-secret.is-compact { flex: none; min-height: 64px; padding: 8px 12px; border-radius: 14px; }
.sp-secret__back { display: flex; flex-direction: column; align-items: center; }
.sp-secret__back b {
  font-family: var(--sp-mono); font-size: 1.5rem; font-weight: 900; letter-spacing: 0.12em; color: var(--sp-accent);
  border: 3px solid currentColor; border-radius: 8px; padding: 2px 10px; transform: rotate(-5deg);
}
.sp-secret.is-compact .sp-secret__back b { font-size: 0.95rem; padding: 0 8px; border-width: 2px; }
.sp-secret__back small { margin-top: 12px; font-weight: 700; color: var(--sp-dim); }
.sp-secret.is-compact .sp-secret__back small { margin-top: 4px; font-size: 0.75rem; }
.sp-secret.is-shown { background: var(--sp-paper); color: var(--sp-ink); box-shadow: inset 0 0 0 3px #b9a676, 0 6px 18px rgba(0,0,0,0.35); }
.sp-secret.is-shown.is-spy { background: #3a0d13; color: #fff; box-shadow: inset 0 0 0 3px var(--sp-accent), 0 0 24px rgba(230,57,70,0.5); }
.sp-secret__face { display: flex; flex-direction: column; align-items: center; }
.sp-secret__face small { font-family: var(--sp-mono); font-weight: 900; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.75; }
.sp-secret__face em { font-style: normal; font-weight: 700; margin-top: 8px; opacity: 0.8; }
.sp-secret__face strong { font-family: var(--sp-mono); font-size: 2.2rem; font-weight: 900; line-height: 1.1; margin-top: 6px; word-break: break-word; }
.sp-secret.is-compact .sp-secret__face strong { font-size: 1.35rem; margin-top: 2px; }
.sp-secret.is-spy .sp-secret__face strong { color: #ff8a93; }

/* Buttons */
.sp-submit, .sp-pass {
  min-height: 58px; margin: 0; border: 0; border-radius: 18px; font: inherit; font-size: 1.3rem; font-weight: 900;
  color: #fff; background: var(--sp-accent); box-shadow: inset 0 -5px 0 rgba(0,0,0,0.22); cursor: pointer; touch-action: manipulation;
}
.sp-submit:disabled, .sp-pass:disabled { opacity: 0.35; }
.sp-submit:not(:disabled):active, .sp-pass:not(:disabled):active { transform: scale(0.98); }
.sp-pass { background: var(--sp-btn); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.2), inset 0 -5px 0 rgba(0,0,0,0.22); }
.sp-row { display: flex; }
.sp-row > * { flex: 1; }
.sp-row > :not(:first-child) { margin-left: 10px; }
.sp-row .sp-submit { flex: 1.6; }

/* Hinweis */
.sp-form { display: flex; flex-direction: column; }
.sp-form > :not(:first-child) { margin-top: 10px; }
.sp-label { display: flex; justify-content: space-between; align-items: baseline; font-weight: 800; color: var(--sp-dim); }
.sp-counter { font-size: 0.95rem; font-weight: 700; }
.sp-counter.is-over { color: var(--sp-accent); }
.sp-input {
  width: 100%; margin: 0; padding: 14px 16px; border: 2px solid rgba(230,57,70,0.55); border-radius: 16px; outline: none;
  font: inherit; font-size: 1.5rem; font-weight: 800; color: #fff; background: rgba(0,0,0,0.3);
}
.sp-input:focus { border-color: var(--sp-accent); box-shadow: 0 0 0 3px rgba(230,57,70,0.25); }
.sp-input::placeholder { color: rgba(255,255,255,0.35); font-weight: 600; }
.sp-warn { padding: 8px 12px; border-radius: 12px; font-weight: 800; color: #ffe7a6; background: rgba(255,210,77,0.14); }
.sp-warn.is-bad { color: #ffd6da; background: rgba(230,57,70,0.18); box-shadow: inset 0 0 0 2px var(--sp-accent); animation: sp-shake 0.4s; }
.sp-wait {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: 20px; background: rgba(255,255,255,0.04); padding: 16px;
}
.sp-wait > :not(:first-child) { margin-top: 10px; }
.sp-wait small { color: var(--sp-dim); font-weight: 700; }
.sp-wait__who { display: flex; align-items: center; }
.sp-wait__who strong { margin-left: 10px; font-size: 1.5rem; font-weight: 900; }
.sp-wait > span:last-child, .sp-wait > strong { color: var(--sp-dim); font-weight: 700; }
.sp-wait > strong { font-size: 1.2rem; color: #eef3fb; }
.sp-dot {
  width: 48px; height: 48px; flex: none; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center;
  font-size: 28px; box-shadow: 0 0 0 3px rgba(0,0,0,0.25);
}
.sp-mine { display: flex; flex-wrap: wrap; align-items: center; font-size: 0.95rem; color: var(--sp-dim); flex: none; }
.sp-mine b { margin-left: 8px; padding: 2px 10px; border-radius: 99px; background: rgba(255,255,255,0.08); color: #eef3fb; }

/* Abstimmen */
.sp-tiles { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(64px, 1fr); grid-gap: 10px; gap: 10px; min-height: 0; }
.sp-tiles--many { grid-auto-rows: minmax(56px, 1fr); grid-gap: 8px; gap: 8px; }
.sp-tile {
  position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0; padding: 6px; min-height: 0;
  border: 0; border-radius: 16px; font: inherit; color: #fff; background: var(--sp-btn); cursor: pointer; touch-action: manipulation;
  box-shadow: inset 0 0 0 3px var(--c), inset 0 -4px 0 rgba(0,0,0,0.3);
}
.sp-tile:active { transform: scale(0.97); }
.sp-tile__emoji { font-size: 2rem; line-height: 1; }
.sp-tile__name { margin-top: 4px; font-size: 1.05rem; font-weight: 900; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-tiles--many .sp-tile__emoji { font-size: 1.6rem; }
.sp-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: 22px; background: rgba(230,57,70,0.12); box-shadow: inset 0 0 0 2px var(--sp-accent); padding: 20px;
}
.sp-locked__label { font-weight: 800; color: var(--sp-dim); }
.sp-locked__who { display: flex; align-items: center; margin-top: 10px; font-size: 1.7rem; font-weight: 900; }
.sp-locked__who > span:last-child { margin-left: 10px; }
.sp-locked small { margin-top: 14px; font-size: 1rem; color: var(--sp-dim); }

/* Raten */
.sp-btns { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(52px, 1fr); grid-gap: 8px; gap: 8px; min-height: 0; }
.sp-btn {
  margin: 0; padding: 6px 8px; border: 0; border-radius: 14px; font: inherit; font-size: 1.05rem; font-weight: 900; line-height: 1.15;
  color: var(--sp-ink); background: var(--sp-paper); box-shadow: inset 0 -4px 0 rgba(0,0,0,0.2); cursor: pointer; touch-action: manipulation;
  word-break: break-word; -webkit-hyphens: auto; hyphens: auto; min-height: 0;
}
.sp-btn:active:not(:disabled) { transform: scale(0.97); }
.sp-btn.is-picked { background: var(--sp-accent); color: #fff; box-shadow: 0 0 0 3px #fff; }
.sp-btn.is-dim { opacity: 0.4; }

/* Ergebnis */
.sp-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.sp-result > strong { font-size: 1.9rem; font-weight: 900; line-height: 1.2; }
.sp-result.is-good > strong { color: var(--sp-good); }
.sp-result.is-bad > strong { color: var(--sp-accent); }
.sp-result > span { margin-top: 10px; font-size: 1.05rem; color: var(--sp-dim); }
.sp-you-spy { font-family: var(--sp-mono); font-weight: 900; color: var(--sp-accent) !important; }
.sp-facts { display: grid; grid-template-columns: auto 1fr; grid-gap: 6px 12px; gap: 6px 12px; margin-top: 16px !important; font-size: 1.1rem; text-align: left; }
.sp-facts dt { color: var(--sp-dim); font-weight: 700; }
.sp-facts dd { font-weight: 900; word-break: break-word; }
.sp-right { font-weight: 800; color: #b9f5d0 !important; }
.sp-award { font-weight: 900; color: var(--sp-gold) !important; }
.sp-gain { font-size: 2.2rem !important; font-weight: 900; color: var(--sp-gold) !important; margin-top: 14px !important; }
@keyframes sp-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
`;
