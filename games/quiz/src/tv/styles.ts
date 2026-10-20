// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Als String, damit es unabhängig vom Bundler (sideEffects: false) zuverlässig ankommt.
export const TV_CSS = /* css */ `
.qz-tv {
  --qz-bg: #110c22;
  --qz-panel: #1d1638;
  --qz-line: rgba(255, 255, 255, 0.09);
  --qz-ink: #f4f1ff;
  --qz-dim: #a69fc4;
  --qz-accent: #7c4dff;
  --qz-good: #3ddc84;
  --qz-a0: #e23d51;
  --qz-a1: #2e6be6;
  --qz-a2: #f4b400;
  --qz-a3: #1e9e5a;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  
  padding: 3rem 4.4rem 2.6rem;
  color: var(--qz-ink);
  background:
    radial-gradient(70rem 30rem at 50% -8rem, rgba(124, 77, 255, 0.28), transparent 70%),
    var(--qz-bg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums;
}
.qz-tv > :not(:first-child) { margin-top: 2rem; }
.qz-tv *, .qz-tv *::before, .qz-tv *::after { box-sizing: border-box; }
.qz-tv h1, .qz-tv h2, .qz-tv p { margin: 0; }

/* Kopfzeile */
.qz-head { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2rem; }
.qz-meta { display: flex; flex-direction: column;  }
.qz-meta > :not(:first-child) { margin-top: 0.9rem; }
.qz-cat {
  align-self: flex-start;
  font-size: 1.7rem; font-weight: 700;
  padding: 0.45rem 1.2rem; border-radius: 99rem;
  background: rgba(124, 77, 255, 0.22); color: #d9ccff;
}
.qz-progress { display: flex; align-items: center;  font-size: 1.6rem; color: var(--qz-dim); }
.qz-progress > :not(:first-child) { margin-left: 1.2rem; }
.qz-ticks { display: flex;  }
.qz-ticks > :not(:first-child) { margin-left: 0.35rem; }
.qz-tick { width: 1.6rem; height: 0.45rem; border-radius: 1rem; background: var(--qz-line); }
.qz-tick.is-done { background: rgba(124, 77, 255, 0.55); }
.qz-tick.is-now { background: var(--qz-ink); }

/* Countdown-Ring */
.qz-ring { position: relative; width: 9.5rem; height: 9.5rem; flex: none; }
.qz-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.qz-ring circle { fill: none; stroke-width: 8; }
.qz-ring .qz-ring-track { stroke: var(--qz-line); }
.qz-ring .qz-ring-bar { stroke: var(--qz-ink); stroke-linecap: round; transition: stroke-dashoffset 0.25s linear, stroke 0.3s; }
.qz-ring.is-low .qz-ring-bar { stroke: #ff6b6b; }
.qz-ring-num {
  position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: grid; place-items: center;
  font-size: 3.6rem; font-weight: 800; letter-spacing: -0.02em;
}
.qz-ring.is-low .qz-ring-num { color: #ff8a8a; }

/* Frage */
.qz-question {
  flex: 1; display: flex; align-items: center;
  font-size: 3.9rem; line-height: 1.14; font-weight: 800; letter-spacing: -0.015em;
  max-width: 86rem; text-wrap: balance;
}

/* Antworten */
.qz-answers { display: grid; grid-template-columns: 1fr 1fr; gap: 1.3rem; }
.qz-answer {
  position: relative; overflow: hidden;
  display: flex; align-items: center; 
  min-height: 8.6rem; padding: 1rem 2rem;
  border-radius: 1.1rem;
  font-size: 2.5rem; font-weight: 700; line-height: 1.15;
  color: #fff;
  transition: opacity 0.5s, transform 0.5s;
}
.qz-answer > :not(:first-child) { margin-left: 1.6rem; }
.qz-answer > .qz-bar { margin-left: 0; } /* absolut positioniert, kein Abstand */
.qz-answer.a0 { background: var(--qz-a0); }
.qz-answer.a1 { background: var(--qz-a1); }
.qz-answer.a2 { background: var(--qz-a2); color: #261b00; }
.qz-answer.a3 { background: var(--qz-a3); }
.qz-answer .qz-shape { width: 4rem; height: 4rem; flex: none; fill: currentColor; }
.qz-answer-text { flex: 1; }
.qz-answer.is-wrong { opacity: 0.28; }
.qz-answer.is-correct { transform: scale(1.025); box-shadow: 0 0 0 0.35rem #fff, 0 1.2rem 3rem rgba(0, 0, 0, 0.45); }
.qz-answer-votes { display: flex; align-items: center;  font-size: 1.7rem; font-weight: 700; }
.qz-answer-votes > :not(:first-child) { margin-left: 0.8rem; }
.qz-answer-votes .qz-mini { width: 2.6rem; height: 2.6rem; font-size: 1.5rem; }
.qz-bar {
  position: absolute; left: 0; bottom: 0; height: 0.55rem; width: 100%;
  background: currentColor; opacity: 0.55;
  transform-origin: left center; transition: transform 0.9s cubic-bezier(.2,.8,.2,1);
}
.qz-check {
  width: 3rem; height: 3rem; flex: none; border-radius: 50%;
  display: grid; place-items: center; background: #fff; color: #111; font-size: 2rem; font-weight: 900;
}

/* Spieler-Leiste */
.qz-strip { display: flex; align-items: center;  min-height: 5.4rem; }
.qz-strip > :not(:first-child) { margin-left: 1.6rem; }
.qz-strip > .qz-strip-label { margin-left: auto; } /* rechtsbündig */
.qz-strip-label { font-size: 1.6rem; color: var(--qz-dim); margin-left: auto; }
.qz-avatar {
  position: relative; flex: none;
  width: 4.6rem; height: 4.6rem; border-radius: 50%;
  display: grid; place-items: center; font-size: 2.6rem;
  background: var(--qz-panel); box-shadow: 0 0 0 0.3rem var(--pc);
  transition: opacity 0.3s, transform 0.3s;
}
.qz-avatar.is-waiting { opacity: 0.35; }
.qz-avatar.is-done { transform: translateY(-0.4rem); }
.qz-avatar.is-off { opacity: 0.2; filter: grayscale(1); }
.qz-avatar .qz-badge {
  position: absolute; right: -0.5rem; bottom: -0.4rem;
  width: 2rem; height: 2rem; border-radius: 50%;
  display: grid; place-items: center; font-size: 1.2rem; font-weight: 900;
  background: var(--qz-good); color: #06210f;
}
.qz-mini {
  width: 3.2rem; height: 3.2rem; border-radius: 50%; display: grid; place-items: center; font-size: 1.9rem;
  background: rgba(0, 0, 0, 0.25); box-shadow: 0 0 0 0.2rem var(--pc);
}

/* Rundenpunkte (Auflösung) */
.qz-round { display: flex; flex-wrap: wrap;  min-height: 5.4rem; align-items: center; margin-left: calc(1.6rem / -2); margin-right: calc(1.6rem / -2); }
.qz-round > * { margin: calc(1rem / 2) calc(1.6rem / 2); }
.qz-chip { display: flex; align-items: center;  font-size: 1.8rem; font-weight: 700; }
.qz-chip > :not(:first-child) { margin-left: 0.8rem; }
.qz-chip .qz-pts { color: var(--qz-good); }
.qz-chip.is-zero .qz-pts, .qz-chip .qz-pts.is-dim { color: var(--qz-dim); font-weight: 600; }
.qz-note { font-size: 1.8rem; color: var(--qz-dim); }

/* Intro */
.qz-intro { flex: 1; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4rem; }
.qz-intro h1 { font-size: 6.4rem; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
.qz-intro .qz-sub { font-size: 2.6rem; margin-top: 1.4rem; color: #d9ccff; font-weight: 600; }
.qz-intro .qz-hint { font-size: 1.9rem; margin-top: 3rem; color: var(--qz-dim); max-width: 50rem; }
.qz-cats { display: flex; flex-wrap: wrap;  margin-top: calc(2.2rem - 0.8rem / 2); max-width: 64rem; margin-left: calc(0.8rem / -2); margin-right: calc(0.8rem / -2); margin-bottom: calc(0.8rem / -2); }
.qz-cats > * { margin: calc(0.8rem / 2); }
.qz-cats span { font-size: 1.5rem; padding: 0.4rem 1rem; border-radius: 99rem; border: 0.12rem solid var(--qz-line); color: var(--qz-dim); }
.qz-intro-shapes { display: grid; grid-template-columns: repeat(2, 7rem); gap: 1.2rem; }
.qz-intro-shapes div { width: 7rem; height: 7rem; border-radius: 1.2rem; display: grid; place-items: center; }
.qz-intro-shapes .qz-shape { width: 3.6rem; height: 3.6rem; fill: #fff; }
.qz-intro-shapes .a2 .qz-shape { fill: #261b00; }
.qz-intro-shapes .a0 { background: var(--qz-a0); } .qz-intro-shapes .a1 { background: var(--qz-a1); }
.qz-intro-shapes .a2 { background: var(--qz-a2); } .qz-intro-shapes .a3 { background: var(--qz-a3); }
.qz-intro-count { display: flex; flex-direction: column; align-items: center;  font-size: 1.6rem; color: var(--qz-dim); }
.qz-intro-count > :not(:first-child) { margin-top: 1rem; }

/* Zwischenstand */
.qz-title { display: flex; align-items: baseline;  }
.qz-title > :not(:first-child) { margin-left: 1.6rem; }
.qz-title h2 { font-size: 3.6rem; font-weight: 900; letter-spacing: -0.02em; }
.qz-title p { font-size: 1.9rem; color: var(--qz-dim); }
.qz-board { position: relative; flex: 1; width: 100%; max-width: 76rem; margin: 0 auto; }
.qz-row {
  position: absolute; left: 0; right: 0; top: 0;
  display: grid; grid-template-columns: 4rem 4.6rem 1fr auto auto; align-items: center; gap: 1.6rem;
  height: 5.4rem; padding: 0 1.6rem; border-radius: 1rem;
  background: var(--qz-panel);
  font-size: 2.2rem; font-weight: 700;
  transition: transform 0.9s cubic-bezier(.3,.9,.3,1), opacity 0.4s;
  will-change: transform;
}
.qz-row .qz-avatar { width: 3.8rem; height: 3.8rem; font-size: 2.1rem; }
.qz-row-rank { font-size: 2.4rem; font-weight: 900; color: var(--qz-dim); text-align: right; }
.qz-row.is-first { background: linear-gradient(90deg, rgba(124, 77, 255, 0.45), var(--qz-panel)); }
.qz-row.is-first .qz-row-rank { color: var(--qz-ink); }
.qz-row-name { display: flex; align-items: baseline;  min-width: 0; }
.qz-row-name > :not(:first-child) { margin-left: 1rem; }
.qz-row-name span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qz-tag { font-size: 1.4rem; font-weight: 600; color: var(--qz-dim); }
.qz-row.is-left { opacity: 0.5; }
.qz-delta { font-size: 1.7rem; color: var(--qz-good); }
.qz-delta.is-zero { color: transparent; }
.qz-score { min-width: 9rem; text-align: right; }

/* Finale / Podium */
.qz-final-bar { height: 0.8rem; border-radius: 1rem; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
.qz-final-bar span { display: block; height: 100%; background: var(--qz-accent); transform-origin: left center; transition: transform 0.25s linear; }
.qz-podium { flex: 1; display: flex; justify-content: center; align-items: flex-end;  }
.qz-podium > :not(:first-child) { margin-left: 2rem; }
.qz-step { width: 22rem; display: flex; flex-direction: column; align-items: center;  }
.qz-step > :not(:first-child) { margin-top: 0.8rem; }
.qz-step .qz-avatar { width: 7.2rem; height: 7.2rem; font-size: 4.2rem; box-shadow: 0 0 0 0.4rem var(--pc); }
.qz-step-name { font-size: 2.4rem; font-weight: 800; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qz-step-score { font-size: 1.9rem; color: var(--qz-dim); }
.qz-block {
  width: 100%; border-radius: 1rem 1rem 0 0;
  display: flex; justify-content: center; padding-top: 1.4rem;
  font-size: 5rem; font-weight: 900; color: rgba(255, 255, 255, 0.92);
  background: linear-gradient(180deg, #3b2a78, #1d1638);
  transform-origin: bottom center;
  animation: qz-rise 1.1s cubic-bezier(.2,.9,.25,1) both;
}
.qz-step.r1 .qz-block { height: 22rem; background: linear-gradient(180deg, #7c4dff, #2c1d63); }
.qz-step.r2 .qz-block { height: 15rem; }
.qz-step.r3 .qz-block { height: 10rem; }
.qz-step.r2 { animation-delay: 0.2s; }
.qz-step .qz-who { animation: qz-fade 0.6s 0.9s both; display: flex; flex-direction: column; align-items: center;  }
.qz-step .qz-who > :not(:first-child) { margin-top: 0.8rem; }
.qz-rest { display: flex; justify-content: center; flex-wrap: wrap;  min-height: 4rem; margin-left: calc(2.4rem / -2); margin-right: calc(2.4rem / -2); }
.qz-rest > * { margin: calc(1rem / 2) calc(2.4rem / 2); }
@keyframes qz-rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes qz-fade { from { opacity: 0; transform: translateY(1.5rem); } to { opacity: 1; transform: none; } }

.qz-wait { flex: 1; display: grid; place-items: center; font-size: 3rem; color: var(--qz-dim); }

@media (prefers-reduced-motion: reduce) {
  .qz-tv *, .qz-tv *::before, .qz-tv *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
`;
