// Alle UI-Texte des Quiz (TV- und Controller-View). Keine Texte direkt in Komponenten.
import type { CategoryId } from "../shared.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  geografie: "Geografie",
  geschichte: "Geschichte",
  wissenschaft: "Wissenschaft & Natur",
  sport: "Sport",
  kultur: "Kunst & Literatur",
  unterhaltung: "Film & Musik",
  essen: "Essen & Trinken",
  technik: "Technik",
};

/** Namen der Antwortformen (Screenreader / aria-label). */
export const SHAPE_LABELS = ["Rotes Dreieck", "Blaue Raute", "Gelber Kreis", "Grünes Quadrat"] as const;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const fmt = (n: number): string => n.toLocaleString("de-DE");

export const t = {
  title: "Allgemeinwissen-Quiz",
  waiting: "Gleich geht’s los …",
  points: (n: number) => `${fmt(n)} Pkt.`,
  pointsLong: (n: number) => `${fmt(n)} ${n === 1 ? "Punkt" : "Punkte"}`,
  plusPoints: (n: number) => `+${fmt(n)}`,
  number: fmt,

  // Intro
  introQuestions: (n: number) => plural(n, "Frage", "Fragen"),
  introCategories: (n: number) => `aus ${plural(n, "Kategorie", "Kategorien")}`,
  introHint: "Antwortet auf dem Handy – je schneller, desto mehr Punkte.",
  introStartsIn: "Erste Frage in",

  // Frage
  progress: (i: number, total: number) => `Frage ${i + 1} von ${total}`,
  progressShort: (i: number, total: number) => `${i + 1}/${total}`,
  answeredCount: (n: number, of: number) => `${n} von ${of} haben geantwortet`,
  secondsLeft: (s: number) => `${s} Sekunden übrig`,

  // Auflösung
  correctAnswer: "Richtige Antwort",
  votes: (n: number) => plural(n, "Stimme", "Stimmen"),
  noAnswer: "Keine Antwort",
  nobodyCorrect: "Diesmal lag niemand richtig.",
  allCorrect: "Alle lagen richtig!",

  // Zwischenstand / Finale
  standingsTitle: "Zwischenstand",
  standingsAfter: (i: number, total: number) => `nach Frage ${i + 1} von ${total}`,
  finalTitle: "Siegerehrung",
  finalSubtitle: (total: number) => `nach ${plural(total, "Frage", "Fragen")}`,
  rank: (r: number) => `${r}.`,
  left: "hat verlassen",
  offline: "getrennt",
  correctOf: (c: number, total: number) => `${c} von ${total} richtig`,

  // Controller
  ctrlQuestion: (i: number, total: number) => `Frage ${i + 1}/${total}`,
  ctrlChoose: "Wähle deine Antwort",
  ctrlLocked: "Antwort gesperrt",
  ctrlLockedHint: "Warte auf die Auflösung am Fernseher.",
  ctrlTimeUp: "Zeit abgelaufen",
  ctrlCorrect: "Richtig!",
  ctrlWrong: "Leider falsch",
  ctrlNone: "Keine Antwort",
  ctrlRightWas: "Richtig war",
  ctrlPlace: (rank: number, of: number) => `Platz ${rank} von ${of}`,
  ctrlOf: (of: number) => `von ${plural(of, "Spieler", "Spielern")}`,
  ctrlScore: (n: number) => `Gesamt: ${fmt(n)} Punkte`,
  ctrlStandings: "Zwischenstand",
  ctrlLookTv: "Schau auf den Fernseher.",
  ctrlFinal: "Spiel vorbei",
  ctrlWinner: "Du hast gewonnen!",
  ctrlRankUp: (n: number) => `${n} ${n === 1 ? "Platz" : "Plätze"} nach oben`,
  ctrlRankDown: (n: number) => `${n} ${n === 1 ? "Platz" : "Plätze"} nach unten`,
  ctrlIntro: "Mach dich bereit!",
  ctrlIntroHint: "Die Antworten erscheinen hier, die Frage auf dem Fernseher.",
} as const;

/** Fehlercodes des Servers zu einer Eingabe (error.message wird nie angezeigt). */
export function errorText(code: string): string {
  switch (code) {
    case "INVALID_INPUT":
      return "Diese Antwort konnte nicht gesendet werden.";
    case "INVALID_PHASE":
      return "Gerade kann nicht geantwortet werden.";
    case "NOT_ALLOWED":
      return "Du spielst in dieser Runde nicht mit.";
    case "RATE_LIMITED":
      return "Langsamer – bitte kurz warten.";
    default:
      return "Etwas ist schiefgelaufen.";
  }
}
