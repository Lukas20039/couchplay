// Konstanten von „Zeichnen & Raten“ ohne Abhängigkeiten (auch von TV/Handy importierbar).

export const CATEGORY_IDS = ["tiere", "essen", "haushalt", "berufe", "sport", "orte", "natur", "fantasie"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** ID-Präfix je Kategorie (IDs: `tie-001`). */
export const CATEGORY_PREFIX: Record<CategoryId, string> = {
  tiere: "tie",
  essen: "ess",
  haushalt: "hau",
  berufe: "ber",
  sport: "spo",
  orte: "ort",
  natur: "nat",
  fantasie: "fan",
};

export const DIFFICULTIES = ["leicht", "gemischt", "schwer"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Erlaubte Schwierigkeitsstufen der Begriffe je Setting. */
export const DIFFICULTY_LEVELS: Record<Difficulty, readonly (1 | 2 | 3)[]> = {
  leicht: [1],
  gemischt: [1, 2, 3],
  schwer: [2, 3],
};

/**
 * Stiftfarben (Index = `color` im Strich). Die letzte ist Weiß = Radierer;
 * die Werkzeugleiste zeigt die ersten acht als Farben und Weiß als Radierer.
 */
export const PALETTE = ["#1b1b1f", "#e5383b", "#ff8c1a", "#f7c600", "#2bb34a", "#1f7ae0", "#8e44c9", "#8b5a2b", "#ffffff"] as const;
export const ERASER = PALETTE.length - 1;
/** Stiftstärken in Zeichnungseinheiten (Blatt = 1000 × 1000). */
export const SIZES = [6, 16, 40] as const;

/** Koordinatenraum der Zeichnung: ganzzahlig 0 … CANVAS_UNITS. */
export const CANVAS_UNITS = 1000;

export const DRAW_LIMITS = {
  /** Punkte (x,y-Paare) je game.input-Nachricht. 250 Paare ≈ 3 KB JSON, weit unter 16 KiB. */
  chunkPoints: 250,
  /** Punkte je Zeichnung; darüber werden Striche ignoriert (Server und Handy gleich). */
  drawingPoints: 6000,
  /** Mindestabstand (Einheiten) zwischen zwei übernommenen Punkten (Glättung am Handy). */
  minDistance: 5,
  /** Höchstens so oft pro Sekunde sendet das Handy Zeichnungsdaten. */
  sendIntervalMs: 125,
} as const;

export const GUESS_LIMITS = {
  /** Tipps ≤ 40 Zeichen. */
  maxLength: 40,
  /** Höchstens 1 Tipp pro Sekunde je Spieler. */
  minIntervalMs: 1000,
} as const;
