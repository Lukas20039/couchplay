// Computer-Gegner. Sieht das komplette Brett (wie ein Mensch, nichts ist geheim).
//   leicht: nimmt einen Gewinnzug, blockt einen Gewinnzug des Gegners, sonst zufällig
//   mittel: Minimax (Negamax mit Alpha-Beta) Tiefe 4
//   schwer: Negamax mit Alpha-Beta Tiefe 7, Spalten von der Mitte nach außen, Transpositionstabelle,
//           erzwungene Züge (Drohungen blocken) und Bewertung aller Viererfenster mit Zeilen-Parität
// Zufall nur über das übergebene Rng (bei gleich guten Zügen) → deterministisch bei festem Seed.
import { createRng, type Rng } from "@couchplay/game-sdk";
import { EMPTY, legalColumns, type Difficulty, type Dims, type Grid, type SeatIndex } from "../shared.js";

export const SEARCH_DEPTH: Record<Exclude<Difficulty, "leicht">, number> = { mittel: 4, schwer: 7 };

/** Gewinnwert; schnellere Siege (kleinere Zugtiefe) zählen mehr. */
const WIN = 1_000_000;

/** Vorberechnete Geometrie je Brettgröße. */
interface Geometry {
  cols: number;
  rows: number;
  /** Spalten von der Mitte nach außen (Alpha-Beta schneidet so früher ab). */
  order: number[];
  /** Alle Viererfenster, je 4 Feldnummern hintereinander. */
  windows: Int16Array;
  /** Gewicht je Feld für die Bewertung (Mitte wertvoller). */
  centre: Int8Array;
  /** Zufallszahlen je Feld und Platz für Zobrist-Schlüssel (fester Seed, also deterministisch). */
  zobristHi: Int32Array;
  zobristLo: Int32Array;
}

const geometries = new Map<string, Geometry>();

function geometry(d: Dims): Geometry {
  const key = `${d.cols}x${d.rows}`;
  const cached = geometries.get(key);
  if (cached) return cached;
  const { cols, rows } = d;
  const mid = (cols - 1) / 2;
  const order = Array.from({ length: cols }, (_, c) => c).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  const win: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dc, dr] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ] as const) {
        const ec = c + 3 * dc;
        const er = r + 3 * dr;
        if (ec < 0 || ec >= cols || er < 0 || er >= rows) continue;
        for (let i = 0; i < 4; i++) win.push((r + i * dr) * cols + c + i * dc);
      }
    }
  }
  const centre = new Int8Array(cols * rows);
  for (let c = 0; c < cols; c++) {
    // Mittlere Spalte(n) 3, daneben 2, dann 1, Rand 0.
    const w = Math.max(0, 3 - Math.floor(Math.abs(c - mid)));
    for (let r = 0; r < rows; r++) centre[r * cols + c] = w;
  }
  const zr = createRng(0x4f47);
  const random32 = (): number => Math.floor(zr.next() * 4294967296) | 0;
  const zobristHi = Int32Array.from({ length: cols * rows * 2 }, random32);
  const zobristLo = Int32Array.from({ length: cols * rows * 2 }, random32);
  const g: Geometry = { cols, rows, order, windows: Int16Array.from(win), centre, zobristHi, zobristLo };
  geometries.set(key, g);
  return g;
}

/** Veränderliche Suchstellung: 0 leer, 1 = Platz 0, 2 = Platz 1. */
class Position {
  readonly cells: Int8Array;
  readonly heights: Int8Array;
  moves = 0;
  /** Zobrist-Schlüssel der Stellung (zwei 32-Bit-Hälften). */
  private hi = 0;
  private lo = 0;

  constructor(
    readonly g: Geometry,
    grid: Grid,
  ) {
    this.cells = new Int8Array(g.cols * g.rows);
    this.heights = new Int8Array(g.cols);
    for (let i = 0; i < grid.length; i++) {
      const ch = grid[i];
      if (ch === EMPTY) continue;
      const who = ch === "0" ? 1 : 2;
      this.cells[i] = who;
      this.hash(i, who);
      this.moves++;
      this.heights[i % g.cols]! += 1;
    }
  }

