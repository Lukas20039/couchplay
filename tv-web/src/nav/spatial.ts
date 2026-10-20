// Schlanke Spatial-Navigation (rein, ohne DOM) – getestet in test/spatial.test.ts.
// Elemente gehören zu Fokus-Gruppen (z. B. "games", "settings"). Bewegung bleibt
// bevorzugt in der eigenen Gruppe; beim Wechsel in eine andere Gruppe wird deren
// zuletzt fokussiertes Element wiederhergestellt (Gruppen-Gedächtnis).

export type Direction = "up" | "down" | "left" | "right";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface NavItem {
  id: string;
  group: string;
  rect: Rect;
}

interface Axis {
  /** Abstand in Bewegungsrichtung (>0 = liegt in Richtung). */
  primary: number;
  /** Seitlicher Versatz (Überlappung = 0). */
  secondary: number;
}

function measure(from: Rect, to: Rect, dir: Direction): Axis {
  const fromRight = from.left + from.width;
  const fromBottom = from.top + from.height;
  const toRight = to.left + to.width;
  const toBottom = to.top + to.height;
  // Seitlicher Versatz: 0 bei Überlappung der Projektionen, sonst Lücke.
  const gapX = Math.max(0, to.left - fromRight, from.left - toRight);
  const gapY = Math.max(0, to.top - fromBottom, from.top - toBottom);
  // Primärabstand von Kante zu Kante; Mittelpunkte entscheiden die Richtung.
  const cx = to.left + to.width / 2 - (from.left + from.width / 2);
  const cy = to.top + to.height / 2 - (from.top + from.height / 2);
  switch (dir) {
    case "right":
      return { primary: cx > 1 ? Math.max(0, to.left - fromRight) + 1 : -1, secondary: gapY };
    case "left":
      return { primary: cx < -1 ? Math.max(0, from.left - toRight) + 1 : -1, secondary: gapY };
    case "down":
      return { primary: cy > 1 ? Math.max(0, to.top - fromBottom) + 1 : -1, secondary: gapX };
    case "up":
      return { primary: cy < -1 ? Math.max(0, from.top - toBottom) + 1 : -1, secondary: gapX };
  }
}

/** Kleinerer Wert = besserer Kandidat; seitlicher Versatz wird stark gewichtet. */
function score(a: Axis): number {
  return a.primary + a.secondary * 3;
}

function best(from: Rect, items: readonly NavItem[], dir: Direction): NavItem | null {
  let found: NavItem | null = null;
  let bestScore = Infinity;
  for (const item of items) {
    const a = measure(from, item.rect, dir);
    if (a.primary < 0) continue;
    const s = score(a);
    if (s < bestScore) {
      bestScore = s;
      found = item;
    }
  }
  return found;
}

/**
 * Nächstes Ziel ab `currentId` in Richtung `dir`.
 * @param memory zuletzt fokussierte ID je Gruppe
 * @returns ID oder null (Rand erreicht)
 */
export function findNext(
  currentId: string | null,
  items: readonly NavItem[],
  dir: Direction,
  memory: Readonly<Record<string, string>> = {},
): string | null {
  const current = items.find((i) => i.id === currentId);
  if (!current) return items[0]?.id ?? null;
  const others = items.filter((i) => i.id !== current.id);
  const same = best(current.rect, others.filter((i) => i.group === current.group), dir);
  if (same) return same.id;
  const target = best(current.rect, others, dir);
  if (!target) return null;
  // Gruppenwechsel: gemerktes Element der Zielgruppe bevorzugen, wenn es noch existiert.
  const remembered = memory[target.group];
  if (remembered && remembered !== current.id && others.some((i) => i.id === remembered)) return remembered;
  return target.id;
}

export type NavKey = Direction | "ok" | "back" | "menu";

/** Taste → Navigationsaktion (Tastatur, Fernbedienung, WebView-Keycodes). */
export function keyToNav(e: { key: string; keyCode?: number }): NavKey | null {
  switch (e.key) {
    case "ArrowUp":
    case "Up":
      return "up";
    case "ArrowDown":
    case "Down":
      return "down";
    case "ArrowLeft":
    case "Left":
      return "left";
    case "ArrowRight":
    case "Right":
      return "right";
    case "Enter":
    case "Select":
    case " ":
      return "ok";
    case "Escape":
    case "Esc":
    case "Backspace":
    case "GoBack":
    case "BrowserBack":
      return "back";
    case "ContextMenu":
      return "menu";
  }
  // Ältere WebViews liefern teils nur keyCode.
  switch (e.keyCode) {
    case 38:
      return "up";
    case 40:
      return "down";
    case 37:
      return "left";
    case 39:
      return "right";
    case 13:
    case 23: // DPAD_CENTER
      return "ok";
    case 27:
    case 8:
    case 461: // webOS/Hbb-TV Back
      return "back";
    case 93:
      return "menu";
  }
  return null;
}
