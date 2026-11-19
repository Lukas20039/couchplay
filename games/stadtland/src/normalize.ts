// Text-Helfer für Antworten (ohne Abhängigkeiten; Server, Tests und Handy nutzen sie).
import { ANSWER_MAX } from "./constants.js";

// Steuerzeichen, Zero-Width, Bidi-Overrides und Zeilenumbrüche (wie normalizeName im Protokoll).
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g;

/** Artikel, die am Anfang einer Antwort ignoriert werden (Buchstabenprüfung und Vergleich). */
const ARTICLES = new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]);

const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** Anzeigeform: NFC, verbotene Zeichen raus, Leerraum zusammengefasst, getrimmt, auf `max` Codepoints gekürzt. */
export function cleanText(raw: string, max: number): string {
  const text = raw.normalize("NFC").replace(FORBIDDEN, "").replace(/\s+/g, " ").trim();
  const chars = [...text];
  return chars.length <= max ? text : chars.slice(0, max).join("").trimEnd();
}

/** Anzeigeform einer Antwort (auf ANSWER_MAX gekürzt). Einargumentig – taugt für `.map(cleanAnswer)`. */
export const cleanAnswer = (raw: string): string => cleanText(raw, ANSWER_MAX);

/** Länge in Codepoints (Emoji zählen einzeln, wie beim Namen). */
export const answerLength = (text: string): number => [...text].length;

/**
 * Vergleichsschlüssel: Groß/klein, Umlaute/ß (ä = ae), Akzente, Satzzeichen und Leerzeichen egal,
 * ein Artikel am Anfang (der/die/das/ein/eine …) wird ignoriert.
 * „Der Rhein!“ → „rhein“, „Österreich“ → „oesterreich“, „St. Gallen“ → „stgallen“.
 */
export function answerKey(text: string): string {
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

/** Ergebnis der automatischen Prüfung einer Antwort. */
export type AutoCheck = "ok" | "empty" | "letter" | "short";

/**
 * Automatische Prüfung: leer, zu kurz (weniger als 2 Buchstaben/Ziffern) oder falscher Anfangsbuchstabe.
 * Umlaute zählen als Grundbuchstabe (Ö → O), ein führender Artikel zählt nicht („Der Rhein“ passt zu R).
 */
export function checkAnswer(text: string, letter: string): AutoCheck {
  const key = answerKey(text);
  if (key === "") return text.trim() === "" ? "empty" : "short";
  if (key.length < 2) return "short";
  return key.startsWith(letter.toLowerCase()) ? "ok" : "letter";
}
