#!/usr/bin/env node
// Erzeugt die Wortlisten der Lexikon-Prüfung von „Stadt, Land, Fluss“ aus offenen Datenquellen.
//
//   node games/stadtland/scripts/build-lexicon.mjs            # alle Kategorien
//   node games/stadtland/scripts/build-lexicon.mjs stadt tier # nur einzelne Kategorien
//
// Quellen:
//   - Wikidata (CC0) über den SPARQL-Endpunkt query.wikidata.org
//   - GeoNames cities15000/cities5000 (CC BY 4.0) von download.geonames.org
//
// Ergebnis: src/server/lexicon/data/<kategorie>.ts – je ein großer String („Eintrag\nEintrag\n…“).
// Handkuratierte Ergänzungen liegen getrennt in src/server/lexicon/extra/*.ts und werden hier NICHT
// angefasst. Antworten der Quellen werden im Temp-Verzeichnis zwischengespeichert
// (COUCHPLAY_LEXICON_CACHE, Standard: <tmp>/couchplay-lexicon-cache); zum Auffrischen löschen.
// Keine npm-Abhängigkeiten: nur Node ≥ 22 (fetch) und das Systemprogramm `unzip`.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "src", "server", "lexicon", "data");
const CACHE = process.env.COUCHPLAY_LEXICON_CACHE ?? join(tmpdir(), "couchplay-lexicon-cache");
const UA = "CouchPlayLexiconBuilder/1.0 (offline word list generator for a party game; node fetch)";
const SPARQL = "https://query.wikidata.org/sparql";

mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** SPARQL-Abfrage (mit Cache und Wiederholungen). Liefert die Zeilen als Objekte mit Stringwerten. */
async function sparql(query, { attempts = 5 } = {}) {
  const hash = createHash("sha1").update(query).digest("hex").slice(0, 16);
  const file = join(CACHE, `wd-${hash}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  // COUCHPLAY_LEXICON_OFFLINE=1: nur aus dem Cache arbeiten (fehlende Abfragen gelten als fehlgeschlagen).
  if (process.env.COUCHPLAY_LEXICON_OFFLINE) throw new Error("nicht im Cache (offline)");
  let rateLimited = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(SPARQL, {
        method: "POST",
        headers: {
          "User-Agent": UA,
          // TSV ist deutlich kompakter als JSON – große Ergebnisse brechen sonst am Zeitlimit ab.
          Accept: "text/tab-separated-values",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ query }),
      });
      const text = await res.text();
      if (res.status === 429 && ++rateLimited <= 10) {
        // Rate-Limit des Endpunkts (Rechenzeit pro Minute): so lange warten wie verlangt.
        const wait = Number(res.headers.get("retry-after")) || 60;
        console.warn(`  Rate-Limit – warte ${wait} s …`);
        await sleep(wait * 1000);
        attempt--;
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
      const rows = parseTsv(text);
      writeFileSync(file, JSON.stringify(rows));
      return rows;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.warn(`  SPARQL-Fehler (Versuch ${attempt}): ${String(err).slice(0, 200)} – neuer Versuch …`);
      await sleep(5000 * attempt);
    }
  }
}

/** Parst SPARQL-TSV (Kopfzeile „?a\t?b“, Literale als "Text"@de, IRIs als <…>). */
function parseTsv(text) {
  if (/Exception|TimeoutException|upstream request timeout/.test(text.slice(-2000))) {
    throw new Error("Abfrage abgebrochen (Zeitlimit)");
  }
  const lines = text.split("\n");
  const head = lines.shift().split("\t").map((h) => h.replace(/^\?/, ""));
  const value = (raw) => {
    if (raw === "") return undefined;
    if (raw.startsWith("<") && raw.endsWith(">")) return raw.slice(1, -1);
    const m = /^"(.*)"(?:@[\w-]+|\^\^<[^>]*>)?$/s.exec(raw);
    if (!m) return raw;
    return m[1].replace(/\\(.)/g, (_, c) => ({ t: "\t", n: "\n", r: "\r" })[c] ?? c);
  };
  const rows = [];
  for (const line of lines) {
    if (line === "") continue;
    const cells = line.split("\t");
    const row = {};
    head.forEach((h, i) => {
      const v = value(cells[i] ?? "");
      if (v !== undefined) row[h] = v;
    });
    rows.push(row);
  }
  return rows;
}

/** Lädt eine GeoNames-ZIP-Datei (mit Cache) und liefert die Zeilen der enthaltenen .txt-Datei. */
async function geonames(name) {
  const txt = join(CACHE, `${name}.txt`);
  if (!existsSync(txt)) {
    const zip = join(CACHE, `${name}.zip`);
    const res = await fetch(`https://download.geonames.org/export/dump/${name}.zip`, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`GeoNames ${name}: HTTP ${res.status}`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    execFileSync("unzip", ["-o", "-q", zip, `${name}.txt`, "-d", CACHE]);
  }
  return readFileSync(txt, "utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
}

/** Nur lateinische Schrift (inkl. Akzente), Ziffern und übliche Satzzeichen. */
const LATIN = /^[\p{Script=Latin}0-9 .,'’\-()/&]+$/u;

/**
 * Bereinigt eine Bezeichnung: Klammerzusätze („Haus (Steiermark)“), Kommazusätze („Weil, Bayern“)
 * und Leerraum. Liefert null für Unbrauchbares (andere Schrift, Q-IDs, zu lang/kurz).
 */
function clean(label) {
  if (!label) return null;
  let s = label.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (s.includes(",")) s = s.split(",")[0].trim();
  if (/^Q\d+$/.test(s)) return null;
  if (s.length < 2 || s.length > 40) return null;
  if (!LATIN.test(s)) return null;
  return s;
}

/** Sortiert (deutsch), entfernt Dubletten und schreibt data/<name>.ts. */
function writeList(name, entries, sources) {
  const seen = new Map();
  for (const e of entries) {
    const c = clean(e);
    if (!c) continue;
    const k = c.toLocaleLowerCase("de-DE");
    if (!seen.has(k)) seen.set(k, c);
  }
  const list = [...seen.values()].sort((a, b) => a.localeCompare(b, "de"));
  const body = list.join("\n");
  const head =
    `// AUTOMATISCH ERZEUGT von scripts/build-lexicon.mjs – nicht von Hand bearbeiten (Ergänzungen: extra/${name}.ts).\n` +
    `// Quellen: ${sources}\n` +
    `// ${list.length} Einträge, einer pro Zeile.\n`;
  writeFileSync(join(OUT_DIR, `${name}.ts`), `${head}export default ${JSON.stringify(body)};\n`);
  console.log(`  ${name}: ${list.length} Einträge (${(Buffer.byteLength(body) / 1024).toFixed(0)} KB)`);
}

/** Labels (rdfs:label + optional skos:altLabel) in den angegebenen Sprachen für ein Muster ?x. */
function labelQuery(pattern, langs, { aliases = false } = {}) {
  const langList = langs.map((l) => `"${l}"`).join(",");
  const pred = aliases ? "rdfs:label|skos:altLabel" : "rdfs:label";
  return `SELECT DISTINCT ?l WHERE { ${pattern} ?x ${pred} ?l . FILTER(LANG(?l) IN (${langList})) }`;
}

const labels = async (pattern, langs, opts) => (await sparql(labelQuery(pattern, langs, opts))).map((r) => r.l);

const DEWIKI = `?article schema:about ?x ; schema:isPartOf <https://de.wikipedia.org/> .`;
/** Sprachen in lateinischer Schrift, deren Bezeichnungen als „Originalname“ durchgehen. */
const LATIN_LANGS = ["de", "en", "fr", "it", "es", "pt", "nl", "pl", "cs", "sk", "sv", "da", "nb", "fi", "hu", "tr", "ro", "hr", "sl", "lb", "rm"];

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

const BUILDERS = {
  async stadt() {
    const out = [];
    // Alle Gemeinden (auch ehemalige) in Deutschland (AGS), Österreich (Gemeindekennziffer), Schweiz (BFS-Nr.).
    for (const prop of ["P439", "P964", "P771"]) {
      out.push(...(await labels(`?x wdt:${prop} [] .`, ["de"], { aliases: true })));
    }
    // Weltweit: GeoNames-Städte > 15.000 Einwohner (Name + ASCII-Name) …
    const big = await geonames("cities15000");
    const ids = [];
    for (const f of big) {
      out.push(f[1], f[2]);
      if (Number(f[14]) >= 50000) ids.push(f[0]);
    }
    // … und europäische Orte > 5.000 Einwohner.
    const EUROPE = new Set(
      "DE AT CH LI LU BE NL FR IT ES PT DK SE NO FI IS IE GB PL CZ SK HU SI HR BA RS ME MK AL GR BG RO MD UA BY LT LV EE RU TR CY MT SM VA MC AD".split(" "),
    );
    for (const f of await geonames("cities5000")) if (EUROPE.has(f[8])) out.push(f[1], f[2]);
    // Für Städte > 50.000 Einwohner: deutsche (inkl. Aliasse) und Originalbezeichnungen aus Wikidata.
    for (let i = 0; i < ids.length; i += 500) {
      const values = ids.slice(i, i + 500).map((id) => `"${id}"`).join(" ");
      out.push(...(await labels(`VALUES ?gn { ${values} } ?x wdt:P1566 ?gn .`, LATIN_LANGS)));
      out.push(...(await labels(`VALUES ?gn { ${values} } ?x wdt:P1566 ?gn .`, ["de"], { aliases: true })));
    }
    writeList("stadt", out, "Wikidata (CC0), GeoNames cities15000/cities5000 (CC BY 4.0)");
  },

  async land() {
    const out = [];
    // Staaten, Länder, abhängige Gebiete, Staaten mit begrenzter Anerkennung, Landesteile (England …).
    const classes = "wd:Q3624078 wd:Q6256 wd:Q15634554 wd:Q46395 wd:Q161243 wd:Q1763527 wd:Q26934845";
    out.push(...(await labels(`VALUES ?c { ${classes} } ?x wdt:P31 ?c .`, ["de"], { aliases: true })));
    out.push(...(await labels(`VALUES ?c { ${classes} } ?x wdt:P31 ?c .`, ["en"])));
    // Bekannte historische Staaten (viele Sprachversionen = bekannt).
    out.push(...(await labels(`?x wdt:P31 wd:Q3024240 ; wikibase:sitelinks ?s . FILTER(?s >= 40)`, ["de"])));
    // Aliasse enthalten Kürzel und Fremdsprachiges („sv“, „Staaten“) – nur Großgeschriebenes ab 4 Zeichen.
    writeList("land", out.filter((l) => /^[A-ZÄÖÜ]/.test(l) && l.length >= 4 && l !== "Staaten"), "Wikidata (CC0)");
  },

  async fluss() {
    const out = [];
    const classes = "wd:Q4022 wd:Q47521 wd:Q355304 wd:Q1437299 wd:Q159675 wd:Q573344";
    // Fließgewässer mit Artikel in der deutschen Wikipedia (deutsche Bezeichnungen + Aliasse) …
    out.push(...(await labels(`VALUES ?c { ${classes} } ?x wdt:P31 ?c . ${DEWIKI}`, ["de"], { aliases: true })));
    // … und große Flüsse auch mit Originalnamen.
    out.push(
      ...(await labels(`VALUES ?c { ${classes} } ?x wdt:P31 ?c ; wikibase:sitelinks ?s . FILTER(?s >= 20)`, LATIN_LANGS)),
    );
    writeList("fluss", out, "Wikidata (CC0)");
  },

  async name() {
    // Männliche, weibliche, geschlechtsneutrale Vornamen und Vornamen allgemein – je Klasse eine Abfrage
    // (eine gemeinsame ist dem Endpunkt zu groß). „mul“ = sprachübergreifendes Label.
    const out = [];
    for (const c of ["Q12308941", "Q11879590", "Q3409032", "Q202444"]) {
      out.push(
        ...(await labels(`?x wdt:P31 wd:${c} ; wikibase:sitelinks ?s . FILTER(?s >= 2)`, [
          "mul",
          "de",
          "en",
          "fr",
          "it",
          "es",
          "tr",
        ])),
      );
    }
    writeList("name", out, "Wikidata (CC0)");
  },

  async beruf() {
    const out = [];
    const classes = "wd:Q28640 wd:Q12737077";
    out.push(...(await labels(`VALUES ?c { ${classes} } ?x wdt:P31 ?c .`, ["de"], { aliases: true })));
    out.push(...(await labels(`?x wdt:P279 wd:Q28640 .`, ["de"], { aliases: true })));
    // Weibliche Formen (P2521) und männliche Formen (P3321) deutscher Berufsbezeichnungen.
    for (const p of ["P2521", "P3321"]) {
      const rows = await sparql(
        `SELECT DISTINCT ?l WHERE { VALUES ?c { ${classes} } ?x wdt:P31 ?c ; wdt:${p} ?l . FILTER(LANG(?l) = "de") }`,
      );
      out.push(...rows.map((r) => r.l));
    }
    // Nur deutsch aussehende Bezeichnungen (Großbuchstabe am Anfang, keine Fremd-Diakritika).
    const german = (l) => /^[A-ZÄÖÜ][A-Za-zÄÖÜäöüßéè\- ./]+$/.test(l);
    writeList("beruf", out.filter((l) => isOccupationLike(l) && german(l)), "Wikidata (CC0)");
  },

  // Essen & Trinken: Wikidata ergänzt die handkuratierten Listen (extra/*.ts) um Spezialitäten mit Artikel
  // in der deutschen Wikipedia (Instanz oder Unterklasse der genannten Klassen).
  async gericht() {
    writeList("gericht", await foodLabels(["Q746549", "Q41415", "Q9266", "Q28803", "Q2920963"]), "Wikidata (CC0)");
  },

  async getraenk() {
    writeList("getraenk", await foodLabels(["Q40050", "Q134768", "Q44", "Q282", "Q154", "Q8486"]), "Wikidata (CC0)");
  },

  async suesses() {
    writeList("suesses", await foodLabels(["Q182940", "Q13276", "Q13266", "Q185583", "Q477248", "Q195"]), "Wikidata (CC0)");
  },

  async marke() {
    // Marken (Q431289), Produktmarken/-linien und bekannte Unternehmen (viele Sprachversionen = bekannt).
    const out = [];
    const langs = ["de", "en", "mul"];
    out.push(...(await labels(`?x wdt:P31 wd:Q431289 ; wikibase:sitelinks ?s . FILTER(?s >= 3)`, langs, { aliases: true })));
    out.push(...(await labels(`?x wdt:P31 wd:Q167270 ; wikibase:sitelinks ?s . FILTER(?s >= 3)`, langs)));
    for (const c of ["Q4830453", "Q6881511", "Q891723", "Q786820", "Q2085381", "Q1631129"]) {
      // Gewerbebetrieb, Unternehmen, börsennotiertes Unternehmen, Automobilhersteller, Verlag, Hotelkette.
      out.push(...(await labels(`?x wdt:P31 wd:${c} ; wikibase:sitelinks ?s . FILTER(?s >= 12)`, langs)));
    }
    writeList("marke", out.map(stripCompanySuffix), "Wikidata (CC0)");
  },

  async musik() {
    // Bands/Musikgruppen und Musiker:innen (Personen mit Musikberuf) – je mit Mindestbekanntheit.
    const out = [];
    for (const c of ["Q215380", "Q5741069", "Q2088357", "Q9212979"]) {
      out.push(...(await labels(`?x wdt:P31 wd:${c} ; wikibase:sitelinks ?s . FILTER(?s >= 4)`, ["de", "en", "mul"])));
    }
    // Sänger, Musiker, Rapper, Singer-Songwriter, Komponist, DJ, Pianist, Gitarrist, Musikproduzent.
    for (const occ of ["Q177220", "Q639669", "Q2252262", "Q488205", "Q36834", "Q130857", "Q486748", "Q855091", "Q183945"]) {
      try {
        out.push(
          ...(await labels(`?x wdt:P106 wd:${occ} ; wikibase:sitelinks ?s . FILTER(?s >= 12)`, ["de", "en", "mul"], {
            aliases: true,
          })),
        );
      } catch (err) {
        console.warn(`  Beruf ${occ} übersprungen: ${String(err).slice(0, 120)}`);
      }
    }
    writeList("musik", out, "Wikidata (CC0)");
  },

  async tier() {
    // Kandidaten: (a) alle Taxa mit deutschem Trivialnamen (P1843), (b) alle Taxa unterhalb einiger
    // überschaubarer Tierklassen. Eine Gesamtabfrage „Nachkomme von Animalia“ ist für den
    // SPARQL-Endpunkt zu teuer, daher wird die Abstammung für (a) stapelweise geprüft.
    const ids = new Set();
    const common = await sparql(`SELECT ?x ?n WHERE { ?x wdt:P1843 ?n . FILTER(LANG(?n) = "de") }`);
    const commonIds = [...new Set(common.map((r) => qid(r.x)))];
    const animalCommon = new Set();
    for (const batch of chunks(commonIds, 400)) {
      // Pfad von ?x aufwärts auswerten (Gearing „forward“) – sonst läuft der Endpunkt von Animalia abwärts.
      const values = batch.map((q) => `wd:${q}`).join(" ");
      const query = `SELECT DISTINCT ?x WHERE { VALUES ?x { ${values} } ?x wdt:P171* wd:Q729 . hint:Prior hint:gearing "forward" . }`;
      for (const r of await sparql(query)) animalCommon.add(qid(r.x));
    }
    const out = common.filter((r) => animalCommon.has(qid(r.x))).map((r) => r.n);
    for (const q of animalCommon) ids.add(q);
    // Säugetiere, Vögel, Reptilien, Amphibien, Knorpelfische, Krebstiere (Unterbäume einzeln).
    for (const clade of ["Q7377", "Q5113", "Q10811", "Q10908", "Q25371", "Q25364"]) {
      for (const q of await descendants(clade)) ids.add(q);
    }
    // Deutsche Bezeichnungen (Label + Aliasse) dieser Taxa; wissenschaftliche Namen fliegen raus.
    let skipped = 0;
    for (const batch of chunks([...ids], 1500)) {
      try {
        const rows = await sparql(
          `SELECT ?l ?t WHERE { VALUES ?x { ${batch.map((q) => `wd:${q}`).join(" ")} } ?x rdfs:label|skos:altLabel ?l . FILTER(LANG(?l) = "de") OPTIONAL { ?x wdt:P225 ?t } }`,
          { attempts: 2 },
        );
        for (const r of rows) if (r.l !== r.t && !isScientific(r.l)) out.push(r.l);
      } catch {
        skipped++; // Endpunkt überlastet – Lücke in Kauf nehmen (extra/tier.ts deckt das Wichtigste ab)
      }
    }
    if (skipped > 0) console.warn(`  ${skipped} Label-Stapel übersprungen (Zeitlimit)`);
    writeList("tier", out.filter((l) => !isScientific(l)), "Wikidata (CC0)");
  },
};

/** Deutsche Labels (+ Aliasse) von Instanzen/Unterklassen (bis 2 Ebenen) mit deWP-Artikel. */
async function foodLabels(classes) {
  const out = [];
  for (const c of classes) {
    for (const path of ["wdt:P31", "wdt:P279", "wdt:P31/wdt:P279", "wdt:P279/wdt:P279"]) {
      const rows = await labels(`?x ${path} wd:${c} . ${DEWIKI}`, ["de"], { aliases: true });
      out.push(...rows);
    }
  }
  // Nur deutsch aussehende Einträge (Großbuchstabe am Anfang, keine langen Beschreibungen).
  return out.filter((l) => /^[A-ZÄÖÜ0-9]/.test(l) && l.split(" ").length <= 4);
}

/** „Volkswagen AG“ → „Volkswagen“, „Apple Inc.“ → „Apple“. */
function stripCompanySuffix(label) {
  return label.replace(/[ ,]+(AG|SE|GmbH|GmbH & Co\. KG|KG|KGaA|Inc\.?|Corp\.?|Corporation|Ltd\.?|Limited|plc|PLC|S\.A\.|SA|S\.p\.A\.|N\.V\.|NV|B\.V\.|LLC|Co\.|Company|Group|Holding|Holdings)$/i, "");
}

/**
 * Alle Taxa unterhalb von `clade` (P171 = übergeordnetes Taxon). Ist die Abfrage zu groß fürs
 * Zeitlimit, wird rekursiv über die direkten Untertaxa aufgeteilt.
 */
async function descendants(clade, depth = 0) {
  try {
    const rows = await sparql(`SELECT ?x WHERE { ?x wdt:P171+ wd:${clade} . }`, { attempts: 2 });
    return rows.map((r) => qid(r.x));
  } catch (err) {
    if (depth >= 2) {
      console.warn(`  Taxon ${clade} übersprungen: ${String(err).slice(0, 120)}`);
      return [];
    }
    console.warn(`  Taxon ${clade} zu groß – teile auf …`);
    let children = [];
    try {
      children = (await sparql(`SELECT ?x WHERE { ?x wdt:P171 wd:${clade} . }`, { attempts: 2 })).map((r) => qid(r.x));
    } catch {
      console.warn(`  Taxon ${clade} übersprungen`);
    }
    const out = [...children];
    for (const c of children) out.push(...(await descendants(c, depth + 1)));
    return out;
  }
}

const qid = (uri) => uri.slice(uri.lastIndexOf("/") + 1);

function chunks(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Sieht nach wissenschaftlichem Namen aus („Vulpes vulpes“, „Canidae“, „Felis catus silvestris“). */
function isScientific(label) {
  if (/^[A-Z][a-z]+ [a-z]+( [a-z]+)?$/.test(label)) return true; // Binomen/Trinomen
  if (/^[A-Z][a-z]+(idae|inae|ini|oidea|formes|iformes|acea|aceae|ina)$/.test(label)) return true; // Familien/Ordnungen
  return false;
}

/** Grobe Filter für Wikidata-Berufe: keine Ämter mit Ortsbezug („Bürgermeister von …“). */
function isOccupationLike(label) {
  if (typeof label !== "string") return false;
  return !/\b(von|der|des|im|in|für|of)\b/.test(label) && label.split(" ").length <= 3;
}

// ---------------------------------------------------------------------------

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(BUILDERS);
for (const name of names) {
  const build = BUILDERS[name];
  if (!build) throw new Error(`Unbekannte Kategorie: ${name}`);
  console.log(`→ ${name}`);
  await build();
}
