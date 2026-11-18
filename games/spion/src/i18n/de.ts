// Alle Texte von „Wer ist der Spion?“ (TV- und Controller-View gemeinsam).
import type { CategoryId, SpMode } from "../constants.js";
import type { SpAwardKind, SpReason } from "../shared.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  orte: "Orte",
  berufe: "Berufe",
  tiere: "Tiere",
  essen: "Essen & Trinken",
  gegenstaende: "Gegenstände",
  sport: "Sport & Hobbys",
  figuren: "Filme & Figuren",
  feste: "Feste & Anlässe",
};

export const MODE_LABELS: Record<SpMode, string> = {
  klassisch: "Klassisch",
  undercover: "Undercover",
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
/** Ganze Zahl mit Tausenderpunkt (Punktestände). */
const int = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
/** „Anna“, „Anna & Ben“, „Anna, Ben & Cleo“. */
export const joinNames = (names: readonly string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;

export const AWARDS: Record<SpAwardKind, { icon: string; title: string; detail: (n: number) => string }> = {
  detective: { icon: "🔎", title: "Spürnase", detail: (n) => `${n}× den Spion verdächtigt` },
  masterspy: { icon: "🕶️", title: "Meisterspion", detail: (n) => `${n}× als Spion gewonnen` },
};

/** Ausgang einer Runde (TV-Schlagzeile). */
export const REASONS: Record<SpReason, string> = {
  caught: "Spion enttarnt – die Agenten gewinnen!",
  guessed: "Enttarnt – aber das Wort erraten! Der Spion gewinnt.",
  wrong: "Falscher Verdacht – der Spion gewinnt!",
  tie: "Keine Einigung – der Spion entkommt!",
  none: "Niemand hat abgestimmt – der Spion entkommt!",
  left: "Der Spion hat sich abgesetzt – Runde ohne Wertung.",
};

export const t = {
  title: "Wer ist der Spion?",
  round: (i: number, n: number) => `Runde ${i + 1} von ${n}`,
  points: (n: number) => `${int(n)} ${plural(n, "Punkt", "Punkte")}`,
  plus: (n: number) => `+${int(n)}`,
  rank: (n: number) => `${n}.`,
  left: "weg",
  passed: "—",
  topSecret: "STRENG GEHEIM",
  clueRound: (i: number, n: number) => `Hinweisrunde ${i + 1} von ${n}`,
  votes: (n: number) => `${n} ${plural(n, "Stimme", "Stimmen")}`,

  tv: {
    introLead: (n: number) => `${n} ${plural(n, "Runde", "Runden")} – einer von euch ist ein Spion.`,
    introRules: {
      klassisch: [
        "Alle sehen am Handy geheim dasselbe Wort – nur der Spion kennt bloß die Kategorie.",
        "Reihum gibt jeder EIN Hinweiswort. Nicht zu deutlich – sonst errät der Spion das Wort!",
        "Dann zeigen alle auf den Verdächtigen. Enttarnt? Dann darf der Spion noch das Wort raten.",
      ],
      undercover: [
        "Alle sehen am Handy geheim ein Wort – der Spion bekommt ein ähnliches und weiß es nicht.",
        "Reihum gibt jeder EIN Hinweiswort. Passt ein Hinweis nicht ganz? Verdächtig!",
        "Dann zeigen alle auf den Verdächtigen. Vielleicht bist du ja selbst der Spion …",
      ],
    } satisfies Record<SpMode, string[]>,
    startsIn: "Gleich geht’s los",
    modeChip: (m: SpMode) => `Modus: ${MODE_LABELS[m]}`,
    roleTitle: "Schaut heimlich auf euer Handy!",
    roleHint: "Haltet die Karte gedrückt – und lasst niemanden mitlesen.",
    roleReady: (n: number, of: number) => `${n} von ${of} haben ihre Rolle gesehen`,
    clueHint: "Ein Wort. Nicht zu deutlich, nicht zu vage.",
    onTurn: (name: string) => `${name} ist dran`,
    turnTag: "ist dran",
    secondsLeft: (n: number) => `Noch ${n} Sekunden`,
    voteTitle: "Wer ist der Spion?",
    voteHint: "Diskutiert – und tippt dann am Handy auf euren Verdacht.",
    runoffTitle: "Gleichstand – Stichwahl!",
    runoffHint: "Nur noch diese Verdächtigen stehen zur Wahl.",
    voted: (n: number, of: number) => `${n} von ${of} haben abgestimmt`,
    countTitle: "Die Stimmen …",
    accuses: (name: string) => `Die Gruppe beschuldigt ${name}!`,
    tie: "Gleichstand!",
    tieRunoff: "Gleichstand! Gleich folgt die Stichwahl …",
    tieAgain: "Wieder Gleichstand – niemand wird beschuldigt.",
    noVotes: "Niemand hat abgestimmt.",
    drumroll: "Ist es wirklich der Spion?",
    stampSpy: "SPION!",
    stampInnocent: "UNSCHULDIG",
    caught: (name: string) => `${name} ist der Spion!`,
    innocent: (name: string) => `${name} ist unschuldig …`,
    realSpy: (name: string) => `Der Spion war ${name}!`,
    guessTitle: (name: string) => `${name} ist enttarnt!`,
    guessHint: "Letzte Chance: Errät der Spion das geheime Wort?",
    wordLabel: "Das geheime Wort",
    spyWordLabel: "Wort des Spions",
    spyLabel: "Der Spion",
    guessedRight: (word: string) => `Getippt: „${word}“ – richtig!`,
    guessedWrong: (word: string) => `Getippt: „${word}“ – falsch!`,
    noGuess: "Der Spion hat nicht getippt.",
    correctVoters: "Richtig verdächtigt:",
    nextRound: "Gleich: nächste Runde",
    nextFinal: "Gleich: Endstand",
    final: "Endstand",
    winners: (names: string) => `Gewinner: ${names}`,
    finalProgress: "Gleich geht’s zum Ergebnis",
    agents: "Agenten",
    spy: "Spion",
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    intro: "Gleich bekommst du deine geheime Rolle. Halte dein Handy so, dass niemand mitlesen kann!",
    holdToReveal: "Halten oder antippen zum Anzeigen",
    hiddenCompact: "Geheime Rolle – halten oder antippen",
    youAreSpy: "Du bist der Spion!",
    spyHint: "Du kennst das Wort nicht. Hör gut zu und bluffe dich durch!",
    yourWord: "Dein geheimes Wort",
    category: (c: string) => `Kategorie: ${c}`,
    readyButton: "Verstanden",
    readyLocked: "Schau dir zuerst deine Rolle an",
    readyWait: "Warte auf die anderen …",
    yourTurn: "Du bist dran!",
    clueLabel: "Dein Hinweis (ein Wort)",
    placeholder: "Hinweiswort …",
    counter: (n: number, max: number) => `${n}/${max}`,
    oneWord: "Nur ein Wort – ohne Leerzeichen.",
    submit: "Abschicken",
    pass: "Auslassen",
    rejected: "Das verrät dein Wort zu direkt – denk dir einen anderen Hinweis aus!",
    othersTurn: (name: string) => `${name} ist dran`,
    turnsUntil: (n: number) => (n === 1 ? "Du bist als Nächstes dran" : `Du bist in ${n} Zügen dran`),
    noMoreTurns: "Du hast in dieser Runde keinen Zug mehr",
    myClues: "Deine Hinweise:",
    voteLead: "Wer ist der Spion?",
    runoffLead: "Stichwahl – wer ist der Spion?",
    inRunoff: "Du stehst selbst in der Stichwahl!",
    voteFor: (name: string) => `${name} verdächtigen`,
    yourVote: "Dein Verdacht:",
    locked: "Warte auf die anderen …",
    noVote: "Zu spät – du hast nicht abgestimmt.",
    watchTv: "Schau auf den Fernseher! 📺",
    guessLead: "Du bist enttarnt! Welches Wort ist es?",
    guessSent: "Getippt – schau auf den Fernseher!",
    guessWait: (name: string) => `${name} ist enttarnt und rät jetzt das Wort …`,
    wordWas: "Das Wort:",
    spyWordWas: "Wort des Spions:",
    spyWas: "Spion:",
    youWereSpy: "Du warst der Spion!",
    won: "Gewonnen!",
    lost: "Verloren!",
    voided: "Runde ohne Wertung",
    votedRight: "Richtig verdächtigt 🔎",
    standings: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    finalTitle: "Fertig!",
    finalStats: (votes: number, wins: number) =>
      `${votes}× richtig verdächtigt · ${wins}× als Spion gewonnen`,
    guessOption: (word: string) => `Tipp: ${word}`,
  },
} as const;
