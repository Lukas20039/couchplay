// Alle UI-Texte von „Alles oder nichts“ (TV- und Controller-View). Keine Texte direkt in Komponenten.
import type { CategoryId } from "../constants.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  rechtschreibung: "Rechtschreibung",
  woerter: "Wörter & Bedeutungen",
  geografie: "Geografie",
  geschichte: "Geschichte",
  natur: "Natur & Wissenschaft",
  kultur: "Kunst, Musik & Film",
  sport: "Sport & Spiel",
  alltag: "Alltag, Essen & Technik",
};

/** Namen der Antwortformen (Screenreader / aria-label). */
export const SHAPE_LABELS = ["Rotes Dreieck", "Blaue Raute", "Gelber Kreis", "Grünes Quadrat"] as const;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
const fmt = (n: number): string => n.toLocaleString("de-DE");
/** Punkte mit Vorzeichen: +2, −1 (echtes Minuszeichen), 0. */
const signed = (n: number): string => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : "0");

/** Punktestand ohne Plus: 3 Punkte, −1 Punkt. */
const pointsLong = (n: number): string => `${signed(n).replace(/^\+/, "")} ${Math.abs(n) === 1 ? "Punkt" : "Punkte"}`;

export const t = {
  title: "Alles oder nichts",
  waiting: "Gleich geht’s los …",
  points: (n: number) => `${signed(n).replace(/^\+/, "")} Pkt.`,
  pointsLong,
  signed,
  number: fmt,

  // Intro
  introQuestions: (n: number) => plural(n, "knifflige Frage", "knifflige Fragen"),
  introCategories: (n: number) => `aus ${plural(n, "Kategorie", "Kategorien")}`,
  introRules: [
    "Tippe auf eine Antwort – oder enthalte dich.",
    "Runde für Runde fliegt eine falsche Antwort raus.",
    "Steig rechtzeitig aus und sichere +1 oder +2 – oder halte durch bis +3.",
    "Fliegt deine Antwort raus, verlierst du 1, 2 oder 3 Punkte.",
  ],
  introStartsIn: "Erste Frage in",

  // Kopf / Einsätze
  progress: (i: number, total: number) => `Frage ${i + 1} von ${total}`,
  stakeLabel: (stage: number) => `Runde ${stage}`,
  stakeValue: (stage: number) => `±${stage}`,
  secondsLeft: (s: number) => `${s} Sekunden übrig`,

  // Tippen
  answeredCount: (n: number, of: number) => `${n} von ${of} haben gewählt`,

  // Elimination
  spinTitle: (stage: number) => `Elimination ${stage} von 3`,
  spinHint: "Welche falsche Antwort fliegt raus?",
  struckTag: (stage: number) => `raus in Runde ${stage}`,
  hit: "Raus!",
  decideTitle: (stage: number) => `Aussteigen mit +${stage} oder weiter?`,
  decideHint: (stage: number) => `Weiter heißt: +${stage + 1} – oder −${stage + 1}, wenn die eigene Antwort rausfliegt.`,
  decidedCount: (n: number, of: number) => `${n} von ${of} haben entschieden`,
  nobodyLeft: "Niemand mehr im Rennen.",

  // Status-Tags am TV
  tagIn: "drin",
  tagAbstain: "enthalten",
  tagCashed: (pts: number) => `${signed(pts)} gesichert`,
  tagOut: (pts: number) => `${signed(pts)} raus`,
  tagWon: (pts: number) => `${signed(pts)} Volltreffer`,
  tagDecided: "entschieden",

  // Auflösung
  correctAnswer: "Richtige Antwort",
  revealSolo: (name: string) => `Nur ${name} hat durchgehalten: +1 Bonus!`,
  revealNobody: "Diesmal hat niemand bis zum Schluss durchgehalten.",
  revealAllAbstained: "Alle haben sich enthalten.",

  // Zwischenstand / Finale
  standingsTitle: "Zwischenstand",
  standingsAfter: (i: number, total: number) => `nach Frage ${i + 1} von ${total}`,
  finalTitle: "Siegerehrung",
  finalProgress: "Gleich kommt das Ergebnis",
  finalSubtitle: (total: number) => `nach ${plural(total, "Frage", "Fragen")}`,
  rank: (r: number) => `${r}.`,
  left: "hat verlassen",
  jackpots: (n: number) => (n === 1 ? "1 Volltreffer" : `${n} Volltreffer`),

  // Controller
  ctrlQuestion: (i: number, total: number) => `Frage ${i + 1}/${total}`,
  ctrlChoose: "Wähle deine Antwort",
  ctrlAbstain: "Enthalten",
  ctrlAbstainHint: "0 Punkte, kein Risiko",
  ctrlLocked: "Antwort gesperrt",
  ctrlLockedHint: "Gleich fliegt die erste falsche Antwort raus.",
  ctrlAbstained: "Du enthältst dich",
  ctrlAbstainedHint: "Schau zu, wie die anderen zittern.",
  ctrlTimeUp: "Zeit abgelaufen",
  ctrlYourPick: "Dein Tipp",
  ctrlStage: (stage: number) => `Elimination ${stage}/3`,
  ctrlSpinIn: "Daumen drücken …",
  ctrlSpinInHint: "Am Fernseher fliegt gleich eine falsche Antwort raus.",
  ctrlStillIn: "Deine Antwort ist noch drin!",
  ctrlCash: "Aussteigen",
  ctrlCashValue: (pts: number) => `${signed(pts)} sichern`,
  ctrlStay: "Weiter",
  ctrlStayValue: (stage: number) => `${signed(stage + 1)} oder ${signed(-(stage + 1))}`,
  ctrlDecideDefault: "Ohne Entscheidung steigst du automatisch aus.",
  ctrlCashedNow: (pts: number) => `Du steigst aus: ${signed(pts)}`,
  ctrlStayNow: "Du zockst weiter!",
  ctrlWaitOthers: "Warte auf die anderen …",
  ctrlCashed: (pts: number) => `${signed(pts)} gesichert`,
  ctrlCashedHint: "Du bist ausgestiegen – schau, ob es sich gelohnt hat.",
  ctrlOut: "Raus!",
  ctrlOutHint: (pts: number) => `Deine Antwort ist geflogen: ${signed(pts)}`,
  ctrlWatching: "Du schaust zu",
  ctrlWon: "Volltreffer!",
  ctrlBonus: "+1 Bonus: Nur du hast durchgehalten!",
  ctrlNoAnswer: "Enthalten",
  ctrlRightWas: "Richtig war",
  ctrlPlace: (rank: number, of: number) => `Platz ${rank} von ${of}`,
  ctrlOf: (of: number) => `von ${plural(of, "Spieler", "Spielern")}`,
  ctrlScore: (n: number) => `Gesamt: ${pointsLong(n)}`,
  ctrlStandings: "Zwischenstand",
  ctrlLookTv: "Schau auf den Fernseher.",
  ctrlFinal: "Spiel vorbei",
  ctrlWinner: "Du hast gewonnen!",
  ctrlRankUp: (n: number) => `${n} ${n === 1 ? "Platz" : "Plätze"} nach oben`,
  ctrlRankDown: (n: number) => `${n} ${n === 1 ? "Platz" : "Plätze"} nach unten`,
  ctrlIntro: "Mach dich bereit!",
  ctrlIntroHint: "Die Frage steht am Fernseher, die Antworten erscheinen hier.",
};

/** Fehlercodes des Servers zu einer Eingabe (error.message wird nie angezeigt). */
export function errorText(code: string): string {
  switch (code) {
    case "INVALID_INPUT":
      return "Diese Eingabe konnte nicht gesendet werden.";
    case "INVALID_PHASE":
      return "Gerade geht das nicht.";
    case "NOT_ALLOWED":
      return "Du spielst in dieser Runde nicht mit.";
    case "RATE_LIMITED":
      return "Langsamer – bitte kurz warten.";
    default:
      return "Etwas ist schiefgelaufen.";
  }
}
