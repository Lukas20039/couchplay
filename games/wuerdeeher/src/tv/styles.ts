// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
export const TV_CSS = /* css */ `
.we-tv {
  --we-dim: #c0b2db;
  --we-panel: #22183d;
  --we-accent: #c86bff;
  --we-gold: #ffd24d;
  --we-good: #3ddc84;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 2.2rem 5rem 1.6rem; color: #f8f3ff;
  background: radial-gradient(72rem 34rem at 50% 0%, rgba(200,107,255,0.22), rgba(200,107,255,0) 70%), var(--bg, #110c22);
  font-variant-numeric: tabular-nums;
}
.we-tv *, .we-tv *::before, .we-tv *::after { box-sizing: border-box; }
.we-tv h1, .we-tv h2, .we-tv p, .we-tv ol { margin: 0; }

/* Avatare */
.we-av {
  position: relative; width: 5rem; height: 5rem; flex: none; border-radius: 50%; background: var(--c);
  display: flex; align-items: center; justify-content: center; font-size: 3rem; line-height: 1;
  box-shadow: 0 0 0 0.3rem rgba(0,0,0,0.25);
}
.we-av.is-waiting { opacity: 0.55; }
.we-av.is-off { opacity: 0.3; filter: grayscale(1); }
.we-av.is-done { box-shadow: 0 0 0 0.3rem var(--we-good), 0 0 1.6rem rgba(61,220,132,0.6); animation: we-pop 0.4s both; }
.we-av__badge { position: absolute; right: -0.6rem; bottom: -0.5rem; font-size: 2rem; }
.we-av--mini { width: 3.4rem; height: 3.4rem; font-size: 2rem; box-shadow: none; }

/* Intro */
.we-intro, .we-ranking { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.we-title { font-size: 4.6rem; font-weight: 900; text-align: center; }
.we-title span { color: var(--we-accent); }
.we-lead { font-size: 2.6rem; font-weight: 800; margin-top: 1.4rem !important; }
.we-sub { font-size: 2rem; color: var(--we-dim); margin-top: 0.6rem !important; }
.we-cats { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.4rem; max-width: 96rem; }
.we-cats span { font-size: 1.6rem; font-weight: 700; padding: 0.4rem 1.2rem; margin: 0.4rem; border-radius: 99rem; background: rgba(200,107,255,0.18); color: #e6c8ff; }
.we-rules { margin-top: 1.6rem !important; padding: 0 0 0 2.4rem; font-size: 2.1rem; color: var(--we-dim); max-width: 90rem; }
.we-rules li { margin-top: 0.7rem; }
.we-note { margin-top: 1.2rem !important; font-size: 1.9rem; font-weight: 800; color: var(--we-gold); }
.we-starts { margin-top: 1.6rem !important; font-size: 2.2rem; color: var(--we-dim); }
.we-starts b { color: var(--we-accent); font-size: 3rem; margin-left: 0.6rem; }
.we-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.8rem; }
.we-avatars__item, .we-strip__item { display: flex; flex-direction: column; align-items: center; margin: 0 1.1rem; }
.we-avatars__item small, .we-strip__item small { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; max-width: 11rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Abstimmung */
.we-head { width: 100%; display: flex; align-items: center; min-height: 6rem; flex: none; }
.we-cat { font-size: 1.7rem; font-weight: 800; padding: 0.4rem 1.4rem; border-radius: 99rem; background: rgba(200,107,255,0.2); color: #e6c8ff; }
.we-round { font-size: 1.7rem; color: var(--we-dim); margin-left: 1.6rem; flex: 1; }
.we-clock {
  width: 6.4rem; height: 6.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 900; background: var(--we-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}
.we-clock.is-hurry { color: #ff5a5f; box-shadow: inset 0 0 0 0.3rem #ff5a5f; }
.we-ask { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; max-width: 100rem; }
.we-ask__lead { font-size: 3rem; font-weight: 800; color: var(--we-accent); }
.we-ask__text { font-size: 5.6rem; font-weight: 900; line-height: 1.15; margin-top: 1rem !important; }
.we-timebar { width: 100%; height: 1.2rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; flex: none; }
.we-timebar span { display: block; height: 100%; background: var(--we-accent); transform-origin: left center; transition: transform 0.25s linear, background-color 0.3s; }
.we-timebar span.is-hurry { background: #ff5a5f; }
.we-strip { display: flex; align-items: flex-end; justify-content: center; flex-wrap: wrap; margin-top: 2rem; min-height: 8rem; flex: none; }
.we-strip__label { font-size: 1.9rem; font-weight: 700; color: var(--we-dim); margin-left: 1.6rem; align-self: center; }

/* Auflösung */
.we-headline { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 10.4rem; max-width: 104rem; flex: none; margin-bottom: 1rem !important; }
.we-headline__lead { font-size: 2rem; font-weight: 800; color: var(--we-accent); }
.we-headline__text { font-size: 3.4rem; font-weight: 900; line-height: 1.15; margin-top: 0.3rem !important; }
.we-crowned { font-size: 3.4rem; font-weight: 900; line-height: 1.15; color: var(--we-gold); animation: we-pop 0.6s cubic-bezier(.3,1.6,.5,1) both; }
.we-stage { flex: 1; display: flex; align-items: flex-end; justify-content: center; width: 100%; min-height: 0; padding-bottom: 0.6rem; }
.we-col { display: flex; flex-direction: column; align-items: center; margin: 0 0.8rem; transition: opacity 0.5s; }
.we-col.is-dim { opacity: 0.5; }
.we-col__count { font-size: 3.2rem; font-weight: 900; min-height: 4rem; }
.we-col.is-win .we-col__count { color: var(--we-gold); }
.we-col__area { position: relative; width: 100%; height: 18rem; border-radius: 1.2rem 1.2rem 0.4rem 0.4rem; background: rgba(255,255,255,0.04); overflow: hidden; }
.we-col__bar {
  position: absolute; left: 0; right: 0; bottom: 0; height: 100%; border-radius: 1.2rem 1.2rem 0.4rem 0.4rem;
  background: linear-gradient(180deg, var(--c), rgba(34,24,61,0.6)); opacity: 0.55;
  transform-origin: bottom center; transition: transform 0.35s cubic-bezier(.3,1.3,.5,1);
}
.we-col.is-win .we-col__bar { opacity: 0.9; box-shadow: 0 0 2.4rem var(--we-gold); }
.we-col__chips {
  position: absolute; left: 0; right: 0; bottom: 0; top: 0; padding: 0.4rem;
  display: flex; flex-wrap: wrap-reverse; align-content: flex-start; justify-content: center;
}
.we-chip {
  width: 3.6rem; height: 3.6rem; margin: 0.2rem; border-radius: 50%; background: var(--c); flex: none;
  display: flex; align-items: center; justify-content: center; font-size: 2.1rem; line-height: 1;
  box-shadow: 0 0 0 0.22rem rgba(17,12,34,0.9); animation: we-fly 0.5s cubic-bezier(.3,1.4,.5,1) both;
}
.we-chip.is-anon { background: #f8f3ff; color: #2a1d48; font-size: 1.8rem; font-weight: 900; }
.we-col__who { position: relative; display: flex; flex-direction: column; align-items: center; margin-top: 0.8rem; }
.we-col__who .we-av { width: 6rem; height: 6rem; font-size: 3.6rem; }
.we-col.is-win .we-col__who .we-av { box-shadow: 0 0 0 0.35rem var(--we-gold), 0 0 2.4rem var(--we-gold); animation: we-pulse 1s ease-in-out 2; }
.we-crown { display: inline-block; margin-right: 0.4rem; animation: we-crown 0.7s cubic-bezier(.3,1.6,.5,1) both; }
.we-col__name { font-size: 1.8rem; font-weight: 800; margin-top: 0.5rem; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.we-col__pts { font-size: 2rem; font-weight: 900; color: var(--we-good); min-height: 2.6rem; }
.we-col__pts span { display: inline-block; animation: we-pop 0.5s both; }
.we-outcome { min-height: 3.4rem; font-size: 2.2rem; font-weight: 800; color: var(--we-dim); flex: none; }
.we-outcome span { display: inline-block; animation: we-pop 0.5s both; }

/* Rangliste */
.we-list { list-style: none; padding: 0; margin-top: 2rem !important; display: grid; grid-gap: 0.8rem 2rem; gap: 0.8rem 2rem; justify-content: center; }
.we-row {
  display: flex; align-items: center; width: 70rem; padding: 0.7rem 1.8rem; border-radius: 1.4rem;
  background: var(--we-panel); box-shadow: inset 0.5rem 0 0 var(--c); font-size: 2.4rem; font-weight: 800;
  animation: we-slide 0.4s both;
}
.we-list--2 { grid-auto-flow: column; }
.we-list--2 .we-row { width: 46rem; }
.we-row.is-first { box-shadow: inset 0.5rem 0 0 var(--c), 0 0 0 0.25rem var(--we-gold); }
.we-row.is-left { opacity: 0.5; }
.we-row .we-av { width: 4.4rem; height: 4.4rem; font-size: 2.6rem; margin-right: 1.4rem; }
.we-row__rank { width: 4rem; color: var(--we-dim); }
.we-row__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.we-row__name small { font-size: 1.6rem; color: var(--we-dim); }
.we-row__gain { color: var(--we-good); font-size: 2rem; margin-right: 1.8rem; }
.we-row__score { min-width: 7rem; text-align: right; }

/* Finale */
.we-final { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.we-final__body { flex: 1; display: flex; width: 100%; min-height: 0; margin-top: 1.4rem; }
.we-final__left { flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0; }
.we-final__left { width: 42rem; flex: none; }
.we-final__right { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; margin-left: 3rem; min-height: 0; }
.we-final__h { font-size: 2.6rem; font-weight: 900; color: var(--we-accent); }
.we-podium { display: flex; align-items: flex-end; justify-content: center; flex: 1; }
.we-step { display: flex; flex-direction: column; align-items: center; width: 12.6rem; margin: 0 0.5rem; animation: we-rise 0.7s both; }
.we-step.is-left { opacity: 0.6; }
.we-step .we-av { width: 5.6rem; height: 5.6rem; font-size: 3.3rem; }
.we-step.r1 .we-av { width: 7.2rem; height: 7.2rem; font-size: 4.3rem; box-shadow: 0 0 0 0.4rem var(--we-gold), 0 0 3rem var(--we-gold); }
.we-step__name { font-size: 2.1rem; font-weight: 900; margin-top: 0.6rem; max-width: 12.6rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.we-step__score { font-size: 1.7rem; color: var(--we-dim); font-weight: 700; }
.we-step__block {
  width: 100%; margin-top: 0.8rem; border-radius: 1.4rem 1.4rem 0 0; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 0.8rem; font-size: 4.4rem; font-weight: 900; color: rgba(255,255,255,0.85);
  background: linear-gradient(180deg, var(--c), rgba(34,24,61,0.9));
}
.we-step.r1 .we-step__block { height: 13rem; }
.we-step.r2 .we-step__block { height: 9rem; }
.we-step.r3 .we-step__block { height: 6rem; }
.we-step.r1 { animation-delay: 0.6s; }
.we-step.r2 { animation-delay: 0.3s; }
.we-rest { display: grid; grid-template-columns: auto auto; grid-gap: 0.6rem 0.8rem; gap: 0.6rem 0.8rem; justify-content: center; margin-top: 1rem; width: 100%; }
.we-pill {
  display: flex; align-items: center; padding: 0.25rem 1rem 0.25rem 0.4rem; border-radius: 99rem; min-width: 0;
  background: var(--we-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.5rem; font-weight: 800; animation: we-pop 0.4s both;
}
.we-pill > :not(:first-child) { margin-left: 0.5rem; }
.we-pill .we-av--mini { width: 2.8rem; height: 2.8rem; font-size: 1.7rem; }
.we-pill__name { max-width: 9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.we-pill__pts { color: var(--we-dim); white-space: nowrap; }
.we-titles { list-style: none; padding: 0; margin-top: 0.4rem !important; min-height: 0; }
.we-title-row {
  display: flex; align-items: center; padding: 0.5rem 1.4rem 0.5rem 0.6rem; margin-top: 0.6rem; border-radius: 1.2rem;
  background: var(--we-panel); box-shadow: inset 0.4rem 0 0 var(--c); animation: we-slide 0.4s both;
}
.we-title-row .we-av { margin-right: 1.1rem; }
.we-title-row__text { flex: 1; min-width: 0; line-height: 1.25; font-size: 1.75rem; }
.we-titles--dense .we-title-row__text { font-size: 1.5rem; }
.we-title-row__name { font-weight: 900; font-size: 1.15em; margin-right: 0.5rem; }
.we-title-row__votes { font-weight: 800; color: var(--we-gold); margin-left: 0.5rem; white-space: nowrap; }
.we-title-row__claim { font-weight: 600; color: #e9ddff; }
.we-title-row.is-none .we-title-row__claim { color: var(--we-dim); font-style: italic; }
.we-finalbar { width: 60rem; height: 0.8rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.2rem; flex: none; }
.we-finalbar span { display: block; height: 100%; background: var(--we-accent); transform-origin: left center; transition: transform 0.25s linear; }

@keyframes we-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes we-fly { from { transform: translateY(-26rem) scale(1.4); opacity: 0; } 60% { opacity: 1; } to { transform: none; opacity: 1; } }
@keyframes we-crown { from { transform: translateY(-3rem) rotate(-25deg) scale(0.3); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes we-pulse { 50% { transform: scale(1.15); } }
@keyframes we-slide { from { transform: translateX(-3rem); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes we-rise { from { transform: translateY(8rem); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .we-av.is-done, .we-crowned, .we-chip, .we-crown, .we-col.is-win .we-col__who .we-av, .we-col__pts span,
  .we-outcome span, .we-row, .we-step, .we-pill, .we-title-row { animation: none; }
  .we-col__bar { transition: none; }
}
`;
