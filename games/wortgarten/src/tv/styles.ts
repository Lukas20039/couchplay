// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Als String, damit es unabhängig vom Bundler (sideEffects: false) zuverlässig ankommt.
// Kein `gap` in Flexbox (ältere Android-TV-WebViews) – Abstände über margin bzw. CSS Grid.
export const TV_CSS = /* css */ `
.wg-tv {
  --wg-bg: #0d1712;
  --wg-panel: #16261d;
  --wg-panel2: #1d3226;
  --wg-line: rgba(232, 240, 220, 0.1);
  --wg-ink: #f4f0e2;
  --wg-dim: #a9b8a4;
  --wg-leaf: #6fbf73;
  --wg-sun: #f2c14e;
  --wg-tile: #f3e6c8;
  --wg-tile-ink: #3a2a18;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 2.6rem 3.6rem;
  color: var(--wg-ink);
  background:
    radial-gradient(60rem 26rem at 15% -6rem, rgba(111, 191, 115, 0.22), transparent 70%),
    radial-gradient(50rem 30rem at 100% 110%, rgba(242, 193, 78, 0.12), transparent 70%),
    var(--wg-bg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums;
}
.wg-tv *, .wg-tv *::before, .wg-tv *::after { box-sizing: border-box; }
.wg-tv h1, .wg-tv h2, .wg-tv p, .wg-tv ul, .wg-tv ol { margin: 0; }
.wg-dim { color: var(--wg-dim); font-size: 1.6rem; }
.wg-kicker { font-size: 1.5rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--wg-leaf); }

/* Avatare */
.wg-avatar {
  position: relative; flex: none;
  width: 4.6rem; height: 4.6rem; border-radius: 50%;
  display: grid; place-items: center; font-size: 2.6rem;
  background: var(--wg-panel2); box-shadow: 0 0 0 0.3rem var(--pc);
  transition: opacity 0.3s;
}
.wg-avatar.is-mini { width: 3.2rem; height: 3.2rem; font-size: 1.8rem; box-shadow: 0 0 0 0.2rem var(--pc); }
.wg-avatar.is-off { opacity: 0.25; filter: grayscale(1); }

/* Countdown-Ring */
.wg-ring { position: relative; width: 9rem; height: 9rem; flex: none; }
.wg-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.wg-ring circle { fill: none; stroke-width: 8; }
.wg-ring .wg-ring-track { stroke: var(--wg-line); }
.wg-ring .wg-ring-bar { stroke: var(--wg-leaf); stroke-linecap: round; transition: stroke-dashoffset 0.25s linear, stroke 0.3s; }
.wg-ring.is-low .wg-ring-bar { stroke: #ff8a6b; }
.wg-ring-num { position: absolute; top: 0; right: 0; bottom: 0; left: 0; display: grid; place-items: center; font-size: 3.2rem; font-weight: 800; }
.wg-ring.is-low .wg-ring-num { color: #ffab94; }

/* Buchstabenraster */
.wg-grid {
  --n: 4;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  grid-template-rows: repeat(var(--n), 1fr);
  gap: 1rem;
  width: 50rem; height: 50rem;
  padding: 1.4rem;
  border-radius: 2rem;
  background: linear-gradient(160deg, #4b3420, #2e1f12);
  box-shadow: inset 0 0 0 0.25rem rgba(255, 255, 255, 0.05), 0 1.6rem 4rem rgba(0, 0, 0, 0.45);
}
.wg-grid.s5 { --n: 5; gap: 0.85rem; }
.wg-grid.s6 { --n: 6; gap: 0.7rem; }
.wg-tile {
  position: relative;
  display: grid; place-items: center;
  border-radius: 1.1rem;
  background: linear-gradient(180deg, #fbf1d9, var(--wg-tile));
  color: var(--wg-tile-ink);
  box-shadow: inset 0 -0.45rem 0 rgba(90, 60, 30, 0.25), 0 0.3rem 0.6rem rgba(0, 0, 0, 0.3);
  font-weight: 900; font-size: 6.4rem; line-height: 1;
  animation: wg-sprout 0.5s cubic-bezier(.2,.9,.3,1.2) both;
}
.wg-grid.s5 .wg-tile { font-size: 5.2rem; }
.wg-grid.s6 .wg-tile { font-size: 4.3rem; border-radius: 0.9rem; }
.wg-tile.is-gold {
  background: linear-gradient(180deg, #ffe9a3, #f2c14e);
  box-shadow: inset 0 -0.45rem 0 rgba(140, 90, 0, 0.35), 0 0 1.6rem rgba(242, 193, 78, 0.65);
}
.wg-tile.is-gold::after { content: "✨"; position: absolute; top: 0.3rem; right: 0.5rem; font-size: 1.6rem; }
.wg-grid.is-small { width: 26rem; height: 26rem; padding: 0.8rem; gap: 0.5rem; border-radius: 1.2rem; }
.wg-grid.is-small .wg-tile { font-size: 2.9rem; border-radius: 0.6rem; animation: none; box-shadow: inset 0 -0.25rem 0 rgba(90, 60, 30, 0.25); }
.wg-grid.is-small.s5 .wg-tile { font-size: 2.4rem; }
.wg-grid.is-small.s6 .wg-tile { font-size: 2rem; }
.wg-grid.is-small .wg-tile.is-gold::after { font-size: 0.9rem; top: 0.1rem; right: 0.2rem; }
@keyframes wg-sprout { from { transform: scale(0.6); opacity: 0; } to { transform: none; opacity: 1; } }

/* Intro */
.wg-intro { flex: 1; display: grid; grid-template-columns: 1fr 40rem; gap: 4rem; align-items: center; }
.wg-intro h1 { font-size: 7rem; font-weight: 900; letter-spacing: -0.03em; line-height: 1; }
.wg-tv .wg-sub { font-size: 2.6rem; margin-top: 1.2rem; color: #d7e8c9; font-weight: 600; }
.wg-tv .wg-rules { margin-top: 2.6rem; padding: 0; list-style: none; max-width: 60rem; }
.wg-rules li { position: relative; padding-left: 3rem; font-size: 2.1rem; line-height: 1.35; color: var(--wg-ink); }
.wg-tv .wg-rules li + li { margin-top: 1rem; }
.wg-rules li::before { content: "🌱"; position: absolute; left: 0; top: 0; }
.wg-tv .wg-setup { margin-top: 2.6rem; font-size: 2rem; color: var(--wg-sun); font-weight: 700; }
.wg-tv .wg-locked { margin-top: 0.8rem; font-size: 1.7rem; color: var(--wg-dim); }
.wg-tv .wg-intro-side > * + * { margin-top: 2.4rem; }
.wg-intro-count { display: flex; flex-direction: column; align-items: center; font-size: 1.6rem; color: var(--wg-dim); }
.wg-tv .wg-intro-count > * + * { margin-top: 1rem; }

/* Gartenstufe */
.wg-level { padding: 2rem 2.2rem; border-radius: 1.6rem; background: var(--wg-panel); box-shadow: inset 0 0 0 0.15rem var(--wg-line); }
.wg-tv .wg-level > * + * { margin-top: 1.1rem; }
.wg-level-title { font-size: 2.4rem; font-weight: 800; color: var(--wg-sun); }
.wg-level-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; }
.wg-level-badge { font-size: 2.4rem; font-weight: 800; margin-right: 1.2rem; }
.wg-bar { height: 1rem; border-radius: 1rem; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.wg-bar span { display: block; height: 100%; border-radius: 1rem; background: linear-gradient(90deg, var(--wg-leaf), var(--wg-sun)); transform-origin: left center; transition: transform 1.2s cubic-bezier(.2,.8,.2,1); }
.wg-chips { display: flex; flex-wrap: wrap; margin: 0.6rem -0.4rem 0; }
.wg-chip { margin: 0.4rem; font-size: 1.6rem; padding: 0.4rem 1.1rem; border-radius: 99rem; background: rgba(111, 191, 115, 0.16); color: #d7e8c9; }

/* Runde */
.wg-round { flex: 1; display: grid; grid-template-columns: 50rem 1fr; gap: 3.4rem; min-height: 0; }
.wg-board-wrap { display: flex; flex-direction: column; justify-content: center; align-items: center; }
.wg-tv .wg-gold-hint { margin-top: 1rem; font-size: 1.6rem; color: var(--wg-sun); }
.wg-side { display: flex; flex-direction: column; min-height: 0; }
.wg-side-head { display: flex; align-items: center; justify-content: space-between; }
.wg-tv .wg-mode { font-size: 2.2rem; font-weight: 800; margin-top: 0.4rem; }
.wg-beds { flex: 1; display: flex; flex-direction: column; justify-content: center; margin-top: 1.6rem; min-height: 0; }
.wg-bed {
  display: flex; align-items: center;
  padding: 1.1rem 1.6rem; border-radius: 1.4rem;
  background: linear-gradient(90deg, var(--wg-panel2), var(--wg-panel));
  box-shadow: inset 0.4rem 0 0 var(--pc);
}
.wg-bed + .wg-bed { margin-top: 1.1rem; }
.wg-bed.is-left { opacity: 0.45; }
.wg-bed-main { flex: 1; min-width: 0; margin-left: 1.6rem; }
.wg-bed-top { display: flex; align-items: baseline; justify-content: space-between; }
.wg-bed-name { font-size: 2.2rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wg-bed-score { font-size: 2.6rem; font-weight: 900; margin-left: 1rem; }
.wg-flowers { display: flex; align-items: flex-end; height: 3.2rem; margin-top: 0.4rem; overflow: hidden; }
.wg-flower { font-size: 2.4rem; line-height: 1; margin-right: 0.15rem; animation: wg-grow 0.6s cubic-bezier(.2,.9,.3,1.4) both; transform-origin: bottom center; }
.wg-bed-count { margin-left: auto; font-size: 1.5rem; color: var(--wg-dim); white-space: nowrap; padding-left: 1rem; }
.wg-beds.n5 .wg-bed, .wg-beds.n6 .wg-bed { padding: 0.7rem 1.4rem; }
.wg-beds.n7 .wg-bed, .wg-beds.n8 .wg-bed { padding: 0.5rem 1.4rem; }
.wg-beds.n7 .wg-avatar, .wg-beds.n8 .wg-avatar { width: 3.6rem; height: 3.6rem; font-size: 2rem; }
.wg-beds.n7 .wg-flowers, .wg-beds.n8 .wg-flowers { height: 2.4rem; }
.wg-beds.n7 .wg-flower, .wg-beds.n8 .wg-flower { font-size: 1.9rem; }
.wg-beds.n7 .wg-bed + .wg-bed, .wg-beds.n8 .wg-bed + .wg-bed { margin-top: 0.7rem; }
@keyframes wg-grow { from { transform: scale(0); } to { transform: none; } }

/* Rundenende */
.wg-end { flex: 1; display: grid; grid-template-columns: 30rem 1fr; gap: 3rem; min-height: 0; }
.wg-tv .wg-end-side > * + * { margin-top: 1.4rem; }
.wg-end-side h2 { white-space: nowrap; font-size: 2.6rem; font-weight: 900; letter-spacing: -0.02em; }
.wg-longest-word { font-size: 3rem; font-weight: 900; color: var(--wg-sun); letter-spacing: 0.04em; overflow-wrap: anywhere; }
.wg-longest-who { display: flex; margin-top: 0.6rem; }
.wg-longest-who > * + * { margin-left: 0.8rem; }
.wg-missed p:last-child { font-size: 1.8rem; color: var(--wg-ink); line-height: 1.4; margin-top: 0.4rem; overflow-wrap: anywhere; }
.wg-results { display: flex; flex-direction: column; min-height: 0; }
.wg-tv .wg-legend { display: flex; justify-content: flex-end; margin-bottom: 1rem; }
.wg-tv .wg-legend > * + * { margin-left: 1rem; }
.wg-cards { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, 1fr); gap: 1.4rem; min-height: 0; }
.wg-results.is-many .wg-cards { grid-template-columns: 1fr 1fr 1fr 1fr; }
.wg-card {
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
  padding: 1.4rem 1.6rem; border-radius: 1.4rem; background: var(--wg-panel);
  box-shadow: inset 0 0.4rem 0 var(--pc);
  animation: wg-fade 0.5s both;
}
.wg-card:nth-child(2) { animation-delay: 0.1s; } .wg-card:nth-child(3) { animation-delay: 0.2s; } .wg-card:nth-child(4) { animation-delay: 0.3s; }
.wg-card-head { display: flex; align-items: center; }
.wg-card-name { flex: 1; min-width: 0; margin-left: 1rem; font-size: 2rem; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wg-card-pts { font-size: 2.4rem; font-weight: 900; color: var(--wg-leaf); margin-left: 1rem; }
.wg-words { flex: 1; display: flex; flex-wrap: wrap; align-content: flex-start; margin: 0.8rem -0.3rem 0; overflow: hidden; }
.wg-word { margin: 0.3rem; padding: 0.3rem 0.9rem; border-radius: 0.8rem; font-size: 1.6rem; font-weight: 700; background: rgba(255, 255, 255, 0.07); letter-spacing: 0.03em; }
.wg-word small { font-size: 1.2rem; color: var(--wg-dim); margin-left: 0.3rem; }
.wg-word.is-unique { background: rgba(242, 193, 78, 0.2); color: #ffe39a; }
.wg-word.is-unique small { color: #f2c14e; }
.wg-word.is-shared { color: var(--wg-dim); }
.wg-card-total { margin-top: 0.6rem; text-align: right; font-size: 1.6rem; color: var(--wg-dim); }
.wg-results.is-many .wg-word { font-size: 1.35rem; }
@keyframes wg-fade { from { opacity: 0; transform: translateY(1.2rem); } to { opacity: 1; transform: none; } }

/* Finale */
.wg-final { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.wg-final h2 { font-size: 4rem; font-weight: 900; letter-spacing: -0.02em; }
.wg-final-body { flex: 1; display: grid; grid-template-columns: 1fr 44rem; gap: 3.4rem; margin-top: 2rem; min-height: 0; align-items: start; }
.wg-ranking { list-style: none; padding: 0; }
.wg-rank-row {
  display: grid; grid-template-columns: 4rem 4.6rem 1fr auto; align-items: center; column-gap: 1.6rem;
  height: 5.6rem; padding: 0 1.6rem; border-radius: 1.2rem; background: var(--wg-panel);
  font-size: 2.3rem; font-weight: 700; animation: wg-fade 0.5s both;
}
.wg-rank-row + .wg-rank-row { margin-top: 0.9rem; }
.wg-rank-row.is-first { background: linear-gradient(90deg, rgba(242, 193, 78, 0.35), var(--wg-panel)); }
.wg-rank-row.is-left { opacity: 0.5; }
.wg-rank-num { font-size: 2.5rem; font-weight: 900; color: var(--wg-dim); text-align: right; }
.wg-rank-row.is-first .wg-rank-num { color: var(--wg-sun); }
.wg-rank-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wg-rank-name small { font-size: 1.5rem; color: var(--wg-dim); }
.wg-final-garden > * + * { margin-top: 2rem; }
.wg-news { padding: 1.8rem 2rem; border-radius: 1.6rem; background: rgba(242, 193, 78, 0.1); box-shadow: inset 0 0 0 0.15rem rgba(242, 193, 78, 0.35); animation: wg-fade 0.6s 0.6s both; }
.wg-tv .wg-news-item { display: flex; align-items: center; margin-top: 1.2rem; }
.wg-news-icon { font-size: 3.4rem; margin-right: 1.4rem; }
.wg-news-item strong { font-size: 2.2rem; }
.wg-final-bar { height: 0.8rem; border-radius: 1rem; background: rgba(255, 255, 255, 0.08); overflow: hidden; margin-top: 1.6rem; }
.wg-final-bar span { display: block; height: 100%; background: var(--wg-leaf); transform-origin: left center; transition: transform 0.25s linear; }

.wg-wait { flex: 1; display: grid; place-items: center; font-size: 3rem; color: var(--wg-dim); }

@media (prefers-reduced-motion: reduce) {
  .wg-tv *, .wg-tv *::before, .wg-tv *::after { animation-duration: 1ms !important; transition-duration: 1ms !important; }
}
`;
