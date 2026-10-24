// Alle Texte von „Wie gut kennst du mich?“ (TV- und Controller-View gemeinsam).
import type { CategoryId } from "../constants.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  alltag: "Alltag",
  essen: "Essen & Trinken",
  freizeit: "Freizeit & Hobbys",
  reisen: "Reisen",
  persoenlichkeit: "Persönlichkeit",
  waswaerewenn: "Was wäre wenn …",
  erinnerungen: "Kindheit & Erinnerungen",
  entweder: "Entweder – oder",
};

/** Antwortbuchstaben (Farbe + Buchstabe, damit es auch ohne Farben eindeutig ist). */
export const LETTERS = ["A", "B", "C", "D"];

export const t = {
  title: "Wie gut kennst du mich?",
  round: (i: number, n: number) => `Frage ${i + 1} von ${n}`,
  points: (n: number) => `${n} Punkte`,

  tv: {
    introLead: "Reihum ist eine Person dran.",
    introRules: [
      "Die Person beantwortet am Handy ehrlich eine Frage über sich.",
      "Alle anderen raten gleichzeitig, was sie gewählt hat.",
      "Richtig geraten: 100 Punkte. Die Person bekommt 50 Punkte für jeden, der sie richtig einschätzt.",
    ],
    startsIn: "Gleich geht’s los",
    turnOf: (name: string) => `${name} ist dran`,
    waitingHot: (name: string) => `${name} antwortet …`,
    hotDone: (name: string) => `${name} hat geantwortet`,
    guessed: (n: number, of: number) => `${n} von ${of} haben getippt`,
    answerOf: (name: string) => `${name} hat gewählt:`,
    noAnswer: (name: string) => `${name} hat nicht geantwortet – diesmal keine Punkte.`,
    nobody: "Niemand hat richtig geraten!",
    everyone: "Alle haben richtig geraten!",
    some: (n: number) => (n === 1 ? "1 Person hat richtig geraten" : `${n} Personen haben richtig geraten`),
    standings: "Zwischenstand",
    final: "Wer kennt wen am besten?",
    gain: (n: number) => `+${n}`,
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    introHot: "Gleich geht’s los – wenn du dran bist, beantwortest du Fragen über dich.",
    youAreUp: "Du bist dran! Antworte ehrlich:",
    guessFor: (name: string) => `Was hat ${name} gewählt?`,
    locked: "Antwort gesperrt",
    lockedHot: "Gespeichert – jetzt raten die anderen.",
    lockedGuess: "Warte auf die Auflösung am Fernseher.",
    right: "Richtig geraten!",
    wrong: "Leider daneben",
    noGuess: "Kein Tipp abgegeben",
    hotRight: (n: number) => (n === 1 ? "1 Person kennt dich gut!" : `${n} Personen kennen dich gut!`),
    hotNobody: "Niemand hat dich durchschaut.",
    hotNoAnswer: "Du hast nicht geantwortet.",
    theAnswer: (name: string) => `${name}: `,
    yourAnswer: "Deine Antwort: ",
    standings: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    finalTitle: "Fertig!",
    matches: (n: number) => (n === 1 ? "1 Treffer" : `${n} Treffer`),
    answerLabel: (letter: string, text: string) => `Antwort ${letter}: ${text}`,
  },
} as const;
