// Alle Texte von „Stadt, Land, Fluss“ (TV- und Controller-View gemeinsam).
import type { CategoryId, CheckMode, SetId } from "../constants.js";
import type { SlAwardKind, SlCategory, SlStatus } from "../shared.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  stadt: "Stadt",
  land: "Land",
  fluss: "Fluss",
  name: "Name",
  beruf: "Beruf",
  tier: "Tier",
  gericht: "Gericht",
  obstgemuese: "Obst oder Gemüse",
  getraenk: "Getränk",
  suesses: "Süßigkeit oder Dessert",
  gewuerz: "Gewürz oder Kraut",
  kuechengeraet: "Küchengerät",
  pizzabelag: "Pizzabelag",
  fruehstueck: "Etwas zum Frühstück",
  imbiss: "Am Imbiss bestellt",
  film: "Film",
  serie: "Serie",
  musik: "Band oder Musiker:in",
  promi: "Promi",
  figur: "Comic- oder Trickfigur",
  spiel: "Video- oder Brettspiel",
  marke: "Marke",
  song: "Songtitel",
  buch: "Buch",
  ausrede: "Ausrede fürs Zuspätkommen",
  hosentasche: "Etwas, das man nicht in die Hosentasche steckt",
  haustiername: "Name für ein Haustier",
  superkraft: "Nutzlose Superkraft",
  urlaub: "Etwas, das nicht in den Koffer gehört",
  geschenk: "Schlechtes Geschenk",
  kuehlschrank: "Hat im Kühlschrank nichts verloren",
  aufstehen: "Grund, nicht aufzustehen",
  bandname: "Name für eine Band",
  nachbar: "Was der Nachbar nachts macht",
};

export const SET_LABELS: Record<SetId, string> = {
  klassisch: "Klassisch",
  essen: "Essen & Trinken",
  popkultur: "Popkultur",
  quatsch: "Quatsch",
  gemischt: "Bunt gemischt",
  eigene: "Eigene Kategorien",
};

/** Anzeigename einer Runden-Kategorie: eigener Name bzw. Text der eingebauten Kategorie. */
export const categoryLabel = (c: SlCategory): string => (c.custom === null ? CATEGORY_LABELS[c.id] : c.custom);

/** Vorbelegung des Editors für eigene Kategorien (ohne gespeicherte Liste am Host-Handy). */
export const CUSTOM_DEFAULTS: readonly string[] = ["Stadt", "Land", "Fluss", "Name", "Beruf", "Tier"];

/** Kurzer Grund, warum eine Antwort nicht zählt (null = zählt). */
export const STATUS_LABELS: Record<SlStatus, string | null> = {
  ok: null,
  empty: "leer",
  short: "zu kurz",
  letter: "falscher Buchstabe",
  rejected: "gestrichen",
  unlisted: "nicht im Lexikon",
};

