// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
// Kategorie und Feld stehen nebeneinander, damit sechs Felder ohne Scrollen passen; sehr kleine Handys (≤ 600 px) noch dichter.
export const CONTROLLER_CSS = /* css */ `
.sl-ctl {
  --sl-dim: #a9c4c0;
  --sl-accent: #2fc4a0;
  --sl-gold: #ffd24d;
  --sl-good: #3ddc84;
  --sl-bad: #ff5a6e;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #f1fbf8); font-variant-numeric: tabular-nums;
}
.sl-ctl > :not(:first-child) { margin-top: 10px; }
.sl-ctl *, .sl-ctl *::before, .sl-ctl *::after { box-sizing: border-box; }
.sl-ctl p, .sl-ctl ul { margin: 0; }
.sl-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--sl-dim); }
.sl-msg { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.sl-msg__icon { font-size: 3.4rem; margin-bottom: 12px; }
.sl-spin { display: inline-block; animation: sl-wobble 0.5s ease-in-out infinite alternate; }
.sl-big { font-size: 1.5rem; font-weight: 900; }
.sl-lead { font-weight: 800; color: var(--sl-accent); }
.sl-time { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; flex: none; }
.sl-time span { display: block; height: 100%; background: var(--sl-accent); transform-origin: left center; }
@keyframes sl-drain { to { transform: scaleX(0); } }

/* Buchstabe + Uhr */
.sl-letterbar { display: flex; align-items: center; flex: none; }
.sl-letter {
  display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; flex: none; border-radius: 14px;
  font-size: 2.1rem; font-weight: 900; color: #12302c; background: linear-gradient(165deg, #fff6c9, #ffd24d 70%, #f5b82e);
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
}
.sl-letter--small { width: 44px; height: 44px; font-size: 1.7rem; border-radius: 12px; }
.sl-secs { margin-left: auto; font-size: 1.9rem; font-weight: 900; }
.sl-secs.is-hurry { color: var(--sl-bad); }
.sl-timeup { margin-left: auto; font-size: 1.4rem; font-weight: 900; color: var(--sl-gold); }
.sl-cat { margin-left: 12px; font-size: 1.15rem; font-weight: 900; line-height: 1.2; min-width: 0; }
.sl-cat small { font-weight: 700; color: var(--sl-dim); }
.sl-stopbar {
  flex: none; padding: 8px 12px; border-radius: 14px; text-align: center; font-weight: 900; color: #fff;
  background: var(--sl-bad); animation: sl-shake 0.4s;
}

/* Felder: Kategorie links, Eingabe rechts (sechs Felder passen ohne Scrollen) */
.sl-fields { flex: 1 0 auto; margin: 0; }
.sl-field { display: flex; align-items: center; }
.sl-field:not(:first-child) { margin-top: 6px; }
.sl-field__label { width: 36%; flex: none; padding-right: 8px; font-size: 0.85rem; font-weight: 800; color: var(--sl-dim); line-height: 1.15; }
.sl-field__label > span { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; word-break: break-word; }
.sl-field__label b, .sl-field__label em { display: block; font-size: 0.72rem; }
.sl-field__label b { color: var(--sl-good); }
.sl-field__label em { font-style: normal; color: #ffb3bd; }
.sl-input {
  flex: 1; min-width: 0; width: 100%; margin: 0; padding: 8px 10px; border: 2px solid rgba(47,196,160,0.45); border-radius: 12px; outline: none;
  font: inherit; font-size: 1.05rem; font-weight: 800; color: #fff; background: rgba(0,0,0,0.3);
}
.sl-input:focus { border-color: var(--sl-accent); box-shadow: 0 0 0 3px rgba(47,196,160,0.25); }
.sl-input::placeholder { color: rgba(255,255,255,0.3); font-weight: 600; }
.sl-input:disabled { opacity: 0.6; }
.sl-field.is-ok .sl-input { border-color: rgba(61,220,132,0.7); }
.sl-field.is-letter .sl-input, .sl-field.is-short .sl-input { border-color: rgba(255,90,110,0.75); }
.sl-stop, .sl-ready {
  flex: none; min-height: 52px; margin: 0; border: 0; border-radius: 18px; font: inherit; font-size: 1.3rem; font-weight: 900;
  color: #fff; background: var(--sl-bad); box-shadow: inset 0 -5px 0 rgba(0,0,0,0.22); cursor: pointer; touch-action: manipulation;
}
.sl-stop:disabled { opacity: 0.35; font-size: 1rem; }
.sl-stop:not(:disabled):active, .sl-ready:not(:disabled):active { transform: scale(0.98); }
.sl-ready { color: #062a22; background: var(--sl-accent); }
.sl-ready:disabled { opacity: 0.5; font-size: 1rem; }
/* Host-Handy: rechts Platz für den schwebenden „Weiter“-Knopf der App (unten rechts, ca. 112 × 52 px, 16 px Abstand) –
   beide stehen nebeneinander, ohne dass die Liste höher wird. */
.sl-ready.has-skip { margin-right: 140px; padding: 0 8px; white-space: nowrap; font-size: 1.1rem; }
.sl-ready.has-skip:disabled { font-size: 0.85rem; white-space: normal; }

/* Prüfung */
.sl-entries { flex: 1 0 auto; list-style: none; padding: 0; }
.sl-entry {
  display: flex; align-items: center; padding: 6px 8px 6px 10px; border-radius: 14px; background: #183533;
  box-shadow: inset 4px 0 0 var(--c);
}
.sl-entry:not(:first-child) { margin-top: 6px; }
.sl-entry__av { font-size: 1.5rem; margin-right: 8px; flex: none; }
.sl-entry__body { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.sl-entry__body small { font-size: 0.75rem; font-weight: 700; color: var(--sl-dim); }
.sl-entry__text { font-size: 1.05rem; font-weight: 900; word-break: break-word; }
.sl-entry__body em { font-style: normal; font-weight: 800; color: #ffb3bd; }
.sl-entry__pts { flex: none; margin-left: 8px; font-weight: 900; color: var(--sl-good); }
.sl-entry.is-empty, .sl-entry.is-letter, .sl-entry.is-short { opacity: 0.55; }
.sl-entry.is-letter .sl-entry__text, .sl-entry.is-short .sl-entry__text, .sl-entry.is-rejected .sl-entry__text { text-decoration: line-through; }
.sl-entry.is-rejected { box-shadow: inset 4px 0 0 var(--c), inset 0 0 0 2px var(--sl-bad); }
.sl-entry.is-rejected .sl-entry__pts, .sl-entry.is-empty .sl-entry__pts, .sl-entry.is-letter .sl-entry__pts, .sl-entry.is-short .sl-entry__pts { color: var(--sl-dim); }
.sl-entry.is-mine { background: #1f4440; }
.sl-entries.is-dense .sl-entry { padding: 2px 6px 2px 8px; }
.sl-entries.is-dense .sl-entry:not(:first-child) { margin-top: 4px; }
.sl-entries.is-dense .sl-entry__text { font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sl-entries.is-dense .sl-thumb { height: 36px; }
.sl-entries.is-dense .sl-entry__av { font-size: 1.25rem; }
.sl-thumb {
  flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 54px; height: 48px; margin: 0 0 0 8px;
  border: 0; border-radius: 12px; font: inherit; font-size: 1.3rem; line-height: 1; color: #fff; background: rgba(255,255,255,0.1);
  box-shadow: inset 0 0 0 2px rgba(255,255,255,0.15); cursor: pointer; touch-action: manipulation;
}
.sl-thumb small { font-size: 0.7rem; font-weight: 800; margin-top: 2px; color: var(--sl-dim); }
.sl-thumb.is-on { background: var(--sl-bad); box-shadow: 0 0 0 2px #fff; }
.sl-thumb.is-on small { color: #fff; }
.sl-thumb.is-up { box-shadow: inset 0 0 0 2px rgba(61,220,132,0.6); }
.sl-thumb.is-up.is-on { background: #1f9e5a; box-shadow: 0 0 0 2px #fff; }
.sl-good { font-weight: 800; color: var(--sl-good); }
.sl-entry__body em.is-lex { color: #ffd59a; }
.sl-entry.is-unlisted { opacity: 0.8; box-shadow: inset 4px 0 0 var(--c), inset 0 0 0 2px rgba(255,179,71,0.75); }
.sl-entry.is-unlisted .sl-entry__text { text-decoration: line-through; }
.sl-entry.is-unlisted .sl-entry__pts { color: var(--sl-dim); }
.sl-entry.is-rescued { box-shadow: inset 4px 0 0 var(--c), inset 0 0 0 2px var(--sl-good); }

/* Eigene Kategorien (Host-Editor). Der Los-Knopf klebt unten, damit Tastatur/Vorschläge ihn nicht verdrängen. */
.sl-setup { flex: 1 0 auto; display: flex; flex-direction: column; }
.sl-setup > :not(:first-child) { margin-top: 10px; }
.sl-setup__fields { flex: none; }
.sl-setup__row { display: flex; align-items: center; }
.sl-setup__row:not(:first-child) { margin-top: 6px; }
.sl-setup__num { width: 26px; flex: none; font-weight: 900; color: var(--sl-dim); text-align: center; }
.sl-setup__row .sl-input { margin-left: 4px; }
.sl-setup__row.is-dup .sl-input { border-color: rgba(255,90,110,0.75); }
.sl-setup__dup { flex: none; margin-left: 6px; font-style: normal; font-size: 0.75rem; font-weight: 800; color: #ffb3bd; }
.sl-setup__remove, .sl-setup__add, .sl-chipbtn {
  margin: 0; border: 0; font: inherit; font-weight: 800; color: #fff; background: rgba(255,255,255,0.1); cursor: pointer; touch-action: manipulation;
}
.sl-setup__remove { flex: none; width: 44px; height: 44px; margin-left: 6px; border-radius: 12px; font-size: 1.1rem; }
.sl-setup__remove:disabled, .sl-setup__add:disabled { opacity: 0.3; }
.sl-setup__add { flex: none; align-self: flex-start; min-height: 44px; padding: 0 16px; border-radius: 14px; box-shadow: inset 0 0 0 2px rgba(47,196,160,0.5); color: #bff3e4; }
.sl-setup__label { flex: none; font-size: 0.85rem; font-weight: 800; color: var(--sl-dim); }
.sl-chips { flex: none; display: flex; flex-wrap: wrap; max-height: 20vh; overflow-y: auto; margin-left: -3px; margin-right: -3px; -webkit-overflow-scrolling: touch; }
.sl-chipbtn { min-height: 36px; margin: 3px; padding: 4px 12px; border-radius: 99px; font-size: 0.9rem; background: rgba(47,196,160,0.16); color: #bff3e4; }
.sl-chipbtn:active { background: rgba(47,196,160,0.4); }
.sl-setup__go {
  position: -webkit-sticky; position: sticky; bottom: 0; margin-top: auto !important; display: flex; flex-direction: column;
  /* Unten Platz für den schwebenden „Weiter“-Knopf der App (Setup ist überspringbar, Host sieht ihn immer). */
  padding: 10px 0 72px;
  background: var(--bg, #111528); z-index: 1;
}
.sl-setup__go small { text-align: center; font-weight: 800; color: #ffb3bd; margin-bottom: 6px; }
.sl-setup-wait__list { margin: 16px 0 0; padding: 0 0 0 1.4em; text-align: left; font-size: 1.05rem; color: var(--sl-dim); }
.sl-setup-wait__list li { margin-top: 2px; }

/* Ergebnis */
.sl-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.sl-result > strong { font-size: 1.7rem; font-weight: 900; line-height: 1.2; }
.sl-result > span { margin-top: 10px; font-size: 1.05rem; color: var(--sl-dim); }
.sl-award { font-weight: 900; color: var(--sl-gold) !important; }
.sl-gain { font-size: 2rem !important; font-weight: 900; color: var(--sl-gold) !important; margin-top: 14px !important; }

/* Kleine Handys */
@media (max-height: 600px) {
  .sl-ctl > :not(:first-child) { margin-top: 7px; }
  .sl-letter { width: 40px; height: 40px; font-size: 1.6rem; border-radius: 10px; }
  .sl-secs { font-size: 1.5rem; }
  .sl-field:not(:first-child) { margin-top: 5px; }
  .sl-field__label { font-size: 0.75rem; }
  .sl-input { padding: 6px 9px; font-size: 0.95rem; }
  .sl-stop, .sl-ready { min-height: 46px; font-size: 1.15rem; }
  .sl-entry { padding: 2px 6px 2px 8px; }
  .sl-entry:not(:first-child) { margin-top: 4px; }
  .sl-entry__av { font-size: 1.2rem; }
  .sl-entry__text { font-size: 0.92rem; }
  .sl-thumb { width: 46px; height: 36px; font-size: 1.1rem; }
  .sl-lead { font-size: 0.88rem; }
}
@keyframes sl-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
@keyframes sl-wobble { from { transform: rotate(-10deg); } to { transform: rotate(10deg); } }
`;
