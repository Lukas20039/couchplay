// Minimales Routing: "/" (Startseite) und "/j/:code" (Join-Link aus dem QR-Code).
import { parseJoinPath } from "@couchplay/protocol/util";

export interface InitialRoute {
  /** Code aus /j/:code oder null. */
  code: string | null;
}

export function parseRoute(pathname: string): InitialRoute {
  return { code: parseJoinPath(pathname) };
}

/** Setzt die Adresszeile auf die Startseite zurück (ohne Neuladen). */
export function resetUrl(loc: Pick<Location, "pathname"> = location, hist: Pick<History, "replaceState"> = history): void {
  if (loc.pathname !== "/") hist.replaceState(null, "", "/");
}
