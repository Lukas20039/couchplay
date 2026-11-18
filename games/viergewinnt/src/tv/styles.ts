// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity
// und stroke-dashoffset.
export const TV_CSS = /* css */ `
.c4-tv {
  --c4-ink: #f8f4ff;
  --c4-dim: #aaa1d2;
  --c4-panel: #1d1838;
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c4-ink);
  background:
    radial-gradient(50rem 40rem at 50% 55%, rgba(36, 87, 214, 0.18), rgba(36, 87, 214, 0) 70%),
    var(--bg, #120f24);
  font-variant-numeric: tabular-nums;
}
.c4-tv *, .c4-tv *::before, .c4-tv *::after { box-sizing: border-box; }
.c4-tv h2, .c4-tv p { margin: 0; }

/* ---------- Mitte: Brett ---------- */
.c4-tv__center { margin: 0 3rem; display: flex; flex-direction: column; align-items: center; flex: none; }
.c4-tv__round { font-size: 2rem; font-weight: 700; color: var(--c4-dim); margin-bottom: 0.4rem; white-space: nowrap; }
.c4-tv__sep { margin-left: 1.4rem; padding-left: 1.4rem; border-left: 0.15rem solid rgba(232, 226, 255, 0.2); }
.c4-tv__board { flex: none; transition: opacity 0.4s; }
.c4-tv--paused .c4-tv__board { opacity: 0.4; }

.c4-timer { width: 70%; height: 0.7rem; margin-top: 1rem; border-radius: 0.35rem; background: rgba(255,255,255,0.08); overflow: hidden; opacity: 0; transition: opacity 0.3s; }
.c4-timer.is-on { opacity: 1; }
.c4-timer span { display: block; width: 100%; height: 100%; transform-origin: 0 50%; transition: transform 0.25s linear; }
.c4-timer.is-low span { animation: c4-blink 0.5s ease-in-out infinite alternate; }

/* ---------- Status unter dem Brett ---------- */
.c4-status, .c4-banner {
  height: 6rem; margin-top: 0.8rem;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; white-space: nowrap;
}
.c4-status { font-size: 2.4rem; font-weight: 700; }
.c4-status__note { font-size: 1.7rem; color: #ffb15c; margin-bottom: 0.3rem; animation: c4-pop 0.4s cubic-bezier(.3,1.6,.5,1) both; }
.c4-status__turn { display: flex; align-items: center; }
.c4-status__dot { width: 1.3rem; height: 1.3rem; border-radius: 50%; margin-right: 1.1rem; background: var(--c); animation: c4-pulse-dot 1.4s ease-in-out infinite; }
.c4-status--round strong { font-size: 3rem; font-weight: 900; animation: c4-pop 0.5s cubic-bezier(.3,1.6,.5,1) 0.5s both; }
.c4-status--round span { font-size: 1.6rem; color: var(--c4-dim); margin-top: 0.3rem; }
.c4-status--paused { color: var(--c4-dim); }
.c4-pause { display: flex; }
.c4-pause i { display: block; width: 1.2rem; height: 4rem; margin: 0 0.5rem; border-radius: 0.4rem; background: currentColor; }
.c4-banner {
  padding: 0 3.4rem; border-radius: 3rem; font-size: 3.4rem; font-weight: 900; flex-direction: row;
  color: #120f24; background: var(--c, #f8f4ff); box-shadow: 0 0 3rem var(--c, rgba(255,255,255,0.4));
  animation: c4-pop 0.5s cubic-bezier(.3,1.6,.5,1) 0.6s both;
}
.c4-banner--draw { background: var(--c4-ink); }
@keyframes c4-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes c4-pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }
@keyframes c4-blink { from { opacity: 1; } to { opacity: 0.35; } }

/* ---------- Spieler-Karten ---------- */
.c4-card {
  width: 22rem; flex: none;
  padding: 2.6rem 1.6rem 2.2rem;
  border-radius: 2.4rem;
  background: var(--c4-panel);
  border: 0.35rem solid rgba(255, 255, 255, 0.06);
  display: flex; flex-direction: column; align-items: center; text-align: center;
  opacity: 0.62; transform: scale(0.96);
  transition: transform 0.35s cubic-bezier(.2,.8,.3,1), opacity 0.35s, border-color 0.35s, box-shadow 0.35s;
}
.c4-card.is-active, .c4-card.is-winner { opacity: 1; transform: scale(1.02); border-color: var(--c); }
.c4-card.is-winner { transform: scale(1.06); box-shadow: 0 0 2.6rem var(--c); }
.c4-card.is-loser { opacity: 0.4; }
.c4-card__avatar {
  width: 9.5rem; height: 9.5rem; border-radius: 50%;
  border: 0.45rem solid var(--c); background: rgba(255, 255, 255, 0.05);
  display: flex; align-items: center; justify-content: center; font-size: 5.4rem; line-height: 1;
}
.c4-card.is-offline .c4-card__avatar { filter: grayscale(1); opacity: 0.5; }
.c4-card__name { margin-top: 1.4rem !important; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 2.8rem; font-weight: 800; }
.c4-card__sub { height: 2.2rem; margin-top: 0.3rem !important; font-size: 1.6rem; color: var(--c4-dim); }
.c4-card__disc {
  width: 5.6rem; height: 5.6rem; margin: 1rem 0 0.8rem; border-radius: 50%;
  background: var(--c); box-shadow: inset 0 0 0 0.8rem rgba(0,0,0,0.18), 0 0.3rem 1rem rgba(0,0,0,0.4);
}
.c4-card__pips { height: 2.4rem; display: flex; justify-content: center; align-items: center; }
.c4-card__pips i { display: block; width: 1.8rem; height: 1.8rem; margin: 0 0.4rem; border-radius: 50%; border: 0.25rem solid var(--c); opacity: 0.55; transition: background 0.3s, opacity 0.3s, transform 0.3s; }
.c4-card__pips i.is-on { background: var(--c); opacity: 1; transform: scale(1.15); }
.c4-card__turn {
  margin-top: 1.4rem !important; height: 3.4rem; min-width: 11rem; padding: 0 1.6rem; border-radius: 1.7rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.8rem; font-weight: 800; color: #120f24; background: var(--c);
  opacity: 0; transform: translateY(0.8rem); transition: opacity 0.3s, transform 0.3s;
}
.c4-card.is-active .c4-card__turn { opacity: 1; transform: none; }
.c4-dots i { display: inline-block; width: 0.8rem; height: 0.8rem; margin: 0 0.3rem; border-radius: 50%; background: currentColor; animation: c4-pulse-dot 1s ease-in-out infinite; }
.c4-dots i:nth-child(2) { animation-delay: 0.15s; }
.c4-dots i:nth-child(3) { animation-delay: 0.3s; }

@media (prefers-reduced-motion: reduce) {
  .c4-tv *, .c4-tv *::before, .c4-tv *::after { animation: none !important; transition: none !important; }
}
`;
