// Tests der Lexikon-Prüfung (Wortlisten + Suche) von „Stadt, Land, Fluss“.
import { describe, expect, it } from "vitest";
import { CATEGORY_IDS, LETTERS, type CategoryId } from "../src/constants.js";
import {
  boundedDistance,
  flexCandidates,
  LEXICON_CATEGORIES,
  lexiconKeys,
  lexiconSize,
  lookupAnswer,
  lookupDetail,
} from "../src/server/lexicon/index.js";

const known = (category: CategoryId, words: readonly string[]): void => {
  for (const w of words) expect(lookupAnswer(category, w), `${category}: ${w}`).toBe("known");
};
const unknown = (category: CategoryId, words: readonly string[]): void => {
  for (const w of words) expect(lookupAnswer(category, w), `${category}: ${w}`).toBe("unknown");
};

describe("Kategorien", () => {
  it("hat Wortlisten für die klassischen und Essen-Kategorien", () => {
    for (const c of [
      "stadt",
      "land",
      "fluss",
      "name",
      "beruf",
      "tier",
      "obstgemuese",
      "gewuerz",
      "getraenk",
      "gericht",
      "suesses",
      "kuechengeraet",
      "pizzabelag",
    ] as const) {
      expect(LEXICON_CATEGORIES.has(c), c).toBe(true);
    }
  });

  it("liefert null für nicht prüfbare Kategorien", () => {
    for (const c of ["film", "serie", "promi", "ausrede", "superkraft", "fruehstueck", "imbiss", "bandname"] as const) {
      expect(LEXICON_CATEGORIES.has(c)).toBe(false);
      expect(lookupAnswer(c, "Irgendwas")).toBeNull();
      expect(lookupDetail(c, "Irgendwas")).toEqual({ result: null });
    }
  });

  it("alle Lexikon-Kategorien sind gültige Kategorie-IDs", () => {
    for (const c of LEXICON_CATEGORIES) expect(CATEGORY_IDS).toContain(c);
  });
});

describe("Mindestgrößen", () => {
  const MIN: Partial<Record<CategoryId, number>> = {
    stadt: 20000,
    land: 400,
    fluss: 1000,
    name: 5000,
    beruf: 1500,
    tier: 2000,
    obstgemuese: 300,
    gewuerz: 200,
    getraenk: 400,
    gericht: 800,
    suesses: 400,
    kuechengeraet: 300,
    pizzabelag: 250,
  };
  for (const [c, min] of Object.entries(MIN)) {
    it(`${c} hat mindestens ${min} Einträge`, () => {
      expect(lexiconSize(c as CategoryId)).toBeGreaterThanOrEqual(min);
    });
  }
});

describe("Abdeckung je gespieltem Buchstaben", () => {
  // Ausnahmen (realistisch kaum Einträge): Pizzabelag/Gewürz/Küchengerät mit sehr seltenen Anfangsbuchstaben.
  const EXCEPTIONS: Partial<Record<CategoryId, readonly string[]>> = {
    gewuerz: ["I", "U"],
    pizzabelag: ["I", "U", "E", "N", "Z"],
    kuechengeraet: ["I", "U", "Z", "O", "E"],
    obstgemuese: ["U", "I"],
    getraenk: ["U", "I"],
    suesses: ["U", "I"],
    land: ["W"],
  };
  for (const c of LEXICON_CATEGORIES) {
    it(`${c}: jeder Buchstabe hat Einträge`, () => {
      const keys = lexiconKeys(c);
      const counts = new Map<string, number>();
      for (const k of keys) counts.set(k[0]!, (counts.get(k[0]!) ?? 0) + 1);
      const min = ["stadt", "fluss", "name", "beruf", "tier", "musik", "marke"].includes(c) ? 10 : 2;
      for (const letter of LETTERS) {
        if (EXCEPTIONS[c]?.includes(letter)) continue;
        expect(counts.get(letter.toLowerCase()) ?? 0, `${c}/${letter}`).toBeGreaterThanOrEqual(min);
      }
    });
  }
});

