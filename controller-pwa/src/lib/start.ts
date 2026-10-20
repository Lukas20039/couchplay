// Entscheidung beim App-Start: Was passiert mit /j/<code>, gespeicherter Sitzung und Profil?
// Rein funktional → alle Varianten (frisch, alte Sitzung, gleicher Raum, ungültiger Link …) testbar.
import { JOIN_PATH_PREFIX, type AvatarId } from "@couchplay/protocol/constants";
import { normalizeName } from "@couchplay/protocol/util";
import type { PlayerSession, Profile } from "./storage.js";
import { parseRoute } from "./route.js";

export type StartPlan =
  /** Gespeicherte Sitzung wieder aufnehmen (gleicher Raum wie im Link oder kein Link). */
  | { kind: "resume"; session: PlayerSession }
  /** QR/Link + bekanntes Profil: sofort beitreten, ohne Zwischenschritt. */
  | { kind: "autoJoin"; code: string; name: string; avatar: AvatarId }
  /** QR/Link, erstes Mal: Name + Avatar wählen, Code steht fest. */
  | { kind: "profile"; code: string }
  /** Startseite (Code-Eingabe); `invalidLink` = /j/… mit kaputtem Code. */
  | { kind: "code"; invalidLink: boolean };

export interface StartDecision {
  plan: StartPlan;
  /** Gespeicherte Sitzung eines ANDEREN Raums verwerfen (der Link hat Vorrang). */
  discardSession: boolean;
}

/** Vollständiges, gültiges Profil aus dem Speicher (sonst null). */
export function usableProfile(p: Partial<Profile>): Profile | null {
  if (!p.name || !p.avatar) return null;
  const n = normalizeName(p.name);
  return n.ok ? { name: n.name, avatar: p.avatar } : null;
}

export function decideStart(pathname: string, stored: PlayerSession | null, profile: Partial<Profile>): StartDecision {
  const { code } = parseRoute(pathname);
  if (code) {
    if (stored?.code === code) return { plan: { kind: "resume", session: stored }, discardSession: false };
    const known = usableProfile(profile);
    return {
      plan: known ? { kind: "autoJoin", code, ...known } : { kind: "profile", code },
      discardSession: stored !== null,
    };
  }
  const invalidLink = pathname.startsWith(JOIN_PATH_PREFIX) || pathname === JOIN_PATH_PREFIX.slice(0, -1);
  // Kaputter Link, aber laufende Sitzung: lieber dorthin zurück als auf die leere Startseite.
  if (stored) return { plan: { kind: "resume", session: stored }, discardSession: false };
  return { plan: { kind: "code", invalidLink }, discardSession: false };
}
