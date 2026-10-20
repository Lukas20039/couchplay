// Reine Logik der Raumcode-Eingabe (ein echtes <input>, sechs sichtbare Zellen).
// Getrennt von der Komponente, damit Tippen, Einfügen und Autofill testbar sind.
import { JOIN_PATH_PREFIX, ROOM_CODE_LENGTH } from "@couchplay/protocol/constants";
import { sanitizeRoomCodeInput } from "@couchplay/protocol/util";

/**
 * Normalisiert Rohtext aus dem Eingabefeld zu höchstens 6 Ziffern.
 * Eingefügte Join-Links („https://…/j/042137“) liefern den Code aus dem Pfad –
 * sonst würden z. B. Ziffern eines Ports mit in den Code rutschen.
 */
export function normalizeCodeInput(raw: string): string {
  const prefix = JOIN_PATH_PREFIX.replace(/\//g, "\\/");
  const link = new RegExp(`${prefix}(\\d{${ROOM_CODE_LENGTH}})(?!\\d)`).exec(raw);
  if (link?.[1]) return link[1];
  return sanitizeRoomCodeInput(raw);
}

export function isCodeComplete(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH && /^\d+$/.test(code);
}

/** Zellen für die Anzeige: Ziffer oder "" für leere Zellen. */
export function codeCells(code: string): string[] {
  return Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => code[i] ?? "");
}

/** Index der Zelle, die den Cursor zeigt (bei vollem Code die letzte). */
export function activeCell(code: string): number {
  return Math.min(code.length, ROOM_CODE_LENGTH - 1);
}

export interface CodeInputStep {
  code: string;
  /** true genau dann, wenn diese Eingabe den Code vervollständigt hat (→ automatisch weiter). */
  completed: boolean;
}

/** Übergang bei jeder Eingabe (Tippen, Löschen, Einfügen, One-Time-Code-Autofill). */
export function nextCode(prev: string, raw: string): CodeInputStep {
  const code = normalizeCodeInput(raw);
  return { code, completed: isCodeComplete(code) && code !== prev };
}
