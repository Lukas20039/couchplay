// Namensvorschlag bei NAME_TAKEN, z. B. wenn ein früherer Join angenommen wurde,
// die Antwort aber verloren ging (der alte Platz ist dann noch 2 min reserviert).
import { NAME_MAX_LENGTH } from "@couchplay/protocol/constants";
import { normalizeName } from "@couchplay/protocol/util";

/** "Anna" → "Anna2", "Anna2" → "Anna3", kürzt den Stamm, damit das Limit passt. */
export function suggestName(name: string): string {
  const n = normalizeName(name);
  const base0 = n.ok ? n.name : name.trim();
  const m = /^(.*?)(\d+)$/u.exec(base0);
  const stem = m && m[1] ? m[1] : base0;
  const num = m && m[1] ? Number(m[2]) + 1 : 2;
  const suffix = String(num);
  const chars = [...stem];
  const room = NAME_MAX_LENGTH - suffix.length;
  const cut = chars.length > room ? chars.slice(0, Math.max(1, room)).join("").trimEnd() : stem;
  return cut + suffix;
}
