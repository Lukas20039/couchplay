# Lizenz der Wortliste

`src/server/wordlist.data.ts` ist aus dem Wörterbuch **german-pos-dict** von
[LanguageTool](https://github.com/languagetool-org/german-pos-dict) abgeleitet
(Autoren: LanguageTool-Projekt, Daniel Naber u. a.).

- Lizenz: [Creative Commons Namensnennung – Weitergabe unter gleichen Bedingungen 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/deed.de)
- Änderungen: nur Wortformen (ohne Wortart-Tags), Eigennamen, Abkürzungen und substantivierte
  Adjektive entfernt, in Großbuchstaben umgewandelt, ß → SS, Länge 3–16, front-codiert
  (siehe `tools/build-wordlist.mjs`).

Die abgeleitete Wortliste steht ebenfalls unter **CC BY-SA 4.0**. Der übrige Code von CouchPlay
bleibt unter der MIT-Lizenz (siehe `LICENSE` im Repository-Root).
