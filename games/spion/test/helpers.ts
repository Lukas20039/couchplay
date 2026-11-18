// Gemeinsame Test-Helfer (kein Testfile): Harness starten und Phasen durchspielen.
import { createTestHarness, type GameHarness } from "@couchplay/game-sdk/testing";
import type { SettingsValues } from "@couchplay/protocol";
import game from "../src/server/index.js";
import { TIMING, type SpPlayerView, type SpTvState } from "../src/shared.js";

export type H = GameHarness<SpTvState, SpPlayerView>;
export const SETTINGS: SettingsValues = { rounds: "3", clueRounds: 2, clueSeconds: 30, voteSeconds: 60 };
export const CLUE_MS = 30_000;
export const VOTE_MS = 60_000;

export const setup = (players = 4, settings: SettingsValues = SETTINGS, seed = 7): H =>
  createTestHarness<SpTvState, SpPlayerView>(game, { players, settings, seed });
export const tv = (h: H) => h.lastTv()!;
export const phase = (h: H) => tv(h).phase;
export const view = (h: H, id: string) => h.lastView(id)!;
export const as = <P extends SpTvState["phase"]>(h: H, p: P) => {
  const s = tv(h);
  if (s.phase !== p) throw new Error(`Phase ${s.phase} statt ${p}`);
  return s as Extract<SpTvState, { phase: P }>;
};
export const viewAs = <P extends SpPlayerView["phase"]>(h: H, id: string, p: P) => {
  const v = view(h, id);
  if (v.phase !== p) throw new Error(`Phase ${v.phase} statt ${p}`);
  return v as Extract<SpPlayerView, { phase: P }>;
};
export const ids = (h: H) => h.players.map((p) => p.id);
export const score = (h: H, id: string) => tv(h).players.find((p) => p.id === id)!.score;

/** Geheime Wörter je Spieler (null = klassischer Spion). */
const secrets = (h: H): Map<string, string | null> =>
  new Map(
    ids(h).flatMap((id) => {
      // Ausgeschiedene behalten ihre letzte (veraltete) Ansicht – nicht mitzählen.
      if (tv(h).players.find((p) => p.id === id)?.left) return [];
      const s = h.lastView(id)?.secret;
      return s ? [[id, s.kind === "spy" ? null : s.word] as const] : [];
    }),
  );

/** Spion der laufenden Runde – nur Tests „wissen“ das (klassisch: Rolle, Undercover: das abweichende Wort). */
export function spyOf(h: H): string {
  const m = secrets(h);
  const classic = [...m].find(([, w]) => w === null);
  if (classic) return classic[0];
  const count = new Map<string, number>();
  for (const w of m.values()) count.set(w!, (count.get(w!) ?? 0) + 1);
  const odd = [...m].find(([, w]) => count.get(w!) === 1);
  if (!odd) throw new Error("kein Spion gefunden");
  return odd[0];
}
/** Das echte geheime Wort der Runde. */
export function wordOf(h: H): string {
  const spy = spyOf(h);
  const s = h.lastView(ids(h).find((id) => id !== spy)!)!.secret;
  if (!s || s.kind !== "word") throw new Error("kein Wort");
  return s.word;
}
export const others = (h: H, id: string) => ids(h).filter((x) => x !== id && !tv(h).players.find((p) => p.id === x)!.left);

/** Intro vorbei → Rolle. */
export const toRole = (h: H): H => {
  if (phase(h) === "intro") h.advance(TIMING.introMs);
  return h;
};
/** Alle tippen „Verstanden“ → Hinweise. */
export const toClues = (h: H): H => {
  toRole(h);
  for (const id of ids(h)) if (phase(h) === "role") h.input(id, { type: "ready" });
  return h;
};
/** Alle Züge: wer dran ist, gibt „HinweisN“ (oder lässt aus). */
export const giveClues = (h: H, pass = false): H => {
  for (let i = 0; i < 40 && phase(h) === "clue"; i++) {
    const turn = as(h, "clue").turn;
    h.input(turn, pass ? { type: "pass" } : { type: "clue", text: `Hinweis${i}` });
  }
  return h;
};
export const toVote = (h: H): H => giveClues(toClues(h));
/** Stimmen abgeben: Wähler → Verdächtiger. */
export const castVotes = (h: H, votes: Record<string, string>): H => {
  for (const [voter, target] of Object.entries(votes)) h.input(voter, { type: "vote", target });
  return h;
};
/** Alle verdächtigen `target` (target selbst wählt einen Unschuldigen). */
export const allAccuse = (h: H, target: string): H => {
  const spy = spyOf(h);
  const alt = others(h, target).find((o) => o !== spy) ?? others(h, target)[0]!;
  for (const id of ids(h)) if (phase(h) === "vote" && !tv(h).players.find((p) => p.id === id)!.left) h.input(id, { type: "vote", target: id === target ? alt : target });
  return h;
};
/** Auflösung überspringen (Auszählen + Urteil). */
export const skipReveal = (h: H): H => {
  if (phase(h) === "reveal") h.skip();
  return h;
};
/** Alle Strings eines JSON-Werts (für Geheimhaltungs-Prüfungen). */
export const strings = (x: unknown): string[] =>
  typeof x === "string" ? [x] : Array.isArray(x) ? x.flatMap(strings) : x && typeof x === "object" ? Object.values(x).flatMap(strings) : [];
/** Alle Schlüssel eines JSON-Werts (rekursiv). */
export const keys = (x: unknown): string[] =>
  Array.isArray(x) ? x.flatMap(keys) : x && typeof x === "object" ? Object.entries(x).flatMap(([k, v]) => [k, ...keys(v)]) : [];
