// Alle UI-Texte von Wortgarten (TV- und Controller-View). Keine Texte direkt in Komponenten.
import type { FeedbackResult, Mode, Unlock } from "../shared.js";

const plural = (n: number, one: string, many: string): string => `${fmt(n)} ${n === 1 ? one : many}`;
const fmt = (n: number): string => n.toLocaleString("de-DE");
const factor = (m: number): string => `×${m.toLocaleString("de-DE", { maximumFractionDigits: 1 })}`;

export const MODE_LABELS: Record<Mode, string> = {
  klassisch: "Klassisch",
  blitz: "Blitz",
  langwort: "Langwort",
};

export const MODE_HINTS: Record<Mode, string> = {
  klassisch: "Wörter ab 3 Buchstaben.",
  blitz: "Halbe Zeit, dafür Combos bis ×3.",
  langwort: "Nur Wörter ab 5 Buchstaben – alle Punkte ×2.",
};

export const UNLOCK_LABELS: Record<Unlock, { icon: string; title: string; text: string }> = {
  tips: { icon: "💡", title: "Tipps", text: "Ein Tipp pro Runde: Anfang und Länge eines Worts." },
  grid5: { icon: "🟩", title: "5 × 5 Raster", text: "Mehr Buchstaben, mehr und längere Wörter." },
  gold: { icon: "✨", title: "Goldfelder", text: "Wörter über ein Goldfeld zählen doppelt." },
  blitz: { icon: "⚡", title: "Blitz-Modus", text: "Halbe Zeit, Combos bis ×3." },
  grid6: { icon: "🌳", title: "6 × 6 Raster", text: "Das große Beet für Wortprofis." },
  langwort: { icon: "📜", title: "Langwort-Modus", text: "Nur Wörter ab 5 Buchstaben, Punkte ×2." },
  tips2: { icon: "💡", title: "Zweiter Tipp", text: "Zwei Tipps pro Runde." },
};

export const t = {
  title: "Wortgarten",
  waiting: "Der Garten wird vorbereitet …",
  points: (n: number) => `${fmt(n)} Pkt.`,
  pointsLong: (n: number) => plural(n, "Punkt", "Punkte"),
  plusPoints: (n: number) => `+${fmt(n)}`,
  number: fmt,
  factor,
  rank: (r: number) => `${r}.`,
  left: "hat verlassen",
  secondsLeft: (s: number) => `${s} Sekunden übrig`,
  gridSize: (n: number) => `${n} × ${n}`,
  roundOf: (i: number, total: number) => `Runde ${i + 1} von ${total}`,
  words: (n: number) => plural(n, "Wort", "Wörter"),
  level: (n: number) => `Gartenstufe ${n}`,
  xpProgress: (xp: number, next: number) => `${fmt(xp)} / ${fmt(next)} Erfahrung`,
  xpMax: (xp: number) => `${fmt(xp)} Erfahrung · höchste Stufe`,
  /** Bewusst ohne Namen: Freischaltungen sieht man erst, wenn sie erreicht sind. */
  nextUnlock: (missing: number) => `🎁 Noch ${fmt(missing)} bis zur nächsten Überraschung`,

  // Intro
  introSub: "Findet Wörter im Buchstabenraster.",
  introRules: [
    "Wische auf dem Handy über benachbarte Buchstaben – waagrecht, senkrecht und schräg.",
    "Jedes Feld nur einmal pro Wort. Lange Wörter bringen viel mehr Punkte.",
    "Einzigartige Wörter, die sonst niemand findet, zählen doppelt.",
    "Schnell hintereinander gefundene Wörter starten eine Combo.",
  ],
  introSetup: (rounds: number, size: number, mode: string) => `${plural(rounds, "Runde", "Runden")} · ${size} × ${size} · ${mode}`,
  introLockedMode: (mode: string) => `${mode} ist noch nicht freigeschaltet – gespielt wird Klassisch.`,
  introLockedSize: (size: number) => `${size} × ${size} ist noch nicht freigeschaltet.`,
  introStartsIn: "Erste Runde in",
  unlocked: "Freigeschaltet",

  // Runde (TV)
  foundCount: (n: number) => plural(n, "Wort", "Wörter"),
  goldHint: "Goldfeld: Wort ×2",

  // Rundenende
  roundEndTitle: (i: number) => `Ernte nach Runde ${i + 1}`,
  possible: (n: number) => `Im Raster steckten ${plural(n, "Wort", "Wörter")}.`,
  uniqueLegend: "★ einzigartig ×2",
  sharedLegend: "geteilt",
  longest: "Längstes Wort",
  missed: "Hättet ihr auch finden können",
  noWords: "Diesmal keine Wörter",
  moreWords: (n: number) => `+${fmt(n)} weitere`,

  // Finale
  finalTitle: "Der Garten blüht",
  gardenGrew: "Euer Garten ist gewachsen!",
  newUnlocks: "Neu freigeschaltet",
  finalProgress: "Gleich kommt das Ergebnis",

  // Controller
  ctrlRound: (i: number, total: number) => `Runde ${i + 1}/${total}`,
  ctrlSwipe: "Wische über die Buchstaben – auch schräg",
  ctrlTapHint: "Oder tippe Buchstaben nacheinander an und tippe den letzten nochmal zum Abschicken.",
  ctrlTip: (n: number) => `💡 Tipp (${n})`,
  ctrlTipText: (prefix: string, rest: number) => `${prefix}${" _".repeat(rest)}`,
  ctrlTipLen: (n: number) => plural(n, "Buchstabe", "Buchstaben"),
  ctrlCombo: (m: string) => `Combo ${m}`,
  ctrlFoundNone: "Noch keine Wörter – los geht’s!",
  ctrlTimeUp: "Zeit abgelaufen",
  ctrlLookTv: "Schau auf den Fernseher.",
  ctrlRoundPoints: (n: number) => `+${fmt(n)} in dieser Runde`,
  ctrlUnique: (n: number) => `${plural(n, "einzigartiges Wort", "einzigartige Wörter")} ×2`,
  ctrlTotal: (n: number) => `Gesamt: ${fmt(n)} Punkte`,
  ctrlPlace: (rank: number, of: number) => `Platz ${rank} von ${of}`,
  ctrlFinal: "Spiel vorbei",
  ctrlWinner: "Du hast gewonnen!",
  ctrlXpGain: (n: number) => `+${fmt(n)} Erfahrung`,
  ctrlLongest: (w: string) => `Dein längstes Wort: ${w}`,
  ctrlIntro: "Mach dich bereit!",
  ctrlIntroHint: "Das Raster erscheint gleich hier und am Fernseher.",
} as const;

export const FEEDBACK: Record<FeedbackResult, string> = {
  ok: "",
  dup: "Schon gefunden",
  unknown: "Kein Wort im Wörterbuch",
  short: "Zu kurz",
  bad: "Ungültiger Pfad",
};

/** Fehlercodes des Servers zu einer Eingabe (error.message wird nie angezeigt). */
export function errorText(code: string): string {
  switch (code) {
    case "INVALID_INPUT":
      return "Das konnte nicht gesendet werden.";
    case "INVALID_PHASE":
      return "Gerade nicht möglich.";
    case "NOT_ALLOWED":
      return "Du spielst in dieser Runde nicht mit.";
    case "RATE_LIMITED":
      return "Langsamer – bitte kurz warten.";
    default:
      return "Etwas ist schiefgelaufen.";
  }
}
