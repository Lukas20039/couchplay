// Test-Helfer: echter Server auf zufälligem Port, echte ws-Clients.
import type { AddressInfo } from "node:net";
import { PROTOCOL_VERSION, type ServerMessage, type ServerMessageOf, type ServerMessageType } from "@couchplay/protocol";
import type { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { buildApp, type AppOptions } from "../src/app.js";
import { loadConfig, type ServerConfig } from "../src/config.js";
import { testGame } from "./fixtures/test-game.js";

export interface TestServer {
  app: FastifyInstance;
  url: string;
  wsUrl: string;
  close(): Promise<void>;
}

const NO_STATIC = { tv: "/nonexistent/tv", controller: "/nonexistent/controller" };

export async function startServer(
  opts: { config?: Partial<ServerConfig>; options?: AppOptions } = {},
): Promise<TestServer> {
  const config: ServerConfig = {
    ...loadConfig({ NODE_ENV: "production", PUBLIC_URL: "https://play.example.org" }),
    logLevel: "silent",
    ...opts.config,
  };
  const app = await buildApp(config, { games: [testGame], staticDirs: NO_STATIC, ...opts.options });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = app.server.address() as AddressInfo;
  let closed = false;
  return {
    app,
    url: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    async close() {
      if (closed) return;
      closed = true;
      await app.close();
    },
  };
}

export class TestClient {
  private queue: ServerMessage[] = [];
  private waiters: Array<() => void> = [];
  readonly closed: Promise<{ code: number; reason: string }>;
  closeInfo: { code: number; reason: string } | null = null;

  private constructor(readonly ws: WebSocket) {
    ws.on("message", (data) => {
      this.queue.push(JSON.parse(data.toString()) as ServerMessage);
      this.notify();
    });
    this.closed = new Promise((resolve) => {
      ws.on("close", (code, reason) => {
        this.closeInfo = { code, reason: reason.toString() };
        resolve(this.closeInfo);
        this.notify();
      });
    });
  }

  static connect(url: string, headers: Record<string, string> = {}): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { headers });
      const client = new TestClient(ws);
      ws.once("open", () => resolve(client));
      ws.once("error", reject);
      ws.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    });
  }

  private notify(): void {
    const w = this.waiters;
    this.waiters = [];
    for (const fn of w) fn();
  }

  send(msg: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(msg));
  }

  sendRaw(data: string | Buffer): void {
    this.ws.send(data);
  }

  /** Nächste (älteste) Nachricht vom Typ t, die `pred` erfüllt; wird aus der Queue entfernt. */
  async next<T extends ServerMessageType>(
    t: T,
    pred: (m: ServerMessageOf<T>) => boolean = () => true,
    timeoutMs = 3000,
  ): Promise<ServerMessageOf<T>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const idx = this.queue.findIndex((m) => m.t === t && pred(m as ServerMessageOf<T>));
      if (idx >= 0) return this.queue.splice(idx, 1)[0] as ServerMessageOf<T>;
      const remaining = deadline - Date.now();
      if (remaining <= 0 || this.closeInfo) {
        throw new Error(
          `Keine Nachricht ${t} erhalten (Queue: ${this.queue.map((m) => m.t).join(", ")}; close: ${JSON.stringify(this.closeInfo)})`,
        );
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  /** Fehlerpaket mit erwartetem Code. */
  error(code: string, timeoutMs = 3000): Promise<ServerMessageOf<"error">> {
    return this.next("error", (m) => m.code === code, timeoutMs);
  }

  /** Ältester noch nicht abgeholter room.state, der `pred` erfüllt (wartet ggf.). Vorher ggf. clear() aufrufen. */
  async state(pred: (room: ServerMessageOf<"room.state">["room"]) => boolean = () => true, timeoutMs = 3000) {
    const msg = await this.next("room.state", (m) => pred(m.room), timeoutMs);
    return msg.room;
  }

  /** Alle bisher eingegangenen Nachrichten eines Typs (ohne Entfernen). */
  peekAll<T extends ServerMessageType>(t: T): ServerMessageOf<T>[] {
    return this.queue.filter((m) => m.t === t) as ServerMessageOf<T>[];
  }

  clear(): void {
    this.queue = [];
  }

  /** Wartet kurz und prüft, dass keine Nachricht vom Typ t ankam. */
  async expectNone(t: ServerMessageType, ms = 150): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
    const found = this.queue.filter((m) => m.t === t);
    if (found.length > 0) throw new Error(`Unerwartete Nachricht ${t}: ${JSON.stringify(found[0])}`);
  }

  close(): void {
    this.ws.close();
  }
}

export async function createRoom(server: TestServer, headers: Record<string, string> = {}) {
  const tv = await TestClient.connect(server.wsUrl, headers);
  tv.send({ t: "room.create", v: PROTOCOL_VERSION, rid: "c1" });
  const created = await tv.next("room.created");
  await tv.next("catalog");
  await tv.state();
  return { tv, code: created.code, tvToken: created.tvToken, joinUrl: created.joinUrl };
}

export async function joinPlayer(server: TestServer, code: string, name: string, headers: Record<string, string> = {}) {
  const client = await TestClient.connect(server.wsUrl, headers);
  client.send({ t: "room.join", v: PROTOCOL_VERSION, code, name, avatar: "fuchs" });
  const joined = await client.next("room.joined");
  await client.next("catalog");
  return { client, playerId: joined.playerId, token: joined.token };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
