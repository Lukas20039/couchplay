// Stylesheet der TV-View (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Kompatibel mit alten Android-TV-WebViews (Chrome ≥ 64): kein Flexbox-gap, kein
// inset, kein aspect-ratio, kein clamp(). Animationen nur über transform/opacity.
export const TV_CSS = /* css */ `
.sv-tv {
  --sv-ink: #f8f4ff;
  --sv-dim: #aaa1d2;
  --sv-panel: #1d1838;
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.4rem 4rem 0;
  color: var(--sv-ink);
  background:
    radial-gradient(60rem 30rem at 50% 100%, rgba(47, 155, 255, 0.16), rgba(47, 155, 255, 0) 70%),
    var(--bg, #120f24);
  font-variant-numeric: tabular-nums;
}
.sv-tv *, .sv-tv *::before, .sv-tv *::after { box-sizing: border-box; }
.sv-tv h2, .sv-tv p { margin: 0; }

/* ---------- Kopf: Partie + Status ---------- */
.sv-tv__head { height: 7.6rem; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; }
.sv-tv__round { font-size: 1.5rem; font-weight: 700; color: var(--sv-dim); margin-bottom: 0.5rem; }
.sv-status { display: flex; flex-direction: column; align-items: center; text-align: center; }
.sv-status strong { font-size: 2.4rem; font-weight: 800; line-height: 1.15; }
.sv-status > span { font-size: 1.6rem; color: var(--sv-dim); margin-top: 0.3rem; }
.sv-status--setup span { font-size: 1.6rem; }
.sv-status__shot { animation: sv-pop 0.45s cubic-bezier(.3,1.6,.5,1) both; }
.sv-status__shot--hit { color: #ffb15c; }
.sv-status__shot--sunk { color: #ff6b6b; }
.sv-status__shot--miss { color: #bcd9ff; }
.sv-status__turn { display: flex; align-items: center; }
.sv-status__dot { width: 1.1rem; height: 1.1rem; border-radius: 50%; background: var(--c); margin-right: 0.8rem; box-shadow: 0 0 1rem var(--c); }
@keyframes sv-pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.sv-banner {
  font-size: 3.4rem; font-weight: 900; padding: 1rem 3rem; border-radius: 99rem;
  background: var(--c); color: #120f24; box-shadow: 0 0 3rem var(--c);
  animation: sv-pop 0.5s cubic-bezier(.3,1.6,.5,1) both;
}
.sv-status--paused { height: 5rem; justify-content: center; }
.sv-pause { display: flex; }
.sv-pause i { display: block; width: 1.2rem; height: 4rem; margin: 0 0.5rem; border-radius: 0.4rem; background: var(--sv-dim); }

/* ---------- Zwei Gewässer ---------- */
.sv-tv__sides { display: flex; justify-content: center; align-items: flex-start; }
.sv-side {
  width: 37rem; margin: 0 2.5rem; padding: 1rem 1.4rem 0.8rem; border-radius: 1.6rem;
  background: var(--sv-panel); border: 0.25rem solid transparent;
  transition: border-color 0.3s, box-shadow 0.3s, opacity 0.3s;
}
.sv-side.is-target { border-color: var(--shooter); box-shadow: 0 0 2.4rem rgba(0,0,0,0.4), 0 0 1.6rem var(--shooter); }
.sv-side.is-offline { opacity: 0.55; }
.sv-side.is-winner { border-color: var(--c); box-shadow: 0 0 2.6rem var(--c); }
.sv-side__card { display: flex; align-items: center; margin-bottom: 0.6rem; }
.sv-side__avatar {
  width: 3.8rem; height: 3.8rem; border-radius: 50%; margin-right: 1.2rem; flex: none;
  display: flex; align-items: center; justify-content: center; font-size: 2.2rem;
  background: var(--c); box-shadow: 0 0 0 0.25rem rgba(255,255,255,0.15);
}
.sv-side__who { flex: 1; min-width: 0; }
.sv-side__name { font-size: 2rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sv-side__sub { font-size: 1.35rem; color: var(--sv-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sv-side__info { font-size: 1.35rem; color: var(--sv-dim); text-align: right; margin-left: 1rem; }
.sv-side__ready { font-weight: 700; }
.sv-side__ready.is-ready { color: #3ddc84; }
.sv-side__board { position: relative; font-size: 1.3rem; }
.sv-side__veil {
  position: absolute; top: 1.4em; left: 1.4em; right: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center; border-radius: 0.6em;
  background: rgba(13, 30, 60, 0.55); font-size: 8rem;
}
.sv-side__veil span { animation: sv-bob 2.4s ease-in-out infinite; }
.sv-side__veil.is-ready { color: #3ddc84; }
.sv-side__veil.is-ready span { animation: sv-pop 0.4s both; }
@keyframes sv-bob { 0%, 100% { transform: translateY(-0.3rem) rotate(-4deg); } 50% { transform: translateY(0.3rem) rotate(4deg); } }
.sv-side__fleet { display: flex; align-items: center; margin-top: 0.7rem; font-size: 1.3rem; min-height: 1.8rem; }
.sv-side__label { font-size: 1.2rem; color: var(--sv-dim); margin-right: 1rem; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) {
  .sv-status__shot, .sv-banner, .sv-side__veil span { animation: none; }
}
`;
