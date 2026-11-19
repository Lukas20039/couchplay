# Credits & Datenquellen

Weitere Herkunftsangaben: Musik → [`tv-web/public/music/CREDITS.md`](tv-web/public/music/CREDITS.md),
Wortgarten-Wörterbuch → [`games/wortgarten/DATA-LICENSE.md`](games/wortgarten/DATA-LICENSE.md).

## Stadt, Land, Fluss – Lexikon-Prüfung

Die Wortlisten unter `games/stadtland/src/server/lexicon/data/` werden von
`games/stadtland/scripts/build-lexicon.mjs` aus folgenden Quellen erzeugt:

- **GeoNames** – Städtelisten `cities15000` und `cities5000`
  (<https://www.geonames.org/>, Download: <https://download.geonames.org/export/dump/>).
  Lizenz: [Creative Commons Attribution 4.0 (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
  Verwendet werden nur Ortsnamen (Name, ASCII-Name), gefiltert nach Einwohnerzahl/Land; verändert
  (bereinigt, dedupliziert, sortiert) und mit Wikidata-Bezeichnungen zusammengeführt.
- **Wikidata** (<https://www.wikidata.org/>, SPARQL-Endpunkt <https://query.wikidata.org/>) –
  Bezeichnungen und Aliasse von Gemeinden (DE/AT/CH), Städten, Staaten, Fließgewässern, Vornamen,
  Berufen, Tieren, Marken und Musiker:innen/Bands. Lizenz der Daten:
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (keine Namensnennung nötig, hier
  dennoch aufgeführt).

Die handkuratierten Ergänzungen unter `games/stadtland/src/server/lexicon/extra/` sind Teil dieses
Repositorys (MIT).
