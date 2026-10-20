// Startentscheidung für alle QR-/Link-Varianten (a–g aus dem Nutzerbericht).
import { describe, expect, it } from "vitest";
import { decideStart, usableProfile } from "../src/lib/start.js";
import { TOKEN } from "./helpers.js";

const LINK = "/j/042137";
const sameRoom = { code: "042137", playerId: "p1", token: TOKEN };
const otherRoom = { code: "111111", playerId: "p9", token: TOKEN };
const profile = { name: "Anna", avatar: "eule" as const };

describe("decideStart", () => {
  it("a) frisches Handy: Name/Avatar-Seite mit festem Code", () => {
    expect(decideStart(LINK, null, {})).toEqual({ plan: { kind: "profile", code: "042137" }, discardSession: false });
  });

  it("a') wiederkehrend (Profil gespeichert): sofort beitreten", () => {
    expect(decideStart(LINK, null, profile)).toEqual({
      plan: { kind: "autoJoin", code: "042137", name: "Anna", avatar: "eule" },
      discardSession: false,
    });
  });

  it("b/c) Sitzung eines anderen Raums (alt oder aktiv): Link hat Vorrang, Sitzung wird verworfen", () => {
    expect(decideStart(LINK, otherRoom, {})).toEqual({ plan: { kind: "profile", code: "042137" }, discardSession: true });
    expect(decideStart(LINK, otherRoom, profile)).toMatchObject({ plan: { kind: "autoJoin", code: "042137" }, discardSession: true });
  });

  it("e) gleicher Raum: rejoin mit Token statt neuem Spieler", () => {
    expect(decideStart(LINK, sameRoom, profile)).toEqual({ plan: { kind: "resume", session: sameRoom }, discardSession: false });
  });

  it("f) abschließender Slash (Query/Hash sind nicht Teil von pathname)", () => {
    expect(decideStart("/j/042137/", null, profile).plan).toMatchObject({ kind: "autoJoin", code: "042137" });
  });

  it("g) ungültiger Code im Pfad: Code-Eingabe mit Hinweis", () => {
    for (const p of ["/j/12ab56", "/j/12345", "/j/1234567", "/j/", "/j"]) {
      expect(decideStart(p, null, profile)).toEqual({ plan: { kind: "code", invalidLink: true }, discardSession: false });
    }
    // … außer es läuft noch eine Sitzung: dann dorthin zurück.
    expect(decideStart("/j/12ab56", sameRoom, {}).plan.kind).toBe("resume");
  });

  it("Startseite ohne Link: Sitzung aufnehmen bzw. Code-Eingabe", () => {
    expect(decideStart("/", sameRoom, profile).plan.kind).toBe("resume");
    expect(decideStart("/", null, profile)).toEqual({ plan: { kind: "code", invalidLink: false }, discardSession: false });
  });

  it("unbrauchbares Profil (leerer/zu langer Name) → kein Auto-Join", () => {
    expect(usableProfile({ name: "  ", avatar: "eule" })).toBeNull();
    expect(usableProfile({ name: "x".repeat(17), avatar: "eule" })).toBeNull();
    expect(usableProfile({ name: "Anna" })).toBeNull();
    expect(decideStart(LINK, null, { name: "", avatar: "eule" }).plan.kind).toBe("profile");
  });
});