describe("Stichproben", () => {
  it("Stadt", () => {
    known("stadt", [
      "Berlin",
      "Bad Homburg",
      "Garmisch-Partenkirchen",
      "Mailand",
      "Kopenhagen",
      "München",
      "Muenchen",
      "Frankfurt",
      "Frankfurt am Main",
      "St. Gallen",
      "Sankt Gallen",
      "Wien",
      "Zürich",
      "Rom",
      "Moskau",
      "Peking",
      "Neu-Delhi",
      "New York",
      "Tokio",
      "Paris",
      "Ulm",
      "Iserlohn",
      "Oer-Erkenschwick",
      "Lissabon",
      "Kapstadt",
      "Eisenhüttenstadt",
      "Wanne-Eickel",
      "Zwickau",
      "Halle",
      "Dornbirn",
      "Bregenz",
      "Thun",
    ]);
    unknown("stadt", ["Haus", "Hund", "Quatschdorfhausen", "Kühlschrank"]);
  });

  it("Land", () => {
    known("land", [
      "Deutschland",
      "Holland",
      "Elfenbeinküste",
      "USA",
      "Vereinigte Staaten",
      "Amerika",
      "England",
      "Schottland",
      "Wales",
      "Tschechien",
      "Tschechei",
      "Weißrussland",
      "Belarus",
      "Grönland",
      "Taiwan",
      "Kosovo",
      "Palästina",
      "Jugoslawien",
      "DDR",
      "Sowjetunion",
      "Österreich",
      "Oesterreich",
      "Die Schweiz",
      "Niederlande",
      "Vatikan",
      "Uganda",
      "Zypern",
    ]);
    unknown("land", ["Hamburger", "Berlin", "Hamburg", "Banane"]);
  });

  it("Fluss", () => {
    known("fluss", ["Rhein", "Donau", "Isar", "Amazonas", "Der Rhein", "Nil", "Elbe", "Mississippi", "Themse", "Wolga", "Inn", "Lech", "Neckar", "Ganges", "Jangtse", "Ruhr", "Saale", "Ems"]);
    unknown("fluss", ["Hamburg", "Kuchen", "Gurkensalat"]);
  });

  it("Name", () => {
    known("name", ["Anna", "Mohammed", "Kevin", "Zoe", "Zoë", "Lukas", "Lucas", "Sophie", "Emma", "Ben", "Hans", "Ursula", "Jürgen", "Yusuf", "Emily", "Oskar", "Ida", "Ole", "Wilhelm", "Ingrid"]);
    unknown("name", ["Kühlschrank", "Tisch", "Bratpfanne"]);
  });

  it("Beruf (inkl. weiblicher Formen und Plural)", () => {
    known("beruf", [
      "Bäckerin",
      "Bäcker",
      "Zahnarzt",
      "Zahnärztin",
      "Ärztin",
      "Influencer",
      "Influencerin",
      "Lehrer",
      "Lehrerinnen",
      "Polizist",
      "Polizistin",
      "Köchin",
      "Kauffrau",
      "Feuerwehrfrau",
      "Pilot",
      "Pilotin",
      "Tischler",
      "Schreiner",
      "Erzieher",
      "Informatiker",
      "Programmierer",
      "Friseur",
      "Hebamme",
      "Krankenschwester",
      "Elektriker",
      "Notar",
      "Optiker",
    ]);
    unknown("beruf", ["Banane", "Kühlschrank", "Bratkartoffel"]);
  });

  it("Tier (inkl. Plural und Komposita)", () => {
    known("tier", [
      "Fuchs",
      "Elefanten",
      "Riesenschildkröte",
      "Rotfuchs",
      "Weißer Hai",
      "Hai",
      "Käfer",
      "Maikäfer",
      "Hund",
      "Hunde",
      "Katze",
      "Mäuse",
      "Gänse",
      "Ameise",
      "Igel",
      "Okapi",
      "Nashorn",
      "Zebra",
      "Uhu",
      "Löwin",
      "Kuh",
      "Pferd",
      "Biene",
      "Delfin",
      "Wellensittich",
      "Dackel",
    ]);
    unknown("tier", ["Gurke", "Tomate", "Haus", "Fahrrad"]);
  });

  it("Obst & Gemüse", () => {
    known("obstgemuese", ["Banane", "Zucchini", "Apfel", "Äpfel", "Birnen", "Kartoffel", "Erdäpfel", "Paradeiser", "Wassermelone", "Gurke", "Karotte", "Möhren", "Tomaten", "Ananas", "Kohlrabi", "Rosenkohl", "Kiwi", "Brokkoli"]);
    unknown("obstgemuese", ["Fuchs", "Bratpfanne", "Kuchen"]);
  });

  it("Gewürz/Kraut", () => {
    known("gewuerz", ["Pfeffer", "Salz", "Zimt", "Basilikum", "Oregano", "Muskatnuss", "Kurkuma", "Petersilie", "Dill", "Thymian", "Rosmarin", "Kreuzkümmel", "Safran", "Kardamom"]);
    unknown("gewuerz", ["Kartoffel", "Auto"]);
  });

  it("Getränk (inkl. Komposita)", () => {
    known("getraenk", ["Wasser", "Bier", "Cola", "Apfelschorle", "Zitronenlimonade", "Pfefferminztee", "Kaffee", "Latte Macchiato", "Mojito", "Weizenbier", "Orangensaft", "Wein", "Rotwein", "Gin Tonic", "Kakao", "Milch"]);
    unknown("getraenk", ["Schnitzel", "Fahrrad"]);
  });

  it("Gericht (inkl. Komposita)", () => {
    known("gericht", ["Schnitzel", "Wiener Schnitzel", "Pizza", "Spaghetti Bolognese", "Lasagne", "Gulasch", "Kürbissuppe", "Käsespätzle", "Döner", "Sushi", "Rouladen", "Kartoffelsalat", "Bratkartoffeln", "Ratatouille", "Paella", "Currywurst", "Pfannkuchen", "Risotto"]);
    unknown("gericht", ["Fahrrad", "Schraubenzieher", "Hammer"]);
  });

  it("Süßes", () => {
    known("suesses", ["Schokolade", "Gummibärchen", "Tiramisu", "Käsekuchen", "Erdbeertorte", "Eis", "Lakritz", "Marzipan", "Donut", "Muffin", "Brownie", "Apfelstrudel", "Bonbons", "Kekse", "Pudding"]);
    unknown("suesses", ["Gurke", "Hammer"]);
  });

  it("Küchengerät", () => {
    known("kuechengeraet", ["Mixer", "Toaster", "Wasserkocher", "Kochlöffel", "Schneebesen", "Pfanne", "Bratpfanne", "Topf", "Kühlschrank", "Brotmesser", "Mikrowelle", "Nudelholz", "Reibe", "Sieb", "Thermomix", "Herd", "Backofen"]);
    unknown("kuechengeraet", ["Banane", "Elefant"]);
  });

  it("Pizzabelag", () => {
    known("pizzabelag", ["Salami", "Schinken", "Mozzarella", "Büffelmozzarella", "Ananas", "Thunfisch", "Champignons", "Oliven", "Rucola", "Zwiebeln", "Paprika", "Peperoni", "Tomaten", "Basilikum", "Mais", "Knoblauch"]);
    unknown("pizzabelag", ["Fahrrad", "Kühlschrank"]);
  });

  it("Marke und Musik (optional, Wikidata + Ergänzung)", () => {
    known("marke", ["Adidas", "Nivea", "Volkswagen", "Haribo", "Lego", "Apple", "Tempo", "Zalando"]);
    known("musik", ["Rammstein", "Beatles", "The Beatles", "Helene Fischer", "Grönemeyer", "Nena", "Abba", "Queen", "Madonna", "Die Ärzte"]);
  });
});

