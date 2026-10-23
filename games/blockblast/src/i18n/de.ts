// Alle Texte des Spiels Blockblast (TV- und Controller-View gemeinsam).

const fmt = (n: number): string => n.toLocaleString("de-DE");

export const de = {
  fmt,
  title: "Blockblast",
  countdown: "Gleich geht’s los!",
  time: (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`,
  points: (n: number) => `${fmt(n)} Punkte`,
  rank: (r: number, n: number) => `Platz ${r} von ${n}`,
  combo: (n: number) => `Combo ×${n}`,
  lines: (n: number) => (n === 1 ? "1 Linie" : `${n} Linien`),
  out: "keine Züge mehr",
  left: "gegangen",

  tv: {
    rules: "Teile am Handy aufs Feld ziehen – volle Reihen und Spalten verschwinden.",
    rulesAttack: "Mehrere Linien auf einmal oder Combos schicken dem Führenden Steine!",
    attack: (stones: number, name: string) => `+${stones} Steine → ${name}`,
    winner: (name: string) => `${name} gewinnt!`,
    tie: "Unentschieden!",
    gain: (n: number) => `+${fmt(n)}`,
  },

  controller: {
    loading: "Spiel wird vorbereitet …",
    hint: "Teil aufs Feld ziehen – oder antippen, dann Feld wählen.",
    outTitle: "Keine Züge mehr",
    outHint: "Kein Teil passt mehr. Warte, bis die Runde endet.",
    incoming: (n: number, name: string) => `${name} schickt dir ${n} Steine!`,
    sent: (n: number, name: string) => `${n} Steine an ${name} geschickt!`,
    gain: (points: number, lines: number) => (lines > 0 ? `+${fmt(points)} · ${lines === 1 ? "1 Linie" : `${lines} Linien`}` : `+${fmt(points)}`),
    over: "Zeit um!",
    win: "Gewonnen!",
    place: (r: number) => `Platz ${r}`,
    piece: (i: number) => `Teil ${i + 1}`,
    cell: (x: number, y: number) => `Feld ${x + 1}/${y + 1}`,
  },
} as const;
