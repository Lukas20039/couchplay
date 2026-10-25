// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
export const TV_CSS = /* css */ `
.zg-tv {
  --zg-dim: #b9b0d9;
  --zg-panel: #1f1a3a;
  --zg-accent: #ffb020;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column;
  padding: 2rem 2.4rem; color: #f8f4ff;
  background: radial-gradient(70rem 36rem at 70% 0%, rgba(255,176,32,0.16), rgba(255,176,32,0) 70%), var(--bg, #120f24);
  font-variant-numeric: tabular-nums;
}
.zg-tv *, .zg-tv *::before, .zg-tv *::after { box-sizing: border-box; }
.zg-tv h1, .zg-tv h2, .zg-tv p, .zg-tv ol, .zg-tv ul { margin: 0; }

/* Zentrierte Screens (Intro, Wortwahl, Rangliste) */
.zg-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; }
.zg-title { font-size: 4.4rem; font-weight: 900; text-align: center; }
.zg-lead { font-size: 2.6rem; font-weight: 700; margin-top: 2rem !important; }
.zg-rules { margin-top: 2rem !important; padding: 0 0 0 2.4rem; font-size: 2.1rem; color: var(--zg-dim); max-width: 84rem; }
.zg-rules li { margin-top: 0.8rem; }
.zg-starts { margin-top: 2.6rem !important; font-size: 2.2rem; color: var(--zg-dim); }
.zg-starts b { color: var(--zg-accent); font-size: 3rem; margin-left: 0.6rem; }
.zg-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 2.6rem; }
.zg-avatar { display: flex; flex-direction: column; align-items: center; margin: 0 1.2rem; font-size: 3.6rem; }
.zg-avatar > span { width: 6rem; height: 6rem; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center; }
.zg-avatar small { font-size: 1.5rem; font-weight: 700; margin-top: 0.4rem; max-width: 12rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.zg-round { font-size: 2rem; color: var(--zg-dim); font-weight: 700; }
.zg-big-avatar {
  width: 14rem; height: 14rem; border-radius: 50%; background: var(--c); margin-top: 2.4rem;
  display: flex; align-items: center; justify-content: center; font-size: 8.6rem;
  box-shadow: 0 0 4rem var(--c); animation: zg-pop 0.5s cubic-bezier(.3,1.6,.5,1) both;
}
.zg-choosing { font-size: 4rem; font-weight: 900; margin-top: 2.6rem !important; text-align: center; max-width: 90rem; }
.zg-clock {
  margin-top: 2.4rem; width: 7rem; height: 7rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 3.2rem; font-weight: 900; background: var(--zg-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}

/* Spielfeld: links Blatt, rechts Seitenleiste */
.zg-play { flex: 1; display: flex; min-height: 0; }
.zg-sheet {
  width: 56rem; height: 56rem; flex: none; border-radius: 1.4rem; overflow: hidden; background: #fff;
  box-shadow: 0 0 0 0.4rem rgba(255,255,255,0.08), 0 1.6rem 4rem rgba(0,0,0,0.45);
}
.zg-canvas { display: block; width: 100%; height: 100%; }
.zg-side { flex: 1; min-width: 0; margin-left: 2.4rem; display: flex; flex-direction: column; }

.zg-head { display: flex; align-items: center; }
.zg-head__avatar {
  width: 4.8rem; height: 4.8rem; flex: none; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center;
  font-size: 3rem; box-shadow: 0 0 1.6rem var(--c);
}
.zg-head__name { flex: 1; min-width: 0; margin-left: 1.2rem; font-size: 2.4rem; font-weight: 900; color: var(--c); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zg-head__round { font-size: 1.5rem; color: var(--zg-dim); font-weight: 700; margin-left: 1rem; white-space: nowrap; }

.zg-hint-box { margin-top: 1.6rem; padding: 1.4rem 1.6rem 1rem; border-radius: 1.4rem; background: var(--zg-panel); }
.zg-hint { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-end; min-height: 1.4em; font-weight: 900; line-height: 1.2; }
.zg-hint__cell {
  width: 0.9em; height: 1.2em; margin: 0.12em 0.09em 0; display: flex; align-items: flex-end; justify-content: center;
  border-bottom: 0.12em solid rgba(255,255,255,0.75); text-transform: uppercase;
}
.zg-hint__cell.is-shown { color: var(--zg-accent); border-bottom-color: var(--zg-accent); animation: zg-pop 0.4s both; }
.zg-hint__gap { width: 0.6em; }
.zg-hint__sep { margin: 0 0.06em; }
.zg-hint__count { display: block; text-align: center; margin-top: 0.6rem; font-size: 1.4rem; color: var(--zg-dim); font-weight: 700; }

.zg-timer { display: flex; align-items: center; margin-top: 1.4rem; }
.zg-timer__bar { flex: 1; height: 1.2rem; border-radius: 0.6rem; background: rgba(255,255,255,0.1); overflow: hidden; }
.zg-timer__bar span { display: block; height: 100%; background: var(--zg-accent); transform-origin: left center; transition: transform 0.25s linear; }
.zg-timer__bar span.is-hurry { background: #ff5a5f; }
.zg-timer__secs { width: 5rem; text-align: right; font-size: 2.6rem; font-weight: 900; }
.zg-timer__secs.is-hurry { color: #ff5a5f; }

.zg-players { list-style: none; padding: 0; margin-top: 1.4rem !important; }
.zg-pl {
  display: flex; align-items: center; height: 3.4rem; padding: 0 1.2rem; margin-top: 0.4rem; border-radius: 1rem;
  background: var(--zg-panel); box-shadow: inset 0.4rem 0 0 var(--c); font-size: 1.8rem; font-weight: 800;
  transition: background 0.3s;
}
.zg-pl.is-guessed { background: rgba(61,220,132,0.18); }
.zg-pl.is-left { opacity: 0.45; }
.zg-pl__avatar { width: 2.6rem; height: 2.6rem; flex: none; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin-right: 1rem; }
.zg-pl__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zg-pl__mark { margin-left: 0.6rem; font-size: 1.6rem; }
.zg-pl__gain { margin-left: 0.8rem; color: #3ddc84; font-size: 1.6rem; }
.zg-pl__score { min-width: 5rem; text-align: right; }
.zg-players--grid { display: grid; grid-template-columns: 1fr 1fr; grid-column-gap: 0.8rem; }
.zg-players--grid .zg-pl__gain { display: none; }
.zg-players--grid .zg-pl__score { min-width: 3.6rem; }

.zg-bubbles { list-style: none; padding: 0; margin-top: 1rem !important; flex: 1; min-height: 0; overflow: hidden; }
.zg-bubble {
  position: relative; display: flex; align-items: baseline; margin: 0.9rem 0 0 0.6rem; padding: 0.6rem 1.4rem; border-radius: 1.2rem;
  background: #2a2350; font-size: 1.8rem; max-width: 100%; animation: zg-in 0.3s ease-out both;
}
.zg-bubble::before {
  content: ""; position: absolute; left: -0.6rem; top: 0.9rem; border-style: solid; border-width: 0.6rem 0.8rem 0.6rem 0;
  border-color: transparent #2a2350 transparent transparent;
}
.zg-bubble b { color: var(--c); margin-right: 0.8rem; white-space: nowrap; }
.zg-bubble span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zg-bubble.is-correct { background: rgba(61,220,132,0.22); }
.zg-bubble.is-correct::before { border-color: transparent rgba(61,220,132,0.22) transparent transparent; }
.zg-bubble.is-correct b { color: #3ddc84; }

/* Auflösung */
.zg-word { margin-top: 1.8rem; padding: 1.6rem 2rem; border-radius: 1.4rem; background: var(--zg-panel); text-align: center; box-shadow: inset 0 0 0 0.3rem var(--zg-accent); animation: zg-pop 0.5s both; }
.zg-word span { display: block; font-size: 1.8rem; color: var(--zg-dim); font-weight: 700; }
.zg-word strong { display: block; font-size: 4.4rem; font-weight: 900; color: var(--zg-accent); line-height: 1.15; word-wrap: break-word; }
.zg-status { margin-top: 1.4rem !important; font-size: 2.2rem; font-weight: 800; text-align: center; }

/* Rangliste */
.zg-list { list-style: none; padding: 0; margin-top: 2.4rem !important; width: 70rem; }
.zg-row { display: flex; align-items: center; padding: 0.9rem 1.8rem; margin-top: 0.8rem; border-radius: 1.4rem; background: var(--zg-panel); box-shadow: inset 0.5rem 0 0 var(--c); font-size: 2.4rem; font-weight: 800; }
.zg-row.is-left { opacity: 0.5; }
.zg-row__rank { width: 3.6rem; color: var(--zg-dim); }
.zg-row__avatar { width: 4.4rem; height: 4.4rem; flex: none; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center; font-size: 2.6rem; margin-right: 1.2rem; }
.zg-row__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zg-row__gain { color: #3ddc84; font-size: 2rem; margin-right: 1.6rem; }
.zg-row__score { min-width: 6rem; text-align: right; }
.zg-list--rest { margin-top: 1.6rem !important; width: 60rem; }
.zg-list--rest.is-grid { width: 92rem; display: grid; grid-template-columns: 1fr 1fr; grid-column-gap: 1.6rem; }
.zg-list--rest .zg-row { font-size: 2rem; padding: 0.5rem 1.6rem; margin-top: 0.6rem; }
.zg-list--rest .zg-row__avatar { width: 3.4rem; height: 3.4rem; font-size: 2rem; }

/* Podium */
.zg-podium { display: flex; align-items: flex-end; justify-content: center; margin-top: 1.6rem; }
.zg-step { width: 24rem; margin: 0 1rem; display: flex; flex-direction: column; align-items: center; animation: zg-rise 0.7s cubic-bezier(.3,1.3,.5,1) both; }
.zg-step.is-empty { visibility: hidden; }
.zg-step__avatar { width: 7rem; height: 7rem; border-radius: 50%; background: var(--c); display: flex; align-items: center; justify-content: center; font-size: 4.4rem; box-shadow: 0 0 2.4rem var(--c); }
.zg-step__name { margin-top: 0.8rem; font-size: 2.4rem; font-weight: 900; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.zg-step__score { font-size: 2rem; font-weight: 800; color: var(--zg-dim); }
.zg-step__block {
  margin-top: 0.8rem; width: 100%; display: flex; align-items: flex-start; justify-content: center; padding-top: 0.6rem;
  border-radius: 1.4rem 1.4rem 0 0; background: var(--c); color: #120f24; font-size: 4rem; font-weight: 900;
}
.zg-step--1 .zg-step__block { height: 12rem; }
.zg-step--2 .zg-step__block { height: 8.5rem; }
.zg-step--3 .zg-step__block { height: 6rem; }
.zg-step--1 { animation-delay: 0.3s; }
.zg-step--1 .zg-step__avatar { width: 9rem; height: 9rem; font-size: 5.6rem; }

@keyframes zg-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes zg-in { from { transform: translateX(-2rem); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes zg-rise { from { transform: translateY(6rem); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .zg-big-avatar, .zg-hint__cell.is-shown, .zg-bubble, .zg-word, .zg-step { animation: none; }
}
`;
