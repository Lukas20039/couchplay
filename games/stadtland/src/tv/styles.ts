// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
// Zeitversetzte Animationen (Walze, Kategorien) nutzen „both“, damit sie vor ihrem Start richtig stehen.
export const TV_CSS = /* css */ `
.sl-tv {
  --sl-dim: #a9c4c0;
  --sl-panel: #15302f;
  --sl-accent: #2fc4a0;
  --sl-gold: #ffd24d;
  --sl-good: #3ddc84;
  --sl-bad: #ff5a6e;
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box;
  overflow: hidden; display: flex; flex-direction: column; align-items: center;
  padding: 2.2rem 5rem 1.6rem; color: #f1fbf8;
  background:
    radial-gradient(70rem 32rem at 50% 0%, rgba(47,196,160,0.20), rgba(47,196,160,0) 70%),
    radial-gradient(50rem 30rem at 100% 100%, rgba(255,210,77,0.12), rgba(255,210,77,0) 70%),
    var(--bg, #0d1a1d);
  font-variant-numeric: tabular-nums;
}
.sl-tv *, .sl-tv *::before, .sl-tv *::after { box-sizing: border-box; }
.sl-tv h1, .sl-tv h2, .sl-tv p, .sl-tv ol { margin: 0; }
.sl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Avatare */
.sl-av {
  position: relative; width: 5rem; height: 5rem; flex: none; border-radius: 50%; background: var(--c);
  display: flex; align-items: center; justify-content: center; font-size: 3rem; line-height: 1;
  box-shadow: 0 0 0 0.3rem rgba(0,0,0,0.25);
}
.sl-av.is-off { opacity: 0.3; filter: grayscale(1); }
.sl-av.is-done { box-shadow: 0 0 0 0.3rem var(--sl-good), 0 0 1.6rem rgba(61,220,132,0.6); animation: sl-pop 0.4s both; }
.sl-av__badge { position: absolute; right: -0.6rem; bottom: -0.5rem; font-size: 2rem; }
.sl-av--mini { width: 3.6rem; height: 3.6rem; font-size: 2.2rem; box-shadow: none; }

/* Logo: drei Karteikarten */
.sl-logo { display: inline-flex; align-items: center; margin-right: 1.6rem; }
.sl-logo span {
  display: flex; align-items: center; justify-content: center; width: 5.4rem; height: 6.2rem; margin-right: -0.8rem;
  border-radius: 0.8rem; background: linear-gradient(170deg, #fff8dc, #f0e2b0); color: #12302c; font-size: 4.2rem; font-weight: 900;
  box-shadow: 0 0.4rem 0 rgba(0,0,0,0.3); transform: rotate(-8deg);
}
.sl-logo span:nth-child(2) { transform: translateY(-0.6rem) rotate(2deg); background: linear-gradient(170deg, #d9fff3, #a6efd9); }
.sl-logo span:nth-child(3) { transform: rotate(9deg); background: linear-gradient(170deg, #fff0c2, #ffd24d); }
.sl-logo--small span { width: 3.4rem; height: 4rem; font-size: 2.6rem; border-radius: 0.6rem; margin-right: -0.5rem; }

/* Intro */
.sl-intro, .sl-ranking, .sl-final, .sl-reveal { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.sl-title { font-size: 5.4rem; font-weight: 900; text-align: center; display: flex; align-items: center; justify-content: center; letter-spacing: 0.02em; }
.sl-title--mid { font-size: 4.4rem; }
.sl-lead { font-size: 2.8rem; font-weight: 800; margin-top: 1.4rem !important; color: #c8f5e9; }
.sl-sub { font-size: 2rem; color: var(--sl-dim); margin-top: 0.6rem !important; }
.sl-rules { margin-top: 2rem !important; padding: 0 0 0 2.4rem; font-size: 2.2rem; color: var(--sl-dim); max-width: 90rem; }
.sl-rules li { margin-top: 0.8rem; }
.sl-starts { margin-top: 2rem !important; font-size: 2.2rem; color: var(--sl-dim); }
.sl-starts b { color: var(--sl-accent); font-size: 3rem; margin-left: 0.6rem; }
.sl-rules.is-compact { margin-top: 1.2rem !important; font-size: 1.9rem; }
.sl-rules.is-compact li { margin-top: 0.5rem; }
.sl-intro__custom { display: flex; flex-direction: column; align-items: center; margin-top: 1rem; }
.sl-cats--still { margin-top: 0.6rem; animation: none; }

/* Eigene Kategorien festlegen */
.sl-setup { display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; }
.sl-setup .sl-head .sl-logo { margin-right: 0; }
.sl-setup__list { margin-top: 2.4rem !important; flex: none; }
.sl-setup__list li { animation: sl-slide 0.35s both; }
.sl-setup__empty { margin-top: 6rem !important; font-size: 3rem; font-weight: 800; color: var(--sl-dim); }
.sl-setup__hint { margin-top: auto !important; font-size: 2rem; font-weight: 700; color: #ffb3bd; }
.sl-setup__hint.is-ok { color: var(--sl-dim); }
.sl-avatars { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 2rem; }
.sl-avatars__item, .sl-strip__item { display: flex; flex-direction: column; align-items: center; margin: 0 1rem; }
.sl-avatars__item small, .sl-strip__item small { font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem; max-width: 10rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Kopf */
.sl-head { width: 100%; display: flex; align-items: center; min-height: 6.4rem; flex: none; }
.sl-round { font-size: 1.9rem; font-weight: 700; color: var(--sl-dim); }
.sl-round--center { margin-top: 1rem !important; }
.sl-head .sl-round { margin-left: 1.4rem; }
.sl-head .sl-round:first-child { margin-left: 0; }
.sl-spacer { flex: 1; }
.sl-clock {
  width: 6.4rem; height: 6.4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 3rem; font-weight: 900; background: var(--sl-panel); box-shadow: inset 0 0 0 0.3rem rgba(255,255,255,0.15);
}
.sl-clock.is-hurry { color: var(--sl-bad); box-shadow: inset 0 0 0 0.3rem var(--sl-bad); animation: sl-pulse 1s ease-in-out infinite; }

/* Buchstabe */
.sl-tile {
  display: flex; align-items: center; justify-content: center; flex: none; width: 26rem; height: 26rem; border-radius: 3rem;
  font-size: 19rem; font-weight: 900; line-height: 1; color: #12302c;
  background: linear-gradient(165deg, #fff6c9, #ffd24d 70%, #f5b82e);
  box-shadow: 0 1.2rem 0 rgba(0,0,0,0.35), 0 0 6rem rgba(255,210,77,0.35);
}
.sl-tile--small { width: 14rem; height: 14rem; font-size: 10rem; border-radius: 2rem; }
.sl-tile--chip { width: 5.6rem; height: 5.6rem; font-size: 4rem; border-radius: 1.2rem; box-shadow: 0 0.4rem 0 rgba(0,0,0,0.35); }

/* Walze */
.sl-reel {
  position: relative; width: 28rem; height: 28rem; margin-top: 2.4rem; border-radius: 3rem; overflow: hidden; flex: none;
  background: linear-gradient(165deg, #fff6c9, #ffd24d 70%, #f5b82e);
  box-shadow: 0 1.2rem 0 rgba(0,0,0,0.35), inset 0 2.4rem 2rem -1.6rem rgba(0,0,0,0.35), inset 0 -2.4rem 2rem -1.6rem rgba(0,0,0,0.35);
}
.sl-reel__strip { display: block; animation: sl-spin 2.8s cubic-bezier(.12,.62,.18,1) both; }
.sl-reel__item { display: block; height: 28rem; line-height: 28rem; text-align: center; font-size: 20rem; font-weight: 900; color: #12302c; }
.sl-reel__glow {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 3rem;
  box-shadow: inset 0 0 0 0.6rem #fff, 0 0 5rem #fff; animation: sl-flash 0.9s ease-out both;
}
.sl-cats { display: flex; flex-wrap: wrap; justify-content: center; margin-top: 3rem; max-width: 100rem; animation: sl-fade 0.6s both; }
.sl-cats span { font-size: 2.2rem; font-weight: 800; padding: 0.5rem 1.6rem; margin: 0.5rem; border-radius: 99rem; background: rgba(47,196,160,0.18); color: #bff3e4; }

/* Schreiben */
.sl-board { flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; min-height: 0; }
.sl-board .sl-tile { margin-right: 6rem; animation: sl-pop 0.5s cubic-bezier(.3,1.5,.5,1) both; }
.sl-catlist { list-style: none; padding: 0; min-width: 50rem; max-width: 64rem; counter-reset: sl-cat; }
.sl-catlist li {
  position: relative; padding: 0.7rem 0 0.7rem 5.2rem; font-size: 3.6rem; font-weight: 800; line-height: 1.15;
  border-bottom: 0.25rem dashed rgba(169,196,192,0.35); counter-increment: sl-cat;
}
.sl-catlist li::before {
  content: counter(sl-cat); position: absolute; left: 0; top: 50%; margin-top: -1.8rem; width: 3.6rem; height: 3.6rem; border-radius: 50%;
  background: rgba(47,196,160,0.25); color: #bff3e4; font-size: 2rem; line-height: 3.6rem; text-align: center;
}
.sl-catlist.is-six li { font-size: 3.2rem; padding-top: 0.55rem; padding-bottom: 0.55rem; }
.sl-timebar { width: 100%; height: 1.2rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.6rem; flex: none; }
.sl-timebar span { display: block; height: 100%; background: var(--sl-accent); transform-origin: left center; transition: transform 0.25s linear, background-color 0.3s; }
.sl-timebar span.is-hurry { background: var(--sl-bad); }
.sl-strip { display: flex; align-items: flex-end; justify-content: center; flex-wrap: wrap; margin-top: 1.4rem; min-height: 10rem; flex: none; }
.sl-strip__label { font-size: 1.9rem; font-weight: 700; color: var(--sl-dim); margin-left: 1.6rem; align-self: center; }
.sl-dots { display: flex; margin-top: 0.5rem; }
.sl-dots i { width: 1.1rem; height: 1.1rem; border-radius: 50%; margin: 0 0.2rem; background: rgba(255,255,255,0.14); }
.sl-dots i.is-on { background: var(--sl-accent); }

/* Stopp */
.sl-stop {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(40,6,12,0.9); animation: sl-fade 0.25s both; z-index: 5;
}
.sl-stop__word {
  font-size: 17rem; font-weight: 900; line-height: 1; color: #fff; padding: 1rem 5rem; border-radius: 3rem;
  background: var(--sl-bad); box-shadow: 0 1.2rem 0 rgba(0,0,0,0.35), 0 0 8rem rgba(255,90,110,0.7);
  transform: rotate(-4deg); animation: sl-stamp 0.45s cubic-bezier(.2,1.6,.4,1) both;
}
.sl-stop__who { display: flex; align-items: center; margin-top: 3.4rem; font-size: 3.6rem; font-weight: 900; }
.sl-stop__who .sl-av { margin-right: 1.2rem; }
.sl-stop__count { margin-top: 1.6rem; font-size: 9rem; font-weight: 900; color: var(--sl-gold); animation: sl-pulse 1s ease-in-out infinite; }

/* Stifte weg */
.sl-timeup { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.sl-timeup__word { margin-top: 3rem !important; font-size: 10rem; font-weight: 900; color: var(--sl-gold); animation: sl-stamp 0.45s cubic-bezier(.2,1.6,.4,1) both; }

/* Prüfung */
.sl-head .sl-tile--chip + .sl-round { margin-left: 1.6rem; }
.sl-category { font-size: 5rem; font-weight: 900; text-align: center; line-height: 1.1; max-width: 100rem; flex: none; animation: sl-fade 0.4s both; }
.sl-entries {
  flex: 1; width: 100%; display: grid; grid-template-columns: 1fr 1fr; grid-gap: 1.4rem 2rem; gap: 1.4rem 2rem;
  margin-top: 1.8rem; align-content: center; min-height: 0;
}
.sl-entry {
  display: flex; align-items: center; min-width: 0; padding: 1.4rem 1.8rem; border-radius: 1.8rem;
  background: linear-gradient(160deg, #1b3a38, #132b2a); box-shadow: inset 0.6rem 0 0 var(--c), 0 0.5rem 0 rgba(0,0,0,0.25);
  animation: sl-pop 0.4s cubic-bezier(.3,1.5,.5,1) both; transition: opacity 0.3s;
}
.sl-entry .sl-av { margin-right: 1.6rem; }
.sl-entry__body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sl-entry__body small { font-size: 1.7rem; font-weight: 700; color: var(--sl-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-entry__text { font-size: 3.4rem; font-weight: 900; line-height: 1.12; word-break: break-word; }
.sl-entry__side { display: flex; flex-direction: column; align-items: flex-end; flex: none; margin-left: 1.2rem; }
.sl-entry__side > :not(:first-child) { margin-top: 0.4rem; }
.sl-pts { font-size: 3rem; font-weight: 900; color: var(--sl-dim); min-width: 5rem; text-align: right; }
.sl-pts.is-on { color: var(--sl-good); }
.sl-reason, .sl-tag, .sl-votes { font-size: 1.5rem; font-weight: 800; padding: 0.2rem 1rem; border-radius: 99rem; white-space: nowrap; }
.sl-reason { background: rgba(255,90,110,0.18); color: #ffb3bd; }
.sl-tag { background: rgba(255,255,255,0.12); color: #e6fff8; }
.sl-tag--solo { background: var(--sl-gold); color: #2a2000; }
.sl-votes { background: rgba(255,90,110,0.28); color: #fff; }
.sl-votes--up { background: rgba(61,220,132,0.3); }
.sl-tag--rescued { background: var(--sl-good); color: #06281a; }
.sl-lex { font-weight: 800; margin-left: 0.8rem; }
.sl-lex.is-known { color: var(--sl-good); }
.sl-lex.is-unknown { color: #ffc46b; }
.sl-entry.is-unlisted { opacity: 0.8; box-shadow: inset 0.6rem 0 0 var(--c), inset 0 0 0 0.3rem rgba(255,179,71,0.75); }
.sl-entry.is-unlisted .sl-entry__text { text-decoration: line-through; color: #ffd59a; }
.sl-entry.is-rescued { box-shadow: inset 0.6rem 0 0 var(--c), inset 0 0 0 0.3rem var(--sl-good), 0 0 2rem rgba(61,220,132,0.35); }
.sl-entry.is-empty, .sl-entry.is-letter, .sl-entry.is-short { opacity: 0.5; }
.sl-entry.is-letter .sl-entry__text, .sl-entry.is-short .sl-entry__text { text-decoration: line-through; }
.sl-entry.is-empty .sl-entry__text { color: var(--sl-dim); }
.sl-entry.is-rejected { box-shadow: inset 0.6rem 0 0 var(--c), inset 0 0 0 0.3rem var(--sl-bad); }
.sl-entry.is-rejected .sl-entry__text { text-decoration: line-through; color: #ffb3bd; }
.sl-entry.is-group { box-shadow: inset 0.6rem 0 0 var(--c), inset 0 0 0 0.3rem var(--g), 0 0.5rem 0 rgba(0,0,0,0.25); }
.sl-entry.g0 { --g: #7fd8ff; }
.sl-entry.g1 { --g: #ffb36b; }
.sl-entry.g2 { --g: #d9a6ff; }
.sl-entry.g3 { --g: #a8f07a; }
.sl-entries.is-dense { grid-gap: 1rem 1.8rem; gap: 1rem 1.8rem; }
.sl-entries.is-dense .sl-entry { padding: 0.8rem 1.4rem; }
.sl-entries.is-dense .sl-av { width: 4.2rem; height: 4.2rem; font-size: 2.5rem; margin-right: 1.2rem; }
.sl-entries.is-dense .sl-entry__text { font-size: 2.7rem; }
.sl-entries.is-dense .sl-entry__body small { font-size: 1.5rem; }
.sl-entries.is-dense .sl-pts { font-size: 2.5rem; }
.sl-entries.is-dense .sl-reason, .sl-entries.is-dense .sl-tag, .sl-entries.is-dense .sl-votes { font-size: 1.3rem; }
.sl-foot { width: 100%; display: flex; align-items: center; margin-top: 1.4rem; font-size: 1.9rem; font-weight: 700; color: var(--sl-dim); flex: none; }
/* Unten rechts liegt der „Weiter ⏭“-Knopf von tv-web (right 3rem, bottom 2.6rem, ca. 14 × 4 rem) – in der
   überspringbaren Prüfung bleiben Fußzeile und Zeitbalken dort frei. */
.sl-tv--review .sl-foot { padding-right: 16rem; }
.sl-tv--review > .sl-timebar { width: auto; align-self: stretch; margin-right: 16rem; }

/* Rangliste */
.sl-list { list-style: none; padding: 0; margin-top: 2rem !important; width: 74rem; }
.sl-row {
  display: flex; align-items: center; padding: 0.8rem 1.8rem; margin-top: 0.8rem; border-radius: 1.4rem;
  background: var(--sl-panel); box-shadow: inset 0.5rem 0 0 var(--c); font-size: 2.4rem; font-weight: 800;
  animation: sl-slide 0.4s both;
}
.sl-list.is-dense { margin-top: 1.4rem !important; }
.sl-list.is-dense .sl-row { padding: 0.35rem 1.8rem; margin-top: 0.5rem; font-size: 2.1rem; }
.sl-list.is-dense .sl-row .sl-av { width: 3.8rem; height: 3.8rem; font-size: 2.3rem; }
.sl-row.is-first { box-shadow: inset 0.5rem 0 0 var(--c), 0 0 0 0.25rem var(--sl-gold); }
.sl-row.is-left { opacity: 0.5; }
.sl-row .sl-av { width: 4.4rem; height: 4.4rem; font-size: 2.6rem; margin-right: 1.4rem; }
.sl-row__rank { width: 4rem; color: var(--sl-dim); }
.sl-row__name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-row__name small { font-size: 1.6rem; color: var(--sl-dim); }
.sl-row__gain { color: var(--sl-good); font-size: 2rem; margin-right: 1.8rem; }
.sl-row__score { min-width: 7rem; text-align: right; }

/* Finale */
.sl-podium { display: flex; align-items: flex-end; justify-content: center; margin-top: 1rem; flex: 1; min-height: 0; }
.sl-step { display: flex; flex-direction: column; align-items: center; width: 24rem; margin: 0 1.2rem; animation: sl-rise 0.7s both; }
.sl-step.is-left { opacity: 0.6; }
.sl-step .sl-av { width: 6.6rem; height: 6.6rem; font-size: 4rem; }
.sl-step.r1 .sl-av { width: 8.4rem; height: 8.4rem; font-size: 5rem; box-shadow: 0 0 0 0.4rem var(--sl-gold), 0 0 3rem var(--sl-gold); }
.sl-step__name { font-size: 2.5rem; font-weight: 900; margin-top: 0.7rem; max-width: 24rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-step__score { font-size: 1.9rem; color: var(--sl-dim); font-weight: 700; }
.sl-step__block {
  width: 100%; margin-top: 0.8rem; border-radius: 1.4rem 1.4rem 0 0; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 0.8rem; font-size: 4.4rem; font-weight: 900; color: rgba(255,255,255,0.85);
  background: linear-gradient(180deg, var(--c), rgba(21,48,47,0.9));
}
.sl-step.r1 .sl-step__block { height: 13rem; }
.sl-step.r2 .sl-step__block { height: 9rem; }
.sl-step.r3 .sl-step__block { height: 6rem; }
.sl-podium.is-compact { margin-top: 2.4rem; }
.sl-podium.is-compact .sl-step.r1 .sl-step__block { height: 7.6rem; }
.sl-podium.is-compact .sl-step.r2 .sl-step__block { height: 5.4rem; }
.sl-podium.is-compact .sl-step.r3 .sl-step__block { height: 4.2rem; }
.sl-podium.is-compact .sl-step__block { font-size: 3.4rem; padding-top: 0.4rem; }
.sl-step.r1 { animation-delay: 0.6s; }
.sl-step.r2 { animation-delay: 0.3s; }
.sl-rest { display: flex; flex-wrap: wrap; justify-content: center; max-width: 110rem; margin-top: 1rem; flex: none; }
.sl-chip {
  display: flex; align-items: center; padding: 0.3rem 1.2rem 0.3rem 0.6rem; margin: 0.3rem 0.5rem; border-radius: 99rem;
  background: var(--sl-panel); box-shadow: inset 0 0 0 0.2rem var(--c); font-size: 1.7rem; font-weight: 700; animation: sl-pop 0.4s both;
}
.sl-chip > :not(:first-child) { margin-left: 0.7rem; }
.sl-chip .sl-av--mini { width: 3rem; height: 3rem; font-size: 1.9rem; }
.sl-chip__name { max-width: 14rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-chip__pts { color: var(--sl-dim); }
.sl-awards { display: flex; justify-content: center; margin-top: 1.2rem; flex: none; }
.sl-award {
  display: flex; align-items: center; width: 30rem; margin: 0 0.7rem; padding: 0.7rem 1.4rem; border-radius: 1.6rem;
  background: rgba(255,210,77,0.12); box-shadow: inset 0 0 0 0.2rem rgba(255,210,77,0.55); animation: sl-pop 0.5s both;
}
.sl-award__icon { font-size: 3.4rem; margin-right: 1rem; flex: none; }
.sl-award__text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.sl-award__text b { font-size: 1.6rem; color: var(--sl-gold); white-space: nowrap; }
.sl-award__who { font-size: 2rem; font-weight: 900; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-award__text small { font-size: 1.5rem; color: var(--sl-dim); }
/* Abstand nach unten: Die (bis zu drei) Auszeichnungen reichen sonst in den „Weiter ⏭“-Knopf von tv-web. */
.sl-finalbar { width: 60rem; height: 0.8rem; border-radius: 1rem; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 1.4rem; margin-bottom: 3.2rem; flex: none; }
.sl-finalbar span { display: block; height: 100%; background: var(--sl-accent); transform-origin: left center; transition: transform 0.25s linear; }

@keyframes sl-pop { from { transform: scale(0.5); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes sl-spin { from { transform: translateY(0); } to { transform: translateY(-308rem); } }
@keyframes sl-flash { 0% { opacity: 0; transform: scale(1); } 30% { opacity: 1; transform: scale(1.04); } 100% { opacity: 0; transform: scale(1); } }
@keyframes sl-stamp { from { transform: rotate(-4deg) scale(3); opacity: 0; } to { transform: rotate(-4deg) scale(1); opacity: 1; } }
@keyframes sl-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes sl-pulse { 50% { transform: scale(1.08); } }
@keyframes sl-slide { from { transform: translateX(-3rem); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes sl-rise { from { transform: translateY(8rem); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .sl-reel__strip, .sl-reel__glow, .sl-cats, .sl-board .sl-tile, .sl-stop, .sl-stop__word, .sl-stop__count, .sl-timeup__word,
  .sl-entry, .sl-category, .sl-row, .sl-setup__list li, .sl-step, .sl-chip, .sl-award, .sl-av.is-done, .sl-clock.is-hurry { animation-duration: 0.01ms; }
}
`;
