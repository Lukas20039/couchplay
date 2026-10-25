// Alle Texte von „Schätzen!“ (TV- und Controller-View gemeinsam).
import type { CategoryId } from "../constants.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  geografie: "Geografie",
  geschichte: "Geschichte (Jahreszahlen)",
  natur: "Tiere & Natur",
  mensch: "Mensch & Körper",
  technik: "Technik & Erfindungen",
  sport: "Sport & Rekorde",
  weltall: "Weltall",
  alltag: "Alltag & Kurioses",
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
/** Ganze Zahl mit Tausenderpunkt (Punktestände). */
const int = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const t = {
  title: "Schätzen!",
  round: (i: number, n: number) => `Frage ${i + 1} von ${n}`,
  points: (n: number) => `${int(n)} ${plural(n, "Punkt", "Punkte")}`,
  plus: (n: number) => `+${n}`,
  rank: (n: number) => `${n}.`,
  left: "weg",
  /** Hinweis neben der Eingabe, wenn eine Jahreszahl gefragt ist. */
  yearHint: "Jahreszahl",
  countHint: "Anzahl",
  /** Zahlwörter für Achsen und Abstände. */
  numbers: { trillion: "Bio.", billion: "Mrd.", million: "Mio.", year: "Jahr", years: "Jahre" },

  tv: {
    introLead: (n: number) => `${n} Schätzfragen – wer liegt am nächsten dran?`,
    introRules: [
      "Alle tippen gleichzeitig am Handy eine Zahl ein und drücken „Fertig“.",
      "Am nächsten dran: 100 Punkte, dann 70, 50, 30 – jeder weitere Tipp 10.",
      "Volltreffer (höchstens 2 % daneben, Jahreszahl exakt): +50 Bonus!",
    ],
    introRulesSolo: [
      "Tippe am Handy eine Zahl ein und drück „Fertig“.",
      "Je genauer, desto mehr Punkte: bis 2 % daneben 150, bis 10 % 100, bis 25 % 60, bis 50 % 30.",
      "Bei Jahreszahlen: exakt 150, bis 2 Jahre 100, bis 10 Jahre 60, bis 25 Jahre 30.",
    ],
    startsIn: "Gleich geht’s los",
    unitLabel: (unit: string) => `Antwort in ${unit}`,
    answered: (n: number, of: number) => `${n} von ${of} fertig`,
    secondsLeft: (n: number) => `Noch ${n} Sekunden`,
    drumroll: "Und die Lösung ist …",
    solution: "Lösung",
    nearest: (names: string[]) => (names.length === 1 ? `Am nächsten dran: ${names[0]}!` : `Am nächsten dran: ${names.join(" & ")}!`),
    soloResult: (points: number) => (points > 0 ? `Gut geschätzt: +${points} Punkte` : "Diesmal leider zu weit weg"),
    nobodyGuessed: "Niemand hat getippt.",
    noGuess: "kein Tipp",
    bullseye: "Volltreffer!",
    off: (d: string) => `± ${d}`,
    outsideLeft: "noch weiter links",
    outsideRight: "noch weiter rechts",
    logScale: "logarithmische Skala",
    factLabel: "Gewusst?",
    standings: "Zwischenstand",
    standingsAfter: (i: number, n: number) => `nach Frage ${i + 1} von ${n}`,
    final: "Die besten Schätzer",
    finalSolo: "Deine Schätzrunde",
    bullseyes: (n: number) => `${n} ${plural(n, "Volltreffer", "Volltreffer")}`,
    finalProgress: "Gleich geht’s zum Ergebnis",
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    intro: "Gleich geht’s los – tippe deine Schätzung über das Ziffernfeld ein.",
    placeholder: "?",
    done: "Fertig",
    delete: "Löschen",
    comma: "Komma",
    yourGuess: "Dein Tipp",
    locked: "Warte auf die anderen …",
    lockedSolo: "Gleich kommt die Auflösung …",
    watchTv: "Schau auf den Fernseher!",
    noGuess: "Kein Tipp abgegeben",
    solution: "Lösung",
    distance: "Abstand",
    bullseye: "Volltreffer!",
    nearest: "Am nächsten dran!",
    place: (n: number) => `Platz ${n} bei dieser Frage`,
    soloGood: "Gut geschätzt!",
    soloBad: "Zu weit weg",
    standings: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    finalTitle: "Fertig!",
    bullseyes: (n: number) => `${n} ${plural(n, "Volltreffer", "Volltreffer")}`,
  },
} as const;
