// Reine Regeln: Normalisierung, automatische Prüfung, Wertung einer Kategorie, Auswahl von Kategorien/Buchstaben.
import { createRng } from "@couchplay/game-sdk";
import { describe, expect, it } from "vitest";
import { ANSWER_MAX, CATEGORY_IDS, LETTERS, SETS, type CategoryId } from "../src/constants.js";
import { CATEGORY_LABELS, SET_LABELS } from "../src/i18n/de.js";
import { answerKey, checkAnswer, cleanAnswer } from "../src/normalize.js";
import { computeAwards, neededVotes, pickCategories, pickLetter, scoreCategory } from "../src/scoring.js";

describe("Normalisierung", () => {
  it("Groß/klein, Umlaute/ß, Akzente, Satzzeichen, Leerzeichen und führende Artikel sind egal", () => {
    expect(answerKey("Der Rhein!")).toBe("rhein");
    expect(answerKey("  die   MOSEL ")).toBe("mosel");
    expect(answerKey("Das Boot")).toBe("boot");
    expect(answerKey("Österreich")).toBe("oesterreich");
    expect(answerKey("Oesterreich")).toBe("oesterreich");
    expect(answerKey("Gießen")).toBe(answerKey("Giessen"));
    expect(answerKey("Crème brûlée")).toBe("cremebrulee");
    expect(answerKey("St. Gallen")).toBe(answerKey("st gallen"));
    expect(answerKey("Ein Hamster")).toBe("hamster");
    // Ein Artikel allein bleibt stehen.
    expect(answerKey("Die")).toBe("die");
  });

  it("cleanAnswer: Leerraum zusammenfassen, Steuerzeichen raus, auf 30 Zeichen kürzen", () => {
    expect(cleanAnswer("  Bad \n  Tölz​ ")).toBe("Bad Tölz");
    expect([...cleanAnswer("x".repeat(50))]).toHaveLength(ANSWER_MAX);
    expect(cleanAnswer("   ")).toBe("");
  });

  it("automatische Prüfung: leer, zu kurz, falscher Buchstabe; Artikel und Umlaute beachtet", () => {
    expect(checkAnswer("", "B")).toBe("empty");
    expect(checkAnswer("  ", "B")).toBe("empty");
    expect(checkAnswer("?!", "B")).toBe("short");
    expect(checkAnswer("B", "B")).toBe("short");
    expect(checkAnswer("Berlin", "B")).toBe("ok");
    expect(checkAnswer("berlin", "B")).toBe("ok");
    expect(checkAnswer("Hamburg", "B")).toBe("letter");
    expect(checkAnswer("Der Rhein", "R")).toBe("ok");
    expect(checkAnswer("Der Rhein", "D")).toBe("letter");
    expect(checkAnswer("Ölmühle", "O")).toBe("ok");
    expect(checkAnswer("Überlingen", "U")).toBe("ok");
    expect(checkAnswer("Ärger", "A")).toBe("ok");
  });
});

describe("Wertung einer Kategorie", () => {
  const ids = ["p1", "p2", "p3", "p4"];
  const none = new Map<string, Set<string>>();
  const score = (texts: string[], letter = "B", challenges = none, voters = ids.slice(0, texts.length)) =>
    scoreCategory(
      texts.map((text, i) => ({ playerId: ids[i]!, text })),
      letter,
      challenges,
      voters,
    );

  it("einzigartig 10, doppelt (normalisiert gleich) 5, ungültig und leer 0", () => {
    const e = score(["Berlin", "Der Bodensee", "bodensee!", ""]);
    expect(e.map((x) => [x.status, x.points, x.shared])).toEqual([
      ["ok", 10, false],
      ["ok", 5, true],
      ["ok", 5, true],
      ["empty", 0, false],
    ]);
    expect(score(["Berlin", "Hamburg"]).map((x) => [x.status, x.points])).toEqual([
      ["ok", 20],
      ["letter", 0],
    ]);
  });

  it("als Einzige:r mit gültiger Antwort 20 – zwei Gleiche sind nicht „einzig“", () => {
    expect(score(["Bonn", "", "Köln"]).map((x) => x.points)).toEqual([20, 0, 0]);
    expect(score(["Bonn", "bonn", ""]).map((x) => x.points)).toEqual([5, 5, 0]);
  });

  it("Anfechtung: Mehrheit der Nicht-Autoren streicht; gleiche Antworten werden gemeinsam angefochten", () => {
    // p2 „Bonn“: stimmberechtigt p1, p3, p4 → 2 Daumen nötig.
    const one = new Map([["bonn", new Set(["p1"])]]);
    let e = score(["Berlin", "Bonn", "Bremen", ""], "B", one);
    expect([e[1]!.status, e[1]!.votes, e[1]!.needed]).toEqual(["ok", 1, 2]);
    const two = new Map([["bonn", new Set(["p1", "p3"])]]);
    e = score(["Berlin", "Bonn", "Bremen", ""], "B", two);
    expect([e[1]!.status, e[1]!.points]).toEqual(["rejected", 0]);
    // Gruppe „Bonn“ von p1 + p2: nur p3, p4 stimmberechtigt (2 → 2 nötig); Stimmen der Autoren zählen nicht.
    const group = new Map([["bonn", new Set(["p1", "p2", "p3"])]]);
    e = score(["Bonn", "Bonn", "Bremen", "Bochum"], "B", group);
    expect(e.map((x) => [x.status, x.votes, x.needed])).toEqual([
      ["ok", 1, 2],
      ["ok", 1, 2],
      ["ok", 0, 2],
      ["ok", 0, 2],
    ]);
    // Gestrichene Antworten zählen nicht für „einzig“: übrig bleibt p3 → 20.
    e = score(["Bonn", "Bonn", "Bremen", ""], "B", new Map([["bonn", new Set(["p3", "p4"])]]));
    expect(e.map((x) => [x.status, x.points])).toEqual([
      ["rejected", 0],
      ["rejected", 0],
      ["ok", 20],
      ["empty", 0],
    ]);
  });

  it("Stimmen von Nicht-Stimmberechtigten (gegangen) zählen nicht; ohne Stimmberechtigte nicht anfechtbar", () => {
    const e = score(["Bonn", "Bremen"], "B", new Map([["bonn", new Set(["p2", "p9"])]]), ["p1", "p2"]);
    expect([e[0]!.status, e[0]!.votes, e[0]!.needed]).toEqual(["rejected", 1, 1]);
    const solo = score(["Bonn", "Bonn"], "B", new Map([["bonn", new Set(["p1"])]]));
    expect(solo.map((x) => [x.needed, x.status])).toEqual([
      [null, "ok"],
      [null, "ok"],
    ]);
    expect([0, 1, 2, 3, 7].map(neededVotes)).toEqual([null, 1, 2, 2, 4]);
  });
});

