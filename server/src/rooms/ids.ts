// Kryptografisch zufällige Codes, IDs und Tokens.
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ROOM_CODE_LENGTH } from "@couchplay/protocol/constants";

const CODE_SPACE = 10 ** ROOM_CODE_LENGTH;

/** Zufälliger 6-stelliger Code (000000–999999), der nicht in `taken` liegt. */
export function newRoomCode(taken: { has(code: string): boolean }): string {
  for (;;) {
    const code = String(randomInt(0, CODE_SPACE)).padStart(ROOM_CODE_LENGTH, "0");
    if (!taken.has(code)) return code;
  }
}

/** 24 Byte → base64url (32 Zeichen). */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Spieler-ID, eindeutig im Raum, z. B. "p_Xc1o7JfS". */
export function newPlayerId(taken: ReadonlySet<string>): string {
  for (;;) {
    const id = `p_${randomBytes(6).toString("base64url")}`;
    if (!taken.has(id)) return id;
  }
}

/** Konstantzeit-Vergleich von Tokens. */
export function tokensEqual(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
