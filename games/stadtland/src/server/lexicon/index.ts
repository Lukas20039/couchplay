// Lexikon-Prüfung von „Stadt, Land, Fluss“ (nur Server – die Wortlisten gelangen nie in TV-/Handy-Bundles).
//
// Je prüfbarer Kategorie gibt es eine Wortliste aus einer erzeugten Datei (data/<kategorie>.ts, siehe
// scripts/build-lexicon.mjs) und einer handkuratierten Ergänzung (extra/<kategorie>.ts). Die Listen
// werden erst bei der ersten Abfrage einer Kategorie normalisiert (answerKey) und als Set aufgebaut.
//
// Eine Antwort gilt als „known“ bei:
//   1. exaktem Schlüssel-Treffer,
//   2. einfacher Flexion (Plural/Endungen, Umlaut im Plural, bei Berufen/Tieren weibliche Formen),
//   3. Komposita-Endung (nur Tier/Gericht/Getränk/Süßes …: „Riesenschildkröte“ → „Schildkröte“),
//   4. Tippfehler: Damerau-Levenshtein ≤ 1 ab 5 Zeichen, ≤ 2 ab 9 Zeichen.
// Lieber großzügig: Falsch-Ablehnungen stören mehr als Falsch-Annahmen.
import type { CategoryId } from "../../constants.js";
import { answerKey } from "../../normalize.js";

import beruf from "./data/beruf.js";
import fluss from "./data/fluss.js";
import gericht from "./data/gericht.js";
import getraenk from "./data/getraenk.js";
import land from "./data/land.js";
import marke from "./data/marke.js";
import musik from "./data/musik.js";
import name from "./data/name.js";
import stadt from "./data/stadt.js";
import suesses from "./data/suesses.js";
import tier from "./data/tier.js";
import extraBeruf from "./extra/beruf.js";
import extraDeny from "./extra/deny.js";
import extraFluss from "./extra/fluss.js";
import extraGericht from "./extra/gericht.js";
import extraGetraenk from "./extra/getraenk.js";
import extraGewuerz from "./extra/gewuerz.js";
import extraKuechengeraet from "./extra/kuechengeraet.js";
import extraLand from "./extra/land.js";
import extraMarke from "./extra/marke.js";
import extraMusik from "./extra/musik.js";
import extraName from "./extra/name.js";
import extraObstgemuese from "./extra/obstgemuese.js";
import extraPizzabelag from "./extra/pizzabelag.js";
import extraStadt from "./extra/stadt.js";
import extraSuesses from "./extra/suesses.js";
import extraTier from "./extra/tier.js";

/** Ergebnis der Lexikon-Prüfung: im Lexikon gefunden, nicht gefunden oder Kategorie nicht prüfbar (null). */
export type LexiconResult = "known" | "unknown" | null;

/** Wie eine Antwort gefunden wurde (für Logs/Tests/Debugging). */
export type LexiconMatchKind = "exact" | "flex" | "compound" | "typo";

/** Ausführliches Ergebnis: Treffer-Art und der gefundene Listenschlüssel (normalisiert). */
export interface LexiconDetail {
  result: LexiconResult;
  kind?: LexiconMatchKind;
  match?: string;
}

/** Flexionsregeln: keine (Eigennamen), Substantiv (Plural) oder Person/Tier (zusätzlich weibliche Formen). */
type Flex = "none" | "noun" | "person";

interface Spec {
  /** Rohlisten (ein Eintrag pro Zeile). */
  sources: readonly string[];
  flex: Flex;
  /** Komposita-Endung erlaubt („Zitronenlimonade“ → „Limonade“). */
  compound: boolean;
  /** Ortsnamen-Varianten erzeugen („Frankfurt am Main“ → auch „Frankfurt“, „Sankt“ ↔ „St.“). */
  places?: boolean;
  /** Künstlernamen-Varianten („The Beatles“ → „Beatles“, „Helene Fischer“ → auch „Fischer“). */
  artists?: boolean;
}

