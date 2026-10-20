# CouchPlay – Deployment

Der Game-Server ist ein einzelner Container. Er liefert die TV-Web-UI (`/tv/`), die
Controller-PWA (`/`, `/j/<code>`), den WebSocket-Endpoint (`/ws`), den Spielkatalog
(`/api/catalog`) und den Healthcheck (`/healthz`). Räume liegen nur im Speicher –
eine Instanz pro Domain, kein Sticky-Session-Cluster.

## Image

- Registry: `ghcr.io/<owner>/couchplay` (GitHub Actions, `.github/workflows/docker.yml`)
- Tags: `latest` (Branch `main`), `1.2.3` / `1.2` / `1` (Git-Tags `v1.2.3`), `sha-<kurz>`
- Plattformen: `linux/amd64`, `linux/arm64` (z. B. Raspberry Pi 4/5)
- Läuft als Benutzer `node` (UID 1000), Port `8080`, `HEALTHCHECK` auf `/healthz`
- `SIGTERM` → Graceful Shutdown: alle Clients erhalten `room.closed{server_shutdown}`,
  Sockets werden geschlossen (max. ~10 s). `stop_grace_period` ≥ 15 s setzen.

Lokal bauen und starten:

```bash
docker build -t couchplay:dev .
docker run --rm -p 8080:8080 -e PUBLIC_URL=http://192.168.1.10:8080 couchplay:dev
curl http://localhost:8080/healthz      # {"ok":true,...}
```

## Umgebungsvariablen

| Variable | Default | Bedeutung |
|---|---|---|
| `PUBLIC_URL` | *(leer)* | Öffentliche Basis-URL, z. B. `https://play.example.org`. Daraus entstehen Join-Links und QR-Codes (`${PUBLIC_URL}/j/<code>`). Leer: wird pro Raum aus dem Request des TVs abgeleitet (`Host` bzw. `X-Forwarded-Host`/`-Proto` bei vertrauenswürdigem Proxy). Für Produktion **setzen**. |
| `PORT` | `8080` | HTTP-Port im Container. |
| `HOST` | `0.0.0.0` | Bind-Adresse. |
| `TRUST_PROXY` | `false` | `X-Forwarded-*` vertrauen: `true`, Anzahl Proxy-Hops (z. B. `1`) oder kommagetrennte IPs/CIDRs (`10.0.0.0/8,172.16.0.0/12`). Nötig, damit die Rate-Limits pro Client-IP greifen und nicht pro Proxy. |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. Logs sind JSON (pino), mit Feld `room` pro Raum. |
| `ALLOWED_ORIGINS` | *(leer)* | Zusätzliche erlaubte Origins für das WebSocket-Upgrade (kommagetrennt, `*` = alle). Immer erlaubt: gleiche Origin wie der aufgerufene Host, Origin von `PUBLIC_URL`, Clients ohne `Origin`-Header. |
| `NODE_ENV` | `production` (im Image) | Außerhalb von `production` (Dev-Modus) ist jede WS-Origin erlaubt. |

Ungültige Werte führen beim Start zu einer klaren Fehlermeldung (zod-Validierung).

## HTTPS ist Pflicht

- **iOS** installiert die Controller-PWA („Zum Home-Bildschirm") nur über HTTPS, Service
  Worker und `wss://` brauchen einen sicheren Kontext.
- Der Server selbst spricht nur HTTP. TLS übernimmt ein Reverse-Proxy davor.
- Der Proxy muss **WebSocket-Upgrades** auf `/ws` durchreichen und lange Verbindungen
  erlauben (Server-Heartbeat alle 15 s, Timeout ≥ 60 s genügt).
- `TRUST_PROXY` passend setzen (bei genau einem Proxy: `1`).
- Die Android-TV-App lädt `${Server-URL}/tv/` – dieselbe Origin wie der WebSocket.
  Server-URL in der App = `PUBLIC_URL`.

## Reverse-Proxy-Beispiele

### Caddy (empfohlen, automatische Zertifikate)

Fertiges Compose-Beispiel: [`docker-compose.example.yml`](../docker-compose.example.yml).
Als `Caddyfile`:

```caddyfile
play.example.org {
	encode zstd gzip
	reverse_proxy couchplay:8080
}
```

Caddy reicht WebSocket-Upgrades automatisch durch und setzt `X-Forwarded-For/-Proto/-Host`.

### Traefik (Docker-Labels)

```yaml
services:
  couchplay:
    image: ghcr.io/OWNER/couchplay:latest
    environment:
      PUBLIC_URL: https://play.example.org
      TRUST_PROXY: "1"
    labels:
      - traefik.enable=true
      - traefik.http.routers.couchplay.rule=Host(`play.example.org`)
      - traefik.http.routers.couchplay.entrypoints=websecure
      - traefik.http.routers.couchplay.tls.certresolver=letsencrypt
      - traefik.http.services.couchplay.loadbalancer.server.port=8080
```

Traefik leitet WebSockets ohne Zusatzkonfiguration weiter.

### nginx

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    http2 on;
    server_name play.example.org;
    ssl_certificate     /etc/letsencrypt/live/play.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/play.example.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }

    location = /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

## Betrieb im Heimnetz (ohne Domain)

Zum Ausprobieren reicht HTTP im LAN: `PUBLIC_URL=http://<LAN-IP>:8080`, Port freigeben,
in der TV-App dieselbe URL eintragen. Android-Handys funktionieren im Browser; die
iOS-PWA-Installation und Service Worker stehen dann nicht zur Verfügung.

## Sicherheit & Grenzen (Server-seitig)

- Sicherheitsheader: CSP (nur eigene Skripte, `ws:`/`wss:` zur selben Origin),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`.
- Rate-Limits pro Client-IP: Join-/Rejoin-/Resume-Versuche 10 (+10/min), Raumerstellung 5 (+5/min),
  32 gleichzeitige Verbindungen; pro Verbindung 40 Nachrichten (+20/s). Max. 1000 Räume,
  Nachrichten ≤ 16 KiB. Räume schließen nach 2 h ohne Aktivität.
- Cache: `index.html`, Service Worker und `*.webmanifest` mit `no-cache`, gehashte Assets
  unter `/assets/` mit `immutable` (1 Jahr) – ein CDN/Proxy darf das übernehmen.

## Release

- Docker: Push auf `main` → `latest`; Git-Tag `v1.2.3` → Versions-Tags.
- APK: Git-Tag `v*` (oder manuell) → `.github/workflows/apk.yml` baut die Android-TV-App und
  hängt sie an das GitHub-Release. Secrets: `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (fehlen sie, entsteht
  eine Debug-APK). Repository-Variable `COUCHPLAY_SERVER_URL` = Default-Server-URL der App.
