// Gemeinsame UI-Bausteine für TV- und Controller-View: Farben, Stil-Injektion, Serverzeit.
import { useEffect, useState } from "preact/hooks";

export { avatarEmoji } from "@couchplay/protocol";

/** Antwortfarben (A–D), dazu immer der Buchstabe. */
export const ANSWER_COLORS = ["#e23d51", "#2e6be6", "#f4b400", "#1e9e5a"];

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

/** Serverzeit, die alle 250 ms neu gerendert wird (nur solange `active`). */
export function useServerNow(serverNow: () => number, active: boolean): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(serverNow());
    if (!active) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [active, serverNow]);
  return now;
}

export const secondsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));
