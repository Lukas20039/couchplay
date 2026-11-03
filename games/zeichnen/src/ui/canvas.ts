// Zeichnet Striche und Füllungen (0–1000-Koordinaten) auf eine <canvas>. Von TV und Handy gemeinsam genutzt.
// Gezeichnet wird auf ein Blatt mit fester Auflösung (1 px je Einheit), das dann auf die sichtbare Canvas
// skaliert wird – so füllt der Eimer auf TV und Handy pixelgleich, egal wie groß die Anzeige ist.
// Inkrementell: Es werden nur Punkte nachgezeichnet, die seit dem letzten Aufruf dazugekommen sind;
// bei undo/clear (neue `rev`) oder abweichenden Strich-IDs wird komplett neu gezeichnet.
import { CANVAS_UNITS, PALETTE, SIZES, WHITE } from "../constants.js";
import type { Stroke } from "../shared.js";

/** Farbabstand (Summe der RGB-Differenzen), bis zu dem ein Pixel noch zur Füllfläche gehört (Kantenglättung). */
const FILL_TOLERANCE = 110;

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const RGB = PALETTE.map(rgb);

/** Zeichnet Punkte ab Index `from` (Punktindex, nicht Array-Index) eines Strichs. */
function paint(g: CanvasRenderingContext2D, s: Stroke, from: number, scale: number): void {
  const n = s.points.length / 2;
  if (n <= from) return;
  const color = PALETTE[s.color] ?? PALETTE[0];
  const width = (SIZES[s.size] ?? SIZES[0]) * scale;
  const x = (i: number) => s.points[i * 2]! * scale;
  const y = (i: number) => s.points[i * 2 + 1]! * scale;
  if (n === 1) {
    // Einzelner Punkt: runder Klecks.
    g.fillStyle = color;
    g.beginPath();
    g.arc(x(0), y(0), width / 2, 0, Math.PI * 2);
    g.fill();
    return;
  }
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  const start = Math.max(0, from - 1);
  g.moveTo(x(start), y(start));
  for (let i = start + 1; i < n; i++) g.lineTo(x(i), y(i));
  g.stroke();
}

/**
 * Füllt die zusammenhängende Fläche ähnlicher Farbe um (sx, sy) mit `color` (Scanline-Fill) und erweitert sie
 * um 1 px, damit kein heller Saum an geglätteten Kanten bleibt. Rückgabe: Farbe des Startpunkts war ähnlich
 * `paper` und die Fläche berührt den Rand – dann ist sie der neue Hintergrund.
 */