/** Zusatzzeile der Intro-Regeln zur Lexikon-Prüfung (null = keine). */
const LEXICON_RULE: Record<CheckMode, string | null> = {
  streng: "Das Lexikon prüft mit: Unbekanntes ist erst mal gestrichen – mit Mehrheit 👍 rettet ihr es.",
  hinweis: "Das Lexikon markiert unbekannte Antworten – ob sie zählen, entscheidet ihr.",
  aus: null,
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
/** Ganze Zahl mit Tausenderpunkt (Punktestände). */
const int = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** „Anna“, „Anna & Ben“, „Anna, Ben & Cleo“. */
export const joinNames = (names: readonly string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;

export const AWARDS: Record<SlAwardKind, { icon: string; title: string; detail: (n: number) => string }> = {
  solo: { icon: "🦄", title: "Einzelkämpfer", detail: (n) => `${n}× als Einzige:r eine Antwort` },
  stopper: { icon: "✋", title: "Schnellster Stift", detail: (n) => `${n}× „Stopp!“ gerufen` },
  judge: { icon: "👎", title: "Strengste Jury", detail: (n) => `${n}× Daumen runter` },
};

export const t = {
  title: "Stadt, Land, Fluss",
  round: (i: number, n: number) => `Runde ${i + 1} von ${n}`,
  points: (n: number) => `${int(n)} ${plural(n, "Punkt", "Punkte")}`,
  plus: (n: number) => `+${int(n)}`,
  rank: (n: number) => `${n}.`,
  left: "weg",
  letter: "Buchstabe",
  stop: "STOPP!",

  tv: {
    introLead: (rounds: number, set: string) => `${rounds} Runden · ${set}`,
    introRules: (categories: number, seconds: number, check: CheckMode) =>
      [
        `Ein Buchstabe, ${categories} Kategorien, ${seconds} Sekunden – tippt eure Antworten am Handy.`,
        "Wer alles ausgefüllt hat, ruft „Stopp!“ – dann bleiben allen nur noch 5 Sekunden.",
        "Einzigartig: 10 Punkte · doppelt: 5 · als Einzige:r in der Kategorie: 20.",
        "Danach prüft ihr gemeinsam: Daumen runter für Antworten, die nicht zählen sollen.",
        LEXICON_RULE[check],
      ].filter((r): r is string => r !== null),
    introCustom: "Eure Kategorien – in jeder Runde:",
    startsIn: "Gleich geht’s los",
    setupTitle: "Eigene Kategorien",
    setupBy: (host: string | null) => (host ? `${host} legt die Kategorien fest …` : "Die Kategorien werden am Host-Handy festgelegt …"),
    setupEmpty: "Noch keine Kategorien …",
    setupHint: (min: number) => `Mindestens ${min} Kategorien – sonst wird klassisch gespielt.`,
    letterLead: "Der Buchstabe ist …",
    secondsLeft: (n: number) => `Noch ${n} Sekunden`,
    filled: (n: number, of: number) => `${n}/${of}`,
    filledLabel: (name: string, n: number, of: number) => `${name}: ${n} von ${of} Feldern`,
    allDone: (n: number, of: number) => `${n} von ${of} sind fertig`,
    stopBy: (name: string) => `${name} ruft Stopp!`,
    timeUp: "Stifte weg!",
    timeUpStop: (name: string) => `${name} war am schnellsten`,
    reviewOf: (i: number, n: number) => `Kategorie ${i + 1} / ${n}`,
    reviewHint: "Am Handy: 👎 für Antworten, die nicht zählen sollen",
    reviewHintRescue: "Am Handy: 👎 streicht · 👍 rettet, was das Lexikon nicht kennt",
    reviewEmpty: "Niemand hat hier eine gültige Antwort.",
    votes: (n: number, needed: number) => `👎 ${n}/${needed}`,
    rescueVotes: (n: number, needed: number) => `👍 ${n}/${needed}`,
    lexiconKnown: "✓ im Lexikon",
    lexiconUnknown: "nicht im Lexikon",
    rescuedTag: "👍 gerettet",
    sharedTag: "doppelt",
    soloTag: "Einzige:r!",
    readyLabel: (n: number, of: number) => `${n} von ${of} sagen „Passt“`,
    standings: "Zwischenstand",
    standingsAfter: (i: number, n: number, letter: string) => `nach Runde ${i + 1} von ${n} · Buchstabe ${letter}`,
    final: "Die Wortprofis",
    finalLetters: (letters: string) => `Gespielt: ${letters}`,
    finalProgress: "Gleich geht’s zum Ergebnis",
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    setupTitle: "Eure Kategorien",
    setupLead: (min: number, max: number) => `${min} bis ${max} Kategorien – der Fernseher zeigt mit.`,
    setupPlaceholder: (i: number) => `Kategorie ${i + 1}`,
    setupRemove: (name: string) => `„${name}“ entfernen`,
    setupAdd: "+ Kategorie",
    setupDuplicate: "doppelt",
    setupSuggest: "Vorschläge – antippen zum Hinzufügen",
    setupGo: "Los geht’s!",
    setupMin: (min: number) => `Mindestens ${min} Kategorien`,
    setupSent: "Gleich geht’s los …",
    setupWait: (host: string | null) => (host ? `${host} legt die Kategorien fest …` : "Die Kategorien werden gerade festgelegt …"),
    intro: "Gleich geht’s los – Finger warm machen!",
    letterWait: "Schau auf den Fernseher – gleich kommt der Buchstabe!",
    placeholder: (letter: string) => `${letter} …`,
    counter: (n: number, max: number) => `${n}/${max}`,
    stop: "Stopp!",
    stopHint: "Erst alle Felder ausfüllen",
    stopBy: (name: string) => `${name} ruft Stopp!`,
    stopMine: "Du hast Stopp gerufen!",
    stopLeft: (n: number) => `Noch ${n} s`,
    timeUp: "Stifte weg!",
    timeUpLead: "Gleich wird geprüft …",
    wrongLetter: (letter: string) => `beginnt nicht mit ${letter}`,
    reviewLead: "👎 für Antworten, die nicht zählen",
    reviewLeadRescue: "👎 streicht · 👍 rettet Unbekanntes",
    mine: "du",
    voteLabel: (text: string) => `Daumen runter für „${text}“`,
    rescueLabel: (text: string) => `Daumen hoch: „${text}“ zählt doch`,
    lexiconKnown: "✓ Lexikon",
    lexiconUnknown: "nicht im Lexikon",
    rescued: "gerettet",
    noAnswer: "—",
    ready: "Passt – weiter",
    readyDone: "Warte auf die anderen …",
    standings: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    roundPoints: (n: number) => `Diese Runde: +${int(n)}`,
    finalTitle: "Fertig!",
    finalStats: (valid: number, solos: number) =>
      `${valid} gültige ${plural(valid, "Antwort", "Antworten")} · ${solos}× als Einzige:r`,
  },
} as const;