describe("Toleranz", () => {
  it("Normalisierung: Groß/klein, Umlaute, Artikel, Satzzeichen", () => {
    known("stadt", ["BERLIN", "berlin", "  Berlin!  ", "Köln", "Koeln", "Düsseldorf", "Duesseldorf"]);
    known("fluss", ["Die Donau", "der Rhein"]);
  });

  it("Tippfehler: Distanz 1 ab 5 Zeichen", () => {
    known("stadt", ["Hamburgg", "Muenchn", "Frankfrut"]); // Einfügung, Auslassung, Vertauschung
    known("tier", ["Elefnat", "Giraff"]);
    expect(lookupDetail("land", "Deutschlnad").kind).toBe("typo");
  });

  it("Tippfehler: Distanz 2 ab 9 Zeichen", () => {
    known("land", ["Deutchlandd"]);
    known("stadt", ["Kopenhgaen"]);
    expect(lookupDetail("tier", "Schildkrötte").result).toBe("known");
  });

  it("keine Tippfehler-Toleranz bei kurzen Wörtern", () => {
    // „Rom“ ist bekannt, „Rok“ (3 Zeichen) darf nicht per Tippfehler passen.
    expect(lookupDetail("stadt", "Rok").kind).not.toBe("typo");
  });

  it("Flexion", () => {
    expect(lookupDetail("tier", "Elefanten")).toMatchObject({ result: "known" });
    expect(lookupDetail("beruf", "Bäckerin")).toMatchObject({ result: "known" });
    expect(lookupDetail("obstgemuese", "Äpfel")).toMatchObject({ result: "known" });
    expect(flexCandidates("baeckerin", "person")).toContain("baecker");
    expect(flexCandidates("aerztin", "person")).toContain("arzt");
    expect(flexCandidates("aepfel", "noun")).toContain("apfel");
    expect(flexCandidates("rhein", "none")).toEqual([]);
  });

  it("Komposita nur in den vorgesehenen Kategorien", () => {
    expect(lookupDetail("tier", "Riesenschildkröte").result).toBe("known");
    expect(lookupDetail("getraenk", "Zitronenlimonade").result).toBe("known");
    // Stadt hat keine Komposita-Regel: „Superberlin“ ist keine Stadt.
    expect(lookupAnswer("stadt", "Superberlin")).toBe("unknown");
  });

  it("Ausschlussliste greift", () => {
    expect(lookupAnswer("stadt", "Haus")).toBe("unknown");
    expect(lookupAnswer("fluss", "Fluss")).toBe("unknown");
  });
});

