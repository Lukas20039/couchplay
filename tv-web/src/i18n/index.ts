// Zugriffspunkt für UI-Texte: `import { t } from "./i18n/index.js"`.
import type { ErrorCode } from "@couchplay/protocol/errors";
import { de } from "./de.js";

export type Strings = typeof de;
export const t: Strings = de;

/** Text mit Singular-/Pluralform (Deutsch: genau 1 = Singular). */
export interface PluralText {
  one: string;
  other: string;
}

/** Wählt die passende Form und ersetzt {n} sowie weitere Platzhalter. */
export function plural(text: PluralText, n: number, values: Record<string, string | number> = {}): string {
  const template = n === 1 ? text.one : text.other;
  const all: Record<string, string | number> = { ...values, n };
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in all ? String(all[key]) : m));
}

/** UI-Text für einen Protokoll-Fehlercode. */
export function errorText(code: ErrorCode): string {
  return t.errors[code];
}
