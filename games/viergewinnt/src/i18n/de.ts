// Alle Texte des Spiels Vier gewinnt (TV- und Controller-View gemeinsam).
import type { Difficulty } from "../shared.js";

export const de = {
  botName: "Computer",
  difficulty: {
    leicht: "Leicht",
    mittel: "Mittel",
    schwer: "Schwer",
  } satisfies Record<Difficulty, string>,
  botLevel: (level: string) => `Stärke: ${level}`,
  /** Spaltennummer wie auf dem Brett (1-basiert). */
  column: (col: number) => `${col + 1}`,

  tv: {
    round: (n: number) => `Partie ${n}`,
    bestOf: (n: number) => (n === 1 ? "Eine Partie" : `Best of ${n}`),
    draws: (n: number) => (n === 1 ? "1 Unentschieden" : `${n} Unentschieden`),
    wins: (n: number) => (n === 1 ? "Sieg" : "Siege"),
    yourTurn: "am Zug",
    turnOf: (name: string) => `${name} ist am Zug`,
    starts: (name: string) => `${name} beginnt`,
    botThinking: "Der Computer überlegt …",
    timeout: (name: string, col: string) => `Zeit abgelaufen – Zufallsstein für ${name} in Spalte ${col}`,
    roundWinner: (name: string) => `${name} gewinnt die Partie!`,
    roundDraw: "Brett voll – unentschieden!",
    winner: (name: string) => `${name} gewinnt!`,
    winnerMatch: (name: string, a: number, b: number) => `${name} gewinnt ${a} : ${b}!`,
    winnerForfeit: (name: string) => `${name} gewinnt kampflos`,
    draw: "Unentschieden!",
    nextRound: "Gleich geht’s weiter …",
    paused: "Spiel pausiert",
    boardLabel: (cols: number, rows: number) => `Spielbrett ${cols} × ${rows}`,
    seconds: (n: number) => `${n} s`,
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    you: "Du",
    round: (n: number, bestOf: number) => (bestOf === 1 ? `Partie ${n}` : `Partie ${n} · Best of ${bestOf}`),
    yourTurn: "Du bist dran – wähle eine Spalte!",
    aimed: (col: string) => `Spalte ${col} gewählt`,
    drop: "Einwerfen",
    dropCol: (col: string) => `Einwerfen in Spalte ${col}`,
    opponentTurn: (name: string) => `${name} ist am Zug …`,
    botThinking: "Der Computer überlegt …",
    waitingFor: (names: string) => `Pause – wartet auf ${names} …`,
    timeout: "Zeit abgelaufen – dein Stein fiel zufällig.",
    rejected: "Dieser Zug geht gerade nicht.",
    columnLabel: (col: string, free: number) => (free === 0 ? `Spalte ${col}: voll` : `Spalte ${col}: noch ${free} frei`),
    roundWin: "Partie gewonnen!",
    roundLose: "Partie verloren",
    roundDraw: "Unentschieden – Brett voll",
    win: "Gewonnen!",
    winForfeit: "Gewonnen – dein Gegner ist gegangen",
    lose: "Verloren",
    draw: "Unentschieden",
    nextSoon: "Gleich geht’s weiter …",
    secondsLeft: (n: number) => `noch ${n} s`,
  },
} as const;

/** Anzeigename eines Platzes. */
export const seatName = (seat: { kind: "human"; name: string } | { kind: "bot" }): string =>
  seat.kind === "bot" ? de.botName : seat.name;
