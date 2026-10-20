// Gemeinsame UI-Bausteine für TV- und Controller-View: Antwortformen, Avatare,
// Stil-Injektion und eine tickende Serverzeit für Countdowns.
import type { AvatarId } from "@couchplay/protocol";
import { useEffect, useState } from "preact/hooks";
import { SHAPE_LABELS } from "../i18n/de.js";

/** Antwort i → Form + Farbe (Farbe UND Form, damit es auch für Farbenblinde eindeutig ist). */
export const ANSWER_KEYS = ["red", "blue", "yellow", "green"] as const;

export function Shape({ index, class: cls }: { index: number; class?: string }) {
  const common = { class: `qz-shape ${cls ?? ""}`, viewBox: "0 0 100 100", "aria-hidden": "true" as const };
  switch (index) {
    case 0:
      return (
        <svg {...common}>
          <polygon points="50,10 92,86 8,86" />
        </svg>
      );
    case 1:
      return (
        <svg {...common}>
          <polygon points="50,6 94,50 50,94 6,50" />
        </svg>
      );
    case 2:
      return (
        <svg {...common}>
          <circle cx="50" cy="50" r="42" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="12" y="12" width="76" height="76" rx="4" />
        </svg>
      );
  }
}

export const shapeLabel = (index: number): string => SHAPE_LABELS[index] ?? "";

const AVATAR_EMOJI: Record<AvatarId, string> = {
  fuchs: "🦊",
  katze: "🐱",
  hund: "🐶",
  panda: "🐼",
  eule: "🦉",
  frosch: "🐸",
  tiger: "🐯",
  einhorn: "🦄",
  pinguin: "🐧",
  krake: "🐙",
  roboter: "🤖",
  alien: "👽",
};

export const avatarEmoji = (avatar: string): string => AVATAR_EMOJI[avatar as AvatarId] ?? "🙂";

/** Spielerfarbe als CSS-Variable der App (--p0 … --p7) mit Fallback. */
const FALLBACK = ["#ff4d4d", "#4da6ff", "#4dff88", "#ffd24d", "#c34dff", "#ff9f4d", "#4dfff0", "#ff4dc4"];
export const playerColor = (color: number): string => `var(--p${color}, ${FALLBACK[color % 8]})`;

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

/** true, wenn der Nutzer reduzierte Bewegung wünscht. */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
