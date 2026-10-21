// Hilfen für Tests außerhalb des Pakets (E2E): alle Wörter eines Rasters mit Pfad.
// Nicht in Apps importieren – zieht die komplette Wortliste nach.
import { germanDictionary } from "./server/dictionary.js";
import { solve } from "./server/grid.js";

/** Wörter (≥ minLen) im Raster, kürzeste zuerst, jeweils mit einem gültigen Pfad. */
export function wordsInGrid(letters: readonly string[], size: number, minLen = 3): Array<{ word: string; path: number[] }> {
  return [...solve(letters, size, germanDictionary(), minLen).words]
    .map(([word, path]) => ({ word, path }))
    .sort((a, b) => a.word.length - b.word.length || (a.word < b.word ? -1 : 1));
}
