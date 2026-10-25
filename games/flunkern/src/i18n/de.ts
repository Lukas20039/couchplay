// Alle Texte von „Flunkern“ (TV- und Controller-View gemeinsam).
import type { CategoryId } from "../constants.js";
import type { FlAwardKind } from "../shared.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  kurioses: "Kurioses Wissen",
  tiere: "Tiere & Natur",
  woerter: "Wörter & Namen",
  geschichte: "Geschichte & Erfindungen",
  welt: "Länder & Gesetze",
  essen: "Essen & Trinken",
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
/** Ganze Zahl mit Tausenderpunkt (Punktestände). */
const int = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** „Anna“, „Anna & Ben“, „Anna, Ben & Cleo“. */
export const joinNames = (names: readonly string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;

export const AWARDS: Record<FlAwardKind, { icon: string; title: string; detail: (n: number) => string }> = {
  baron: { icon: "🤥", title: "Größter Lügenbaron", detail: (n) => `${n}× hereingelegt` },
  finder: { icon: "🔍", title: "Wahrheitsfinder", detail: (n) => `${n}× die Wahrheit gefunden` },
  gullible: { icon: "🐟", title: "Leichtgläubigste Seele", detail: (n) => `${n}× reingefallen` },
};

export const t = {
  title: "Flunkern",
  round: (i: number, n: number) => `Runde ${i + 1} von ${n}`,
  points: (n: number) => `${int(n)} ${plural(n, "Punkt", "Punkte")}`,
  plus: (n: number) => `+${int(n)}`,
  rank: (n: number) => `${n}.`,
  left: "weg",
  double: "Letzte Runde – doppelte Punkte!",

  tv: {
    introLead: (n: number) => `${n} kuriose Fragen – wer lügt am besten?`,
    introRules: [
      "Denk dir am Handy eine glaubwürdige falsche Antwort aus.",
      "Dann tippen alle auf die Antwort, die sie für wahr halten.",
      "Wahrheit gefunden: +500. Jeder, der auf deine Lüge reinfällt: +250.",
    ],
    startsIn: "Gleich geht’s los",
    writeHint: "Denkt euch eine glaubwürdige Lüge aus!",
    written: (n: number, of: number) => `${n} von ${of} haben gelogen`,
    chooseHint: "Welche Antwort ist die Wahrheit?",
    chosen: (n: number, of: number) => `${n} von ${of} haben gewählt`,
    secondsLeft: (n: number) => `Noch ${n} Sekunden`,
    stepOf: (i: number, n: number) => `${i + 1} / ${n}`,
    fooledLabel: "Reingefallen:",
    lied: "GELOGEN!",
    true: "WAHR!",
    liedBy: (names: string) => `Gelogen von ${names}!`,
    autoLie: "(automatisch zugeteilt)",
    houseLie: "Hauslüge 🏠",
    houseNoPoints: "Bringt niemandem Punkte",
    drumroll: "Und die Wahrheit ist …",
    finders: "Richtig:",
    nobodyFound: "Niemand hat die Wahrheit gefunden!",
    factLabel: "Wirklich wahr:",
    standings: "Zwischenstand",
    standingsAfter: (i: number, n: number) => `nach Runde ${i + 1} von ${n}`,
    nextDouble: "Gleich: letzte Runde – doppelte Punkte!",
    final: "Die besten Flunkerer",
    finalProgress: "Gleich geht’s zum Ergebnis",
    fooledShort: (n: number) => `🤥 ${n}`,
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    intro: "Gleich geht’s los – denk dir gleich eine glaubwürdige Lüge aus!",
    writeLabel: "Deine Lüge",
    placeholder: "Erfinde eine Antwort …",
    counter: (n: number, max: number) => `${n}/${max}`,
    submit: "Abschicken",
    rejected: "Zu nah an der Wahrheit – denk dir was anderes aus!",
    yourLie: "Deine Lüge",
    yourLieLabel: "Deine Lüge:",
    waiting: "Warte auf die anderen …",
    chooseLead: "Was ist die Wahrheit?",
    ownLie: "Deine Lüge",
    ownLieAuto: "Deine Lüge (zugeteilt)",
    chosen: "Gewählt – warte auf die anderen …",
    noChoice: "Zu spät – du hast nichts gewählt.",
    watchTv: "Schau auf den Fernseher! 📺",
    foundTruth: "Wahrheit gefunden!",
    fooledByPlayers: (names: string) => `Reingefallen auf ${names}!`,
    fooledByHouse: "Reingefallen auf eine Hauslüge 🏠",
    noChoiceResult: "Nichts gewählt",
    truthWas: "Die Wahrheit:",
    yourChoice: "Deine Wahl:",
    fooledYou: (names: string) => `Auf deine Lüge reingefallen: ${names}`,
    nobodyFooled: "Auf deine Lüge ist niemand reingefallen.",
    standings: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    finalTitle: "Fertig!",
    finalStats: (fooled: number, truths: number) =>
      `${fooled}× hereingelegt · ${truths}× ${plural(truths, "Wahrheit", "Wahrheiten")} gefunden`,
    answerLabel: (text: string) => `Antwort: ${text}`,
  },
} as const;
