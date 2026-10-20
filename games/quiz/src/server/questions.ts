// Fragenauswahl für eine Runde: gemischt per ctx.rng, keine Wiederholung, Kategorien
// reihum (damit nicht fünf Sportfragen am Stück kommen), Antworten gemischt.
import type { Rng } from "@couchplay/game-sdk";
import type { Question } from "../data/index.js";
import type { CategoryId } from "../shared.js";

export interface RoundQuestion {
  id: string;
  category: CategoryId;
  text: string;
  /** Antworten in Anzeige-Reihenfolge. */
  answers: string[];
  correctIndex: number;
}

/**
 * Zieht `count` Fragen aus den gewählten Kategorien.
 * `avoidIds` (z. B. Fragen der Vorrunde) werden nur verwendet, wenn sonst zu wenige übrig sind.
 */
export function drawQuestions(
  pool: Readonly<Record<CategoryId, readonly Question[]>>,
  categories: readonly CategoryId[],
  count: number,
  rng: Rng,
  avoidIds: ReadonlySet<string> = new Set(),
): RoundQuestion[] {
  // Je Kategorie: frische Fragen zuerst (gemischt), bereits gespielte dahinter (gemischt).
  const queues = rng.shuffle([...new Set(categories)]).map((cat) => {
    const all = pool[cat] ?? [];
    const fresh = rng.shuffle(all.filter((q) => !avoidIds.has(q.id)));
    const seen = rng.shuffle(all.filter((q) => avoidIds.has(q.id)));
    return { fresh, seen };
  });

  const picked: Question[] = [];
  // Erst reihum aus frischen Fragen, dann – falls nötig – aus bereits gespielten.
  for (const key of ["fresh", "seen"] as const) {
    let progress = true;
    while (picked.length < count && progress) {
      progress = false;
      for (const queue of queues) {
        if (picked.length >= count) break;
        const q = queue[key].shift();
        if (q) {
          picked.push(q);
          progress = true;
        }
      }
    }
  }

  return picked.map((q) => {
    // answers[0] ist im Katalog die richtige Antwort.
    const order = rng.shuffle([0, 1, 2, 3]);
    return {
      id: q.id,
      category: q.category,
      text: q.text,
      answers: order.map((i) => q.answers[i] as string),
      correctIndex: order.indexOf(0),
    };
  });
}
