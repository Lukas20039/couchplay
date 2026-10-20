// Alle Texte des Spiels TicTacToe (TV- und Controller-View gemeinsam).
import type { Difficulty } from "../shared.js";

export const de = {
  botName: "Computer",
  difficulty: {
    leicht: "Leicht",
    mittel: "Mittel",
    unbesiegbar: "Unbesiegbar",
  } satisfies Record<Difficulty, string>,
  botLevel: (level: string) => `Stärke: ${level}`,

  tv: {
    round: (n: number) => `Partie ${n}`,
    draws: (n: number) => (n === 1 ? "1 Unentschieden" : `${n} Unentschieden`),
    wins: (n: number) => (n === 1 ? "Sieg" : "Siege"),
    yourTurn: "am Zug",
    turnOf: (name: string) => `${name} ist am Zug`,
    botThinking: "Der Computer überlegt …",
    waitingFor: (names: string) => `Pause – wartet auf ${names} …`,
    winner: (name: string) => `${name} gewinnt!`,
    winnerForfeit: (name: string) => `${name} gewinnt kampflos`,
    draw: "Unentschieden!",
    starts: (name: string) => `${name} beginnt`,
    offline: "getrennt",
    boardLabel: "Spielfeld",
  },

  controller: {
    youPlay: "Du spielst",
    you: "Du",
    draws: "Remis",
    yourTurn: "Du bist dran!",
    opponentTurn: (name: string) => `${name} ist am Zug …`,
    botThinking: "Der Computer überlegt …",
    waitingFor: (names: string) => `Pause – wartet auf ${names} …`,
    win: "Gewonnen!",
    winForfeit: "Gewonnen – dein Gegner ist gegangen",
    lose: "Verloren",
    draw: "Unentschieden",
    nextSoon: "Gleich geht’s weiter …",
    loading: "Spiel wird vorbereitet …",
    cellLabel: (n: number, content: string) => `Feld ${n}: ${content}`,
    cellEmpty: "frei",
    lastMove: "letzter Zug des Gegners",
    rejected: "Dieser Zug geht gerade nicht.",
  },
} as const;

/** Anzeigename eines Platzes am Brett. */
export const seatName = (seat: { kind: "human"; name: string } | { kind: "bot" }): string =>
  seat.kind === "bot" ? de.botName : seat.name;
