import { describe, expect, it } from "vitest";
import {
  AVATAR_EMOJI,
  AVATAR_FALLBACK_EMOJI,
  AVATAR_IDS,
  BOT_EMOJI,
  GameManifestSchema,
  avatarEmoji,
  NAME_MAX_LENGTH,
  RECONNECT_BACKOFF_MAX_MS,
  buildJoinUrl,
  defaultSettings,
  isValidRoomCode,
  nameKey,
  normalizeName,
  parseJoinPath,
  reconnectDelayMs,
  relockSettings,
  sanitizeRoomCodeInput,
  unlockedFields,
  unlockedOptions,
  validateSettings,
  type SettingField,
} from "../src/index.js";

const fields: SettingField[] = [
  { type: "select", key: "difficulty", label: "Stärke", options: [{ value: "leicht", label: "L" }, { value: "schwer", label: "S" }], default: "leicht" },
  {
    type: "multiselect",
    key: "categories",
    label: "Kategorien",
    options: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }],
    default: ["a", "b"],
    minSelected: 1,
    maxSelected: 2,
  },
  { type: "number", key: "rounds", label: "Runden", min: 5, max: 20, step: 5, default: 10 },
  { type: "toggle", key: "bonus", label: "Bonus", default: true },
];

describe("Settings", () => {
  it("liefert Defaults", () => {
    expect(defaultSettings(fields)).toEqual({ difficulty: "leicht", categories: ["a", "b"], rounds: 10, bonus: true });
  });

  it("mergt gültige Teil-Updates", () => {
    const res = validateSettings(fields, { rounds: 15, categories: ["c"] });
    expect(res).toEqual({ ok: true, settings: { difficulty: "leicht", categories: ["c"], rounds: 15, bonus: true } });
  });

  it("verwendet base als Ausgangswert", () => {
    const res = validateSettings(fields, { bonus: false }, { rounds: 20, legacy: "weg" });
    expect(res).toEqual({ ok: true, settings: { difficulty: "leicht", categories: ["a", "b"], rounds: 20, bonus: false } });
  });

  it.each([
    [{ difficulty: "mittel" }],
    [{ difficulty: 3 }],
    [{ categories: [] }],
    [{ categories: ["a", "b", "c"] }],
    [{ categories: ["a", "a"] }],
    [{ categories: ["x"] }],
    [{ rounds: 7 }],
    [{ rounds: 25 }],
    [{ rounds: Number.NaN }],
    [{ bonus: "ja" }],
    [{ unbekannt: 1 }],
  ])("lehnt %j ab", (input) => {
    expect(validateSettings(fields, input as never).ok).toBe(false);
  });
});

describe("Manifest", () => {
  const base = { id: "quiz", name: "Quiz", description: "", version: "1.0.0", minPlayers: 1, maxPlayers: 8, botSupport: false, settings: fields };

  it("akzeptiert gültiges Manifest", () => {
    expect(GameManifestSchema.safeParse(base).success).toBe(true);
  });

  it("akzeptiert optionales Icon bis 16 Zeichen", () => {
    expect(GameManifestSchema.safeParse({ ...base, icon: "🧠" }).success).toBe(true);
    expect(GameManifestSchema.safeParse({ ...base, icon: "" }).success).toBe(false);
    expect(GameManifestSchema.safeParse({ ...base, icon: "x".repeat(17) }).success).toBe(false);
  });

  it("lehnt min > max, doppelte Keys und zu viele Spieler ab", () => {
    expect(GameManifestSchema.safeParse({ ...base, minPlayers: 3, maxPlayers: 2 }).success).toBe(false);
    expect(GameManifestSchema.safeParse({ ...base, maxPlayers: 9 }).success).toBe(false);
    expect(GameManifestSchema.safeParse({ ...base, settings: [fields[0], fields[0]] }).success).toBe(false);
  });
});

describe("Avatare", () => {
  it("hat für jede Avatar-ID ein eindeutiges Emoji, Bot-Emoji kollidiert nicht", () => {
    expect(Object.keys(AVATAR_EMOJI).sort()).toEqual([...AVATAR_IDS].sort());
    const emojis = Object.values(AVATAR_EMOJI);
    expect(new Set(emojis).size).toBe(emojis.length);
    expect(emojis).not.toContain(BOT_EMOJI);
    expect(emojis).not.toContain(AVATAR_FALLBACK_EMOJI);
  });

  it("avatarEmoji mit Fallback", () => {
    expect(avatarEmoji("fuchs")).toBe("🦊");
    expect(avatarEmoji("drache")).toBe(AVATAR_FALLBACK_EMOJI);
    expect(avatarEmoji("toString")).toBe(AVATAR_FALLBACK_EMOJI);
  });
});

