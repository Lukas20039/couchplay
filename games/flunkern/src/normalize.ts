// Text-Helfer für Lügen und Antworten (ohne Abhängigkeiten; Server, Daten-Tests und Handy nutzen sie).
import { LIE_MAX } from "./constants.js";

// Steuerzeichen, Zero-Width, Bidi-Overrides und Zeilenumbrüche (wie normalizeName im Protokoll).
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g;

/** Artikel, die am Anfang einer Antwort beim Vergleich ignoriert werden. */
const ARTICLES = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]);

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * Anzeigeform einer eingegebenen Lüge: NFC, verbotene Zeichen raus, Leerraum zusammengefasst, getrimmt.
 * Kürzt NICHT – die Länge prüft `lieLength`.
 */
export function cleanText(raw: string): string {
  return raw.normalize("NFC").replace(FORBIDDEN, "").replace(/\s+/g, " ").trim();
}

/** Länge in Codepoints (Emoji zählen einzeln, wie beim Namen). */
export const lieLength = (text: string): number => [...text].length;

/** Gültige Lüge nach `cleanText`: 1–40 Zeichen und mindestens ein Buchstabe oder eine Ziffer. */
export const isValidLie = (clean: string): boolean => {
  const n = lieLength(clean);
  return n >= 1 && n <= LIE_MAX && normalizeAnswer(clean) !== "";
};

/**
 * Vergleichsschlüssel: Groß/klein, Umlaute/ß (ä = ae), Akzente, Satzzeichen und Leerzeichen egal,
 * ein Artikel am Anfang (der/die/das/ein/eine …) wird ignoriert.
 * „Der Kau-Gummi!“ → „kaugummi“, „Ein Öl“ → „oel“.
 */
export function normalizeAnswer(text: string): string {
  const words = text
    .toLocaleLowerCase("de-DE")
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((w) => w !== "");
  // Artikel nur entfernen, wenn danach noch etwas übrig bleibt („Die“ allein bleibt „die“).
  if (words.length > 1 && ARTICLES.has(words[0]!)) words.shift();
  return words.join("");
}
