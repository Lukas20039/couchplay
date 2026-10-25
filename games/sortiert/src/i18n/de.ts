// Alle Texte von „Sortiert!“ (TV- und Controller-View gemeinsam).
import type { CategoryId } from "../constants.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  zeit: "Zeitstrahl (Jahre)",
  geld: "Preise & Kosten",
  verkauf: "Meistverkauft",
  groesse: "Größe & Gewicht",
  mengen: "Mengen & Zahlen",
  tempo: "Tempo & Dauer",
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
/** Ganze Zahl mit Tausenderpunkt (Punktestände). */
const int = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const names = (list: string[]): string => (list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} & ${list.at(-1)}`);

export const t = {
  title: "Sortiert!",
  round: (i: number, n: number) => `Runde ${i + 1} von ${n}`,
  points: (n: number) => `${int(n)} ${plural(n, "Punkt", "Punkte")}`,
  plus: (n: number) => `+${int(n)}`,
  rank: (n: number) => `${n}.`,
  left: "weg",
  /** Richtungshinweis: „oben = am ältesten“. */
  topIs: (label: string) => `oben = ${label}`,
  bottomIs: (label: string) => `unten = ${label}`,
  perfect: "Perfekt!",
  /** Symbole je Platz-Bewertung. */
  marks: { exact: "✅", near: "≈", miss: "❌", none: "–" },
  markLabels: { exact: "richtig", near: "eins daneben", miss: "falsch", none: "leer" },

  tv: {
    introLead: (rounds: number, cards: number) => `${rounds} Runden – je ${cards} Karten in die richtige Reihenfolge!`,
    introRules: [
      "Tippt die Karten am Handy der Reihe nach an: die erste kommt auf Platz 1, die nächste auf Platz 2 …",
      "Jede Karte am richtigen Platz: 100 Punkte. Eine Position daneben: 50.",
      "Alles richtig: Perfekt! +200 Bonus.",
    ],
    startsIn: "Gleich geht’s los",
    done: (n: number, of: number) => `${n} von ${of} fertig`,
    secondsLeft: (n: number) => `Noch ${n} Sekunden`,
    solution: "Die richtige Reihenfolge",
    yourOrders: "Eure Reihenfolgen",
    pending: "?",
    noOrder: "nichts sortiert",
    perfectBy: (list: string[]) => `${names(list)}`,
    bestRound: (list: string[], points: number) => `Beste Runde: ${names(list)} (+${int(points)})`,
    nobody: "Diesmal hat niemand sortiert.",
    standings: "Zwischenstand",
    standingsAfter: (i: number, n: number) => `nach Runde ${i + 1} von ${n}`,
    final: "Die besten Sortierer",
    finalSolo: "Deine Sortier-Runde",
    perfects: (n: number) => `${n}× perfekt`,
    finalProgress: "Gleich geht’s zum Ergebnis",
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    intro: "Gleich geht’s los – tippe die Karten der Reihe nach an, oben beginnt Platz 1.",
    tapHint: "Tippe die Karten der Reihe nach an",
    removeHint: "Antippen nimmt eine Karte wieder heraus",
    slotEmpty: "frei",
    reset: "Zurücksetzen",
    done: "Fertig",
    place: (n: number) => `Platz ${n}`,
    submitted: "Abgegeben!",
    waiting: "Warte auf die anderen …",
    waitingSolo: "Gleich kommt die Auflösung …",
    watchTv: "Schau auf den Fernseher!",
    yourOrder: "Deine Reihenfolge",
    correct: (label: string) => `richtig: ${label}`,
    nothing: "Nichts sortiert",
    partial: "Zeit um – dein Zwischenstand wurde gewertet",
    roundPoints: (n: number) => `+${int(n)}`,
    rank: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    finalTitle: "Fertig!",
    perfects: (n: number) => `${n}× perfekt sortiert`,
  },
} as const;
