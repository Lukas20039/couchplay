// Gemeinsame UI-Bausteine für TV- und Controller-View.
import { useEffect, useState } from "preact/hooks";
import type { LevelInfo } from "../shared.js";

export { avatarEmoji } from "@couchplay/protocol";

/** Spielerfarbe als CSS-Variable der App (--p0 … --p7) mit Fallback. */
const FALLBACK = ["#ff4d4d", "#4da6ff", "#4dff88", "#ffd24d", "#c34dff", "#ff9f4d", "#4dfff0", "#ff4dc4"];
export const playerColor = (color: number): string => `var(--p${color}, ${FALLBACK[color % 8]})`;

/** Blume je Wortlänge – der TV zeigt Wachstum, ohne Wörter zu verraten. */
export function bloom(length: number): string {
  if (length <= 3) return "🌱";
  if (length === 4) return "🌿";
  if (length === 5) return "🌷";
  if (length === 6) return "🌼";
  if (length === 7) return "🌻";
  return "🌳";
}

/** Fügt ein Stylesheet einmalig in <head> ein (robust gegen Tree-Shaking von CSS-Importen). */
export function ensureStyles(id: string, css: string): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
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

/** Restsekunden (aufgerundet, ≥ 0). */
export const secondsLeft = (endsAt: number, now: number): number => Math.max(0, Math.ceil((endsAt - now) / 1000));

/** Anteil der aktuellen Stufe (0..1). */
export const levelShare = (l: LevelInfo): number =>
  l.nextXp === null ? 1 : Math.min(1, Math.max(0, (l.xp - l.levelXp) / (l.nextXp - l.levelXp)));