/** Prüfbare Kategorien und ihre Regeln. Gerichte erben Süßes/Obst & Gemüse nicht – jede Liste steht für sich. */
const SPECS: Partial<Record<CategoryId, Spec>> = {
  stadt: { sources: [stadt, extraStadt], flex: "none", compound: false, places: true },
  land: { sources: [land, extraLand], flex: "none", compound: false, places: true },
  fluss: { sources: [fluss, extraFluss], flex: "none", compound: false, places: true },
  name: { sources: [name, extraName], flex: "none", compound: false },
  beruf: { sources: [beruf, extraBeruf], flex: "person", compound: false },
  tier: { sources: [tier, extraTier], flex: "person", compound: true },
  obstgemuese: { sources: [extraObstgemuese], flex: "noun", compound: true },
  gewuerz: { sources: [extraGewuerz], flex: "noun", compound: true },
  getraenk: { sources: [getraenk, extraGetraenk], flex: "noun", compound: true },
  gericht: { sources: [gericht, extraGericht], flex: "noun", compound: true },
  suesses: { sources: [suesses, extraSuesses], flex: "noun", compound: true },
  kuechengeraet: { sources: [extraKuechengeraet], flex: "noun", compound: true },
  pizzabelag: { sources: [extraPizzabelag], flex: "noun", compound: true },
  marke: { sources: [marke, extraMarke], flex: "none", compound: false },
  musik: { sources: [musik, extraMusik], flex: "none", compound: false, artists: true },
};

/** Kategorien, für die es eine Wortliste gibt. */
export const LEXICON_CATEGORIES: ReadonlySet<CategoryId> = new Set(Object.keys(SPECS) as CategoryId[]);

// ---------------------------------------------------------------------------
// Aufbau (lazy, je Kategorie gecacht)
// ---------------------------------------------------------------------------

interface Index {
  keys: Set<string>;
  /** Für die Tippfehlersuche: Schlüssel nach „Anfangsbuchstabe + Länge“. */
  buckets: Map<string, string[]>;
  /** Schlüssel, die nie als bekannt gelten (z. B. „Haus“ ist zwar ein Ort in der Steiermark …). */
  deny: Set<string>;
}

const cache = new Map<CategoryId, Index>();

/** Verbindungswörter in Ortsnamen, ab denen der Rest ein Zusatz ist („Frankfurt am Main“, „Bad Homburg vor der Höhe“). */
const PLACE_QUALIFIER = / (am|an der|an den|im|in der|in|ob der|ob|vor der|bei|unter|auf der|upon|on|sur|en|de|del|di)( .*)$/;

/** Rohe Varianten eines Ortsnamens (vor answerKey). */
function placeVariants(raw: string): string[] {
  const out = [raw];
  const m = PLACE_QUALIFIER.exec(raw);
  if (m) {
    out.push(raw.slice(0, m.index)); // „Frankfurt“
    out.push(raw.slice(0, m.index) + m[2]); // „Frankfurt Main“ (für „Frankfurt/Main“)
  }
  const slash = raw.indexOf("/");
  if (slash > 1) out.push(raw.slice(0, slash)); // „Halle/Saale“ → „Halle“
  return out;
}

