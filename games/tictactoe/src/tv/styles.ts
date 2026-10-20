// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity
// und stroke-dashoffset.
export const TV_CSS = /* css */ `
.ttt-tv {
  --ttt-ink: #f8f4ff;
  --ttt-dim: #aaa1d2;
  --ttt-line: rgba(232, 226, 255, 0.2);
  --ttt-panel: #1d1838;
  --ttt-accent: #00c2a8;
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ttt-ink);
  background:
    radial-gradient(46rem 40rem at 50% 50%, rgba(0, 194, 168, 0.09), rgba(0, 194, 168, 0) 70%),
    var(--bg, #120f24);
  font-variant-numeric: tabular-nums;
}
.ttt-tv *, .ttt-tv *::before, .ttt-tv *::after { box-sizing: border-box; }
.ttt-tv h2, .ttt-tv p { margin: 0; }

/* ---------- Mitte: Brett ---------- */
.ttt-tv__center {
  width: 46rem;
  margin: 0 4rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ttt-tv__round {
  font-size: 2rem;
  font-weight: 700;
  color: var(--ttt-dim);
  margin-bottom: 1.4rem;
}
.ttt-tv__draws { margin-left: 1.6rem; padding-left: 1.6rem; border-left: 0.15rem solid var(--ttt-line); }

.ttt-board { width: 44rem; height: 44rem; }
.ttt-board svg { display: block; width: 100%; height: 100%; overflow: visible; }
.ttt-grid path { fill: none; stroke: var(--ttt-line); stroke-width: 5; stroke-linecap: round; }
.ttt-cellmark { transition: opacity 0.5s 0.3s; }
.ttt-cellmark .ttt-stroke { stroke-width: 10; }
.ttt-cellmark.is-dim { opacity: 0.28; }

.ttt-winline line { fill: none; stroke: currentColor; stroke-linecap: round; stroke-dashoffset: 0; }
.ttt-winline__glow { stroke-width: 30; opacity: 0.22; }
.ttt-winline__core { stroke-width: 11; }
.ttt-winline line { animation: ttt-draw 0.55s cubic-bezier(.6,0,.2,1) 0.5s both; }

/* ---------- Status unter dem Brett ---------- */
.ttt-status, .ttt-banner {
  height: 6.4rem;
  margin-top: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}
.ttt-status { font-size: 2.6rem; font-weight: 700; }
.ttt-status__dot {
  width: 1.4rem; height: 1.4rem; border-radius: 50%;
  margin-right: 1.2rem;
  background: var(--c);
  animation: ttt-pulse 1.4s ease-in-out infinite;
}
.ttt-status--paused { color: var(--ttt-dim); }
.ttt-pause i { display: inline-block; width: 1.3rem; height: 4.2rem; margin: 0 0.6rem; border-radius: 0.5rem; background: currentColor; }
/* Pause: Brett gedimmt, Karten neutral */
.ttt-board { transition: opacity 0.4s; }
.ttt-tv--paused .ttt-board { opacity: 0.35; }
.ttt-banner {
  padding: 0 3.6rem;
  border-radius: 3.2rem;
  font-size: 3.8rem;
  font-weight: 900;
  letter-spacing: -0.01em;
  color: #120f24;
  background: var(--c, #f8f4ff);
  animation: ttt-rise 0.5s cubic-bezier(.2,.9,.3,1.3) 1s both;
}
.ttt-banner--draw { background: var(--ttt-ink); }
@keyframes ttt-rise { from { opacity: 0; transform: translateY(2rem) scale(0.9); } to { opacity: 1; transform: none; } }
@keyframes ttt-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.7); } }

/* ---------- Spieler-Karten ---------- */
.ttt-card {
  width: 25rem;
  padding: 3rem 1.8rem 2.4rem;
  border-radius: 2.6rem;
  background: var(--ttt-panel);
  border: 0.35rem solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  opacity: 0.62;
  transform: scale(0.96);
  transition: transform 0.35s cubic-bezier(.2,.8,.3,1), opacity 0.35s, border-color 0.35s;
}
.ttt-card.is-active, .ttt-card.is-winner { opacity: 1; transform: scale(1.02); border-color: var(--c); }
.ttt-card.is-winner { transform: scale(1.06); }
.ttt-card.is-loser { opacity: 0.4; }
.ttt-card__avatar {
  width: 11rem; height: 11rem;
  border-radius: 50%;
  border: 0.5rem solid var(--c);
  background: rgba(255, 255, 255, 0.05);
  display: flex; align-items: center; justify-content: center;
  font-size: 6.2rem; line-height: 1;
}
.ttt-card.is-offline .ttt-card__avatar { filter: grayscale(1); opacity: 0.5; }
.ttt-card__name {
  margin-top: 1.6rem !important;
  max-width: 100%;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 3.2rem; font-weight: 800; letter-spacing: -0.01em;
}
.ttt-card__sub { height: 2.4rem; margin-top: 0.4rem !important; font-size: 1.7rem; color: var(--ttt-dim); }
.ttt-card__mark { width: 6.4rem; height: 6.4rem; margin: 1rem 0 0.6rem; color: var(--c); }
.ttt-card__wins { display: flex; align-items: baseline; justify-content: center; }
.ttt-card__num { font-size: 6rem; font-weight: 900; line-height: 1; margin-right: 1rem; }
.ttt-card__label { font-size: 2rem; color: var(--ttt-dim); }
.ttt-card__turn {
  margin-top: 1.6rem !important;
  height: 3.6rem; min-width: 12rem;
  padding: 0 1.8rem;
  border-radius: 1.8rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.9rem; font-weight: 800;
  color: #120f24;
  background: var(--c);
  opacity: 0;
  transform: translateY(0.8rem);
  transition: opacity 0.3s, transform 0.3s;
}
.ttt-card.is-active .ttt-card__turn { opacity: 1; transform: none; }
.ttt-dots i {
  display: inline-block; width: 0.8rem; height: 0.8rem; margin: 0 0.3rem;
  border-radius: 50%; background: currentColor;
  animation: ttt-pulse 1s ease-in-out infinite;
}
.ttt-dots i:nth-child(2) { animation-delay: 0.15s; }
.ttt-dots i:nth-child(3) { animation-delay: 0.3s; }

@media (prefers-reduced-motion: reduce) {
  .ttt-tv *, .ttt-tv *::before, .ttt-tv *::after { animation: none !important; transition: none !important; }
  .ttt-winline line { stroke-dashoffset: 0 !important; }
}
`;
