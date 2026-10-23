// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
export const TV_CSS = /* css */ `
.bb-tv {
  --bb-dim: #aaa1d2;
  --bb-panel: #1d1838;
  --bb-board: 34rem;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 1.2rem 3rem 0; color: #f8f4ff;
  background: radial-gradient(70rem 40rem at 50% 0%, rgba(255,138,61,0.14), rgba(255,138,61,0) 70%), var(--bg, #120f24);
  font-variant-numeric: tabular-nums;
}
.bb-tv *, .bb-tv *::before, .bb-tv *::after { box-sizing: border-box; }
.bb-tv h1, .bb-tv p { margin: 0; }
.bb-tv--quad { --bb-board: 20rem; }
.bb-tv--many { --bb-board: 16rem; }

.bb-tv__head { height: 6rem; display: flex; align-items: center; justify-content: center; position: relative; width: 100%; }
.bb-tv__title { position: absolute; left: 0; top: 1.4rem; font-size: 2rem; font-weight: 900; color: var(--bb-dim); }
.bb-tv__clock { font-size: 3.6rem; font-weight: 900; letter-spacing: 0.05em; }
.bb-tv__clock.is-hurry { color: #ff5a5f; animation: bb-pulse 1s ease-in-out infinite; }
.bb-tv__banner {
  font-size: 3rem; font-weight: 900; padding: 0.6rem 2.6rem; border-radius: 99rem;
  background: var(--c); color: #120f24; box-shadow: 0 0 2.5rem var(--c); animation: bb-pop 0.5s cubic-bezier(.3,1.6,.5,1) both;
}
@keyframes bb-pulse { 50% { transform: scale(1.08); } }
@keyframes bb-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }

.bb-tv__boards { display: flex; flex-wrap: wrap; justify-content: center; align-content: flex-start; width: 100%; }
.bb-panel {
  width: calc(var(--bb-board) + 2.4rem); margin: 0 1rem 1.2rem; padding: 1rem 1.2rem 0.8rem;
  border-radius: 1.4rem; background: var(--bb-panel); border: 0.22rem solid transparent;
  transition: opacity 0.4s, border-color 0.3s;
}
.bb-tv--duo .bb-panel { margin: 0 3rem; }
.bb-panel.is-out { opacity: 0.55; }
.bb-panel.is-winner { border-color: var(--c); box-shadow: 0 0 2.4rem var(--c); opacity: 1; }
.bb-panel__head { display: flex; align-items: center; font-size: 1.6rem; font-weight: 800; }
.bb-tv--many .bb-panel__head { font-size: 1.3rem; }
.bb-panel__avatar {
  width: 2.4em; height: 2.4em; flex: none; border-radius: 50%; margin-right: 0.6em;
  display: flex; align-items: center; justify-content: center; background: var(--c); font-size: 0.8em;
}
.bb-panel__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-panel__rank { color: var(--c); margin-left: 0.6em; }
.bb-panel__score { position: relative; font-size: 2.6rem; font-weight: 900; margin: 0.2rem 0 0.5rem !important; }
.bb-tv--many .bb-panel__score { font-size: 1.9rem; margin: 0 0 0.3rem !important; }
.bb-panel__gain { position: absolute; right: 0; top: 0.4rem; font-size: 1.5rem; color: #ffd84d; animation: bb-rise 1.4s ease-out both; }
@keyframes bb-rise { 0% { opacity: 0; transform: translateY(0.8rem); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-1.2rem); } }
.bb-panel__board { position: relative; width: var(--bb-board); font-size: 1rem; }
.bb-tv--duo .bb-panel__board { font-size: 1.6rem; }
.bb-tv--many .bb-panel__board { font-size: 0.7rem; }
.bb-panel__veil {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 0.7em;
  display: flex; align-items: center; justify-content: center; text-align: center; padding: 1rem;
  background: rgba(18,15,36,0.6); font-size: 1.8rem; font-weight: 800; color: var(--bb-dim);
}
.bb-panel__combo {
  position: absolute; top: 40%; left: 0; width: 100%; text-align: center; font-size: 2.6rem; font-weight: 900;
  color: #ffd84d; text-shadow: 0 0.2rem 1rem rgba(0,0,0,0.8); animation: bb-combo 1.3s ease-out both; pointer-events: none;
}
@keyframes bb-combo { 0% { opacity: 0; transform: scale(0.5); } 20% { opacity: 1; transform: scale(1.15); } 70% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }
.bb-panel__foot { font-size: 1.3rem; color: var(--bb-dim); margin-top: 0.5rem !important; min-height: 1.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bb-panel__attack { color: #ff8a3d; font-weight: 800; animation: bb-pop 0.4s both; }

.bb-tv__countdown {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(18,15,36,0.82); text-align: center;
}
.bb-tv__count { font-size: 14rem; font-weight: 900; line-height: 1; color: #ff8a3d; animation: bb-pop 0.5s both; }
.bb-tv__countdown p { font-size: 2.6rem; font-weight: 800; margin-top: 1rem; }
.bb-tv__countdown .bb-tv__rules { font-size: 1.8rem; font-weight: 600; color: var(--bb-dim); margin-top: 0.8rem; }
@media (prefers-reduced-motion: reduce) {
  .bb-tv__clock.is-hurry, .bb-tv__banner, .bb-panel__gain, .bb-panel__combo, .bb-tv__count, .bb-panel__attack { animation: none; }
}
`;
