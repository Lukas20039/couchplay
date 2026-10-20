// Kleine, zod-freie Helfer für Codes, Namen und URLs.
import {
  JOIN_PATH_PREFIX,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  RECONNECT_BACKOFF_FACTOR,
  RECONNECT_BACKOFF_MAX_MS,
  RECONNECT_BACKOFF_MIN_MS,
  ROOM_CODE_LENGTH,
  ROOM_CODE_PATTERN,
} from "./constants.js";

export function isValidRoomCode(value: string): boolean {
  return ROOM_CODE_PATTERN.test(value);
}

/** Entfernt alles außer Ziffern (für Code-Eingabefelder, z. B. "123 456" → "123456"). */
export function sanitizeRoomCodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, ROOM_CODE_LENGTH);
}

/** `${publicUrl}/j/<code>` ohne doppelten Slash. */
export function buildJoinUrl(publicUrl: string, code: string): string {
  return `${publicUrl.replace(/\/+$/, "")}${JOIN_PATH_PREFIX}${code}`;
}

/** Liest den Raumcode aus einem Pfad wie "/j/123456" (oder null). */
export function parseJoinPath(pathname: string): string | null {
  const m = /^\/j\/(\d{6})\/?$/.exec(pathname);
  return m?.[1] ?? null;
}

// Steuerzeichen, Zero-Width, Bidi-Overrides und Zeilenumbrüche.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_NAME_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g;

export type NameResult = { ok: true; name: string } | { ok: false; reason: "empty" | "too_long" };

/**
 * Normalisiert einen Spielernamen: NFC, Steuerzeichen raus, Whitespace
 * zusammenfassen, trimmen. Länge in Codepoints (Emoji zählen einzeln).
 */
export function normalizeName(raw: string): NameResult {
  const name = raw.normalize("NFC").replace(FORBIDDEN_NAME_CHARS, "").replace(/\s+/g, " ").trim();
  const length = [...name].length;
  if (length < NAME_MIN_LENGTH) return { ok: false, reason: "empty" };
  if (length > NAME_MAX_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, name };
}

/** Vergleichsschlüssel für Namens-Eindeutigkeit im Raum. */
export function nameKey(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("de-DE");
}

/** Reconnect-Backoff mit Jitter für Clients. attempt beginnt bei 0. */
export function reconnectDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(RECONNECT_BACKOFF_MIN_MS * RECONNECT_BACKOFF_FACTOR ** attempt, RECONNECT_BACKOFF_MAX_MS);
  const jitter = 1 + (random() * 0.4 - 0.2);
  return Math.round(base * jitter);
}
