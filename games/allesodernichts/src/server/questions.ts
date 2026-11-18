// Fragenauswahl: Kategorien reihum (damit nicht fünf Geografiefragen am Stück kommen), Antworten
// gemischt, keine Wiederholung innerhalb einer Partie. Gezogen wird erst, wenn die Frage dran ist –
// so kann die Auswahl berücksichtigen, was die Handys der Mitspieler schon gesehen haben.
import type { Rng } from "@couchplay/game-sdk";
import type { CategoryId } from "../constants.js";
import type { Question } from "../data/index.js";

export interface RoundQuestion {
  id: string;
  category: CategoryId;
  text: string;
  /** Antworten in Anzeige-Reihenfolge. */
  answers: string[];
  correctIndex: number;
}

/** Bewertung einer Frage: je höher, desto weniger gern (z. B. Anzahl Mitspieler, die sie kennen). */
export type Penalty = (id: string) => number;

export interface QuestionDeck {
  /** So viele Fragen gibt es in den gewählten Kategorien insgesamt. */
  readonly size: number;
  /** Nächste Frage (nächste Kategorie reihum, darin die mit der kleinsten Strafe), null = leer. */
  next(penalty?: Penalty): RoundQuestion | null;
}

export function createDeck(
  pool: Readonly<Record<CategoryId, readonly Question[]>>,
  categories: readonly CategoryId[],
  rng: Rng,
): QuestionDeck {
  const queues = rng.shuffle([...new Set(categories)]).map((cat) => rng.shuffle([...(pool[cat] ?? [])]));
  const size = queues.reduce((n, q) => n + q.length, 0);
  let turn = 0;
  return {
    size,
    next(penalty = () => 0) {
      for (let tries = 0; tries < queues.length; tries++) {
        const queue = queues[turn % queues.length]!;
        turn++;
        if (queue.length === 0) continue;
        // Kleinste Strafe gewinnt; bei Gleichstand die zuerst gemischte (= zufällig).
        let best = 0;
        let bestScore = penalty(queue[0]!.id);
        for (let i = 1; i < queue.length && bestScore > 0; i++) {
          const s = penalty(queue[i]!.id);
          if (s < bestScore) {
            best = i;
            bestScore = s;
          }
        }
        const [q] = queue.splice(best, 1);
        return toRoundQuestion(q!, rng);
      }
      return null;
    },
  };
}

function toRoundQuestion(q: Question, rng: Rng): RoundQuestion {
  // answers[0] ist im Katalog die richtige Antwort.
  const order = rng.shuffle([0, 1, 2, 3]);
  return {
    id: q.id,
    category: q.category,
    text: q.text,
    answers: order.map((i) => q.answers[i] as string),
    correctIndex: order.indexOf(0),
  };
}