describe("Auswahl", () => {
  it("Buchstaben: ohne seltene, ohne Wiederholung; Vorrunde wird gemieden, solange es geht", () => {
    for (const rare of ["C", "J", "Q", "V", "X", "Y"]) expect(LETTERS).not.toContain(rare);
    const rng = createRng(3);
    const used = new Set<string>();
    for (let i = 0; i < LETTERS.length; i++) {
      const l = pickLetter(LETTERS, used, new Set(), rng)!;
      expect(used.has(l)).toBe(false);
      used.add(l);
    }
    expect(pickLetter(LETTERS, used, new Set(), rng)).toBeNull();
    const avoid = new Set(LETTERS.slice(0, -1));
    expect(pickLetter(LETTERS, new Set(), avoid, createRng(1))).toBe(LETTERS.at(-1));
    expect(pickLetter(LETTERS, new Set(LETTERS.slice(1)), new Set(LETTERS), createRng(1))).toBe(LETTERS[0]);
  });

  it("Kategorien: am seltensten gespielte zuerst, Ergebnis in Pool-Reihenfolge", () => {
    const pool = SETS.quatsch;
    const usage = new Map<CategoryId, number>();
    const rng = createRng(5);
    const seen = new Set<CategoryId>();
    for (let r = 0; r < 2; r++) {
      const cats = pickCategories(pool, 5, usage, rng);
      expect(cats).toHaveLength(5);
      expect(cats).toEqual(pool.filter((c) => cats.includes(c)));
      for (const c of cats) {
        usage.set(c, (usage.get(c) ?? 0) + 1);
        seen.add(c);
      }
    }
    // 10 Kategorien, 2 × 5 → alle einmal.
    expect(seen.size).toBe(pool.length);
    expect(pickCategories(SETS.klassisch, 6, usage, rng)).toEqual(["stadt", "land", "fluss", "name", "beruf", "tier"]);
  });

  it("jedes Set hat genug Kategorien, jede Kategorie einen Text", () => {
    for (const [id, cats] of Object.entries(SETS)) {
      expect(cats.length, id).toBeGreaterThanOrEqual(6);
      expect(SET_LABELS[id as keyof typeof SET_LABELS]).toBeTruthy();
    }
    for (const c of CATEGORY_IDS) expect(CATEGORY_LABELS[c]).toBeTruthy();
    expect(SETS.quatsch.map((c) => CATEGORY_LABELS[c])).toContain("Ausrede fürs Zuspätkommen");
    expect(SETS.quatsch.map((c) => CATEGORY_LABELS[c])).toContain("Etwas, das man nicht in die Hosentasche steckt");
  });

  it("Auszeichnungen: Bestwert ≥ 1, Gleichstand → mehrere", () => {
    expect(
      computeAwards([
        { id: "p1", solos: 2, stops: 1, challenges: 0 },
        { id: "p2", solos: 2, stops: 0, challenges: 0 },
      ]),
    ).toEqual([
      { kind: "solo", playerIds: ["p1", "p2"], count: 2 },
      { kind: "stopper", playerIds: ["p1"], count: 1 },
    ]);
  });
});
