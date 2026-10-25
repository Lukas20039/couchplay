// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
export const TV_CSS = /* css */ `
.so-tv {
  --so-dim: #a9b8d6;
  --so-panel: #17213d;
  --so-accent: #3ddc97;
  --so-gold: #ffd24d;
  --so-near: #ffb347;
  --so-bad: #ff5a5f;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 2.2rem 5rem 1.6rem; color: #f3f7ff;
  background: radial-gradient(72rem 34rem at 50% 0%, rgba(61,220,151,0.18), rgba(61,220,151,0) 70%), var(--bg, #0e1224);
  font-variant-numeric: tabular-nums;
}
.so-tv *, .so-tv *::before, .so-tv *::after { box-sizing: border-box; }
.so-tv h1, .so-tv h2, .so-tv h3, .so-tv p, .so-tv ol { margin: 0; }

/* Avatare */
.so-av {
  position: relative; width: 5rem; height: 5rem; flex: none; border-radius: 50%; background: var(--c);
  display: flex; align-items: center; justify-content: center; font-size: 3rem; line-height: 1;
  box-shadow: 0 0 0 0.3rem rgba(0,0,0,0.25);
}
.so-av.is-waiting { opacity: 0.55; }
.so-av.is-off { opacity: 0.3; filter: grayscale(1); }
.so-av.is-done { box-shadow: 0 0 0 0.3rem var(--so-accent), 0 0 1.6rem rgba(61,220,151,0.6); animation: so-pop 0.4s both; }
.so-av__badge { position: absolute; right: -0.6rem; bottom: -0.5rem; font-size: 2rem; }
.so-av--mini { width: 3.4rem; height: 3.4rem; font-size: 2rem; box-shadow: none; }

/* Intro */
.so-intro, .so-ranking, .so-final { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.so-title { font-size: 4.6rem; font-weight: 900; text-align: center; }
.so-title span { color: var(--so-accent); }
.so-lead { font-size: 2.6rem; font-weight: 800; margin-top: 1.6rem !important; text-align: center; }
.so-sub { font-size: 2rem; color: var(--so-dim); margin-top: 0.6rem !important; }
.so-cats { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.6rem; max-width: 90rem; }
.so-cats span { font-size: 1.6rem; font-weight: 700; padding: 0.4rem 1.2rem; margin: 0.4rem; border-radius: 99rem; background: rgba(61,220,151,0.16); color: #b9f5da; }
.so-rules { margin-top: 1.8rem !important; padding: 0 0 0 2.4rem; font-size: 2.1rem; color: var(--so-dim); max-width: 88rem; }
.so-rules li { margin-top: 0.7rem; }
.so-starts { margin-top: 2rem !important; font-size: 2.2rem; color: var(--so-dim); }
.so-starts b { color: var(--so-accent); font-size: 3rem; margin-left: 0.6rem; }
.so-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 2rem; }
.so-avatars__item, .so-strip__item { display: flex; flex-direction: column; align-items: center; margin: 0 1.1rem; }
.so-avatars__item small, .so-strip__item small { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; max-width: 10rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Kopf, Kriterium, Richtung */
.so-head { width: 100%; display: flex; align-items: center; min-height: 6rem; flex: none; }
.so-cat { font-size: 1.7rem; font-weight: 800; padding: 0.4rem 1.4rem; border-radius: 99rem; background: rgba(61,220,151,0.18); color: #a5f0cf; white-space: nowrap; }
.so-round { font-size: 1.7rem; color: var(--so-dim); margin-left: 1.6rem; flex: 1; white-space: nowrap; }
.so-clock {
  width: 6.4rem; height: 6.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 900; background: var(--so-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}
.so-clock.is-hurry { color: var(--so-bad); box-shadow: inset 0 0 0 0.3rem var(--so-bad); }
.so-prompt { text-align: center; font-size: 4.4rem; font-weight: 900; line-height: 1.18; max-width: 100rem; margin-top: 1rem !important; flex: none; }
.so-prompt--small { font-size: 2.8rem; margin-top: 0.2rem !important; }
.so-dir { display: flex; align-items: center; justify-content: center; margin-top: 1.6rem; flex: none; }
.so-dir__end {
  font-size: 2.2rem; font-weight: 800; padding: 0.5rem 1.8rem; border-radius: 99rem;
  background: rgba(61,220,151,0.14); color: #c4f7e0; box-shadow: inset 0 0 0 0.2rem rgba(61,220,151,0.5); white-space: nowrap;
}
.so-dir__arrow { font-size: 3rem; color: var(--so-accent); margin: 0 1.4rem; }
.so-dir--small { margin-top: 0; }
.so-dir--small .so-dir__end { font-size: 1.6rem; padding: 0.3rem 1.2rem; }
.so-dir--small .so-dir__arrow { font-size: 2rem; margin: 0 0.8rem; }

/* Sortierphase: gemischte Karten */
.so-cards { flex: 1; width: 100%; max-width: 120rem; display: grid; grid-gap: 1.6rem 2rem; gap: 1.6rem 2rem; align-content: center; margin-top: 1.4rem; }
.so-card {
  min-height: 9rem; display: flex; align-items: center; justify-content: center; text-align: center;
  padding: 1rem 2rem; border-radius: 1.8rem; font-size: 3rem; font-weight: 900; line-height: 1.15;
  background: linear-gradient(180deg, #22305a, #1a2546); box-shadow: inset 0 0 0 0.25rem rgba(255,255,255,0.12), 0 0.6rem 0 rgba(0,0,0,0.25);
  animation: so-deal 0.45s cubic-bezier(.3,1.4,.5,1) both; word-break: break-word;
}
.so-timebar { width: 100%; height: 1.2rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.6rem; flex: none; }
.so-timebar span { display: block; height: 100%; background: var(--so-accent); transform-origin: left center; transition: transform 0.25s linear, background-color 0.3s; }
.so-timebar span.is-hurry { background: var(--so-bad); }
.so-strip { display: flex; align-items: flex-end; justify-content: center; flex-wrap: wrap; margin-top: 1.4rem; min-height: 8rem; flex: none; }
.so-strip__label { font-size: 1.9rem; font-weight: 700; color: var(--so-dim); margin-left: 1.6rem; align-self: center; }

/* Auflösung */
.so-reveal { flex: 1; width: 100%; display: flex; align-items: stretch; margin-top: 1.2rem; min-height: 0; }
.so-ladder { list-style: none; padding: 0; flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.so-slot {
  display: flex; align-items: center; height: calc((43rem - (var(--n) - 1) * 0.8rem) / var(--n)); max-height: 9.4rem;
  padding: 0 1.6rem 0 1rem; border-radius: 1.6rem; background: rgba(255,255,255,0.04);
  box-shadow: inset 0 0 0 0.2rem rgba(255,255,255,0.12);
}
.so-slot + .so-slot { margin-top: 0.8rem; }
.so-slot.is-open {
  background: linear-gradient(90deg, rgba(61,220,151,0.22), var(--so-panel) 40%);
  box-shadow: inset 0 0 0 0.25rem rgba(61,220,151,0.55); animation: so-flip 0.55s cubic-bezier(.3,1.4,.5,1) both;
}
.so-slot__rank {
  width: 4.6rem; height: 4.6rem; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 2.6rem; font-weight: 900; background: rgba(255,255,255,0.1); margin-right: 1.4rem;
}
.so-slot.is-open .so-slot__rank { background: var(--so-accent); color: #062417; }
.so-slot__pending { font-size: 3rem; font-weight: 900; color: rgba(255,255,255,0.25); }
.so-slot__text { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; line-height: 1.1; }
.so-slot__label { font-size: 2.6rem; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.so-slot__label.is-long { font-size: 2.1rem; }
.so-slot__line { display: flex; align-items: baseline; min-width: 0; margin-top: 0.2rem; }
.so-slot__value {
  flex: none; font-size: 2.7rem; font-weight: 900; color: var(--so-gold); white-space: nowrap;
  animation: so-pop 0.5s 0.15s cubic-bezier(.3,1.6,.5,1) both;
}
.so-slot__note { font-size: 1.6rem; color: var(--so-dim); margin-left: 1.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.so-slot__who { flex: none; display: flex; flex-wrap: wrap; justify-content: flex-end; align-content: center; width: 12.4rem; margin-left: 1rem; }
.so-slot__who .so-av { width: 2.8rem; height: 2.8rem; font-size: 1.7rem; margin: 0.15rem; animation: so-pop 0.4s 0.45s both; }

.so-panel { flex: none; margin-left: 2.4rem; min-width: 36rem; display: flex; flex-direction: column; justify-content: center; }
.so-panel__title { font-size: 2rem; font-weight: 800; color: var(--so-dim); margin-bottom: 0.6rem; }
.so-res {
  display: flex; align-items: center; padding: 0.4rem 1.2rem 0.4rem 0.5rem; margin-top: 0.6rem; border-radius: 99rem;
  background: var(--so-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.9rem; font-weight: 800;
}
.so-res > :not(:first-child) { margin-left: 0.9rem; }
.so-res__name { width: 11rem; flex: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.so-res__marks { flex: none; display: flex; }
.so-mark {
  width: 3.2rem; height: 3.2rem; border-radius: 0.8rem; margin-right: 0.4rem; display: flex; align-items: center; justify-content: center;
  font-size: 1.9rem; font-weight: 900; background: rgba(255,255,255,0.06);
}
.so-mark--exact { background: rgba(61,220,151,0.25); animation: so-pop 0.35s both; }
.so-mark--near { background: rgba(255,179,71,0.25); color: var(--so-near); font-size: 2.4rem; animation: so-pop 0.35s both; }
.so-mark--miss { background: rgba(255,90,95,0.18); animation: so-pop 0.35s both; }
.so-mark--none { color: var(--so-dim); }
.so-res__pts { min-width: 6.4rem; margin-left: auto !important; text-align: right; color: var(--so-accent); font-weight: 900; }
.so-res.is-perfect { background: rgba(255,210,77,0.2); box-shadow: inset 0 0 0 0.3rem var(--so-gold), 0 0 2rem rgba(255,210,77,0.4); }
.so-res.is-perfect .so-res__pts { color: var(--so-gold); }
.so-best { margin-top: 1.2rem !important; font-size: 2.2rem; font-weight: 900; color: var(--so-gold); animation: so-pop 0.5s both; }

.so-perfect {
  position: absolute; left: 50%; top: 50%; z-index: 10; display: flex; flex-direction: column; align-items: center;
  padding: 2.4rem 6rem; border-radius: 3rem; background: rgba(14,18,36,0.94);
  box-shadow: 0 0 0 0.5rem var(--so-gold), 0 0 8rem rgba(255,210,77,0.7);
  animation: so-celebrate 3.6s cubic-bezier(.3,1.4,.5,1) both; pointer-events: none;
}
.so-perfect strong { font-size: 9rem; font-weight: 900; color: var(--so-gold); line-height: 1; }
.so-perfect__burst { font-size: 6rem; line-height: 1; animation: so-wiggle 0.5s ease-in-out 4 alternate; }
.so-perfect__names { font-size: 3rem; font-weight: 800; margin-top: 1rem; max-width: 80rem; text-align: center; }

/* Rangliste */
.so-list { list-style: none; padding: 0; margin-top: 2.2rem !important; width: 74rem; }
.so-row {
  display: flex; align-items: center; padding: 0.8rem 1.8rem; margin-top: 0.8rem; border-radius: 1.4rem;
  background: var(--so-panel); box-shadow: inset 0.5rem 0 0 var(--c); font-size: 2.4rem; font-weight: 800;
  animation: so-slide 0.4s both;
}
.so-row.is-first { box-shadow: inset 0.5rem 0 0 var(--c), 0 0 0 0.25rem var(--so-gold); }
.so-row.is-left { opacity: 0.5; }
.so-row .so-av { width: 4.4rem; height: 4.4rem; font-size: 2.6rem; margin-right: 1.4rem; }
.so-row__rank { width: 4rem; color: var(--so-dim); }
.so-row__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.so-row__name small { font-size: 1.6rem; color: var(--so-dim); }
.so-row__gain { color: var(--so-accent); font-size: 2rem; margin-right: 1.8rem; }
.so-row__score { min-width: 7rem; text-align: right; }

/* Finale */
.so-podium { display: flex; align-items: flex-end; justify-content: center; margin-top: 2rem; flex: 1; }
.so-step { display: flex; flex-direction: column; align-items: center; width: 24rem; margin: 0 1.2rem; animation: so-rise 0.7s both; }
.so-step.is-left { opacity: 0.6; }
.so-step .so-av { width: 7rem; height: 7rem; font-size: 4.2rem; }
.so-step.r1 .so-av { width: 9rem; height: 9rem; font-size: 5.4rem; box-shadow: 0 0 0 0.4rem var(--so-gold), 0 0 3rem var(--so-gold); }
.so-step__name { font-size: 2.6rem; font-weight: 900; margin-top: 0.8rem; max-width: 24rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.so-step__score { font-size: 2rem; color: var(--so-dim); font-weight: 700; }
.so-step__perfect { font-size: 1.6rem; color: var(--so-gold); font-weight: 700; margin-top: 0.2rem; }
.so-step__block {
  width: 100%; margin-top: 1rem; border-radius: 1.4rem 1.4rem 0 0; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 1rem; font-size: 5rem; font-weight: 900; color: rgba(255,255,255,0.85);
  background: linear-gradient(180deg, var(--c), rgba(23,33,61,0.9));
}
.so-step.r1 .so-step__block { height: 18rem; }
.so-step.r2 .so-step__block { height: 12rem; }
.so-step.r3 .so-step__block { height: 8rem; }
.so-step.r1 { animation-delay: 0.6s; }
.so-step.r2 { animation-delay: 0.3s; }
.so-rest { display: flex; flex-wrap: wrap; justify-content: center; max-width: 100rem; margin-top: 1.2rem; }
.so-chip {
  display: flex; align-items: center; margin: 0.4rem 0.5rem; padding: 0.4rem 1.2rem 0.4rem 0.5rem; border-radius: 99rem;
  background: var(--so-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.7rem; font-weight: 700;
}
.so-chip > :not(:first-child) { margin-left: 0.8rem; }
.so-chip__name { max-width: 12rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.so-chip__pts { color: var(--so-accent); font-weight: 900; }
.so-finalbar { width: 60rem; height: 0.8rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.6rem; flex: none; }
.so-finalbar span { display: block; height: 100%; background: var(--so-accent); transform-origin: left center; transition: transform 0.25s linear; }

@keyframes so-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes so-deal { from { transform: translateY(3rem) rotate(-4deg); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes so-flip { from { transform: perspective(60rem) rotateX(-80deg); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes so-slide { from { transform: translateX(-3rem); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes so-rise { from { transform: translateY(8rem); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes so-wiggle { from { transform: rotate(-14deg) scale(1); } to { transform: rotate(14deg) scale(1.2); } }
@keyframes so-celebrate {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
  12% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
  18% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(0.85); opacity: 0; visibility: hidden; }
}
@media (prefers-reduced-motion: reduce) {
  .so-av.is-done, .so-card, .so-slot.is-open, .so-slot__value, .so-slot__who .so-av, .so-mark, .so-best, .so-perfect__burst, .so-row, .so-step { animation: none; }
}
`;
