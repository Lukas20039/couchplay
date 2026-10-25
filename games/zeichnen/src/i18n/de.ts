// Alle Texte von „Zeichnen & Raten“ (TV- und Controller-View gemeinsam).
import type { CategoryId } from "../constants.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  tiere: "Tiere",
  essen: "Essen & Trinken",
  haushalt: "Haushalt & Gegenstände",
  berufe: "Berufe",
  sport: "Sport & Freizeit",
  orte: "Orte & Gebäude",
  natur: "Natur & Wetter",
  fantasie: "Märchen & Fantasie",
};

/** Namen der Stiftfarben (Index wie PALETTE) – für Screenreader/aria-label. */
export const COLOR_NAMES = ["Schwarz", "Rot", "Orange", "Gelb", "Grün", "Blau", "Lila", "Braun", "Weiß"];
export const SIZE_NAMES = ["Dünn", "Mittel", "Dick"];

export const t = {
  title: "Zeichnen & Raten",
  round: (i: number, n: number) => `Runde ${i + 1} von ${n}`,
  points: (n: number) => `${n} Punkte`,
  gain: (n: number) => `+${n}`,

  tv: {
    introLead: "Reihum zeichnet eine Person – alle anderen raten.",
    introRules: [
      "Wer dran ist, wählt am Handy einen von drei Begriffen und zeichnet ihn dort.",
      "Die Zeichnung erscheint live hier am Fernseher. Tippt eure Tipps ins Handy!",
      "Je schneller ihr ratet, desto mehr Punkte. Wer zeichnet, bekommt 50 Punkte für jeden Treffer.",
    ],
    startsIn: "Gleich geht’s los",
    choosing: (name: string) => `${name} wählt einen Begriff …`,
    drawing: (name: string) => `${name} zeichnet`,
    hasIt: (name: string) => `${name} hat’s! ✅`,
    wordWas: "Gesucht war:",
    allGuessed: "Alle haben es erraten!",
    nobody: "Niemand hat es erraten.",
    some: (n: number) => (n === 1 ? "1 Person hat es erraten" : `${n} Personen haben es erraten`),
    drawerLeft: (name: string) => `${name} hat das Spiel verlassen.`,
    standings: "Zwischenstand",
    final: "Die besten Künstler",
    letters: (n: number) => (n === 1 ? "1 Buchstabe" : `${n} Buchstaben`),
    drawingLabel: "Zeichnung",
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    intro: "Gleich geht’s los! Wenn du dran bist, zeichnest du hier am Handy.",
    chooseLead: "Du bist dran! Was willst du zeichnen?",
    chooseWait: (name: string) => `${name} wählt einen Begriff …`,
    drawWord: "Zeichne:",
    guessedOf: (n: number, of: number) => `${n} von ${of} haben’s`,
    timeUp: "Zeit ist um!",
    full: "Das Blatt ist voll – mach etwas rückgängig.",
    eraser: "Radierer",
    undo: "Rückgängig",
    undoShort: "Zurück",
    clear: "Alles löschen",
    clearShort: "Löschen",
    colorLabel: (name: string) => `Farbe ${name}`,
    sizeLabel: (name: string) => `Stift ${name}`,
    guessLead: (name: string) => `Was zeichnet ${name}?`,
    guessPlaceholder: "Dein Tipp …",
    guessButton: "Raten",
    guessLabel: "Dein Tipp",
    close: "Knapp daneben!",
    yourGuesses: "Deine Tipps",
    wait: "Kurz warten …",
    correct: "Richtig!",
    correctSub: "Schau zu, wie die anderen raten.",
    wordWas: "Gesucht war:",
    youHadIt: "Du hattest es!",
    youMissed: "Diesmal nicht erraten.",
    drawerGot: (n: number) => (n === 1 ? "1 Person hat es erraten" : `${n} Personen haben es erraten`),
    drawerNone: "Niemand hat es erraten.",
    standings: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    finalTitle: "Fertig!",
  },
} as const;
