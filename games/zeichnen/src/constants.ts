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
 * Farben (Index = `color` im Strich bzw. in der Füllung). Die ersten QUICK_COLORS stehen direkt in der
 * Werkzeugleiste, alle zusammen im Farbmenü (8 × 4). Der Radierer malt in der Blattfarbe (ui/canvas.ts).
 */
export const PALETTE = [
  "#1b1b1f", "#ffffff", "#e5383b", "#ff8c1a", "#f7c600", "#2bb34a", "#1f7ae0", "#8e44c9", "#8b5a2b",
  "#5c5c66", "#a3a3ad", "#dcdce2", "#ff7eb6", "#d81b78", "#8e1b24", "#ff7f6e",
  "#fff1a0", "#d4a72c", "#a6e04f", "#1e6b30", "#6b7a2a", "#7ee8c4", "#2ec4b6", "#126e82",
  "#9ed8ff", "#163a7a", "#c9a7ff", "#4b2477", "#f9d3b4", "#d9a066", "#a0643c", "#4a2a14",
] as const;
export const WHITE = 1;
export const QUICK_COLORS = 9;
/** Stiftstärken in Zeichnungseinheiten (Blatt = 1000 × 1000). */
export const SIZES = [5, 10, 18, 34, 64] as const;
export const DEFAULT_SIZE = 2;

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
  /** Füllungen je Zeichnung (jede wird beim Neuzeichnen per Flood-Fill wiederholt). */
  fills: 30,
  /** So viele Punkte zählt eine Füllung gegen drawingPoints. */
  fillCost: 20,
  /** Punkte einer Ellipse (Formwerkzeug). */
  ellipsePoints: 72,
} as const;

export const GUESS_LIMITS = {
  /** Tipps ≤ 40 Zeichen. */
  maxLength: 40,
  /** Höchstens 1 Tipp pro Sekunde je Spieler. */
  minIntervalMs: 1000,
} as const;
