// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
export const TV_CSS = /* css */ `
.kd-tv {
  --kd-dim: #b3a9d6;
  --kd-panel: #1f1840;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 2.4rem 5rem 2rem; color: #f8f4ff;
  background: radial-gradient(70rem 36rem at 50% 0%, rgba(255,95,191,0.18), rgba(255,95,191,0) 70%), var(--bg, #120f24);
  font-variant-numeric: tabular-nums;
}
.kd-tv *, .kd-tv *::before, .kd-tv *::after { box-sizing: border-box; }
.kd-tv h1, .kd-tv h2, .kd-tv p, .kd-tv ol { margin: 0; }

/* Intro */
.kd-intro, .kd-ranking { display: flex; flex-direction: column; align-items: center; width: 100%; }
.kd-title { font-size: 4.4rem; font-weight: 900; text-align: center; }
.kd-lead { font-size: 2.6rem; font-weight: 700; margin-top: 2rem !important; }
.kd-rules { margin-top: 2rem !important; padding: 0 0 0 2.4rem; font-size: 2.1rem; color: var(--kd-dim); max-width: 80rem; }
.kd-rules li { margin-top: 0.8rem; }
.kd-starts { margin-top: 2.6rem !important; font-size: 2.2rem; color: var(--kd-dim); }
.kd-starts b { color: #ff5fbf; font-size: 3rem; margin-left: 0.6rem; }
.kd-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 2.6rem; }
.kd-avatar { display: flex; flex-direction: column; align-items: center; margin: 0 1.2rem; font-size: 3.6rem; }
.kd-avatar > span { width: 6rem; height: 6rem; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center; }
.kd-avatar small { font-size: 1.5rem; font-weight: 700; margin-top: 0.4rem; }

/* Frage */
.kd-head { width: 100%; display: flex; align-items: center; }
.kd-cat { font-size: 1.7rem; font-weight: 800; padding: 0.4rem 1.4rem; border-radius: 99rem; background: rgba(255,95,191,0.18); color: #ff9fd9; }
.kd-round { font-size: 1.7rem; color: var(--kd-dim); margin-left: 1.6rem; flex: 1; }
.kd-clock {
  width: 6rem; height: 6rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 2.8rem; font-weight: 900; background: var(--kd-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}
.kd-clock.is-hurry { color: #ff5a5f; box-shadow: inset 0 0 0 0.3rem #ff5a5f; }
.kd-hot { display: flex; align-items: center; margin-top: 1.4rem; }
.kd-hot__avatar {
  width: 7rem; height: 7rem; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center;
  font-size: 4.4rem; box-shadow: 0 0 2.4rem var(--c); animation: kd-pop 0.5s cubic-bezier(.3,1.6,.5,1) both;
}
.kd-hot__name { font-size: 2.6rem; font-weight: 800; margin-left: 1.6rem; color: var(--c); }
.kd-question { font-size: 3.8rem; font-weight: 900; text-align: center; line-height: 1.2; margin-top: 1.8rem !important; max-width: 92rem; min-height: 9.2rem; }
.kd-answers { display: flex; flex-wrap: wrap; justify-content: center; width: 100%; max-width: 100rem; margin-top: 2rem; }
.kd-answer {
  position: relative; width: 45rem; min-height: 8.4rem; margin: 0.8rem 1rem; padding: 1.2rem 2rem; border-radius: 1.6rem;
  display: flex; align-items: center; background: var(--kd-panel); box-shadow: inset 0.6rem 0 0 var(--a);
  transition: opacity 0.4s, transform 0.4s;
}
.kd-answers--2 .kd-answer { width: 44rem; min-height: 11rem; }
.kd-answer__letter {
  width: 4.4rem; height: 4.4rem; flex: none; border-radius: 1rem; background: var(--a); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 2.4rem; font-weight: 900; margin-right: 1.6rem;
}
.kd-answer__text { font-size: 2.6rem; font-weight: 700; flex: 1; }
.kd-answers--2 .kd-answer__text { font-size: 3.2rem; }
.kd-answer.is-dim { opacity: 0.45; }
.kd-answer.is-chosen { transform: scale(1.04); box-shadow: inset 0.6rem 0 0 var(--a), 0 0 0 0.35rem var(--a), 0 0 2.4rem var(--a); }
.kd-answer__check { font-size: 3.4rem; font-weight: 900; color: #3ddc84; margin-left: 1rem; animation: kd-pop 0.4s both; }
.kd-answer__voters { position: absolute; right: 1.2rem; bottom: -1.6rem; display: flex; }
.kd-mini {
  width: 3.4rem; height: 3.4rem; border-radius: 50%; background: var(--c); margin-left: -0.6rem; border: 0.25rem solid var(--bg, #120f24);
  display: flex; align-items: center; justify-content: center; font-size: 1.9rem; animation: kd-pop 0.4s both;
}
.kd-foot { margin-top: auto; display: flex; justify-content: center; padding-bottom: 0.4rem; }
.kd-pill { font-size: 1.9rem; font-weight: 700; padding: 0.7rem 1.8rem; border-radius: 99rem; background: var(--kd-panel); color: var(--kd-dim); margin: 0 0.8rem; }
.kd-pill.is-done { color: #3ddc84; }
.kd-pill.is-big { font-size: 2.6rem; color: #fff; background: rgba(255,95,191,0.25); animation: kd-pop 0.5s both; }

/* Rangliste */
.kd-list { list-style: none; padding: 0; margin-top: 2.4rem !important; width: 70rem; }
.kd-row { display: flex; align-items: center; padding: 0.9rem 1.8rem; margin-top: 0.8rem; border-radius: 1.4rem; background: var(--kd-panel); box-shadow: inset 0.5rem 0 0 var(--c); font-size: 2.4rem; font-weight: 800; }
.kd-row.is-left { opacity: 0.5; }
.kd-row__rank { width: 3.6rem; color: var(--kd-dim); }
.kd-row__avatar { width: 4.4rem; height: 4.4rem; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center; font-size: 2.6rem; margin-right: 1.2rem; }
.kd-row__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kd-row__gain { color: #3ddc84; font-size: 2rem; margin-right: 1.6rem; }
.kd-row__score { min-width: 6rem; text-align: right; }
@keyframes kd-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .kd-hot__avatar, .kd-answer__check, .kd-mini, .kd-pill.is-big { animation: none; }
}
`;