/** Gattungswörter in Flussnamen anderer Sprachen („Río Segre“, „Rivière Croche“, „Misty River“, „Upa Nehri“). */
const RIVER_PREFIX = /^(río|rio|rivière|riviere|râul|raul|arroyo|ruisseau|fiume|torrente|rzeka|reka|nahal|wadi|oued|ribeirão|ribeira) (de la |del |de |du |des |d'|da |do |dos )?/i;
const RIVER_SUFFIX = / (river|creek|brook|burn|water|nehri|çayı|potamós|potamos|fork)$/i;

function riverVariants(raw: string): string[] {
  const out = placeVariants(raw);
  const stripped = raw.replace(RIVER_PREFIX, "").replace(RIVER_SUFFIX, "");
  if (stripped !== raw && stripped.length >= 2) out.push(stripped);
  return out;
}

/** Rohe Varianten eines Künstler-/Bandnamens (vor answerKey). */
function artistVariants(raw: string): string[] {
  const out = [raw];
  const the = /^(the|die|les|los|la|le) (.+)$/i.exec(raw);
  if (the) out.push(the[2]!);
  const words = raw.split(" ");
  // Personennamen: Nachname allein („Grönemeyer“); nur bei zwei bis drei Wörtern und ≥ 4 Zeichen.
  const last = words[words.length - 1]!;
  if (words.length >= 2 && words.length <= 3 && last.length >= 4) out.push(last);
  return out;
}

/** Schlüssel-Varianten für Orte: „sankt“/„saint“/„san“ ↔ „st“. */
function placeKeyVariants(key: string, add: (k: string) => void): void {
  for (const p of ["sankt", "saint", "sainte"]) {
    if (key.startsWith(p) && key.length > p.length + 2) add("st" + key.slice(p.length));
  }
}

/** Parst die Deny-Liste: Zeilen „kategorie: Eintrag“. */
function denyFor(category: CategoryId): Set<string> {
  const out = new Set<string>();
  for (const line of extraDeny.split("\n")) {
    const i = line.indexOf(":");
    if (i < 0 || line.slice(0, i).trim() !== category) continue;
    const key = answerKey(line.slice(i + 1));
    if (key) out.add(key);
  }
  return out;
}

const ASCII_WORD = /^[A-Za-z]+$/;

/** answerKey mit schnellem Weg für einzelne ASCII-Wörter (dort ist answerKey = Kleinschreibung). */
const keyOf = (raw: string): string => (ASCII_WORD.test(raw) ? raw.toLowerCase() : answerKey(raw));

function buildIndex(category: CategoryId, spec: Spec): Index {
  const keys = new Set<string>();
  const add = (k: string): void => {
    if (k.length >= 2) keys.add(k);
  };
  for (const source of spec.sources) {
    for (const line of source.split("\n")) {
      const raw = line.trim();
      if (raw === "" || raw.startsWith("#")) continue;
      const variants =
        category === "fluss"
          ? riverVariants(raw)
          : spec.places
            ? placeVariants(raw)
            : spec.artists
              ? artistVariants(raw)
              : [raw];
      for (const variant of variants) {
        const key = keyOf(variant);
        add(key);
        if (spec.places) placeKeyVariants(key, add);
      }
    }
  }
  const buckets = new Map<string, string[]>();
  for (const k of keys) {
    if (k.length < 4) continue; // Tippfehler erst ab 5 Zeichen (Länge ±1)
    const b = k[0]! + k.length;
    const list = buckets.get(b);
    if (list) list.push(k);
    else buckets.set(b, [k]);
  }
  return { keys, buckets, deny: denyFor(category) };
}

function getIndex(category: CategoryId): Index | null {
  const spec = SPECS[category];
  if (!spec) return null;
  let index = cache.get(category);
  if (!index) {
    index = buildIndex(category, spec);
    cache.set(category, index);
  }
  return index;
}

// ---------------------------------------------------------------------------
// Flexion
// ---------------------------------------------------------------------------

/** Plural-/Flexionsendungen (längste zuerst). */
const NOUN_ENDINGS = ["nen", "ern", "en", "er", "es", "e", "n", "s"];
const PERSON_ENDINGS = ["innen", "in"];
const ADD_ENDINGS = ["e", "n", "en", "s"];

/** Letzten Umlaut zurückführen: „aepfel“ → „apfel“, „maeus“ → „maus“, „aerzt“ → „arzt“. */
function unUmlaut(s: string): string | null {
  const m = /(ae|oe|ue)(?!.*(ae|oe|ue))/.exec(s);
  if (!m) return null;
  return s.slice(0, m.index) + m[1]![0] + s.slice(m.index + 2);
}

/** Kandidaten-Grundformen eines Schlüssels (ohne den Schlüssel selbst). */
export function flexCandidates(key: string, flex: Flex): string[] {
  if (flex === "none") return [];
  const stems = new Set<string>();
  const strip = (s: string, endings: readonly string[]): void => {
    for (const e of endings) {
      if (s.endsWith(e) && s.length - e.length >= 3) stems.add(s.slice(0, -e.length));
    }
  };
  strip(key, NOUN_ENDINGS);
  if (flex === "person") {
    // Weibliche Formen: „Bäckerin“ → „bäcker“, „Ärztinnen“ → „aerzt“ → „arzt“, „Beamtin“ → „beamt“ + e/er.
    const before = stems.size;
    strip(key, PERSON_ENDINGS);
    if (stems.size > before) {
      for (const s of [...stems]) stems.add(s + "er");
    }
    // „Kauffrau“ ↔ „Kaufmann“, „Feuerwehrfrau“ → „Feuerwehrmann“.
    for (const [from, to] of [
      ["frauen", "mann"],
      ["frau", "mann"],
      ["leute", "mann"],
      ["maenner", "mann"],
      ["mann", "frau"],
    ] as const) {
      if (key.endsWith(from) && key.length > from.length + 2) stems.add(key.slice(0, -from.length) + to);
    }
  }
  stems.add(key);
  for (const s of [...stems]) {
    const u = unUmlaut(s);
    if (u) stems.add(u);
  }
  // Endungen anhängen (Liste hat Plural, Antwort Singular: „Nudel“ → „Nudeln“) nur bei Speisen & Co. –
  // bei Tieren/Berufen erzeugt das eher Zufallstreffer („Haus“ + „en“ = „Hausen“, ein Fisch).
  if (flex === "noun") {
    for (const s of [...stems]) for (const e of ADD_ENDINGS) stems.add(s + e);
  }
  stems.delete(key);
  return [...stems];
}

// ---------------------------------------------------------------------------
// Tippfehler: begrenzte Damerau-Levenshtein-Distanz (Optimal String Alignment)
// ---------------------------------------------------------------------------

const ROW_MAX = 64;
let rowA = new Int32Array(ROW_MAX);
let rowB = new Int32Array(ROW_MAX);
let rowC = new Int32Array(ROW_MAX);

/** Distanz zwischen a und b, oder max + 1, sobald sie sicher größer als max ist. */
export function boundedDistance(a: string, b: string, max: number): number {
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > max) return max + 1;
  if (m + 1 > rowA.length) {
    rowA = new Int32Array(m + 1);
    rowB = new Int32Array(m + 1);
    rowC = new Int32Array(m + 1);
  }
  // prev2 = Zeile i-2, prev = Zeile i-1, cur = Zeile i
  let prev2 = rowA;
  let prev = rowB;
  let cur = rowC;
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) {
        v = Math.min(v, prev2[j - 2]! + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    const t = prev2;
    prev2 = prev;
    prev = cur;
    cur = t;
  }
  return prev[m]!;
}

