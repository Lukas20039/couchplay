// Gedächtnis „schon gesehene Fragen“ je Handy (localStorage), kompakt zum Server geschickt.
// Ohne zod-Abhängigkeit, damit es auch der Controller importieren kann.

/** Schlüssel im localStorage des Handys. */
export const SEEN_STORAGE_KEY = "couchplay.quiz.seen";
/** So viele zuletzt gesehene Fragen merkt sich ein Handy (älteste fallen raus). */
export const SEEN_MAX = 1000;

/** Kompaktform für game.input: { geo: [1, 17, 140], ges: [3] } statt ["geo-01", …]. */
export type SeenPacked = Record<string, number[]>;

const ID = /^([a-z]+)-(\d{2,3})$/;

export function packSeen(ids: readonly string[]): SeenPacked {
  const out: SeenPacked = {};
  for (const id of ids.slice(-SEEN_MAX)) {
    const m = ID.exec(id);
    if (!m) continue;
    (out[m[1]!] ??= []).push(Number(m[2]));
  }
  return out;
}

export function unpackSeen(packed: SeenPacked): string[] {
  const out: string[] = [];
  for (const [prefix, nums] of Object.entries(packed)) {
    for (const n of nums) out.push(`${prefix}-${String(n).padStart(2, "0")}`);
  }
  return out;
}

/** Gespeicherte Liste lesen (defekt/fehlend → leer). */
export function loadSeen(storage: Pick<Storage, "getItem"> | null | undefined): string[] {
  try {
    const v: unknown = JSON.parse(storage?.getItem(SEEN_STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && ID.test(x)) : [];
  } catch {
    return [];
  }
}

/** Frage als gesehen merken (ans Ende, ohne Doppelte, höchstens SEEN_MAX). */
export function rememberSeen(storage: Pick<Storage, "getItem" | "setItem"> | null | undefined, id: string): void {
  if (!storage || !ID.test(id)) return;
  const list = loadSeen(storage).filter((x) => x !== id);
  list.push(id);
  try {
    storage.setItem(SEEN_STORAGE_KEY, JSON.stringify(list.slice(-SEEN_MAX)));
  } catch {
    // Speicher voll/gesperrt (privater Modus): dann eben ohne Gedächtnis.
  }
}
