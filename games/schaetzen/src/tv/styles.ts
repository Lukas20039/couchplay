// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
export const TV_CSS = /* css */ `
.es-tv {
  --es-dim: #a9b8d6;
  --es-panel: #17213d;
  --es-accent: #3fb6ff;
  --es-gold: #ffd24d;
  --es-good: #3ddc84;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 2.2rem 5rem 1.6rem; color: #f3f7ff;
  background: radial-gradient(72rem 34rem at 50% 0%, rgba(63,182,255,0.20), rgba(63,182,255,0) 70%), var(--bg, #0e1224);
  font-variant-numeric: tabular-nums;
}
.es-tv *, .es-tv *::before, .es-tv *::after { box-sizing: border-box; }
.es-tv h1, .es-tv h2, .es-tv p, .es-tv ol { margin: 0; }

/* Avatare */
.es-av {
  position: relative; width: 5rem; height: 5rem; flex: none; border-radius: 50%; background: var(--c);
  display: flex; align-items: center; justify-content: center; font-size: 3rem; line-height: 1;
  box-shadow: 0 0 0 0.3rem rgba(0,0,0,0.25);
}
.es-av.is-waiting { opacity: 0.55; }
.es-av.is-off { opacity: 0.3; filter: grayscale(1); }
.es-av.is-done { box-shadow: 0 0 0 0.3rem var(--es-good), 0 0 1.6rem rgba(61,220,132,0.6); animation: es-pop 0.4s both; }
.es-av__badge { position: absolute; right: -0.6rem; bottom: -0.5rem; font-size: 2rem; }
.es-av--mini { width: 3.4rem; height: 3.4rem; font-size: 2rem; box-shadow: none; }

/* Intro */
.es-intro, .es-ranking, .es-final { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.es-title { font-size: 4.6rem; font-weight: 900; text-align: center; }
.es-title span { color: var(--es-accent); }
.es-lead { font-size: 2.6rem; font-weight: 800; margin-top: 1.6rem !important; }
.es-sub { font-size: 2rem; color: var(--es-dim); margin-top: 0.6rem !important; }
.es-cats { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.6rem; max-width: 90rem; }
.es-cats span { font-size: 1.6rem; font-weight: 700; padding: 0.4rem 1.2rem; margin: 0.4rem; border-radius: 99rem; background: rgba(63,182,255,0.16); color: #bfe6ff; }
.es-rules { margin-top: 1.8rem !important; padding: 0 0 0 2.4rem; font-size: 2.1rem; color: var(--es-dim); max-width: 84rem; }
.es-rules li { margin-top: 0.7rem; }
.es-starts { margin-top: 2rem !important; font-size: 2.2rem; color: var(--es-dim); }
.es-starts b { color: var(--es-accent); font-size: 3rem; margin-left: 0.6rem; }
.es-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 2rem; }
.es-avatars__item, .es-strip__item { display: flex; flex-direction: column; align-items: center; margin: 0 1.1rem; }
.es-avatars__item small, .es-strip__item small { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; max-width: 10rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Frage */
.es-head { width: 100%; display: flex; align-items: center; min-height: 6rem; }
.es-cat { font-size: 1.7rem; font-weight: 800; padding: 0.4rem 1.4rem; border-radius: 99rem; background: rgba(63,182,255,0.18); color: #9fdcff; }
.es-round { font-size: 1.7rem; color: var(--es-dim); margin-left: 1.6rem; flex: 1; }
.es-clock {
  width: 6.4rem; height: 6.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 900; background: var(--es-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}
.es-clock.is-hurry { color: #ff5a5f; box-shadow: inset 0 0 0 0.3rem #ff5a5f; }
.es-question {
  flex: 1; display: flex; align-items: center; justify-content: center; text-align: center;
  font-size: 4.8rem; font-weight: 900; line-height: 1.18; max-width: 92rem;
}
.es-question--small { flex: none; font-size: 2.8rem; line-height: 1.2; margin-top: 0.6rem !important; max-width: 96rem; min-height: 3.4rem; }
.es-unit {
  font-size: 2.6rem; font-weight: 800; padding: 0.8rem 2.6rem; border-radius: 99rem;
  background: rgba(63,182,255,0.16); color: #bfe6ff; box-shadow: inset 0 0 0 0.25rem rgba(63,182,255,0.5);
}
.es-timebar { width: 100%; height: 1.2rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 2.6rem; }
.es-timebar span { display: block; height: 100%; background: var(--es-accent); transform-origin: left center; transition: transform 0.25s linear, background-color 0.3s; }
.es-timebar span.is-hurry { background: #ff5a5f; }
.es-strip { display: flex; align-items: flex-end; justify-content: center; flex-wrap: wrap; margin-top: 2rem; min-height: 8rem; }
.es-strip__label { font-size: 1.9rem; font-weight: 700; color: var(--es-dim); margin-left: 1.6rem; align-self: center; }

/* Zahlenstrahl */
.es-line { position: relative; width: 94rem; height: 28rem; margin-top: 1rem; flex: none; }
.es-axis {
  position: absolute; left: 0; right: 0; top: 19.4rem; height: 0.6rem; border-radius: 1rem;
  background: linear-gradient(90deg, rgba(63,182,255,0.25), rgba(63,182,255,0.9), rgba(63,182,255,0.25));
}
.es-tick { position: absolute; top: 20.5rem; transform: translateX(-50%); font-size: 1.5rem; color: var(--es-dim); white-space: nowrap; }
.es-tick::before { content: ""; position: absolute; left: 50%; top: -1.1rem; width: 0.2rem; height: 0.9rem; margin-left: -0.1rem; background: rgba(255,255,255,0.35); }
.es-scale-note { position: absolute; right: 0; top: 23.2rem; font-size: 1.3rem; color: var(--es-dim); font-style: italic; }
.es-pin {
  position: absolute; bottom: 8.1rem; display: flex; flex-direction: column; align-items: center;
  transform: translateX(-50%); animation: es-drop 0.45s cubic-bezier(.3,1.5,.5,1) both; transition: opacity 0.4s;
}
.es-pin .es-av { width: 4.4rem; height: 4.4rem; font-size: 2.6rem; }
.es-pin__tag {
  font-size: 1.5rem; font-weight: 800; padding: 0.1rem 0.7rem; margin-bottom: 0.3rem; border-radius: 0.6rem;
  background: rgba(14,18,36,0.85); white-space: nowrap; box-shadow: inset 0 0 0 0.15rem var(--c);
}
.es-pin__arrow { color: var(--es-gold); }
.es-pin__stem { width: 0.3rem; height: calc(1rem + var(--lane) * 6rem); background: var(--c); }
.es-pin.is-dim { opacity: 0.55; }
.es-pin.is-best .es-av { box-shadow: 0 0 0 0.35rem var(--es-gold), 0 0 2.4rem var(--es-gold); animation: es-pulse 1s ease-in-out 2; }
.es-pin.is-best .es-pin__tag { background: var(--es-gold); color: #1a1400; }
.es-answer { position: absolute; top: 0; z-index: 4; }
.es-answer__line {
  position: absolute; left: -0.25rem; top: 0; width: 0.5rem; height: 20rem; border-radius: 0.3rem;
  background: var(--es-gold); box-shadow: 0 0 1.8rem var(--es-gold);
}
.es-answer__value {
  position: absolute; top: 22.8rem; left: 0; transform: translateX(-50%); white-space: nowrap;
  font-size: 3.4rem; font-weight: 900; padding: 0.3rem 1.6rem; border-radius: 1.2rem;
  background: var(--es-gold); color: #1a1400; box-shadow: 0 0.4rem 2rem rgba(255,210,77,0.45);
}
.es-drum {
  position: absolute; left: 0; right: 0; top: 23rem; text-align: center; font-size: 3.2rem; font-weight: 900;
  color: var(--es-gold); animation: es-blink 0.6s ease-in-out infinite alternate;
}
.es-outcome { display: flex; flex-direction: column; align-items: center; min-height: 12rem; }
.es-nearest { font-size: 2.8rem; font-weight: 900; color: var(--es-gold); animation: es-pop 0.5s cubic-bezier(.3,1.6,.5,1) both; }
.es-chips { display: grid; grid-gap: 0.7rem 1rem; gap: 0.7rem 1rem; justify-content: center; margin-top: 0.8rem; }
.es-rest { display: flex; flex-wrap: wrap; justify-content: center; max-width: 100rem; margin-top: 0.8rem; }
.es-rest .es-chip { margin: 0.4rem 0.5rem; }
.es-chip {
  display: flex; align-items: center; min-width: 0; padding: 0.4rem 1.2rem 0.4rem 0.5rem; border-radius: 99rem;
  background: var(--es-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.7rem; font-weight: 700;
  animation: es-pop 0.4s both;
}
.es-chip__text { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.15; }
.es-chip__text .es-chip__name { margin: 0; max-width: none; font-weight: 800; }
.es-chip__detail { display: flex; align-items: baseline; font-size: 1.5rem; white-space: nowrap; }
.es-chip__detail > :not(:first-child) { margin-left: 0.7rem; }
.es-chip.is-best { background: rgba(255,210,77,0.18); box-shadow: inset 0 0 0 0.25rem var(--es-gold); }
.es-chip > :not(:first-child) { margin-left: 0.8rem; }
.es-chip__name { max-width: 12rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.es-chip__detail .es-chip__pts { margin-left: auto !important; padding-left: 0.7rem; }
.es-chip__off { color: var(--es-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.es-chip__bull { font-size: 1.5rem; }
.es-chip__pts { color: var(--es-good); font-weight: 900; }
.es-fact {
  margin-top: auto !important; max-width: 96rem; text-align: center; font-size: 1.9rem; color: #d7e6ff;
  padding: 0.6rem 1.6rem; border-radius: 1rem; background: rgba(255,255,255,0.05); animation: es-fade 0.6s 0.3s both;
}
.es-fact b { color: var(--es-accent); margin-right: 0.4rem; }

/* Rangliste */
.es-list { list-style: none; padding: 0; margin-top: 2.2rem !important; width: 74rem; }
.es-row {
  display: flex; align-items: center; padding: 0.8rem 1.8rem; margin-top: 0.8rem; border-radius: 1.4rem;
  background: var(--es-panel); box-shadow: inset 0.5rem 0 0 var(--c); font-size: 2.4rem; font-weight: 800;
  animation: es-slide 0.4s both;
}
.es-row.is-first { box-shadow: inset 0.5rem 0 0 var(--c), 0 0 0 0.25rem var(--es-gold); }
.es-row.is-left { opacity: 0.5; }
.es-row .es-av { width: 4.4rem; height: 4.4rem; font-size: 2.6rem; margin-right: 1.4rem; }
.es-row__rank { width: 4rem; color: var(--es-dim); }
.es-row__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.es-row__name small { font-size: 1.6rem; color: var(--es-dim); }
.es-row__gain { color: var(--es-good); font-size: 2rem; margin-right: 1.8rem; }
.es-row__score { min-width: 7rem; text-align: right; }

/* Finale */
.es-podium { display: flex; align-items: flex-end; justify-content: center; margin-top: 2rem; flex: 1; }
.es-step { display: flex; flex-direction: column; align-items: center; width: 24rem; margin: 0 1.2rem; animation: es-rise 0.7s both; }
.es-step.is-left { opacity: 0.6; }
.es-step .es-av { width: 7rem; height: 7rem; font-size: 4.2rem; }
.es-step.r1 .es-av { width: 9rem; height: 9rem; font-size: 5.4rem; box-shadow: 0 0 0 0.4rem var(--es-gold), 0 0 3rem var(--es-gold); }
.es-step__name { font-size: 2.6rem; font-weight: 900; margin-top: 0.8rem; max-width: 24rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.es-step__score { font-size: 2rem; color: var(--es-dim); font-weight: 700; }
.es-step__bull { font-size: 1.6rem; color: var(--es-gold); font-weight: 700; margin-top: 0.2rem; }
.es-step__block {
  width: 100%; margin-top: 1rem; border-radius: 1.4rem 1.4rem 0 0; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 1rem; font-size: 5rem; font-weight: 900; color: rgba(255,255,255,0.85);
  background: linear-gradient(180deg, var(--c), rgba(23,33,61,0.9));
}
.es-step.r1 .es-step__block { height: 18rem; }
.es-step.r2 .es-step__block { height: 12rem; }
.es-step.r3 .es-step__block { height: 8rem; }
.es-step.r1 { animation-delay: 0.6s; }
.es-step.r2 { animation-delay: 0.3s; }
.es-rest { margin-top: 1.2rem; }
.es-finalbar { width: 60rem; height: 0.8rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.6rem; flex: none; }
.es-finalbar span { display: block; height: 100%; background: var(--es-accent); transform-origin: left center; transition: transform 0.25s linear; }

@keyframes es-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes es-drop { from { transform: translate(-50%, -4rem); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
@keyframes es-pulse { 50% { transform: scale(1.18); } }
@keyframes es-blink { from { opacity: 0.45; } to { opacity: 1; } }
@keyframes es-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes es-slide { from { transform: translateX(-3rem); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes es-rise { from { transform: translateY(8rem); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .es-av.is-done, .es-pin, .es-pin.is-best .es-av, .es-drum, .es-nearest, .es-chip, .es-fact, .es-row, .es-step { animation: none; }
}
`;
