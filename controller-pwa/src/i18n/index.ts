// Zugriffspunkt für UI-Texte: `import { t } from "./i18n/index.js"`.
import type { ErrorCode } from "@couchplay/protocol/errors";
import { de } from "./de.js";

export type Strings = typeof de;
export const t: Strings = de;

/** UI-Text für einen Protokoll-Fehlercode. */
export function errorText(code: ErrorCode): string {
  return t.errors[code];
}
