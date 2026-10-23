// Alle Texte des Spiels Schiffe versenken (TV- und Controller-View gemeinsam).
import type { Difficulty } from "../shared.js";

const COLS = "ABCDEFGHIJ";

export const de = {
  botName: "Computer",
  difficulty: {
    leicht: "Leicht",
    mittel: "Mittel",
    schwer: "Schwer",
  } satisfies Record<Difficulty, string>,
  /** Feldname wie auf dem Spielblock: Spalte A–J, Zeile 1–10. */
  coord: (cell: number) => `${COLS[cell % 10]}${Math.floor(cell / 10) + 1}`,
  cols: COLS.split(""),
  shipName: (len: number): string =>
    ({ 5: "Schlachtschiff", 4: "Kreuzer", 3: "Zerstörer", 2: "U-Boot" })[len] ?? `${len}er-Schiff`,
  /** Mit unbestimmtem Artikel im Akkusativ („versenkt einen Kreuzer“). */
  shipAcc: (len: number): string =>
    ({ 5: "ein Schlachtschiff", 4: "einen Kreuzer", 3: "einen Zerstörer", 2: "ein U-Boot" })[len] ?? `ein ${len}er-Schiff`,

  tv: {
    round: (n: number) => `Partie ${n}`,
    waters: (name: string) => `Gewässer von ${name}`,
    setupTitle: "Stellt eure Flotten auf!",
    setupHint: "Am Handy Schiffe antippen, verschieben und drehen – oder zufällig verteilen.",
    placing: "stellt auf …",
    ready: "bereit",
    turnOf: (name: string) => `${name} ist am Zug`,
    starts: (name: string) => `${name} beginnt`,
    botThinking: "Der Computer zielt …",
    miss: (name: string, coord: string) => `${name}: ${coord} – Wasser`,
    hit: (name: string, coord: string) => `${name}: ${coord} – Treffer!`,
    sunk: (name: string, shipAcc: string) => `${name} versenkt ${shipAcc}!`,
    winner: (name: string) => `${name} gewinnt!`,
    winnerForfeit: (name: string) => `${name} gewinnt kampflos`,
    paused: "Spiel pausiert",
    afloat: "Noch im Wasser",
    accuracy: (shots: number, hits: number) =>
      shots === 0 ? "noch kein Schuss" : `${shots} ${shots === 1 ? "Schuss" : "Schüsse"} · ${Math.round((hits / shots) * 100)} % Treffer`,
    wins: (n: number) => (n === 1 ? "1 Sieg" : `${n} Siege`),
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    setupTitle: "Stelle deine Flotte auf",
    setupHint: "Schiff antippen, dann ein Feld für den Bug.",
    setupNoTouch: "Schiffe dürfen sich nicht berühren, auch nicht über Eck.",
    pickFirst: "Tippe zuerst ein Schiff an.",
    blocked: "Dort passt das Schiff nicht hin.",
    rotate: "Drehen",
    shuffle: "Zufällig",
    ready: "Bereit!",
    change: "Ändern",
    waitOpponent: (name: string) => `Warte auf ${name} …`,
    opponentReady: (name: string) => `${name} ist schon bereit.`,
    selected: (ship: string) => `Ausgewählt: ${ship}`,
    yourTurn: "Du bist dran – tippe ein Feld an!",
    again: "Treffer! Du darfst nochmal.",
    opponentTurn: (name: string) => `${name} zielt …`,
    botThinking: "Der Computer zielt …",
    waitingFor: (names: string) => `Pause – wartet auf ${names} …`,
    rejected: "Dieser Schuss geht gerade nicht.",
    you: "Du",
    targetTitle: "Gegnerische Gewässer",
    ownTitle: "Deine Flotte",
    win: "Gewonnen!",
    winForfeit: "Gewonnen – dein Gegner ist gegangen",
    lose: "Verloren",
    nextSoon: "Gleich geht’s weiter …",
    cellLabel: (coord: string, state: string) => `${coord}: ${state}`,
    state: { ".": "unbekannt", o: "Wasser", x: "Treffer", "#": "versenkt", "~": "sicher Wasser" } as Record<string, string>,
  },
} as const;

/** Anzeigename eines Platzes. */
export const seatName = (seat: { kind: "human"; name: string } | { kind: "bot" }): string =>
  seat.kind === "bot" ? de.botName : seat.name;
