// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
// Zeitversetzte Animationen der Auflösung nutzen „both“, damit sie vor ihrem Start unsichtbar sind.
export const TV_CSS = /* css */ `
.fl-tv {
  --fl-dim: #b9b3d6;
  --fl-panel: #221a3d;
  --fl-accent: #ff8a3d;
  --fl-gold: #ffd24d;
  --fl-good: #3ddc84;
  --fl-lie: #ff4f6d;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 2.2rem 5rem 1.6rem; color: #f7f3ff;
  background:
    radial-gradient(70rem 32rem at 50% 0%, rgba(255,138,61,0.20), rgba(255,138,61,0) 70%),
    radial-gradient(50rem 30rem at 100% 100%, rgba(178,107,255,0.16), rgba(178,107,255,0) 70%),
    var(--bg, #120f24);
  font-variant-numeric: tabular-nums;
}
.fl-tv *, .fl-tv *::before, .fl-tv *::after { box-sizing: border-box; }
.fl-tv h1, .fl-tv h2, .fl-tv p, .fl-tv ol { margin: 0; }

/* Avatare */
.fl-av {
  position: relative; width: 5rem; height: 5rem; flex: none; border-radius: 50%; background: var(--c);
  display: flex; align-items: center; justify-content: center; font-size: 3rem; line-height: 1;
  box-shadow: 0 0 0 0.3rem rgba(0,0,0,0.25);
}
.fl-av.is-waiting { opacity: 0.55; }
.fl-av.is-off { opacity: 0.3; filter: grayscale(1); }
.fl-av.is-done { box-shadow: 0 0 0 0.3rem var(--fl-good), 0 0 1.6rem rgba(61,220,132,0.6); animation: fl-pop 0.4s both; }
.fl-av__badge { position: absolute; right: -0.6rem; bottom: -0.5rem; font-size: 2rem; }
.fl-av--mini { width: 3.6rem; height: 3.6rem; font-size: 2.2rem; box-shadow: none; }

/* Logo: Pinocchio mit wachsender Nase */
.fl-logo { position: relative; display: inline-block; vertical-align: middle; width: 8.6rem; height: 6rem; margin-right: 1.4rem; }
.fl-logo__face { position: absolute; left: 0; top: 0; font-size: 5.6rem; line-height: 6rem; z-index: 1; }
.fl-logo__nose {
  position: absolute; left: 4.6rem; top: 3.1rem; width: 4rem; height: 0.8rem; border-radius: 0.4rem;
  background: linear-gradient(90deg, #f5b26b, #e88a3a); transform-origin: left center;
  animation: fl-nose 2.4s ease-in-out infinite alternate;
}
.fl-logo--small { width: 5rem; height: 3.6rem; margin-right: 0.6rem; }
.fl-logo--small .fl-logo__face { font-size: 3.2rem; line-height: 3.6rem; }
.fl-logo--small .fl-logo__nose { left: 2.6rem; top: 1.85rem; width: 2.3rem; height: 0.5rem; }

/* Intro */
.fl-intro, .fl-ranking, .fl-final { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.fl-title { font-size: 5.4rem; font-weight: 900; text-align: center; display: flex; align-items: center; justify-content: center; letter-spacing: 0.02em; }
.fl-title--mid { font-size: 4.4rem; }
.fl-lead { font-size: 2.6rem; font-weight: 800; margin-top: 1.4rem !important; }
.fl-sub { font-size: 2rem; color: var(--fl-dim); margin-top: 0.6rem !important; }
.fl-cats { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.6rem; max-width: 90rem; }
.fl-cats span { font-size: 1.6rem; font-weight: 700; padding: 0.4rem 1.2rem; margin: 0.4rem; border-radius: 99rem; background: rgba(255,138,61,0.16); color: #ffd0ad; }
.fl-rules { margin-top: 1.8rem !important; padding: 0 0 0 2.4rem; font-size: 2.1rem; color: var(--fl-dim); max-width: 84rem; }
.fl-rules li { margin-top: 0.7rem; }
.fl-starts { margin-top: 2rem !important; font-size: 2.2rem; color: var(--fl-dim); }
.fl-starts b { color: var(--fl-accent); font-size: 3rem; margin-left: 0.6rem; }
.fl-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 2rem; }
.fl-avatars__item, .fl-strip__item { display: flex; flex-direction: column; align-items: center; margin: 0 1rem; }
.fl-avatars__item small, .fl-strip__item small { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; max-width: 10rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Kopf */
.fl-head { width: 100%; display: flex; align-items: center; min-height: 6.4rem; flex: none; }
.fl-cat { font-size: 1.7rem; font-weight: 800; padding: 0.4rem 1.4rem; border-radius: 99rem; background: rgba(255,138,61,0.18); color: #ffc08f; }
.fl-round { font-size: 1.7rem; color: var(--fl-dim); margin-left: 1.6rem; }
.fl-spacer { flex: 1; }
.fl-steps { font-size: 1.8rem; font-weight: 800; color: var(--fl-dim); }
.fl-clock {
  width: 6.4rem; height: 6.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 900; background: var(--fl-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}
.fl-clock.is-hurry { color: var(--fl-lie); box-shadow: inset 0 0 0 0.3rem var(--fl-lie); }
.fl-double { font-weight: 900; color: #1a1400; background: var(--fl-gold); border-radius: 99rem; }
.fl-double--chip { font-size: 1.6rem; padding: 0.3rem 1.2rem; margin-left: 1.6rem; }
.fl-double--banner {
  font-size: 2.6rem; padding: 0.6rem 2.6rem; margin-top: 1rem !important; flex: none;
  box-shadow: 0 0 2.4rem rgba(255,210,77,0.5); animation: fl-pulse 1.2s ease-in-out infinite;
}

/* Frage */
.fl-question {
  flex: 1; display: flex; align-items: center; justify-content: center; text-align: center;
  font-size: 5rem; font-weight: 900; line-height: 1.18; max-width: 96rem;
}
.fl-question--small { flex: none; font-size: 2.9rem; line-height: 1.22; margin-top: 0.4rem !important; max-width: 104rem; }
.fl-hint { font-size: 2.4rem; font-weight: 800; color: #ffc08f; display: flex; align-items: center; }
.fl-timebar { width: 100%; height: 1.2rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 2rem; flex: none; }
.fl-timebar span { display: block; height: 100%; background: var(--fl-accent); transform-origin: left center; transition: transform 0.25s linear, background-color 0.3s; }
.fl-timebar span.is-hurry { background: var(--fl-lie); }
.fl-strip { display: flex; align-items: flex-end; justify-content: center; flex-wrap: wrap; margin-top: 1.6rem; min-height: 8rem; flex: none; }
.fl-strip__label { font-size: 1.9rem; font-weight: 700; color: var(--fl-dim); margin-left: 1.6rem; align-self: center; }

/* Antwortraster */
.fl-grid {
  flex: 1; width: 100%; display: grid; grid-gap: 1.4rem 1.8rem; gap: 1.4rem 1.8rem; margin-top: 1.6rem;
  grid-auto-rows: 1fr; align-content: center; min-height: 0;
}
.fl-grid--c2 { grid-template-columns: 1fr 1fr; }
.fl-grid--c3 { grid-template-columns: 1fr 1fr 1fr; }
.fl-tile {
  display: flex; align-items: center; justify-content: center; text-align: center; min-height: 0; overflow: hidden;
  padding: 1rem 2rem; border-radius: 1.8rem; background: linear-gradient(160deg, #2d2350, #221a3d);
  box-shadow: inset 0 0 0 0.25rem rgba(255,138,61,0.45), 0 0.6rem 0 rgba(0,0,0,0.25);
  animation: fl-pop 0.45s cubic-bezier(.3,1.5,.5,1) both;
}
.fl-tile__text { font-size: 3.2rem; font-weight: 800; line-height: 1.15; word-break: break-word; }
.fl-grid.is-dense { grid-gap: 1rem 1.4rem; gap: 1rem 1.4rem; }
.fl-grid.is-dense .fl-tile { padding: 0.6rem 1.4rem; border-radius: 1.4rem; }
.fl-grid.is-dense .fl-tile__text { font-size: 2.5rem; }

/* Auflösung */
.fl-stage { position: relative; flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.fl-card {
  position: relative; max-width: 100rem; min-width: 50rem; padding: 2.4rem 5rem 3.8rem; border-radius: 2.4rem; text-align: center;
  background: linear-gradient(160deg, #33285c, #241b42); box-shadow: inset 0 0 0 0.35rem rgba(255,255,255,0.18), 0 1rem 3rem rgba(0,0,0,0.4);
  margin-bottom: 2.6rem; animation: fl-zoom 0.5s cubic-bezier(.3,1.5,.5,1) both;
}
.fl-card__text { font-size: 4.6rem; font-weight: 900; line-height: 1.15; word-break: break-word; }
.fl-card--truth { background: linear-gradient(160deg, #1f5c3f, #183c2e); box-shadow: inset 0 0 0 0.4rem var(--fl-good), 0 0 4rem rgba(61,220,132,0.45); }
.fl-stamp {
  position: absolute; right: -3rem; bottom: -2.6rem; padding: 0.2rem 1.6rem; border-radius: 1rem; border: 0.45rem solid currentColor;
  font-size: 3.2rem; font-weight: 900; letter-spacing: 0.08em; background: rgba(18,15,36,0.92); white-space: nowrap;
  transform: rotate(-8deg); animation: fl-stamp 0.4s cubic-bezier(.2,1.6,.4,1) both;
}
.fl-stamp--lie { color: var(--fl-lie); }
.fl-stamp--truth { color: var(--fl-good); }
.fl-fallers { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 1.4rem; min-height: 7.6rem; }
.fl-fallers__label { font-size: 2.2rem; font-weight: 800; color: var(--fl-dim); margin-right: 1.4rem; animation: fl-fade 0.3s both; }
.fl-faller { display: flex; flex-direction: column; align-items: center; margin: 0 0.8rem; animation: fl-fly 0.55s cubic-bezier(.3,1.4,.5,1) both; }
.fl-faller small { font-size: 1.5rem; font-weight: 700; margin-top: 0.3rem; max-width: 10rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl-author { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 1.6rem !important; font-size: 3rem; animation: fl-pop 0.45s cubic-bezier(.3,1.6,.5,1) both; }
.fl-author > * { margin: 0 0.5rem; }
.fl-author b { font-weight: 900; color: var(--fl-gold); }
.fl-author small { font-size: 1.8rem; color: var(--fl-dim); }
.fl-gain { font-weight: 900; color: var(--fl-good); font-size: 3rem; }
.fl-drum {
  position: absolute; left: 0; right: 0; top: 50%; margin-top: -3rem !important; text-align: center; font-size: 4.4rem; font-weight: 900;
  color: var(--fl-gold); animation: fl-out 0.3s both; z-index: 2;
}
.fl-drum::after { content: " 🥁"; display: inline-block; animation: fl-shake 0.12s linear infinite; }
.fl-fact {
  margin-top: 1.8rem !important; max-width: 100rem; text-align: center; font-size: 2rem; color: #e6e0ff;
  padding: 0.7rem 1.8rem; border-radius: 1rem; background: rgba(255,255,255,0.06); animation: fl-fade 0.6s both;
}
.fl-fact b { color: var(--fl-accent); margin-right: 0.4rem; }
.fl-board { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.2rem; max-width: 110rem; flex: none; }
.fl-board__item {
  font-size: 1.5rem; font-weight: 700; padding: 0.3rem 1.1rem; margin: 0.3rem; border-radius: 99rem;
  background: rgba(255,255,255,0.07); color: var(--fl-dim); max-width: 34rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.fl-board__item.is-lie { color: #ff9aac; text-decoration: line-through; background: rgba(255,79,109,0.12); }
.fl-board__item.is-truth { color: #0c2a1b; background: var(--fl-good); }
.fl-board__item.is-current { box-shadow: inset 0 0 0 0.2rem #fff; text-decoration: none; }

/* Rangliste */
.fl-list { list-style: none; padding: 0; margin-top: 2rem !important; width: 74rem; }
.fl-row {
  display: flex; align-items: center; padding: 0.8rem 1.8rem; margin-top: 0.8rem; border-radius: 1.4rem;
  background: var(--fl-panel); box-shadow: inset 0.5rem 0 0 var(--c); font-size: 2.4rem; font-weight: 800;
  animation: fl-slide 0.4s both;
}
.fl-list.is-dense { margin-top: 1.4rem !important; }
.fl-list.is-dense .fl-row { padding: 0.35rem 1.8rem; margin-top: 0.5rem; font-size: 2.1rem; }
.fl-list.is-dense .fl-row .fl-av { width: 3.8rem; height: 3.8rem; font-size: 2.3rem; }
.fl-row.is-first { box-shadow: inset 0.5rem 0 0 var(--c), 0 0 0 0.25rem var(--fl-gold); }
.fl-row.is-left { opacity: 0.5; }
.fl-row .fl-av { width: 4.4rem; height: 4.4rem; font-size: 2.6rem; margin-right: 1.4rem; }
.fl-row__rank { width: 4rem; color: var(--fl-dim); }
.fl-row__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl-row__name small { font-size: 1.6rem; color: var(--fl-dim); }
.fl-row__gain { color: var(--fl-good); font-size: 2rem; margin-right: 1.8rem; }
.fl-row__score { min-width: 7rem; text-align: right; }

/* Finale */
.fl-podium { display: flex; align-items: flex-end; justify-content: center; margin-top: 1rem; flex: 1; min-height: 0; }
.fl-step { display: flex; flex-direction: column; align-items: center; width: 24rem; margin: 0 1.2rem; animation: fl-rise 0.7s both; }
.fl-step.is-left { opacity: 0.6; }
.fl-step .fl-av { width: 6.6rem; height: 6.6rem; font-size: 4rem; }
.fl-step.r1 .fl-av { width: 8.4rem; height: 8.4rem; font-size: 5rem; box-shadow: 0 0 0 0.4rem var(--fl-gold), 0 0 3rem var(--fl-gold); }
.fl-step__name { font-size: 2.5rem; font-weight: 900; margin-top: 0.7rem; max-width: 24rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl-step__score { font-size: 1.9rem; color: var(--fl-dim); font-weight: 700; }
.fl-step__block {
  width: 100%; margin-top: 0.8rem; border-radius: 1.4rem 1.4rem 0 0; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 0.8rem; font-size: 4.4rem; font-weight: 900; color: rgba(255,255,255,0.85);
  background: linear-gradient(180deg, var(--c), rgba(34,26,61,0.9));
}
.fl-step.r1 .fl-step__block { height: 13rem; }
.fl-step.r2 .fl-step__block { height: 9rem; }
.fl-step.r3 .fl-step__block { height: 6rem; }
.fl-step.r1 { animation-delay: 0.6s; }
.fl-step.r2 { animation-delay: 0.3s; }
.fl-rest { display: flex; flex-wrap: wrap; justify-content: center; max-width: 110rem; margin-top: 1rem; flex: none; }
.fl-chip {
  display: flex; align-items: center; padding: 0.3rem 1.2rem 0.3rem 0.6rem; margin: 0.3rem 0.5rem; border-radius: 99rem;
  background: var(--fl-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.7rem; font-weight: 700; animation: fl-pop 0.4s both;
}
.fl-chip > :not(:first-child) { margin-left: 0.7rem; }
.fl-chip .fl-av--mini { width: 3rem; height: 3rem; font-size: 1.9rem; }
.fl-chip__name { max-width: 14rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl-chip__pts { color: var(--fl-dim); }
.fl-awards { display: flex; justify-content: center; margin-top: 1.2rem; flex: none; }
.fl-award {
  display: flex; align-items: center; width: 30rem; margin: 0 0.7rem; padding: 0.7rem 1.4rem; border-radius: 1.6rem;
  background: rgba(255,210,77,0.12); box-shadow: inset 0 0 0 0.2rem rgba(255,210,77,0.55); animation: fl-pop 0.5s both;
}
.fl-award__icon { font-size: 3.4rem; margin-right: 1rem; flex: none; }
.fl-award__text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.fl-award__text b { font-size: 1.6rem; color: var(--fl-gold); white-space: nowrap; }
.fl-award__who { font-size: 2rem; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fl-award__text small { font-size: 1.5rem; color: var(--fl-dim); }
.fl-finalbar { width: 60rem; height: 0.8rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.4rem; flex: none; }
.fl-finalbar span { display: block; height: 100%; background: var(--fl-accent); transform-origin: left center; transition: transform 0.25s linear; }

@keyframes fl-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fl-zoom { from { transform: scale(0.3); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fl-fly { from { transform: translateY(-14rem) scale(0.3) rotate(-30deg); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fl-stamp { from { transform: rotate(-8deg) scale(3); opacity: 0; } to { transform: rotate(-8deg) scale(1); opacity: 1; } }
@keyframes fl-out { from { opacity: 1; } to { opacity: 0; transform: scale(0.8); } }
@keyframes fl-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fl-shake { 0% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } 100% { transform: rotate(-8deg); } }
@keyframes fl-pulse { 50% { transform: scale(1.05); } }
@keyframes fl-nose { from { transform: scaleX(0.55); } to { transform: scaleX(1.25); } }
@keyframes fl-slide { from { transform: translateX(-3rem); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes fl-rise { from { transform: translateY(8rem); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .fl-logo__nose, .fl-double--banner, .fl-tile, .fl-card, .fl-stamp, .fl-faller, .fl-author, .fl-fallers__label,
  .fl-fact, .fl-row, .fl-step, .fl-chip, .fl-award, .fl-drum::after, .fl-av.is-done { animation-duration: 0.01ms; }
}
`;
