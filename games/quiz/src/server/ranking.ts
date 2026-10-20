// Ranglisten-Berechnung mit sauberem Gleichstand ("1224"-Wertung: gleiche Punkte = gleicher Rang).

export interface Scored {
  id: string;
  score: number;
  /** Startreihenfolge – nur Sortier-Tiebreak für die Anzeige, nicht für den Rang. */
  order: number;
}

/** Sortiert absteigend nach Punkten (Gleichstand: Startreihenfolge) und vergibt Ränge. */
export function rankScores<T extends Scored>(items: readonly T[]): Array<T & { rank: number }> {
  const sorted = [...items].sort((a, b) => b.score - a.score || a.order - b.order);
  let rank = 0;
  return sorted.map((item, i) => {
    if (i === 0 || item.score !== sorted[i - 1]!.score) rank = i + 1;
    return { ...item, rank };
  });
}
