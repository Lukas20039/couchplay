// Zeichnet Striche (0–1000-Koordinaten) auf eine <canvas>. Von TV und Handy gemeinsam genutzt.
// Inkrementell: Es werden nur Punkte nachgezeichnet, die seit dem letzten Aufruf dazugekommen sind;
// bei undo/clear (neue `rev`), geänderter Größe oder abweichenden Strich-IDs wird komplett neu gezeichnet.
import { CANVAS_UNITS, PALETTE, SIZES } from "../constants.js";
import type { Stroke } from "../shared.js";

const BACKGROUND = "#ffffff";

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

export class SheetRenderer {
  private ids: number[] = [];
  private drawn: number[] = [];
  private rev = -1;
  private px = -1;

  /** Erzwingt beim nächsten render() ein komplettes Neuzeichnen. */
  invalidate(): void {
    this.rev = -1;
  }

  render(canvas: HTMLCanvasElement | null, strokes: readonly Stroke[], rev: number): void {
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return;
    const px = canvas.width;
    const scale = px / CANVAS_UNITS;
    let full = rev !== this.rev || px !== this.px || strokes.length < this.ids.length;
    for (let i = 0; !full && i < this.ids.length; i++) {
      if (strokes[i]!.id !== this.ids[i] || strokes[i]!.points.length / 2 < this.drawn[i]!) full = true;
    }
    if (full) {
      g.fillStyle = BACKGROUND;
      g.fillRect(0, 0, canvas.width, canvas.height);
      this.ids = [];
      this.drawn = [];
      this.rev = rev;
      this.px = px;
    }
    strokes.forEach((s, i) => {
      paint(g, s, this.drawn[i] ?? 0, scale);
      this.ids[i] = s.id;
      this.drawn[i] = s.points.length / 2;
    });
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
