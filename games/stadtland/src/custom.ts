// Eigene Kategorien (Set „eigene“): Bereinigung, Abbildung auf eingebaute Kategorien und Gedächtnis am Host-Handy.
// Ohne zod und ohne Lexikon – Server und Controller importieren diese Datei gemeinsam.
import { CATEGORY_IDS, CUSTOM_NAME_MAX, MAX_CATEGORIES, type CategoryId } from "./constants.js";
import { CATEGORY_LABELS } from "./i18n/de.js";
import { answerKey, cleanText } from "./normalize.js";

/** Schlüssel im localStorage des Host-Handys: zuletzt bestätigte eigene Liste (JSON-Array von Strings). */
export const CUSTOM_STORAGE_KEY = "couchplay.stadtland.custom";

/** Name einer eigenen Kategorie in Anzeigeform (bereinigt, auf CUSTOM_NAME_MAX gekürzt). */
export const cleanCategoryName = (raw: string): string => cleanText(raw, CUSTOM_NAME_MAX);

/**
 * Bereinigt eine Liste eigener Kategorien: Namen säubern, leere bzw. nur aus Satzzeichen bestehende raus,
 * Doppelte (gleicher Vergleichsschlüssel, „Tiere“ ≠ „Tier“, aber „Der Fluss“ = „fluss“) raus, höchstens MAX_CATEGORIES.
 */
export function cleanCategoryList(raw: readonly string[]): string[] {
  const out: string[] = [];
  const keys = new Set<string>();
  for (const r of raw) {
    const name = cleanCategoryName(r);
    const key = answerKey(name);
    if (key === "" || keys.has(key)) continue;
    keys.add(key);
    out.push(name);
    if (out.length >= MAX_CATEGORIES) break;
  }
  return out;
}

/**
 * Naheliegende Aliase eingebauter Kategorien (als Vergleichsschlüssel, siehe answerKey). Die Anzeigenamen aus
 * i18n/de.ts gelten zusätzlich. Wird eine eigene Kategorie so abgebildet, bekommt sie die Lexikon-Prüfung.
 */
const ALIASES: Partial<Record<CategoryId, readonly string[]>> = {
  stadt: ["stadt", "staedte", "stadte", "ort", "orte", "grossstadt", "grossstaedte"],
  land: ["land", "laender", "lander", "staat", "staaten"],
  fluss: ["fluss", "fluesse", "flusse"],
  name: ["name", "namen", "vorname", "vornamen"],
  beruf: ["beruf", "berufe", "job", "jobs"],
  tier: ["tier", "tiere", "tierart", "tierarten"],
  gericht: ["gericht", "gerichte", "speise", "speisen"],
  obstgemuese: ["obst", "gemuese", "obstundgemuese", "obstodergemuese", "frucht", "fruechte", "obstsorte", "gemuesesorte"],
  getraenk: ["getraenk", "getraenke", "drink", "drinks"],
  suesses: ["suessigkeit", "suessigkeiten", "dessert", "desserts", "nachtisch", "suesses"],
  gewuerz: ["gewuerz", "gewuerze", "kraut", "kraeuter"],
  kuechengeraet: ["kuechengeraet", "kuechengeraete"],
  film: ["film", "filme", "kinofilm", "kinofilme"],
  serie: ["serie", "serien", "tvserie", "fernsehserie"],
  musik: ["band", "bands", "musiker", "musikerin", "saenger", "saengerin", "interpret"],
  promi: ["promi", "promis", "prominente", "prominenter", "star", "stars", "beruehmtheit"],
  figur: ["comicfigur", "trickfigur", "zeichentrickfigur", "comicfiguren"],
  spiel: ["spiel", "spiele", "videospiel", "brettspiel", "computerspiel", "game"],
  marke: ["marke", "marken"],
  song: ["song", "songs", "lied", "lieder", "songtitel"],
  buch: ["buch", "buecher", "roman"],
};

let aliasIndex: Map<string, CategoryId> | null = null;
function index(): Map<string, CategoryId> {
  if (aliasIndex) return aliasIndex;
  const map = new Map<string, CategoryId>();
  for (const id of CATEGORY_IDS) {
    for (const key of ALIASES[id] ?? []) if (!map.has(key)) map.set(key, id);
  }
  // Anzeigenamen nur, wenn sie nicht schon belegt sind (Aliase haben Vorrang).
  for (const id of CATEGORY_IDS) {
    const key = answerKey(CATEGORY_LABELS[id]);
    if (!map.has(key)) map.set(key, id);
  }
  return (aliasIndex = map);
}

/** Eingebaute Kategorie zu einem eigenen Namen („Städte“ → stadt) oder null (nicht prüfbar). */
export function matchCategory(name: string): CategoryId | null {
  return index().get(answerKey(name)) ?? null;
}

/** Gespeicherte eigene Liste lesen (defekt/fehlend/zu kurz → null). */
export function loadCustom(storage: Pick<Storage, "getItem"> | null | undefined, min: number): string[] | null {
  try {
    const v: unknown = JSON.parse(storage?.getItem(CUSTOM_STORAGE_KEY) ?? "null");
    if (!Array.isArray(v)) return null;
    const list = cleanCategoryList(v.filter((x): x is string => typeof x === "string"));
    return list.length >= min ? list : null;
  } catch {
    return null;
  }
}

/** Bestätigte Liste merken (nur das Host-Handy). */
export function saveCustom(storage: Pick<Storage, "setItem"> | null | undefined, list: readonly string[]): void {
  try {
    storage?.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(cleanCategoryList(list)));
  } catch {
    // Speicher voll/gesperrt (privater Modus): dann eben ohne Gedächtnis.
  }
}
