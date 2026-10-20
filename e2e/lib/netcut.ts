// TCP-Durchreiche zwischen einem Handy-Kontext und dem Server, die sich „durchschneiden“ lässt.
// Simuliert einen echten Netzabbruch (WLAN weg): bestehende Verbindungen sterben ohne Close-Frame
// (Code 1006 auf beiden Seiten), neue werden abgewiesen. `context.setOffline()` allein reicht dafür
// nicht – Chromium und WebKit lassen bestehende WebSockets dabei offen.
import net from "node:net";

export class NetCut {
  private readonly sockets = new Set<net.Socket>();
  private server: net.Server | null = null;
  private down = false;
  port = 0;

  constructor(
    private readonly targetPort: number,
    private readonly targetHost = "127.0.0.1",
  ) {}

  async start(): Promise<string> {
    this.server = net.createServer((client) => {
      if (this.down) {
        client.destroy();
        return;
      }
      const upstream = net.connect(this.targetPort, this.targetHost);
      for (const s of [client, upstream]) {
        this.sockets.add(s);
        s.on("close", () => this.sockets.delete(s));
        s.on("error", () => undefined);
      }
      client.pipe(upstream);
      upstream.pipe(client);
      client.on("close", () => upstream.destroy());
      upstream.on("close", () => client.destroy());
    });
    await new Promise<void>((resolve) => this.server!.listen(0, "127.0.0.1", resolve));
    this.port = (this.server.address() as net.AddressInfo).port;
    return `http://127.0.0.1:${this.port}`;
  }

  /** Netz weg: alle Verbindungen hart trennen, neue abweisen. */
  cut(): void {
    this.down = true;
    for (const s of this.sockets) s.destroy();
    this.sockets.clear();
  }

  /** Netz wieder da. */
  restore(): void {
    this.down = false;
  }

  async stop(): Promise<void> {
    this.cut();
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
