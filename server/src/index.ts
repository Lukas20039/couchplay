// Einstiegspunkt: Config laden, App starten, sauber herunterfahren
// (SIGTERM/SIGINT: Clients erhalten room.closed{server_shutdown}, Sockets werden geschlossen).
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = await buildApp(config);

let stopping = false;
const shutdown = async (signal: string): Promise<void> => {
  if (stopping) return;
  stopping = true;
  app.log.info({ signal }, "Server fährt herunter");
  // Notbremse, falls etwas hängt.
  setTimeout(() => {
    app.log.error("Shutdown dauert zu lange – erzwinge Beenden");
    process.exit(1);
  }, 10_000).unref();
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "Fehler beim Herunterfahren");
    process.exit(1);
  }
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.port, host: config.host });
app.log.info({ publicUrl: config.publicUrl ?? "(aus Request)", devMode: config.devMode }, "CouchPlay-Server bereit");
