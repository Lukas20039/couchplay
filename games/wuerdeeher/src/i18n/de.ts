// Alle Texte von „Wer würde eher …?“ (TV- und Controller-View gemeinsam).
import type { CategoryId } from "../constants.js";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  alltag: "Alltag",
  abenteuer: "Abenteuer & Mut",
  peinlich: "Peinlich, aber harmlos",
  zukunft: "Zukunft & Was-wäre-wenn",
  essen: "Essen & Genuss",
  chaos: "Chaos & Schusseligkeit",
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
/** „Anna“, „Anna & Ben“, „Anna, Ben & Cleo“ */
const names = (list: readonly string[]): string =>
  list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;

export const t = {
  title: "Wer würde eher …?",
  lead: "Wer würde eher …",
  round: (i: number, n: number) => `Runde ${i + 1} von ${n}`,
  points: (n: number) => `${n} ${plural(n, "Punkt", "Punkte")}`,
  plus: (n: number) => `+${n}`,
  rank: (n: number) => `${n}.`,
  votes: (n: number) => `${n} ${plural(n, "Stimme", "Stimmen")}`,
  left: "weg",
  /** Krönung: „Anna würde eher eine Nacht im Baumarkt verbringen!“ */
  crowned: (who: readonly string[], statement: string) =>
    `${names(who)} ${who.length === 1 ? "würde" : "würden"} eher ${statement}!`,

  tv: {
    introLead: (n: number) => `${n} Runden – wer schätzt die Gruppe am besten ein?`,
    introRules: [
      "Pro Runde eine Aussage. Tippe am Handy auf die Person, die das am ehesten tun würde – gern auch auf dich selbst.",
      "Deine Stimme ging an die Person mit den meisten Stimmen? Dann liegst du mit der Mehrheit: 100 Punkte!",
      "Gewählt werden bringt keine Punkte – nur Ruhm oder Schande.",
    ],
    anonymousNote: "Anonym: Es zählt nur die Anzahl der Stimmen.",
    startsIn: "Gleich geht’s los",
    voted: (n: number, of: number) => `${n} von ${of} haben abgestimmt`,
    secondsLeft: (n: number) => `Noch ${n} Sekunden`,
    nobodyVoted: "Niemand hat abgestimmt.",
    majorityCount: (n: number, of: number) =>
      n === 0
        ? "Niemand lag mit der Mehrheit."
        : n === of
          ? `Alle lagen mit der Mehrheit – je +100`
          : `${n} von ${of} ${plural(n, "lag", "lagen")} mit der Mehrheit – ${plural(n, "+100", "je +100")}`,
    standings: "Zwischenstand",
    standingsAfter: (i: number, n: number) => `nach Runde ${i + 1} von ${n}`,
    final: "Die besten Menschenkenner",
    titles: "Eure Titel",
    noTitle: "– blieb diesmal unverdächtig",
    titleText: (statement: string) => `würde eher ${statement}`,
    titleClaim: (statement: string) => `– würde eher ${statement}`,
    titleVotes: (n: number) => `(${n} ${plural(n, "Stimme", "Stimmen")})`,
    finalProgress: "Gleich geht’s zum Ergebnis",
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    intro: "Gleich geht’s los – tippe bei jeder Aussage auf die Person, die das am ehesten tun würde.",
    me: "Ich",
    yourVote: "Deine Stimme:",
    locked: "Warte auf die anderen …",
    watchTv: "Schau auf den Fernseher!",
    nobody: "Niemand hat abgestimmt.",
    withMajority: "Mit der Mehrheit!",
    against: "Knapp daneben!",
    noVote: "Du hast nicht abgestimmt.",
    youGot: (n: number) => (n === 0 ? "Für dich hat niemand gestimmt." : `Für dich: ${n} ${plural(n, "Stimme", "Stimmen")}`),
    youWon: "Das bist du! 👑",
    standings: (rank: number, n: number) => `Platz ${rank} von ${n}`,
    finalTitle: "Fertig!",
    yourTitle: "Dein Titel:",
    voteFor: (name: string) => `Stimme für ${name}`,
  },
} as const;