function floodFill(g: CanvasRenderingContext2D, sx: number, sy: number, color: number, paper: number): boolean {
  const W = g.canvas.width;
  const H = g.canvas.height;
  const x0 = Math.min(W - 1, Math.max(0, Math.round(sx)));
  const y0 = Math.min(H - 1, Math.max(0, Math.round(sy)));
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const at = (x0 + y0 * W) * 4;
  const seed = [d[at]!, d[at + 1]!, d[at + 2]!];
  const [fr, fg, fb] = RGB[color] ?? RGB[0]!;
  const near = (i: number, c: readonly number[]): boolean => Math.abs(d[i]! - c[0]!) + Math.abs(d[i + 1]! - c[1]!) + Math.abs(d[i + 2]! - c[2]!) <= FILL_TOLERANCE;
  const seedIsPaper = near(at, RGB[paper] ?? RGB[WHITE]!);
  if (Math.abs(seed[0]! - fr) + Math.abs(seed[1]! - fg) + Math.abs(seed[2]! - fb) < 6) return false;

  const mask = new Uint8Array(W * H);
  const stack: number[] = [x0, y0];
  let border = false;
  while (stack.length > 0) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    // Nach links bis zur Grenze, dann nach rechts füllen und darüber/darunter neue Startpunkte merken.
    while (x > 0 && !mask[x - 1 + y * W] && near((x - 1 + y * W) * 4, seed)) x--;
    let up = false;
    let down = false;
    for (; x < W; x++) {
      const p = x + y * W;
      if (mask[p] || !near(p * 4, seed)) break;
      mask[p] = 1;
      if (x === 0 || x === W - 1 || y === 0 || y === H - 1) border = true;
      if (y > 0) {
        const q = p - W;
        const ok = !mask[q] && near(q * 4, seed);
        if (ok && !up) stack.push(x, y - 1);
        up = ok;
      }
      if (y < H - 1) {
        const q = p + W;
        const ok = !mask[q] && near(q * 4, seed);
        if (ok && !down) stack.push(x, y + 1);
        down = ok;
      }
    }
  }
  for (let p = 0; p < W * H; p++) {
    const x = p % W;
    const hit = mask[p] || (x > 0 && mask[p - 1] === 1) || (x < W - 1 && mask[p + 1] === 1) || (p >= W && mask[p - W] === 1) || (p + W < W * H && mask[p + W] === 1);
    if (!hit) continue;
    d[p * 4] = fr;
    d[p * 4 + 1] = fg;
    d[p * 4 + 2] = fb;
    d[p * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return seedIsPaper && border;
}

export class SheetRenderer {
  private ids: number[] = [];
  private drawn: number[] = [];
  private rev = -1;
  private sheet: CanvasRenderingContext2D | null | undefined;
  /** Farbindex des Hintergrunds (für den Radierer): Weiß, bis der Eimer eine randberührende Blattfläche füllt. */
  paper: number = WHITE;

  private getSheet(): CanvasRenderingContext2D | null {
    if (this.sheet === undefined) {
      const c = typeof document === "undefined" ? null : document.createElement("canvas");
      if (c) c.width = c.height = CANVAS_UNITS;
      this.sheet = c?.getContext("2d", { willReadFrequently: true }) ?? null;
    }
    return this.sheet;
  }

  /** `preview`: Strich, der nur auf dieser Canvas erscheint (Form, die gerade aufgezogen wird). */
  render(canvas: HTMLCanvasElement | null, strokes: readonly Stroke[], rev: number, preview?: Stroke): void {
    const g = canvas?.getContext("2d");
    const sheet = this.getSheet();
    if (!canvas || !g || !sheet) return;
    let full = rev !== this.rev || strokes.length < this.ids.length;
    for (let i = 0; !full && i < this.ids.length; i++) {
      if (strokes[i]!.id !== this.ids[i] || strokes[i]!.points.length / 2 < this.drawn[i]!) full = true;
    }
    if (full) {
      sheet.fillStyle = PALETTE[WHITE];
      sheet.fillRect(0, 0, CANVAS_UNITS, CANVAS_UNITS);
      this.ids = [];
      this.drawn = [];
      this.rev = rev;
      this.paper = WHITE;
    }
    strokes.forEach((s, i) => {
      const from = this.drawn[i] ?? 0;
      if (s.fill) {
        if (from === 0 && floodFill(sheet, s.points[0]!, s.points[1]!, s.color, this.paper)) this.paper = s.color;
      } else paint(sheet, s, from, 1);
      this.ids[i] = s.id;
      this.drawn[i] = s.points.length / 2;
    });
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(sheet.canvas, 0, 0, canvas.width, canvas.height);
    if (preview) paint(g, preview, 0, canvas.width / CANVAS_UNITS);
  }
}

/** Setzt die Pixelgröße der Canvas passend zur CSS-Größe (scharf auf HiDPI). true = geändert. */
export function fitCanvas(canvas: HTMLCanvasElement, cssSize: number): boolean {
  const dpr = Math.min(3, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
  const px = Math.max(1, Math.round(cssSize * dpr));
  if (canvas.width === px && canvas.height === px) return false;
  canvas.width = px;
  canvas.height = px;
  return true;
}
