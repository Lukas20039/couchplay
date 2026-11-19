// Ausschlussliste: Antworten, die NIE automatisch als „known“ gelten – auch wenn sie zufällig in einer
// erzeugten Liste stehen (z. B. gibt es in der Steiermark eine Gemeinde „Haus“). Wer so etwas ernst
// meint, kann von der Mehrheit gerettet werden.
// Format: „kategorie: Eintrag“, ein Eintrag pro Zeile, „#“ = Kommentar.
export default `
stadt: Haus
stadt: Hund
stadt: Katze
stadt: Auto
stadt: Baum
stadt: Brot
stadt: Wasser
stadt: Stadt
stadt: Dorf
land: Land
fluss: Fluss
fluss: Bach
fluss: Wasser
tier: Tier
name: Name
beruf: Beruf
# Bekannte Fehltreffer über die Tippfehler-Toleranz (Hammer ≈ Hummer, Haus ≈ Hausen …)
gericht: Hammer
tier: Haus
tier: Hause
`;
