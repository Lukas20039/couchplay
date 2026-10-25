// Gemeinsame UI-Bausteine für TV- und Controller-View: Farben, Stil-Injektion, Serverzeit.
import { useEffect, useState } from "preact/hooks";

export { avatarEmoji } from "@couchplay/protocol";

const FALLBACK = ["#ff4d4d", "#4da6ff", "#4dff88", "#ffd24d", "#c34dff", "#ff9f4d", "#4dfff0", "#ff4dc4"];
export const playerColor = (color: number): string => `var(--p${color % 8}, ${FALLBACK[color % 8]})`;

/** Fügt ein Stylesheet einmalig in <head> ein (robust gegen Tree-Shaking von CSS-Importen). */
export function ensureStyles(id: string, css: string): void {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Serverzeit, die alle `intervalMs` neu gerendert wird (nur solange `active`). */
export function useServerNow(serverNow: () => number, active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(serverNow());
    if (!active) return;
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [active, serverNow, intervalMs]);
  return now;
}

export const secondsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));

/** 0 → 1 zwischen from und to (geklemmt). */
export const progress = (now: number, from: number, to: number): number => (to <= from ? 1 : Math.min(1, Math.max(0, (now - from) / (to - from))));

/** Weiches Abbremsen am Ende (für Balken und Hochzählen). */
export const easeOut = (x: number): number => 1 - (1 - x) ** 3;