  get full(): boolean {
    return this.moves === this.cells.length;
  }

  canPlay(col: number): boolean {
    return this.heights[col]! < this.g.rows;
  }

  /** Feld, auf dem ein Stein in `col` landet (Aufrufer prüft canPlay). */
  target(col: number): number {
    return (this.g.rows - 1 - this.heights[col]!) * this.g.cols + col;
  }

  private hash(cell: number, who: number): void {
    const z = cell * 2 + who - 1;
    this.hi ^= this.g.zobristHi[z]!;
    this.lo ^= this.g.zobristLo[z]!;
  }

  /** Schlüssel für die Transpositionstabelle (53 Bit, als Zahl). */
  key(): number {
    return (this.hi >>> 0) * 2097152 + (this.lo >>> 11);
  }

  play(col: number, who: number): void {
    const cell = this.target(col);
    this.cells[cell] = who;
    this.hash(cell, who);
    this.heights[col]! += 1;
    this.moves++;
  }

  undo(col: number): void {
    this.heights[col]! -= 1;
    const cell = this.target(col);
    this.hash(cell, this.cells[cell]!);
    this.cells[cell] = 0;
    this.moves--;
  }

  /** Gibt ein Stein von `who` in `col` dem Gegner das Feld darüber zum Sieg frei? */
  givesAway(col: number, who: number): boolean {
    if (this.heights[col]! + 1 >= this.g.rows) return false;
    this.play(col, who);
    const lost = this.wins(col, 3 - who);
    this.undo(col);
    return lost;
  }

  /** Würde `who` mit einem Stein in `col` sofort vier in einer Reihe haben? */
  wins(col: number, who: number): boolean {
    const { cols, rows } = this.g;
    const cell = this.target(col);
    const r0 = Math.floor(cell / cols);
    const c0 = col;
    const cells = this.cells;
    // Senkrecht: nur nach unten zählen.
    let n = 0;
    for (let r = r0 + 1; r < rows && cells[r * cols + c0] === who; r++) n++;
    if (n >= 3) return true;
    for (const [dc, dr] of DIRS) {
      n = 0;
      for (let c = c0 + dc, r = r0 + dr; c >= 0 && c < cols && r >= 0 && r < rows && cells[r * cols + c] === who; c += dc, r += dr) n++;
      for (let c = c0 - dc, r = r0 - dr; c >= 0 && c < cols && r >= 0 && r < rows && cells[r * cols + c] === who; c -= dc, r -= dr) n++;
      if (n >= 3) return true;
    }
    return false;
  }

  /**
   * Heuristischer Wert aus Sicht von `who`. Zählt offene Viererfenster:
   * - Dreier mit einem freien Feld = Drohung. Liegt das Feld noch in der Luft, ist sie viel wert
   *   (der Gegner kann sie nicht sofort blocken), besonders in der „richtigen“ Zeile: Wer die Partie
   *   begonnen hat, profitiert von Drohungen in ungeraden Zeilen (von unten gezählt), der andere von geraden.
   * - Zweier mit zwei freien Feldern, Steine in der Mitte.
   */
  evaluate(who: number): number {
    const { windows, centre, cols, rows } = this.g;
    const cells = this.cells;
    const heights = this.heights;
    // Wer hat angefangen? Bei gleicher Steinzahl ist der am Zug, der begonnen hat.
    const first = this.moves % 2 === 0 ? who : 3 - who;
    let score = 0;
    for (let i = 0; i < windows.length; i += 4) {
      let mine = 0;
      let theirs = 0;
      let gap = -1;
      for (let k = 0; k < 4; k++) {
        const cell = windows[i + k]!;
        const v = cells[cell]!;
        if (v === 0) gap = cell;
        else if (v === who) mine++;
        else theirs++;
      }
      if (mine > 0 && theirs > 0) continue;
      if (mine === 3 || theirs === 3) {
        const owner = mine === 3 ? who : 3 - who;
        const col = gap % cols;
        const row = Math.floor(gap / cols);
        const playable = rows - 1 - heights[col]! === row;
        let w = 10;
        if (!playable) {
          w = 50;
          const fromBottom = rows - row; // 1 = unterste Zeile
          if ((owner === first) === (fromBottom % 2 === 1)) w += 30;
        }
        score += owner === who ? w : -w;
      } else if (mine === 2) score += 4;
      else if (theirs === 2) score -= 4;
    }
    for (let i = 0; i < cells.length; i++) {
      const v = cells[i]!;
      if (v === 0) continue;
      score += v === who ? centre[i]! : -centre[i]!;
    }
    return score;
  }
}

