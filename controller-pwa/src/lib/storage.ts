// localStorage-Zugriff mit Typprüfung. Safari im privaten Modus / gesperrter Speicher
// werfen Exceptions – dann läuft die App ohne Persistenz weiter.
import { AVATAR_IDS, ROOM_CODE_PATTERN, STORAGE_KEYS, type AvatarId } from "@couchplay/protocol/constants";

export interface PlayerSession {
  code: string;
  playerId: string;
  token: string;
}

export interface Profile {
  name: string;
  avatar: AvatarId;
}

const INSTALL_HINT_KEY = "couchplay.player.installHintDismissed";

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Speicher nicht verfügbar – ignorieren.
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isAvatarId(v: unknown): v is AvatarId {
  return typeof v === "string" && (AVATAR_IDS as readonly string[]).includes(v);
}

export function loadSession(): PlayerSession | null {
  const v = read(STORAGE_KEYS.playerSession);
  if (!isRecord(v)) return null;
  const { code, playerId, token } = v;
  if (typeof code !== "string" || !ROOM_CODE_PATTERN.test(code)) return null;
  if (typeof playerId !== "string" || typeof token !== "string" || !playerId || !token) return null;
  return { code, playerId, token };
}

export function saveSession(s: PlayerSession | null): void {
  write(STORAGE_KEYS.playerSession, s);
}

export function loadProfile(): Partial<Profile> {
  const v = read(STORAGE_KEYS.profile);
  if (!isRecord(v)) return {};
  const out: Partial<Profile> = {};
  if (typeof v.name === "string") out.name = v.name;
  if (isAvatarId(v.avatar)) out.avatar = v.avatar;
  return out;
}

export function saveProfile(p: Profile): void {
  write(STORAGE_KEYS.profile, p);
}

export function isInstallHintDismissed(): boolean {
  return read(INSTALL_HINT_KEY) === true;
}

export function dismissInstallHint(): void {
  write(INSTALL_HINT_KEY, true);
}
