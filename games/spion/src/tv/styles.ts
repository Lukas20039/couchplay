// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web). Agenten-Look: Nachtblau, Raster,
// Akten-Karten, rote Stempel, Schreibmaschinenschrift für Etiketten.
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein inset, kein aspect-ratio,
// kein clamp(). Animationen nur über transform/opacity. Zeitversetzte Animationen nutzen „both“, damit sie vor
// ihrem Start unsichtbar sind.
export const TV_CSS = /* css */ `
.sp-tv {
  --sp-dim: #9fb0c8;
  --sp-panel: #172133;
  --sp-panel2: #1e2a40;
  --sp-accent: #e63946;
  --sp-gold: #ffd24d;
  --sp-good: #3ddc84;
  --sp-paper: #eadfc4;
  --sp-ink: #2b2118;
  --sp-mono: "Courier New", Courier, "Liberation Mono", monospace;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 2rem 4.5rem 1.6rem; color: #eef3fb;
  background:
    radial-gradient(60rem 30rem at 50% -5%, rgba(230,57,70,0.20), rgba(230,57,70,0) 70%),
    radial-gradient(50rem 30rem at 100% 100%, rgba(64,140,255,0.14), rgba(64,140,255,0) 70%),
    repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0, rgba(255,255,255,0.025) 0.1rem, transparent 0.1rem, transparent 4rem),
    repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0, rgba(255,255,255,0.025) 0.1rem, transparent 0.1rem, transparent 4rem),
    var(--bg, #0b1220);
  font-variant-numeric: tabular-nums;
}
.sp-tv *, .sp-tv *::before, .sp-tv *::after { box-sizing: border-box; }
.sp-tv h1, .sp-tv h2, .sp-tv p, .sp-tv ol { margin: 0; }

/* Avatare */
.sp-av {
  position: relative; width: 5rem; height: 5rem; flex: none; border-radius: 50%; background: var(--c);
  display: flex; align-items: center; justify-content: center; font-size: 3rem; line-height: 1;
  box-shadow: 0 0 0 0.3rem rgba(0,0,0,0.3);
}
.sp-av.is-waiting { opacity: 0.55; }
.sp-av.is-off { opacity: 0.3; filter: grayscale(1); }
.sp-av.is-done { box-shadow: 0 0 0 0.3rem var(--sp-good), 0 0 1.6rem rgba(61,220,132,0.6); animation: sp-pop 0.4s both; }
.sp-av__badge { position: absolute; right: -0.6rem; bottom: -0.5rem; font-size: 2rem; }
.sp-av--mini { width: 3.6rem; height: 3.6rem; font-size: 2.2rem; box-shadow: none; }
.sp-av--big { width: 9rem; height: 9rem; font-size: 5.6rem; box-shadow: 0 0 0 0.45rem rgba(255,255,255,0.15), 0 0 3rem rgba(230,57,70,0.5); }
.sp-av--vote { width: 3.4rem; height: 3.4rem; font-size: 2rem; margin: 0.25rem; box-shadow: 0 0.3rem 0.8rem rgba(0,0,0,0.5); animation: sp-fly 0.5s cubic-bezier(.3,1.4,.5,1) both; }

/* Logo: Agent mit Suchscheinwerfer */
.sp-logo { position: relative; display: inline-block; vertical-align: middle; width: 7rem; height: 6rem; margin-right: 1.4rem; }
.sp-logo__face { position: absolute; left: 0.4rem; top: 0; font-size: 5.6rem; line-height: 6rem; z-index: 1; }
.sp-logo__beam {
  position: absolute; left: 0; top: 0; width: 7rem; height: 6rem; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,210,77,0.35), rgba(255,210,77,0)); animation: sp-beam 2.6s ease-in-out infinite alternate;
}
.sp-logo--small { width: 4.4rem; height: 3.8rem; margin-right: 0.8rem; }
.sp-logo--small .sp-logo__face { font-size: 3.4rem; line-height: 3.8rem; left: 0.2rem; }
.sp-logo--small .sp-logo__beam { width: 4.4rem; height: 3.8rem; }

/* Stempel */
.sp-stamp {
  display: inline-block; padding: 0.2rem 1.4rem; border-radius: 0.8rem; border: 0.4rem solid currentColor; color: var(--sp-accent);
  font-family: var(--sp-mono); font-size: 2.6rem; font-weight: 900; letter-spacing: 0.12em; white-space: nowrap;
  background: #0b1220; transform: rotate(-8deg); animation: sp-stamp 0.4s cubic-bezier(.2,1.6,.4,1) both;
}
.sp-stamp--top { font-size: 2rem; margin-bottom: 1rem; opacity: 0.9; }
.sp-stamp--folder { position: absolute; right: 2rem; bottom: 2.4rem; font-size: 2.4rem; }
.sp-stamp--card { position: absolute; right: 1.4rem; bottom: 1.6rem; font-size: 3rem; z-index: 3; }
.sp-stamp--card.is-innocent { color: var(--sp-good); font-size: 2.3rem; }
.sp-stamp--paper { position: absolute; right: -2rem; top: -1.6rem; font-size: 1.6rem; transform: rotate(9deg); animation: none; }

/* Intro */
.sp-intro, .sp-final { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.sp-intro { justify-content: center; }
.sp-title { font-size: 5.4rem; font-weight: 900; text-align: center; display: flex; align-items: center; justify-content: center; letter-spacing: 0.02em; }
.sp-title--mid { font-size: 4.4rem; }
.sp-lead { font-size: 2.6rem; font-weight: 800; margin-top: 1.2rem !important; }
.sp-cats { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.4rem; max-width: 96rem; }
.sp-cats span { font-size: 1.6rem; font-weight: 700; padding: 0.4rem 1.2rem; margin: 0.4rem; border-radius: 99rem; background: rgba(159,176,200,0.14); color: #d6e0ee; }
.sp-cats .sp-cats__mode { background: rgba(230,57,70,0.22); color: #ffc2c7; font-family: var(--sp-mono); }
.sp-rules { margin-top: 1.6rem !important; padding: 0 0 0 2.6rem; font-size: 2.1rem; color: var(--sp-dim); max-width: 92rem; }
.sp-rules li { margin-top: 0.7rem; }
.sp-starts { margin-top: 1.8rem !important; font-size: 2.2rem; color: var(--sp-dim); }
.sp-starts b { color: var(--sp-accent); font-size: 3rem; margin-left: 0.6rem; }
.sp-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 1.8rem; }
.sp-avatars__item, .sp-strip__item { display: flex; flex-direction: column; align-items: center; margin: 0 1rem; }
.sp-avatars__item small, .sp-strip__item small { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; max-width: 10rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Kopf */
.sp-head { width: 100%; display: flex; align-items: center; min-height: 6.4rem; flex: none; }
.sp-cat { font-size: 1.8rem; font-weight: 800; padding: 0.4rem 1.4rem; border-radius: 0.6rem; background: var(--sp-accent); color: #fff; font-family: var(--sp-mono); letter-spacing: 0.05em; text-transform: uppercase; }
.sp-round, .sp-mode { font-size: 1.7rem; color: var(--sp-dim); margin-left: 1.6rem; }
.sp-mode { font-family: var(--sp-mono); }
.sp-spacer { flex: 1; }
.sp-step { font-size: 1.8rem; font-weight: 800; color: var(--sp-dim); margin-right: 1.6rem; }
.sp-clock {
  width: 6.4rem; height: 6.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 900; background: var(--sp-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}
.sp-clock.is-hurry { color: var(--sp-accent); box-shadow: inset 0 0 0 0.3rem var(--sp-accent); }
.sp-timebar { width: 100%; height: 1rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.4rem; flex: none; }
.sp-timebar span { display: block; height: 100%; background: var(--sp-accent); transform-origin: left center; transition: transform 0.25s linear, background-color 0.3s; }
.sp-timebar span.is-hurry { background: var(--sp-gold); }
.sp-strip { display: flex; align-items: flex-end; justify-content: center; flex-wrap: wrap; margin-top: 1.4rem; min-height: 8rem; flex: none; }
.sp-strip__label { font-size: 1.9rem; font-weight: 700; color: var(--sp-dim); margin-left: 1.6rem; align-self: center; }

/* Überschriften */
.sp-headline { display: flex; flex-direction: column; align-items: center; text-align: center; font-size: 4.2rem; font-weight: 900; line-height: 1.15; flex: none; }
.sp-headline small { font-size: 2rem; font-weight: 700; color: var(--sp-dim); margin-top: 0.5rem; }
.sp-headline--vote { margin-top: 0.4rem; }
.sp-headline--vote.is-runoff { color: var(--sp-gold); }
.sp-hint { font-size: 2.2rem; color: var(--sp-dim); margin-top: 0.8rem !important; text-align: center; }

/* Rolle */
.sp-role { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 0; }
.sp-folder {
  position: relative; width: 40rem; height: 19rem; margin: 3.4rem 0 2.2rem; border-radius: 0 1.4rem 1.4rem 1.4rem;
  background: linear-gradient(160deg, #d8c79d, #b9a676); box-shadow: 0 1.4rem 3rem rgba(0,0,0,0.5); animation: sp-float 3s ease-in-out infinite alternate;
}
.sp-folder__tab {
  position: absolute; left: 0; top: -3rem; height: 3rem; padding: 0.4rem 2rem; border-radius: 1rem 1rem 0 0;
  background: #d8c79d; color: var(--sp-ink); font-family: var(--sp-mono); font-size: 1.6rem; font-weight: 900;
}
.sp-folder__eye { position: absolute; left: 2.6rem; top: 2.4rem; font-size: 7.4rem; line-height: 1; opacity: 0.85; }

/* Zug-Hinweis */
.sp-turn {
  display: flex; align-items: center; justify-content: center; flex: none; margin-top: 0.4rem !important; padding: 0.5rem 2.4rem 0.5rem 0.8rem;
  border-radius: 99rem; background: var(--sp-panel); box-shadow: inset 0 0 0 0.3rem var(--c), 0 0 2.4rem rgba(0,0,0,0.4); animation: sp-pop 0.4s both;
}
.sp-turn > :not(:first-child) { margin-left: 1.2rem; }
.sp-turn b { font-size: 3.2rem; font-weight: 900; }
.sp-turn small { font-size: 1.8rem; color: var(--sp-dim); }

/* Kartenraster */
.sp-grid {
  flex: 1; width: 100%; display: grid; grid-gap: 1.6rem 1.8rem; gap: 1.6rem 1.8rem; margin-top: 1.6rem; min-height: 0;
  grid-auto-rows: minmax(0, 1fr); align-content: stretch;
}
.sp-grid--c1 { grid-template-columns: 1fr; }
.sp-grid--c2 { grid-template-columns: 1fr 1fr; }
.sp-grid--c3 { grid-template-columns: 1fr 1fr 1fr; }
.sp-grid--c4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
.sp-grid:not(.is-two) { max-height: 32rem; align-self: center; }
.sp-card {
  position: relative; display: flex; flex-direction: column; min-height: 0; overflow: hidden; padding: 1.2rem 1.4rem;
  border-radius: 0.6rem 1.6rem 1.6rem 1.6rem; background: linear-gradient(165deg, var(--sp-panel2), var(--sp-panel));
  box-shadow: inset 0 0.5rem 0 var(--c), inset 0 0 0 0.2rem rgba(255,255,255,0.08), 0 0.6rem 1.6rem rgba(0,0,0,0.35);
  transition: transform 0.3s, opacity 0.3s;
}
.sp-card.is-left { opacity: 0.35; }
.sp-card.is-dim { opacity: 0.4; }
.sp-card__head { display: flex; align-items: center; flex: none; }
.sp-card__head .sp-av { width: 4.4rem; height: 4.4rem; font-size: 2.6rem; }
.sp-card__name { margin-left: 1rem; font-size: 2.4rem; font-weight: 900; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-card__name small { font-size: 1.5rem; color: var(--sp-dim); }
.sp-card__tag {
  position: absolute; right: 1rem; top: 1rem; font-family: var(--sp-mono); font-size: 1.4rem; font-weight: 900;
  padding: 0.2rem 0.8rem; border-radius: 0.5rem; background: var(--c); color: #0b1220; animation: sp-pulse 1.1s ease-in-out infinite;
}
.sp-card.is-turn { box-shadow: inset 0 0.5rem 0 var(--c), inset 0 0 0 0.35rem var(--c), 0 0 3rem rgba(255,255,255,0.18); transform: scale(1.03); }
.sp-card.is-candidate { box-shadow: inset 0 0.5rem 0 var(--c), inset 0 0 0 0.35rem var(--sp-gold), 0 0 2.4rem rgba(255,210,77,0.35); }
.sp-clues { list-style: none; padding: 0; margin-top: 0.8rem !important; display: flex; flex-direction: column; min-height: 0; }
.sp-clue {
  font-size: 2.4rem; font-weight: 800; line-height: 1.2; padding: 0.25rem 0.9rem; margin-top: 0.5rem; border-radius: 0.6rem;
  background: rgba(255,255,255,0.07); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sp-clue.is-new { animation: sp-pop 0.35s both; }
.sp-clue.is-empty { background: transparent; box-shadow: inset 0 0 0 0.15rem rgba(255,255,255,0.12); min-height: 3.4rem; animation: none; }
.sp-clue.is-passed { color: var(--sp-dim); }
.sp-grid.is-two .sp-clue { font-size: 2.1rem; }
.sp-grid.is-two .sp-clue.is-empty { min-height: 3rem; }

/* Abstimmung / Auflösung */
.sp-count { font-size: 1.9rem; font-weight: 700; color: var(--sp-dim); margin-top: 0.8rem !important; flex: none; }
.sp-headline--reveal { position: relative; width: 100%; min-height: 7.6rem; justify-content: center; }
.sp-reveal__count { font-size: 2.2rem; color: var(--sp-dim); animation: sp-fade 0.3s both; }
.sp-reveal__msg { font-size: 3.6rem; animation: sp-pop 0.45s cubic-bezier(.3,1.6,.5,1) both; }
.sp-reveal__msg.is-caught { color: var(--sp-accent); }
.sp-reveal__msg.is-wrong { color: var(--sp-good); }
.sp-reveal__msg.is-spy { color: var(--sp-accent); font-size: 3rem; }
.sp-reveal__drum {
  position: absolute; left: 0; right: 0; top: 0; text-align: center; font-size: 3.6rem; color: var(--sp-gold);
  animation: sp-out 0.3s both; z-index: 2;
}
.sp-reveal__drum::after { content: " 🥁"; display: inline-block; animation: sp-shake 0.12s linear infinite; }
.sp-voters { display: flex; flex-wrap: wrap; align-items: center; margin-top: 0.6rem; min-height: 3.9rem; flex: none; }
.sp-votes {
  margin-left: auto; font-size: 1.8rem; font-weight: 900; padding: 0.2rem 0.9rem; border-radius: 99rem; white-space: nowrap;
  background: var(--sp-gold); color: #1a1400; animation: sp-pop 0.35s both;
}
.sp-spot {
  position: absolute; left: 0; top: 0; width: 100%; height: 100%; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 0.45rem var(--sp-gold), 0 0 0 0.3rem var(--sp-gold); animation: sp-spot 0.6s both;
}
.sp-card.is-accused { z-index: 2; }
.sp-grid.is-verdict .sp-card.is-accused { transform: scale(1.04); }
.sp-card.is-caught { box-shadow: inset 0 0.5rem 0 var(--c), inset 0 0 0 0.45rem var(--sp-accent), 0 0 3rem rgba(230,57,70,0.6); }
.sp-card.is-innocent { box-shadow: inset 0 0.5rem 0 var(--c), inset 0 0 0 0.45rem var(--sp-good); }
.sp-grid.is-verdict .sp-av--vote { animation: none; }
.sp-grid.is-verdict .sp-votes { animation: none; }
/* Im Urteil liegt der Stempel unten rechts – dort stand vorher der Stimmenzähler. */
.sp-grid.is-verdict .sp-card.is-accused .sp-votes, .sp-grid.is-verdict .sp-card.is-spy .sp-votes { visibility: hidden; }

/* Raten */
.sp-guess { display: flex; align-items: center; justify-content: center; margin-top: 1rem; flex: none; }
.sp-guess .sp-headline { margin-left: 2.4rem; align-items: flex-start; text-align: left; }
.sp-options {
  flex: 1; width: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; grid-auto-rows: minmax(0, 1fr);
  grid-gap: 1.6rem; gap: 1.6rem; margin-top: 2rem; min-height: 0; max-height: 34rem;
}
.sp-option {
  display: flex; align-items: center; justify-content: center; text-align: center; padding: 1rem 1.4rem; border-radius: 1.2rem;
  background: var(--sp-paper); color: var(--sp-ink); font-family: var(--sp-mono); font-size: 3rem; font-weight: 900; line-height: 1.1;
  box-shadow: 0 0.6rem 0 rgba(0,0,0,0.35); word-break: break-word; animation: sp-pop 0.45s cubic-bezier(.3,1.5,.5,1) both;
}
.sp-option.is-long { font-size: 2.3rem; }

/* Ergebnis */
.sp-banner {
  flex: none; margin-top: 0.4rem !important; padding: 0.6rem 3rem; border-radius: 99rem; font-size: 3rem; font-weight: 900;
  text-align: center; animation: sp-pop 0.5s both;
}
.sp-banner.is-group { background: var(--sp-good); color: #062514; }
.sp-banner.is-spy { background: var(--sp-accent); color: #fff; }
.sp-banner.is-none { background: var(--sp-panel2); color: var(--sp-dim); }
.sp-result { display: flex; align-items: center; justify-content: center; width: 100%; margin-top: auto; padding-top: 2rem; flex: none; }
.sp-paper {
  position: relative; display: flex; flex-direction: column; align-items: center; min-width: 52rem; max-width: 78rem; padding: 2rem 4rem 2.4rem;
  border-radius: 0.6rem; background: var(--sp-paper); color: var(--sp-ink); box-shadow: 0 1.2rem 3rem rgba(0,0,0,0.5);
  transform: rotate(-1.2deg); animation: sp-zoom 0.55s cubic-bezier(.3,1.5,.5,1) both;
}
.sp-paper__label { font-family: var(--sp-mono); font-size: 1.8rem; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7; }
.sp-paper__word { font-family: var(--sp-mono); font-size: 6.4rem; font-weight: 900; line-height: 1.1; margin-top: 0.4rem; text-align: center; word-break: break-word; }
.sp-paper__spy { font-size: 2.2rem; margin-top: 0.8rem; }
.sp-paper__spy b { color: #b3121f; }
.sp-paper__guess { font-size: 2.1rem; font-weight: 800; margin-top: 0.8rem; }
.sp-paper__guess.is-right { color: #b3121f; }
.sp-paper__guess.is-wrong { color: #1d6b3f; }
.sp-agent { display: flex; flex-direction: column; align-items: center; margin-left: 5rem; max-width: 30rem; animation: sp-pop 0.5s 0.3s both; }
.sp-agent__label { font-family: var(--sp-mono); font-size: 1.8rem; font-weight: 900; color: var(--sp-accent); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.8rem; }
.sp-agent__name { font-size: 3rem; font-weight: 900; margin-top: 0.8rem; max-width: 30rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-agent__voters { font-size: 1.7rem; color: var(--sp-dim); text-align: center; margin-top: 0.4rem; }
.sp-scores { list-style: none; padding: 0; margin: 2.4rem 0 auto !important; display: flex; flex-wrap: wrap; justify-content: center; max-width: 110rem; flex: none; }
.sp-score {
  display: flex; align-items: center; padding: 0.3rem 1.4rem 0.3rem 0.6rem; margin: 0.4rem 0.5rem; border-radius: 99rem;
  background: var(--sp-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.9rem; font-weight: 800; animation: sp-pop 0.4s both;
}
.sp-score > :not(:first-child) { margin-left: 0.7rem; }
.sp-score.is-left { opacity: 0.5; }
.sp-score .sp-av--mini { width: 3.2rem; height: 3.2rem; font-size: 2rem; }
.sp-score__rank { color: var(--sp-dim); }
.sp-score__name { max-width: 14rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-score__gain { color: var(--sp-good); }
.sp-score__pts { color: var(--sp-dim); }

/* Finale */
.sp-winners { font-size: 2.6rem; font-weight: 900; color: var(--sp-gold); margin-top: 0.4rem !important; flex: none; }
.sp-final .sp-title { font-size: 4rem; }
.sp-podium { display: flex; align-items: flex-end; justify-content: center; margin-top: 0.6rem; flex: 1; min-height: 0; }
.sp-pod { display: flex; flex-direction: column; align-items: center; width: 24rem; margin: 0 1.2rem; animation: sp-rise 0.7s both; }
.sp-pod.is-left { opacity: 0.6; }
.sp-pod .sp-av { width: 6.6rem; height: 6.6rem; font-size: 4rem; }
.sp-pod.r1 .sp-av { width: 8.4rem; height: 8.4rem; font-size: 5rem; box-shadow: 0 0 0 0.4rem var(--sp-gold), 0 0 3rem var(--sp-gold); }
.sp-pod__name { font-size: 2.5rem; font-weight: 900; margin-top: 0.7rem; max-width: 24rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-pod__score { font-size: 1.9rem; color: var(--sp-dim); font-weight: 700; }
.sp-pod__block {
  width: 100%; margin-top: 0.8rem; border-radius: 1.4rem 1.4rem 0 0; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 0.8rem; font-size: 4.4rem; font-weight: 900; color: rgba(255,255,255,0.85);
  background: linear-gradient(180deg, var(--c), rgba(23,33,51,0.9));
}
.sp-pod.r1 .sp-pod__block { height: 10rem; }
.sp-pod.r2 .sp-pod__block { height: 7rem; }
.sp-pod.r3 .sp-pod__block { height: 4.6rem; }
.sp-pod.r1 { animation-delay: 0.6s; }
.sp-pod.r2 { animation-delay: 0.3s; }
.sp-rest { display: flex; flex-wrap: wrap; justify-content: center; max-width: 110rem; margin-top: 1rem; flex: none; }
.sp-chip {
  display: flex; align-items: center; padding: 0.3rem 1.2rem 0.3rem 0.6rem; margin: 0.3rem 0.5rem; border-radius: 99rem;
  background: var(--sp-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.7rem; font-weight: 700; animation: sp-pop 0.4s both;
}
.sp-chip > :not(:first-child) { margin-left: 0.7rem; }
.sp-chip .sp-av--mini { width: 3rem; height: 3rem; font-size: 1.9rem; }
.sp-chip__name { max-width: 14rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-chip__pts { color: var(--sp-dim); }
.sp-awards { display: flex; justify-content: center; margin-top: 1.2rem; flex: none; }
.sp-award {
  display: flex; align-items: center; width: 34rem; margin: 0 0.7rem; padding: 0.7rem 1.4rem; border-radius: 1.6rem;
  background: rgba(255,210,77,0.12); box-shadow: inset 0 0 0 0.2rem rgba(255,210,77,0.55); animation: sp-pop 0.5s both;
}
.sp-award__icon { font-size: 3.4rem; margin-right: 1rem; flex: none; }
.sp-award__text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.sp-award__text b { font-size: 1.6rem; color: var(--sp-gold); white-space: nowrap; }
.sp-award__who { font-size: 2rem; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-award__text small { font-size: 1.5rem; color: var(--sp-dim); }
.sp-finalbar { width: 60rem; height: 0.8rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.4rem; flex: none; }
.sp-finalbar span { display: block; height: 100%; background: var(--sp-accent); transform-origin: left center; transition: transform 0.25s linear; }

@keyframes sp-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes sp-zoom { from { transform: rotate(-1.2deg) scale(0.3); opacity: 0; } to { transform: rotate(-1.2deg); opacity: 1; } }
@keyframes sp-fly { from { transform: translateY(-10rem) scale(0.3) rotate(-30deg); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes sp-stamp { from { transform: rotate(-8deg) scale(3); opacity: 0; } to { transform: rotate(-8deg) scale(1); opacity: 1; } }
@keyframes sp-spot { from { opacity: 0; transform: scale(1.2); } to { opacity: 1; transform: none; } }
@keyframes sp-out { from { opacity: 1; } to { opacity: 0; transform: scale(0.8); } }
@keyframes sp-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sp-shake { 0% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } 100% { transform: rotate(-8deg); } }
@keyframes sp-pulse { 50% { opacity: 0.6; } }
@keyframes sp-beam { from { transform: scale(0.8); opacity: 0.4; } to { transform: scale(1.25); opacity: 1; } }
@keyframes sp-float { from { transform: rotate(-2deg) translateY(0); } to { transform: rotate(1deg) translateY(-1rem); } }
@keyframes sp-rise { from { transform: translateY(8rem); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .sp-logo__beam, .sp-folder, .sp-card__tag, .sp-turn, .sp-clue, .sp-av--vote, .sp-votes, .sp-spot, .sp-stamp, .sp-reveal__msg,
  .sp-reveal__count, .sp-reveal__drum::after, .sp-option, .sp-banner, .sp-paper, .sp-agent, .sp-score, .sp-pod, .sp-chip, .sp-award,
  .sp-av.is-done { animation-duration: 0.01ms; }
}
`;
