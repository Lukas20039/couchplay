// Erzeugt src/server/wordlist.data.ts aus dem LanguageTool-Wörterbuch german-pos-dict
// (CC BY-SA 4.0, https://github.com/languagetool-org/german-pos-dict).
//
// Vorbereitung (einmalig, braucht Java):
//   german.dict + german.info aus src/main/resources/org/languagetool/resource/de/ laden,
//   morfologik-tools 2.1.9 (+ morfologik-fsa, -fsa-builders, -stemming, jcommander 1.78, hppc 0.8.1)
//   von Maven Central laden, dann:
//   java -cp "*" morfologik.tools.Launcher dict_decompile -i german.dict -o german.txt
// Aufruf:
//   node games/wortgarten/tools/build-wordlist.mjs <pfad/zu/german.txt>
//
// Format der Ausgabe (Front-Coding, ohne Trennzeichen): sortierte Wörter; vor jedem Wort ein
// Zeichen für die Länge des gemeinsamen Präfixes mit dem Vorgänger. "0".."g" = 0..16 für normale
// Wortformen, "h".."x" = 0..16 für Grundformen (Lemma = Wortform), die für Tipps und die Anzeige
// verpasster Wörter bevorzugt werden. Wörter bestehen nur aus A–Z und ÄÖÜ (ß → SS).
import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_LEN = 3;
const MAX_LEN = 16;
const NORMAL = "0123456789abcdefg";
const BASE = "hijklmnopqrstuvwx";
// Eigennamen, Abkürzungen und Wortfragmente sind keine Spielwörter.
const SKIP_POS = new Set(["EIG", "ABK", "IG", "ZUS"]);
const VALID = /^[A-ZÄÖÜ]+$/;

const input = process.argv[2];
if (!input) {
  console.error("Aufruf: node build-wordlist.mjs <german.txt>");
  process.exit(1);
}

/** Wort → true, wenn es (auch) als Grundform vorkommt. */
const words = new Map();
const lines = createInterface({ input: createReadStream(input, "utf8"), crlfDelay: Infinity });
for await (const line of lines) {
  const parts = line.split("_");
  if (parts.length < 3) continue;
  const [lemma, form] = parts;
  const tag = parts.slice(2).join("_");
  const pos = tag.split(":")[0];
  if (SKIP_POS.has(pos)) continue;
  // Substantivierte Adjektive/Infinitive ("Erzwungene") – die kleingeschriebene Form ist ohnehin enthalten.
  if (pos === "SUB" && (tag.includes(":ADJ") || tag.includes(":INF"))) continue;
  const word = form.toUpperCase().replaceAll("ß", "SS");
  if (word.length < MIN_LEN || word.length > MAX_LEN || !VALID.test(word)) continue;
  const isBase = lemma === form && pos !== "PA1" && pos !== "PA2";
  words.set(word, (words.get(word) ?? false) || isBase);
}

const sorted = [...words.keys()].sort();
let out = "";
let prev = "";
let baseCount = 0;
for (const w of sorted) {
  let p = 0;
  while (p < prev.length && p < w.length && prev[p] === w[p]) p++;
  const base = words.get(w);
  if (base) baseCount++;
  out += (base ? BASE : NORMAL)[p] + w.slice(p);
  prev = w;
}

const target = join(dirname(fileURLToPath(import.meta.url)), "../src/server/wordlist.data.ts");
writeFileSync(
  target,
  `// GENERIERT von tools/build-wordlist.mjs – nicht von Hand ändern.\n` +
    `// Quelle: LanguageTool german-pos-dict, CC BY-SA 4.0 (siehe ../../DATA-LICENSE.md).\n` +
    `// ${sorted.length} Wörter, davon ${baseCount} Grundformen. Format: siehe tools/build-wordlist.mjs.\n` +
    `export const WORDLIST_DATA = "${out}";\n`,
);
console.log(`${sorted.length} Wörter (${baseCount} Grundformen), ${(out.length / 1024 / 1024).toFixed(2)} MB → ${target}`);