/** Waagrecht und beide Diagonalen (senkrecht prüft wins() gesondert). */
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [1, -1],
];

/** Eintrag der Transpositionstabelle (gleiche Stellung über andere Zugfolge). */
interface TtEntry {
  depth: number;
  value: number;
  /** 0 = exakt, 1 = Untergrenze, 2 = Obergrenze. */
  bound: 0 | 1 | 2;
  move: number;
}

/** Gewinnwerte relativ zur Wurzel ↔ relativ zur Stellung (für die Tabelle). */
const toTt = (v: number, ply: number): number => (v > WIN / 2 ? v + ply : v < -WIN / 2 ? v - ply : v);
const fromTt = (v: number, ply: number): number => (v > WIN / 2 ? v - ply : v < -WIN / 2 ? v + ply : v);

class Search {
  readonly table = new Map<number, TtEntry>();
  nodes = 0;
  constructor(readonly pos: Position) {}

  /** Negamax mit Alpha-Beta; Wert aus Sicht von `who` (am Zug), `ply` = Zugtiefe ab Wurzel. */
  negamax(depth: number, alpha: number, beta: number, who: number, ply: number): number {
    this.nodes++;
    const pos = this.pos;
    const { order } = pos.g;
    const opp = 3 - who;
    // Sofortgewinn?
    for (const col of order) if (pos.canPlay(col) && pos.wins(col, who)) return WIN - ply;
    if (pos.full) return 0;
    // Drohungen des Gegners: zwei = verloren, eine = einziger sinnvoller Zug.
    let forced = -1;
    for (const col of order) {
      if (!pos.canPlay(col) || !pos.wins(col, opp)) continue;
      if (forced >= 0) return -(WIN - ply - 1);
      forced = col;
    }
    if (depth === 0) return pos.evaluate(who);

    const key = pos.key();
    const hit = this.table.get(key);
    const alphaOrig = alpha;
    let first = forced;
    if (hit) {
      if (hit.depth >= depth) {
        const v = fromTt(hit.value, ply);
        if (hit.bound === 0) return v;
        if (hit.bound === 1 && v > alpha) alpha = v;
        else if (hit.bound === 2 && v < beta) beta = v;
        if (alpha >= beta) return v;
      }
      if (first < 0) first = hit.move;
    }

    let best = -Infinity;
    let bestMove = -1;
    const tryMove = (col: number): boolean => {
      pos.play(col, who);
      const v = pos.full ? 0 : -this.negamax(depth - 1, -beta, -alpha, opp, ply + 1);
      pos.undo(col);
      if (v > best) {
        best = v;
        bestMove = col;
      }
      if (v > alpha) alpha = v;
      return alpha >= beta;
    };
    if (forced >= 0) tryMove(forced);
    else {
      let cut = first >= 0 && pos.canPlay(first) && tryMove(first);
      // Züge, die dem Gegner das Feld darüber zum Sieg freigeben, zuletzt.
      const later: number[] = [];
      for (const col of order) {
        if (cut) break;
        if (col === first || !pos.canPlay(col)) continue;
        if (pos.givesAway(col, who)) later.push(col);
        else cut = tryMove(col);
      }
      for (const col of later) if (cut || (cut = tryMove(col))) break;
    }
    this.table.set(key, { depth, value: toTt(best, ply), bound: best <= alphaOrig ? 2 : best >= beta ? 1 : 0, move: bestMove });
    return best;
  }
}

