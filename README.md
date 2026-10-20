# CouchPlay

Android TV als Spielkonsole, Smartphones als Controller (PWA). Vorbild: Jackbox / Netflix Games.

- Auftrag: [`docs/PLAN.md`](docs/PLAN.md) · Architektur: [`docs/architecture.md`](docs/architecture.md) · Protokoll: [`docs/protocol.md`](docs/protocol.md) · Regeln für Agents: [`AGENTS.md`](AGENTS.md)

## Schnellstart

```bash
npm install --include=dev   # NODE_ENV=production in der Shell!
npm run typecheck
npm test
npm run build               # Server-Bundle + tv-web + controller-pwa
npm start                   # http://localhost:8080  (TV: /tv/, Handy: /)
```

Entwicklung: `npm run dev` (Server, Port 8080), `npm run dev:tv` (5173), `npm run dev:controller` (5174).

ENV: `PUBLIC_URL`, `PORT`, `TRUST_PROXY`, `LOG_LEVEL`.
