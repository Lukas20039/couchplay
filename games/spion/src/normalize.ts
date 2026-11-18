// Text-Helfer für Hinweiswörter (ohne Abhängigkeiten; Server, Daten-Tests und Handy nutzen sie).
import { CLUE_MAX } from "./constants.js";

// Steuerzeichen, Zero-Width, Bidi-Overrides und Zeilenumbrüche (wie normalizeName im Protokoll).
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g;

/** Artikel, die am Anfang beim Vergleich ignoriert werden. */
const ARTICLES = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]);

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * Anzeigeform eines eingegebenen Hinweises: NFC, verbotene Zeichen raus, Leerraum zusammengefasst, getrimmt.
 * Kürzt NICHT – die Länge prüft `clueLength`.
 */
export function cleanText(raw: string): string {
  return raw.normalize("NFC").replace(FORBIDDEN, "").replace(/\s+/g, " ").trim();
}

/** Länge in Codepoints (Emoji zählen einzeln, wie beim Namen). */
export const clueLength = (text: string): number => [...text].length;

/** Gültiger Hinweis nach `cleanText`: genau EIN Wort (kein Leerzeichen), 1–24 Zeichen, mit Buchstabe oder Ziffer. */
export const isValidClue = (clean: string): boolean => {
  const n = clueLength(clean);
  return n >= 1 && n <= CLUE_MAX && !/\s/.test(clean) && normalizeWord(clean) !== "";
};

/** Bereinigter Text enthält ein Leerzeichen (für den Hinweis „nur ein Wort“ am Handy). */
export const hasSpace = (clean: string): boolean => /\s/.test(clean);

/** Wortteile (für „Harry Potter“ → „harry“, „potter“). */
const parts = (text: string): string[] => words(text).filter((w) => !ARTICLES.has(w));

function words(text: string): string[] {
  return text
    .toLocaleLowerCase("de-DE")
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((w) => w !== "");
}

/**
 * Vergleichsschlüssel: Groß/klein, Umlaute/ß (ä = ae), Akzente, Satzzeichen und Leerzeichen egal,
 * ein Artikel am Anfang wird ignoriert. „Der Schwimm-Bad!“ → „schwimmbad“, „Löwe“ → „loewe“.
 */
export function normalizeWord(text: string): string {
  const w = words(text);
  // Artikel nur entfernen, wenn danach noch etwas übrig bleibt („Die“ allein bleibt „die“).
  if (w.length > 1 && ARTICLES.has(w[0]!)) w.shift();
  return w.join("");
}

/**
 * Hinweis verrät das eigene Wort zu direkt (wird abgelehnt):
 * - gleich dem Wort (normalisiert, z. B. „STRAND!“ für „Strand“),
 * - enthält das Wort (ab 5 Buchstaben irgendwo, kürzere nur am Anfang/Ende: „Strandkorb“, „Haifisch“, „Milchkuh“),
 * - gleich einem Teil eines mehrteiligen Wortes („Potter“ für „Harry Potter“).
 */
export function isForbiddenClue(clue: string, word: string): boolean {
  const k = normalizeWord(clue);
  const w = normalizeWord(word);
  if (k === "" || w === "") return false;
  if (k === w) return true;
  if (w.length >= 5 && k.includes(w)) return true;
  if (w.length >= 3 && (k.startsWith(w) || k.endsWith(w))) return true;
  const ps = parts(word);
  return ps.length > 1 && ps.some((p) => p.length >= 3 && p === k);
}
