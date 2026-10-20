// Reine Formatierungs-Helfer (ohne DOM), getestet in test/format.test.ts.
import type { AvatarId } from "@couchplay/protocol/constants";

/** "042137" → ["042", "137"] (3+3 gruppiert, führende Nullen bleiben). */
export function splitRoomCode(code: string): [string, string] {
  const digits = code.replace(/\D/g, "");
  return [digits.slice(0, 3), digits.slice(3, 6)];
}

/** "042137" → "042 137" (für Klartext/Screenreader). */
export function formatRoomCode(code: string): string {
  const [a, b] = splitRoomCode(code);
  return b ? `${a} ${b}` : a;
}

/** Join-URL für die Anzeige kürzen: Schema und abschließenden Slash weglassen. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/** Host-Teil (inkl. Port) einer URL für den Hinweis „öffne … und gib den Code ein“. */
export function urlHost(url: string): string {
  const m = /^[a-z]+:\/\/([^/]+)/i.exec(url);
  return m?.[1] ?? displayUrl(url);
}

/** Fallback, falls der Server (noch) keine joinUrl liefert: `${origin}/j/<code>`. */
export function fallbackJoinUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/j/${code}`;
}

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

export function avatarEmoji(avatar: string): string {
  return (AVATAR_EMOJI as Record<string, string>)[avatar] ?? "🙂";
}

/** Icon je Spiel-ID. Das Manifest hat (noch) kein Icon-Feld → Zuordnung hier, Fallback Gamepad. */
const GAME_ICONS: Record<string, string> = {
  quiz: "🧠",
  tictactoe: "⭕",
};

export function gameIcon(gameId: string): string {
  return GAME_ICONS[gameId] ?? "🎮";
}

/** CSS-Variable der Spielerfarbe 0..7. */
export function playerColorVar(color: number): string {
  return `var(--p${Math.max(0, Math.min(7, Math.floor(color)))})`;
}

/** Ersetzt {name}-Platzhalter in i18n-Texten. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
}
