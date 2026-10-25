// Reine Rundenlogik von „Flunkern“ (ohne ctx): Lügen prüfen, auffüllen, mischen, werten, Auflösung planen.
import type { Rng } from "@couchplay/game-sdk";
import type { PlayerId } from "@couchplay/protocol";
import { MIN_CHOICES, POINTS } from "./constants.js";
import type { Bluff } from "./data/index.js";
import { normalizeAnswer } from "./normalize.js";
import type { FlAward, FlRevealStep } from "./shared.js";

/** Eine Antwort, die zur Wahl steht. */
export interface Answer {
  text: string;
  key: string;
  kind: "truth" | "player" | "house";
  /** Autoren einer Spielerlüge (mehrere bei gleicher Lüge); sonst leer. */
  authors: PlayerId[];
  /** Spielerlüge wurde automatisch aus den Hauslügen zugeteilt. */
  auto: boolean;
}

/** Abgeschickte Spielerlüge während des Schreibens. */
export interface Lie {
  text: string;
  key: string;
  authors: PlayerId[];
  auto: boolean;
}

/** Normalisierte Schreibweisen der Wahrheit (Antwort + Alternativen). */
export const truthKeys = (q: Bluff): Set<string> => new Set([q.answer, ...q.alternatives].map(normalizeAnswer));

export type LieCheck = { kind: "truth" } | { kind: "merged"; lie: Lie } | { kind: "new"; lie: Lie };

/**
 * Prüft eine (bereinigte) Lüge: zu nah an der Wahrheit → abgelehnt; gleich einer vorhandenen Spielerlüge →
 * zusammengelegt (Autor ergänzt); sonst neu. Ändert `lies` direkt.
 */
export function addLie(q: Bluff, lies: Lie[], author: PlayerId, text: string): LieCheck {
  const key = normalizeAnswer(text);
  if (truthKeys(q).has(key)) return { kind: "truth" };
  const same = lies.find((l) => l.key === key);
  if (same) {
    if (!same.authors.includes(author)) same.authors.push(author);
    return { kind: "merged", lie: same };
  }
  const lie: Lie = { text, key, authors: [author], auto: false };
  lies.push(lie);
  return { kind: "new", lie };
}

/**
 * Antworten für die Wahl: Wahrheit + Spielerlügen; wer nichts abgeschickt hat (`autoFor`), bekommt eine Hauslüge
 * zugeteilt; danach wird mit Hauslügen auf mindestens MIN_CHOICES aufgefüllt. Hauslügen kollidieren nie
 * (normalisiert) mit Wahrheit oder Spielerlügen. Ergebnis gemischt.
 */
export function buildOptions(q: Bluff, lies: readonly Lie[], autoFor: readonly PlayerId[], rng: Rng): Answer[] {
  const used = new Set([...truthKeys(q), ...lies.map((l) => l.key)]);
  const pool: { text: string; key: string }[] = [];
  for (const text of rng.shuffle(q.lies)) {
    const key = normalizeAnswer(text);
    if (used.has(key)) continue;
    used.add(key);
    pool.push({ text, key });
  }
  const answers: Answer[] = [
    { text: q.answer, key: normalizeAnswer(q.answer), kind: "truth", authors: [], auto: false },
    ...lies.map((l) => ({ text: l.text, key: l.key, kind: "player" as const, authors: [...l.authors], auto: l.auto })),
  ];
  for (const id of autoFor) {
    const h = pool.shift();
    if (!h) break;
    answers.push({ ...h, kind: "player", authors: [id], auto: true });
  }
  while (answers.length < MIN_CHOICES && pool.length > 0) {
    answers.push({ ...pool.shift()!, kind: "house", authors: [], auto: false });
  }
  return rng.shuffle(answers);
}

export interface RoundScore {
  /** Punkte je Spieler (nur Spieler mit > 0 Punkten). */
  points: Map<PlayerId, number>;
  /** Auflösungsschritte: gewählte Lügen (wenigste Reingefallene zuerst), zuletzt die Wahrheit. */
  steps: FlRevealStep[];
  /** Je Autor: so viele sind auf ihn reingefallen. */
  fooled: Map<PlayerId, number>;
  /** Wer die Wahrheit gefunden hat. */
  finders: PlayerId[];
  /** Je Spieler: Index der Antwort, auf die er reingefallen ist. */
  fellFor: Map<PlayerId, number>;
}

/**
 * Wertung: Wahrheit gefunden +500; je Mitspieler, der auf die eigene Lüge reinfällt, +250 (jeder Autor einer
 * geteilten Lüge bekommt die vollen Punkte). Auf Hauslügen reinfallen bringt nichts. `double` verdoppelt alles.
 * `choices`: Spieler → Index (nur gültige Wahlen, also nie die eigene Lüge), in Startreihenfolge.
 */
export function scoreRound(options: readonly Answer[], choices: ReadonlyMap<PlayerId, number>, double: boolean, fact: string | null): RoundScore {
  const factor = double ? 2 : 1;
  const points = new Map<PlayerId, number>();
  const fooled = new Map<PlayerId, number>();
  const fellFor = new Map<PlayerId, number>();
  const add = (id: PlayerId, n: number): void => {
    points.set(id, (points.get(id) ?? 0) + n);
  };
  const choosers = options.map(() => [] as PlayerId[]);
  for (const [id, index] of choices) choosers[index]?.push(id);

  const truthIndex = options.findIndex((o) => o.kind === "truth");
  const finders = choosers[truthIndex] ?? [];
  for (const id of finders) add(id, POINTS.truth * factor);

  const lieSteps: FlRevealStep[] = [];
  options.forEach((o, i) => {
    const who = choosers[i]!;
    if (o.kind === "truth" || who.length === 0) return;
    for (const id of who) fellFor.set(id, i);
    const each = o.kind === "player" ? who.length * POINTS.fooled * factor : 0;
    for (const a of o.authors) {
      add(a, each);
      fooled.set(a, (fooled.get(a) ?? 0) + who.length);
    }
    lieSteps.push({ kind: "lie", option: i, text: o.text, fooled: [...who], authors: [...o.authors], auto: o.auto, points: each });
  });
  // Spannungsbogen: erst die Lügen mit wenigen Reingefallenen, die erfolgreichste zuletzt (stabil nach Index).
  lieSteps.sort((a, b) => (a.kind === "lie" && b.kind === "lie" ? a.fooled.length - b.fooled.length : 0) || a.option - b.option);
  const truth = options[truthIndex]!;
  const steps: FlRevealStep[] = [
    ...lieSteps,
    { kind: "truth", option: truthIndex, text: truth.text, finders: [...finders], points: POINTS.truth * factor, fact },
  ];
  for (const [id, n] of [...points]) if (n === 0) points.delete(id);
  return { points, steps, fooled, finders: [...finders], fellFor };
}

/** Auszeichnungen fürs Finale: nur mit mindestens 1, Gleichstand → mehrere Gewinner. */
export function computeAwards(stats: readonly { id: PlayerId; fooled: number; truths: number; gullible: number }[]): FlAward[] {
  const award = (kind: FlAward["kind"], value: (s: (typeof stats)[number]) => number): FlAward | null => {
    const best = Math.max(0, ...stats.map(value));
    if (best <= 0) return null;
    return { kind, playerIds: stats.filter((s) => value(s) === best).map((s) => s.id), count: best };
  };
  return [award("baron", (s) => s.fooled), award("finder", (s) => s.truths), award("gullible", (s) => s.gullible)].filter(
    (a): a is FlAward => a !== null,
  );
}
