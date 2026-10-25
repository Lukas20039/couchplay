// Stylesheet der Controller-View (Handy, Hochformat, px-basiert wie controller-pwa).
// Kacheln als Grid (Grid-gap ist auch in alten WebViews erlaubt).
export const CONTROLLER_CSS = /* css */ `
.we-ctl {
  --we-dim: #c0b2db;
  --we-accent: #c86bff;
  --we-gold: #ffd24d;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
  color: var(--text, #f8f3ff); font-variant-numeric: tabular-nums;
}
.we-ctl > :not(:first-child) { margin-top: 12px; }
.we-ctl *, .we-ctl *::before, .we-ctl *::after { box-sizing: border-box; }
.we-ctl h2, .we-ctl p { margin: 0; }
.we-top { display: flex; justify-content: space-between; font-weight: 800; color: var(--we-dim); }
.we-msg { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 1.2rem; font-weight: 700; padding: 0 12px; }
.we-big { font-size: 1.7rem; font-weight: 900; }
.we-time { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.1); overflow: hidden; flex: none; }
.we-time span { display: block; height: 100%; background: var(--we-accent); transform-origin: left center; }
@keyframes we-drain { to { transform: scaleX(0); } }
.we-q { flex: none; }
.we-q small { display: block; font-size: 0.95rem; font-weight: 800; color: var(--we-accent); }
.we-q strong { display: block; font-size: 1.3rem; font-weight: 900; line-height: 1.25; margin-top: 2px; }
.we-tiles { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(64px, 190px); align-content: center; grid-gap: 10px; gap: 10px; min-height: 0; }
.we-tile {
  position: relative; margin: 0; padding: 8px; border: 0; border-radius: 18px; font: inherit; color: #fff; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 64px; min-width: 0;
  background: var(--c); box-shadow: inset 0 -5px 0 rgba(0,0,0,0.25); touch-action: manipulation;
}
.we-tile:active { transform: scale(0.97); }
.we-tile__emoji { font-size: 2.2rem; line-height: 1; }
.we-tile__name {
  margin-top: 4px; max-width: 100%; font-size: 1.1rem; font-weight: 900; color: #1a1030;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.we-tile__me {
  position: absolute; top: 6px; right: 8px; padding: 1px 8px; border-radius: 99px; font-size: 0.8rem; font-weight: 900;
  background: rgba(17,12,34,0.8); color: #fff;
}
.we-tiles--many .we-tile__emoji { font-size: 1.7rem; }
.we-locked {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  border-radius: 22px; background: rgba(200,107,255,0.14); box-shadow: inset 0 0 0 2px var(--we-accent); padding: 20px;
}
.we-locked__label { font-weight: 800; color: var(--we-dim); }
.we-locked__who { display: flex; align-items: center; margin-top: 10px; font-size: 1.9rem; font-weight: 900; max-width: 100%; }
.we-locked__who span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.we-dot {
  width: 52px; height: 52px; flex: none; border-radius: 50%; background: var(--c); margin-right: 12px;
  display: flex; align-items: center; justify-content: center; font-size: 1.8rem;
}
.we-locked small { margin-top: 14px; font-size: 1rem; color: var(--we-dim); }
.we-result { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.we-result > strong { font-size: 1.6rem; font-weight: 900; }
.we-result.is-good > strong { color: #3ddc84; }
.we-result > span { margin-top: 10px; font-size: 1.1rem; color: var(--we-dim); }
.we-crowns { display: flex; flex-wrap: wrap; justify-content: center; margin-bottom: 12px; }
.we-crowns .we-dot { margin: 4px 6px; }
.we-winner { font-size: 1.15rem !important; font-weight: 800; color: var(--we-gold) !important; margin: 0 0 16px !important; }
.we-me-won { font-size: 1.3rem !important; font-weight: 900; color: var(--we-gold) !important; }
.we-gain { font-size: 2.2rem !important; font-weight: 900; color: var(--we-gold) !important; margin-top: 14px !important; }
.we-title-claim { margin-top: 14px !important; padding: 12px 16px; border-radius: 16px; background: rgba(200,107,255,0.14); color: #f0e6ff !important; font-weight: 800; }
.we-title-claim b { display: block; color: var(--we-accent); font-size: 0.95rem; }
`;