/** Erlaubte Tippfehler-Distanz für einen Schlüssel dieser Länge. */
const typoBudget = (len: number): number => (len >= 9 ? 2 : len >= 5 ? 1 : 0);

function findTypo(index: Index, key: string): string | undefined {
  const max = typoBudget(key.length);
  if (max === 0) return undefined;
  const first = key[0]!;
  for (let d = 0; d <= max; d++) {
    for (const len of d === 0 ? [key.length] : [key.length - d, key.length + d]) {
      const list = index.buckets.get(first + len);
      if (!list) continue;
      for (const cand of list) {
        // Auch der Listeneintrag muss lang genug für die Toleranz sein (kurze Einträge nur exakt).
        if (typoBudget(Math.min(cand.length, key.length)) === 0) continue;
        if (boundedDistance(key, cand, max) <= max) return cand;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Abfrage
// ---------------------------------------------------------------------------

/** Mindestlänge des bekannten Wortes bei Komposita und Mindestlänge des Bestimmungswortes davor. */
const COMPOUND_MIN_TAIL = 4;
const COMPOUND_MIN_HEAD = 3;

/** Wie lookupAnswer, aber mit Art des Treffers und gefundenem Listenschlüssel. */
export function lookupDetail(category: CategoryId, text: string): LexiconDetail {
  const spec = SPECS[category];
  const index = getIndex(category);
  if (!spec || !index) return { result: null };
  const key = answerKey(text);
  if (key.length < 2 || index.deny.has(key)) return { result: "unknown" };
  const { keys } = index;

  if (keys.has(key)) return { result: "known", kind: "exact", match: key };

  const forms = flexCandidates(key, spec.flex);
  for (const f of forms) {
    if (keys.has(f) && !index.deny.has(f)) return { result: "known", kind: "flex", match: f };
  }

  if (spec.compound) {
    for (const f of [key, ...forms]) {
      for (let i = COMPOUND_MIN_HEAD; f.length - i >= COMPOUND_MIN_TAIL; i++) {
        const tail = f.slice(i);
        if (keys.has(tail) && !index.deny.has(tail)) return { result: "known", kind: "compound", match: tail };
      }
    }
  }

  const typo = findTypo(index, key);
  if (typo !== undefined && !index.deny.has(typo)) return { result: "known", kind: "typo", match: typo };
  if (spec.flex === "person") {
    // „Bäckerinn“ o. Ä.: Tippfehler in der Grundform der weiblichen Form.
    const m = /(innen|in)$/.exec(key);
    if (m && key.length - m[0].length >= 5) {
      const t = findTypo(index, key.slice(0, m.index));
      if (t !== undefined && !index.deny.has(t)) return { result: "known", kind: "typo", match: t };
    }
  }
  return { result: "unknown" };
}

/**
 * Prüft eine (bereits gültige: richtiger Anfangsbuchstabe, nicht leer) Antwort gegen die Wortliste der Kategorie.
 * @returns null, wenn die Kategorie keine Wortliste hat.
 */
export function lookupAnswer(category: CategoryId, text: string): LexiconResult {
  return lookupDetail(category, text).result;
}

/** Anzahl der (normalisierten) Schlüssel einer Kategorie – baut den Index bei Bedarf auf (Tests/Statistik). */
export function lexiconSize(category: CategoryId): number {
  return getIndex(category)?.keys.size ?? 0;
}

/** Alle Schlüssel einer Kategorie (Tests/Statistik). */
export function lexiconKeys(category: CategoryId): ReadonlySet<string> {
  return getIndex(category)?.keys ?? new Set();
}