describe("Codes und URLs", () => {
  it("prüft Raumcodes", () => {
    expect(isValidRoomCode("000123")).toBe(true);
    expect(isValidRoomCode("12345")).toBe(false);
    expect(isValidRoomCode("1234567")).toBe(false);
    expect(sanitizeRoomCodeInput(" 123 4567x")).toBe("123456");
  });

  it("baut und parst Join-Links", () => {
    expect(buildJoinUrl("https://play.example.org/", "012345")).toBe("https://play.example.org/j/012345");
    expect(parseJoinPath("/j/012345")).toBe("012345");
    expect(parseJoinPath("/j/012345/")).toBe("012345");
    expect(parseJoinPath("/j/12a456")).toBeNull();
    expect(parseJoinPath("/tv/")).toBeNull();
  });
});

describe("Namen", () => {
  it("normalisiert Whitespace und Steuerzeichen", () => {
    expect(normalizeName("  Anna \n  Lena​ ")).toEqual({ ok: true, name: "Anna Lena" });
    expect(normalizeName("‮evil")).toEqual({ ok: true, name: "evil" });
  });

  it("prüft Länge in Codepoints", () => {
    expect(normalizeName("   ")).toEqual({ ok: false, reason: "empty" });
    expect(normalizeName("😀".repeat(NAME_MAX_LENGTH)).ok).toBe(true);
    expect(normalizeName("x".repeat(NAME_MAX_LENGTH + 1))).toEqual({ ok: false, reason: "too_long" });
  });

  it("vergleicht Namen ohne Groß-/Kleinschreibung", () => {
    expect(nameKey("ANNA")).toBe(nameKey("anna"));
  });
});

describe("Reconnect-Backoff", () => {
  it("wächst exponentiell und ist gedeckelt", () => {
    const mid = () => 0.5;
    expect(reconnectDelayMs(0, mid)).toBe(500);
    expect(reconnectDelayMs(1, mid)).toBe(1000);
    expect(reconnectDelayMs(20, mid)).toBe(RECONNECT_BACKOFF_MAX_MS);
    expect(reconnectDelayMs(0, () => 0)).toBe(400);
  });
});

describe("Freischaltungen (minProgress)", () => {
  const locked: SettingField[] = [
    {
      type: "select",
      key: "mode",
      label: "Modus",
      options: [{ value: "normal", label: "N" }, { value: "blitz", label: "B", minProgress: 100 }],
      default: "normal",
    },
    {
      type: "multiselect",
      key: "packs",
      label: "Pakete",
      options: [{ value: "a", label: "A" }, { value: "b", label: "B", minProgress: 50 }],
      default: ["a"],
    },
  ];

  it("zeigt nur freigeschaltete Optionen", () => {
    expect(unlockedOptions((locked[0] as { options: { value: string }[] }).options, 99).map((o) => o.value)).toEqual(["normal"]);
    expect(unlockedOptions((locked[0] as { options: { value: string }[] }).options, 100).map((o) => o.value)).toEqual(["normal", "blitz"]);
  });

  it("Formular: Auswahl mit nur einer freien Option entfällt", () => {
    expect(unlockedFields(locked, 60).map((f) => f.key)).toEqual(["packs"]);
    expect(unlockedFields(locked, 0).map((f) => f.key)).toEqual(["packs"]);
    expect(unlockedFields(locked, 100)).toEqual(locked);
  });

  it("lehnt gesperrte Optionen ab, ohne Fortschritt ist alles erlaubt", () => {
    expect(validateSettings(locked, { mode: "blitz" }, undefined, 10).ok).toBe(false);
    expect(validateSettings(locked, { packs: ["a", "b"] }, undefined, 10).ok).toBe(false);
    expect(validateSettings(locked, { mode: "blitz" }, undefined, 100).ok).toBe(true);
    expect(validateSettings(locked, { mode: "blitz" }).ok).toBe(true);
  });

  it("setzt gesperrte Werte auf den Default zurück", () => {
    expect(relockSettings(locked, { mode: "blitz", packs: ["a", "b"] }, 60)).toEqual({ mode: "normal", packs: ["a", "b"] });
    expect(relockSettings(locked, { mode: "blitz", packs: ["a", "b"] }, 0)).toEqual({ mode: "normal", packs: ["a"] });
  });

  it("Manifest: Default-Option darf nicht gesperrt sein", () => {
    const base = { id: "demo", name: "Demo", description: "", version: "1.0.0", minPlayers: 1, maxPlayers: 2, botSupport: false };
    expect(GameManifestSchema.safeParse({ ...base, progressKey: "demo.xp", settings: locked }).success).toBe(true);
    const bad = [{ ...locked[0]!, default: "blitz" }];
    expect(GameManifestSchema.safeParse({ ...base, settings: bad }).success).toBe(false);
  });
});
