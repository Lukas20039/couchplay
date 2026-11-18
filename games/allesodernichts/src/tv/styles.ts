// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Als String, damit es unabhängig vom Bundler (sideEffects: false) zuverlässig ankommt.
// Chrome-64-kompatibel (alte Android-TV-WebViews): kein gap in Flexbox, kein inset/clamp/aspect-ratio.
export const TV_CSS = /* css */ `
.an-tv {
  --an-bg: #140d0a;
  --an-panel: #2a1a12;
  --an-line: rgba(255, 255, 255, 0.1);
  --an-ink: #fff6ee;
  --an-dim: #c4a99a;
  --an-accent: #ff9f1c;
  --an-good: #3ddc84;
  --an-bad: #ff5a5f;
  --an-a0: #e23d51;
  --an-a1: #2e6be6;
  --an-a2: #f4b400;
  --an-a3: #1e9e5a;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 2.8rem 4.4rem 2.4rem;
  color: var(--an-ink);
  background:
    radial-gradient(70rem 30rem at 50% -8rem, rgba(255, 159, 28, 0.25), transparent 70%),
    var(--an-bg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums;
}
.an-tv > :not(:first-child) { margin-top: 1.8rem; }
.an-tv *, .an-tv *::before, .an-tv *::after { box-sizing: border-box; }
.an-tv h1, .an-tv h2, .an-tv p, .an-tv ol { margin: 0; }

/* Kopfzeile */
.an-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 2rem; min-height: 9.5rem; }
.an-head-end { display: flex; justify-content: flex-end; }
.an-meta { display: flex; flex-direction: column; }
.an-meta > :not(:first-child) { margin-top: 0.9rem; }
.an-cat {
  align-self: flex-start;
  font-size: 1.7rem; font-weight: 700;
  padding: 0.45rem 1.2rem; border-radius: 99rem;
  background: rgba(255, 159, 28, 0.2); color: #ffd7a1;
}
.an-progress { display: flex; align-items: center; font-size: 1.6rem; color: var(--an-dim); }
.an-progress > :not(:first-child) { margin-left: 1.2rem; }
.an-ticks { display: flex; }
.an-ticks > :not(:first-child) { margin-left: 0.35rem; }
.an-tick { width: 1.4rem; height: 0.45rem; border-radius: 1rem; background: var(--an-line); }
.an-tick.is-done { background: rgba(255, 159, 28, 0.55); }
.an-tick.is-now { background: var(--an-ink); }

/* Einsatzleiter */
.an-stakes { display: flex; align-items: stretch; }
.an-stakes > :not(:first-child) { margin-left: 1rem; }
.an-stake {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 10rem; padding: 0.8rem 0; border-radius: 1.2rem;
  border: 0.2rem solid var(--an-line); color: var(--an-dim);
  transition: background 0.4s, color 0.4s, border-color 0.4s, transform 0.4s;
}
.an-stake-label { font-size: 1.4rem; font-weight: 600; }
.an-stake-value { font-size: 3rem; font-weight: 900; line-height: 1.1; }
.an-stake.is-passed { background: rgba(61, 220, 132, 0.16); border-color: rgba(61, 220, 132, 0.5); color: #b9f5d2; }
.an-stake.is-now { background: var(--an-accent); border-color: var(--an-accent); color: #2b1600; transform: scale(1.08); }

.an-phase-note { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
.an-phase-note strong { font-size: 2.6rem; font-weight: 900; color: var(--an-accent); }
.an-phase-note span { font-size: 1.7rem; color: var(--an-dim); margin-top: 0.4rem; }

/* Countdown-Ring */
.an-ring { position: relative; width: 9.5rem; height: 9.5rem; flex: none; }
.an-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.an-ring circle { fill: none; stroke-width: 8; }
.an-ring .an-ring-track { stroke: var(--an-line); }
.an-ring .an-ring-bar { stroke: var(--an-ink); stroke-linecap: round; transition: stroke-dashoffset 0.25s linear, stroke 0.3s; }
.an-ring.is-low .an-ring-bar { stroke: var(--an-bad); }
.an-ring-num {
  position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: grid; place-items: center;
  font-size: 3.6rem; font-weight: 800; letter-spacing: -0.02em;
}
.an-ring.is-low .an-ring-num { color: #ff8a8a; }

/* Frage */
.an-question {
  flex: 1; display: flex; align-items: center;
  font-size: 3.8rem; line-height: 1.14; font-weight: 800; letter-spacing: -0.015em;
  max-width: 90rem; text-wrap: balance;
}
.an-question.is-small { font-size: 3rem; }

/* Antworten */
.an-answers { display: grid; grid-template-columns: 1fr 1fr; gap: 1.3rem; }
.an-answer {
  position: relative; overflow: hidden;
  display: flex; align-items: center;
  min-height: 8.6rem; padding: 1rem 2rem;
  border-radius: 1.1rem;
  font-size: 2.5rem; font-weight: 700; line-height: 1.15;
  color: #fff;
  transition: opacity 0.35s, transform 0.12s, box-shadow 0.12s, filter 0.35s;
}
.an-answer > :not(:first-child) { margin-left: 1.6rem; }
.an-answer.a0 { background: var(--an-a0); }
.an-answer.a1 { background: var(--an-a1); }
.an-answer.a2 { background: var(--an-a2); color: #261b00; }
.an-answer.a3 { background: var(--an-a3); }
.an-answer .an-shape { width: 4rem; height: 4rem; flex: none; fill: currentColor; }
.an-answer-text { flex: 1; }
.an-answer-votes { display: flex; align-items: center; }
.an-answer-votes > :not(:first-child) { margin-left: 0.5rem; }
.an-answer-votes .an-mini { width: 3rem; height: 3rem; font-size: 1.7rem; }

/* Gestrichen */
.an-answer.is-struck { opacity: 0.22; filter: grayscale(0.85); }
.an-answer.is-struck .an-answer-text { text-decoration: line-through; text-decoration-thickness: 0.3rem; }
.an-struck-tag { font-size: 1.4rem; font-weight: 700; opacity: 0.9; white-space: nowrap; }
.is-reveal .an-answer.is-struck { opacity: 0.35; }

/* Lauflicht */
.is-spin .an-answer:not(.is-lit):not(.is-hit):not(.is-struck) { opacity: 0.45; }
.an-answer.is-lit {
  opacity: 1; transform: scale(1.035);
  box-shadow: 0 0 0 0.45rem #fff, 0 0 3.5rem 0.8rem rgba(255, 255, 255, 0.55);
}
.an-answer.is-hit {
  opacity: 1;
  box-shadow: 0 0 0 0.45rem var(--an-bad), 0 0 4rem 1rem rgba(255, 90, 95, 0.7);
  animation: an-shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
}
.an-answer.is-hit .an-answer-text { text-decoration: line-through; text-decoration-thickness: 0.35rem; }
.an-hit-tag {
  position: absolute; right: 2rem; top: 50%;
  margin-top: -2.6rem; padding: 0.4rem 1.6rem;
  font-size: 3.4rem; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase;
  color: #fff; background: var(--an-bad); border-radius: 0.8rem;
  transform: rotate(-6deg);
  animation: an-stamp 0.35s cubic-bezier(.2,.9,.3,1.4) both;
}
@keyframes an-shake {
  10%, 90% { transform: translateX(-0.2rem); }
  20%, 80% { transform: translateX(0.4rem); }
  30%, 50%, 70% { transform: translateX(-0.8rem); }
  40%, 60% { transform: translateX(0.8rem); }
}
@keyframes an-stamp { from { transform: rotate(-6deg) scale(2.2); opacity: 0; } to { transform: rotate(-6deg) scale(1); opacity: 1; } }

/* Auflösung */
.an-answer.is-correct { opacity: 1; filter: none; transform: scale(1.025); box-shadow: 0 0 0 0.4rem #fff, 0 1.2rem 3rem rgba(0, 0, 0, 0.45); }
.is-reveal .an-answer:not(.is-correct):not(.is-struck) { opacity: 0.35; }
.an-check {
  width: 4rem; height: 4rem; flex: none; border-radius: 50%;
  display: grid; place-items: center; background: #fff; color: #111; font-size: 2.6rem; font-weight: 900;
}
.an-reveal-note { min-height: 2.4rem; font-size: 2rem; font-weight: 700; color: var(--an-accent); text-align: center; }

/* Entscheidung */
.an-decide { flex: 1; display: flex; flex-direction: column; justify-content: center; }
.an-decide h2 { font-size: 3.8rem; font-weight: 900; letter-spacing: -0.015em; color: var(--an-accent); }
.an-decide p { font-size: 2.1rem; margin-top: 0.8rem; color: var(--an-ink); }
.an-dim { color: var(--an-dim); margin-left: 1rem; }

/* Spieler-Leiste */
.an-strip { display: flex; align-items: center; justify-content: center; min-height: 8.6rem; }
.an-strip > :not(:first-child) { margin-left: 1.4rem; }
.an-strip > .an-strip-label { margin-left: auto; }
.an-strip-label { font-size: 1.6rem; color: var(--an-dim); }
.is-pick .an-strip { justify-content: flex-start; }
.an-pl {
  width: 11rem; display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 0.6rem 0.4rem 0.7rem; border-radius: 1rem; background: var(--an-panel);
  transition: background 0.4s, opacity 0.4s;
}
.an-pl > :not(:first-child) { margin-top: 0.35rem; }
.an-pl .an-avatar { width: 4rem; height: 4rem; font-size: 2.3rem; }
.an-pl-name { max-width: 100%; font-size: 1.4rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.an-pl-tag { font-size: 1.35rem; font-weight: 800; white-space: nowrap; color: var(--an-dim); }
.an-pl.is-in .an-pl-tag { color: var(--an-accent); }
.an-pl.is-decided .an-pl-tag { color: var(--an-ink); }
.an-pl.is-cashed { background: rgba(61, 220, 132, 0.15); }
.an-pl.is-cashed .an-pl-tag { color: var(--an-good); }
.an-pl.is-won { background: rgba(61, 220, 132, 0.32); }
.an-pl.is-won .an-pl-tag { color: #d6ffe6; }
.an-pl.is-out { background: rgba(255, 90, 95, 0.2); }
.an-pl.is-out .an-pl-tag { color: #ff9b9e; }
.an-pl.is-abstain { opacity: 0.5; }

.an-avatar {
  position: relative; flex: none;
  width: 4.6rem; height: 4.6rem; border-radius: 50%;
  display: grid; place-items: center; font-size: 2.6rem;
  background: var(--an-panel); box-shadow: 0 0 0 0.3rem var(--pc);
  transition: opacity 0.3s, transform 0.3s;
}
.an-avatar.is-waiting { opacity: 0.35; }
.an-avatar.is-done { transform: translateY(-0.4rem); }
.an-avatar.is-off { opacity: 0.2; filter: grayscale(1); }
.an-avatar .an-badge {
  position: absolute; right: -0.5rem; bottom: -0.4rem;
  width: 2rem; height: 2rem; border-radius: 50%;
  display: grid; place-items: center; font-size: 1.2rem; font-weight: 900;
  background: var(--an-good); color: #06210f;
}
.an-mini {
  width: 3.2rem; height: 3.2rem; border-radius: 50%; display: grid; place-items: center; font-size: 1.9rem;
  background: rgba(0, 0, 0, 0.3); box-shadow: 0 0 0 0.2rem var(--pc);
}

/* Intro */
.an-intro { flex: 1; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4rem; }
.an-intro h1 { font-size: 6.4rem; font-weight: 900; letter-spacing: -0.03em; line-height: 1; color: var(--an-accent); }
.an-intro .an-sub { font-size: 2.6rem; margin-top: 1.4rem; color: #ffd7a1; font-weight: 600; }
.an-rules { margin-top: 2.6rem; padding-left: 3rem; font-size: 2.2rem; line-height: 1.5; max-width: 80rem; }
.an-rules li::marker { color: var(--an-accent); font-weight: 900; }
.an-cats { display: flex; flex-wrap: wrap; margin: 2.2rem -0.4rem -0.4rem; max-width: 80rem; }
.an-cats > * { margin: 0.4rem; }
.an-cats span { font-size: 1.5rem; padding: 0.4rem 1rem; border-radius: 99rem; border: 0.12rem solid var(--an-line); color: var(--an-dim); }
.an-intro-count { display: flex; flex-direction: column; align-items: center; font-size: 1.6rem; color: var(--an-dim); }
.an-intro-count > :not(:first-child) { margin-top: 1rem; }

/* Zwischenstand */
.an-title { display: flex; align-items: baseline; }
.an-title > :not(:first-child) { margin-left: 1.6rem; }
.an-title h2 { font-size: 3.6rem; font-weight: 900; letter-spacing: -0.02em; }
.an-title p { font-size: 1.9rem; color: var(--an-dim); }
.an-board { position: relative; flex: 1; width: 100%; max-width: 76rem; margin: 0 auto; }
.an-row {
  position: absolute; left: 0; right: 0; top: 0;
  display: grid; grid-template-columns: 4rem 4.6rem 1fr auto auto; align-items: center; gap: 1.6rem;
  height: 5.4rem; padding: 0 1.6rem; border-radius: 1rem;
  background: var(--an-panel);
  font-size: 2.2rem; font-weight: 700;
  transition: transform 0.9s cubic-bezier(.3,.9,.3,1), opacity 0.4s;
  will-change: transform;
}
.an-row .an-avatar { width: 3.8rem; height: 3.8rem; font-size: 2.1rem; }
.an-row-rank { font-size: 2.4rem; font-weight: 900; color: var(--an-dim); text-align: right; }
.an-row.is-first { background: linear-gradient(90deg, rgba(255, 159, 28, 0.45), var(--an-panel)); }
.an-row.is-first .an-row-rank { color: var(--an-ink); }
.an-row-name { display: flex; align-items: baseline; min-width: 0; }
.an-row-name > :not(:first-child) { margin-left: 1rem; }
.an-row-name span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.an-tag { font-size: 1.4rem; font-weight: 600; color: var(--an-dim); }
.an-row.is-left { opacity: 0.5; }
.an-delta { font-size: 1.8rem; font-weight: 800; }
.an-delta.is-plus { color: var(--an-good); }
.an-delta.is-minus { color: var(--an-bad); }
.an-delta.is-zero { color: transparent; }
.an-score { min-width: 7rem; text-align: right; }

/* Finale / Podium */
.an-final-bar { height: 0.8rem; border-radius: 1rem; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
.an-final-bar span { display: block; height: 100%; background: var(--an-accent); transform-origin: left center; transition: transform 0.25s linear; }
.an-podium { flex: 1; display: flex; justify-content: center; align-items: flex-end; }
.an-podium > :not(:first-child) { margin-left: 2rem; }
.an-step { width: 22rem; display: flex; flex-direction: column; align-items: center; }
.an-step > :not(:first-child) { margin-top: 0.8rem; }
.an-step .an-avatar { width: 7.2rem; height: 7.2rem; font-size: 4.2rem; box-shadow: 0 0 0 0.4rem var(--pc); }
.an-step-name { font-size: 2.4rem; font-weight: 800; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.an-step-score { font-size: 1.9rem; color: var(--an-ink); }
.an-step-extra { font-size: 1.5rem; color: var(--an-dim); }
.an-block {
  width: 100%; border-radius: 1rem 1rem 0 0;
  display: flex; justify-content: center; padding-top: 1.4rem;
  font-size: 5rem; font-weight: 900; color: rgba(255, 255, 255, 0.92);
  background: linear-gradient(180deg, #6b3a12, #2a1a12);
  transform-origin: bottom center;
  animation: an-rise 1.1s cubic-bezier(.2,.9,.25,1) both;
}
.an-step.r1 .an-block { height: 20rem; background: linear-gradient(180deg, #ff9f1c, #6b3a12); }
.an-step.r2 .an-block { height: 14rem; }
.an-step.r3 .an-block { height: 9rem; }
.an-step .an-who { animation: an-fade 0.6s 0.9s both; display: flex; flex-direction: column; align-items: center; }
.an-step .an-who > :not(:first-child) { margin-top: 0.6rem; }
.an-rest { display: flex; justify-content: center; flex-wrap: wrap; min-height: 4rem; margin: 0 -1.2rem; }
.an-rest > * { margin: 0.5rem 1.2rem; }
.an-chip { display: flex; align-items: center; font-size: 1.8rem; font-weight: 700; }
.an-chip > :not(:first-child) { margin-left: 0.8rem; }
.an-chip .an-pts { color: var(--an-dim); font-weight: 600; }
@keyframes an-rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes an-fade { from { opacity: 0; transform: translateY(1.5rem); } to { opacity: 1; transform: none; } }

.an-wait { flex: 1; display: grid; place-items: center; font-size: 3rem; color: var(--an-dim); }

@media (prefers-reduced-motion: reduce) {
  .an-tv *, .an-tv *::before, .an-tv *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
`;
