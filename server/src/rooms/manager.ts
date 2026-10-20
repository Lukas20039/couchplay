// Verwaltung aller Räume einer Instanz: Codes, Raumlimit, Inaktivitäts-Ablauf.
import { buildJoinUrl, type RoomClosedReason } from "@couchplay/protocol";
import type { FastifyBaseLogger } from "fastify";
import type { GameCatalog } from "../catalog.js";
import { newRoomCode } from "./ids.js";
import { Room } from "./room.js";

export interface RoomManagerOptions {
  catalog: GameCatalog;
  maxRooms: number;
  roomIdleTimeoutMs: number;
  reconnectGraceMs: number;
  log: FastifyBaseLogger;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly opts: RoomManagerOptions) {}

  get size(): number {
    return this.rooms.size;
  }

  /** Neuer Raum oder null, wenn das Raumlimit erreicht ist. */
  create(publicBaseUrl: string): Room | null {
    if (this.rooms.size >= this.opts.maxRooms) return null;
    const code = newRoomCode(this.rooms);
    const room = new Room({
      code,
      joinUrl: buildJoinUrl(publicBaseUrl, code),
      catalog: this.opts.catalog,
      reconnectGraceMs: this.opts.reconnectGraceMs,
      log: this.opts.log,
      onClosed: (r) => {
        if (this.rooms.get(r.code) === r) this.rooms.delete(r.code);
      },
    });
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** Schließt Räume ohne Client-Nachricht seit roomIdleTimeoutMs. */
  sweepIdle(now = Date.now()): void {
    for (const room of [...this.rooms.values()]) {
      if (now - room.lastActivity >= this.opts.roomIdleTimeoutMs) room.close("idle");
    }
  }

  closeAll(reason: RoomClosedReason): void {
    for (const room of [...this.rooms.values()]) room.close(reason);
  }
}
