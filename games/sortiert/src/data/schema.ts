// Schema und Grenzen des Set-Katalogs. Die Sets liegen kompakt als Tupel in ./sets/<kategorie>.ts.
//
// Format (verbindlich, auch für den Daten-Agent):
//   RawSet  = [id, prompt, unit, top, bottom, items]
//   RawItem = [label, value, note?]
//
// - id:     „<präfix>-<3 Ziffern>“, Präfix passend zur Kategorie (zei, gel, ver, gro, men, tem).
// - prompt: Kriterium als kurzer Satz bzw. Frage, 10–90 Zeichen („Welche Konsole wurde am häufigsten verkauft?“).
// - unit:   Einheit für die Anzeige, höchstens 10 Zeichen („Mio.“, „$“, „€“, „m“, „kcal“, „km/h“ …),
//           "" für reine Anzahlen, Spezialwert "Jahr" = Jahreszahl (ganzzahlig 1–2100, ohne Tausenderpunkt).
// - top / bottom: Beschriftung der beiden Enden der Reihenfolge, je 1–24 Zeichen.
//
// SORTIERRICHTUNG (eine Regel, kein eigenes Feld):
//   unit === "Jahr"  → aufsteigend: oben steht das ÄLTESTE (kleinste Jahreszahl), top z. B. „am ältesten“.
//   jede andere unit → absteigend: oben steht der GRÖSSTE Wert, top z. B. „am meisten verkauft“, „am teuersten“.
//   top/bottom müssen dazu passen.
//
// - items: 6–10 Einträge. label 1–32 Zeichen (im Set eindeutig), value endlich ≥ 0 mit höchstens
//   2 Nachkommastellen, note optional 1–30 Zeichen („Stand 2024“).
//   Werte paarweise deutlich verschieden: Jahre verschieden, sonst relativer Abstand ≥ 3 %
//   (bezogen auf den größeren Wert) – so gibt es keine Gleichstände, die man nicht erraten kann.
import { z } from "zod";
import { CATEGORY_IDS, CATEGORY_PREFIX, YEAR_UNIT, type CategoryId } from "../constants.js";

export type RawItem = readonly [label: string, value: number, note?: string];
export type RawSet = readonly [id: string, prompt: string, unit: string, top: string, bottom: string, items: readonly RawItem[]];

export const LIMITS = {
  promptMin: 10,
  promptMax: 90,
  unitMax: 10,
  endMax: 24,
  labelMax: 32,
  noteMax: 30,
  itemsMin: 6,
  itemsMax: 10,
  /** Mindestabstand zweier Werte relativ zum größeren (keine Jahreszahlen). */
  minGap: 0.03,
  yearMin: 1,
  yearMax: 2100,
} as const;

/** Höchstens 2 Nachkommastellen (robust gegen Gleitkomma-Rauschen). */
export const hasMaxTwoDecimals = (n: number): boolean => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;

/** Normalisierter Text für Doppelten-Vergleiche (Labels, Prompts). */
export const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Kleinster relativer Abstand zweier Werte (bezogen auf den größeren); bei Jahreszahlen der kleinste
 * absolute Abstand in Jahren. Weniger als 2 Werte → Infinity.
 */
export function minGap(values: readonly number[], year: boolean): number {
  const sorted = [...values].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const lo = sorted[i - 1]!;
    const hi = sorted[i]!;
    const gap = year ? hi - lo : hi === 0 ? 0 : (hi - lo) / hi;
    min = Math.min(min, gap);
  }
  return min;
}

/** Werte erfüllen die Abstandsregel (Jahre verschieden, sonst ≥ 3 %). */
export const valuesWellSeparated = (values: readonly number[], year: boolean): boolean =>
  year ? minGap(values, true) >= 1 : minGap(values, false) >= LIMITS.minGap - 1e-9;

const ItemSchema = z.object({
  label: z.string().trim().min(1).max(LIMITS.labelMax),
  // zod 4: z.number() lehnt NaN/Infinity bereits ab.
  value: z.number().min(0).refine(hasMaxTwoDecimals, { message: "Höchstens 2 Nachkommastellen" }),
  note: z.string().trim().min(1).max(LIMITS.noteMax).optional(),
});

export const SortSetSchema = z
  .object({
    id: z.string().regex(/^[a-z]{3}-\d{3}$/),
    category: z.enum(CATEGORY_IDS),
    prompt: z.string().trim().min(LIMITS.promptMin).max(LIMITS.promptMax),
    unit: z.string().max(LIMITS.unitMax),
    top: z.string().trim().min(1).max(LIMITS.endMax),
    bottom: z.string().trim().min(1).max(LIMITS.endMax),
    items: z.array(ItemSchema).min(LIMITS.itemsMin).max(LIMITS.itemsMax),
  })
  .refine((s) => s.id.startsWith(`${CATEGORY_PREFIX[s.category]}-`), { message: "ID-Präfix passt nicht zur Kategorie" })
  .refine((s) => new Set(s.items.map((i) => norm(i.label))).size === s.items.length, { message: "Labels im Set nicht eindeutig" })
  .refine(
    (s) => s.unit !== YEAR_UNIT || s.items.every((i) => Number.isInteger(i.value) && i.value >= LIMITS.yearMin && i.value <= LIMITS.yearMax),
    { message: "Jahreszahlen müssen ganzzahlig zwischen 1 und 2100 liegen" },
  )
  .refine(
    (s) =>
      valuesWellSeparated(
        s.items.map((i) => i.value),
        s.unit === YEAR_UNIT,
      ),
    { message: "Werte zu dicht beieinander (Jahre verschieden, sonst ≥ 3 % Abstand)" },
  );

export type SortSet = z.infer<typeof SortSetSchema>;
export type SortItem = SortSet["items"][number];

export function toSets(category: CategoryId, raw: readonly RawSet[]): SortSet[] {
  return raw.map(([id, prompt, unit, top, bottom, items]) =>
    SortSetSchema.parse({
      id,
      category,
      prompt,
      unit,
      top,
      bottom,
      items: items.map(([label, value, note]) => ({ label, value, ...(note !== undefined ? { note } : {}) })),
    }),
  );
}