export interface SearchResult {
  /** Alle gleich guten Spalten (aufsteigend). */
  best: number[];
  score: number;
  nodes: number;
}

/**
 * Obergrenze für Suchknoten je Zug (≈ 60–100 ms auf dem Server). Gezählt statt gemessen, damit der
 * Computer bei gleichem Seed immer gleich spielt – unabhängig davon, wie schnell der Rechner ist.
 */
export const NODE_BUDGET = 40_000;

/**
 * Sucht die besten Spalten für Platz `seat`: iterative Vertiefung bis `depth`. Die nächste Tiefe
 * wird nur begonnen, wenn sie (geschätzt aus dem Wachstum der letzten Iteration) ins Knotenbudget passt.
 */
export function searchBest(grid: Grid, d: Dims, seat: SeatIndex, depth: number, budget = NODE_BUDGET): SearchResult & { depth: number } {
  const pos = new Position(geometry(d), grid);
  const who = seat === 0 ? 1 : 2;
  const playable = pos.g.order.filter((c) => pos.canPlay(c));
  if (playable.length === 0) return { best: [], score: 0, nodes: 0, depth: 0 };
  const wins = playable.filter((c) => pos.wins(c, who));
  if (wins.length > 0) return { best: wins.sort((a, b) => a - b), score: WIN - 1, nodes: 0, depth: 1 };

  const search = new Search(pos);
  const root = (k: number): { best: number[]; score: number } => {
    let bestScore = -Infinity;
    let best: number[] = [];
    for (const col of playable) {
      pos.play(col, who);
      // Fenster knapp unter dem bisher besten Wert: gleich gute Züge werden exakt erkannt,
      // schlechtere früh abgeschnitten.
      const alpha = bestScore === -Infinity ? -Infinity : -(bestScore - 1);
      const v = pos.full || k <= 1 ? (pos.full ? 0 : -pos.evaluate(3 - who)) : -search.negamax(k - 1, -Infinity, alpha, 3 - who, 2);
      pos.undo(col);
      if (v > bestScore) {
        bestScore = v;
        best = [col];
      } else if (v === bestScore) best.push(col);
    }
    return { best, score: bestScore };
  };

  let result = root(1);
  let reached = 1;
  let prev = 0;
  let last = 0;
  for (let k = 2; k <= depth; k++) {
    // Entschieden (erzwungener Sieg oder Niederlage gefunden) → tiefer rechnen ändert nichts.
    if (Math.abs(result.score) > WIN / 2) break;
    const growth = prev > 0 ? Math.max(2, last / prev) : 4;
    if (k > 2 && search.nodes + last * growth > budget) break;
    const before = search.nodes;
    result = root(k);
    reached = k;
    prev = last;
    last = search.nodes - before;
  }
  return { best: result.best.sort((a, b) => a - b), score: result.score, nodes: search.nodes, depth: reached };
}

/** Spalten, mit denen `seat` sofort gewinnt. */
export function winningColumns(grid: Grid, d: Dims, seat: SeatIndex): number[] {
  const pos = new Position(geometry(d), grid);
  const who = seat === 0 ? 1 : 2;
  return legalColumns(grid, d).filter((c) => pos.wins(c, who));
}

/** Zug des Computers (Spalte). Wirft, wenn keine Spalte mehr frei ist. */
export function chooseBotMove(grid: Grid, d: Dims, seat: SeatIndex, difficulty: Difficulty, rng: Rng): number {
  const legal = legalColumns(grid, d);
  if (legal.length === 0) throw new Error("Vier gewinnt: kein gültiger Zug mehr");
  if (difficulty === "leicht") {
    const win = winningColumns(grid, d, seat);
    if (win.length > 0) return rng.pick(win);
    const block = winningColumns(grid, d, seat === 0 ? 1 : 0);
    if (block.length > 0) return rng.pick(block);
    return rng.pick(legal);
  }
  const { best } = searchBest(grid, d, seat, SEARCH_DEPTH[difficulty]);
  return rng.pick(best.length > 0 ? best : legal);
}