describe("Damerau-Levenshtein (begrenzt)", () => {
  it("rechnet richtig", () => {
    expect(boundedDistance("hamburg", "hamburg", 2)).toBe(0);
    expect(boundedDistance("hamburg", "hambrug", 2)).toBe(1); // Vertauschung
    expect(boundedDistance("hamburg", "hamburgg", 2)).toBe(1);
    expect(boundedDistance("hamburg", "hmburg", 2)).toBe(1);
    expect(boundedDistance("hamburg", "hanburk", 2)).toBe(2);
    expect(boundedDistance("hamburg", "bremen", 2)).toBe(3); // > max → max + 1
  });
});

describe("Performance", () => {
  it("Aufbau einer großen Kategorie < 2 s und Abfragen im Mittel < 2 ms", () => {
    const t0 = performance.now();
    lexiconSize("stadt");
    const build = performance.now() - t0;
    // Großzügige Grenze (CI/Testumgebung); Ziel im Betrieb: wenige hundert ms.
    expect(build).toBeLessThan(2000);

    const words = ["Berlin", "Hamburgg", "Quatschstadt", "Mailand", "Xyzabcdefgh", "Frankfrut", "Bad Homburg", "Hausen", "Neustadt", "Zzzzzzzzzz"];
    for (const c of ["stadt", "tier", "name", "beruf", "fluss"] as const) lexiconSize(c);
    const n = 200;
    const t1 = performance.now();
    for (let i = 0; i < n; i++) {
      for (const c of ["stadt", "tier", "name", "beruf", "fluss"] as const) lookupAnswer(c, words[i % words.length]!);
    }
    const perQuery = (performance.now() - t1) / (n * 5);
    expect(perQuery).toBeLessThan(2);
  });
});
