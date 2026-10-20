// Verwaltung aller Räume einer Instanz: Codes, Raumlimit, Inaktivitäts-Ablauf.
import { buildJoinUrl, type RoomClosedReason } from "@couchplay/protocol";
import type { FastifyBaseLogger } from "fastify";
import type { GameCatalog } from "../catalog.js";
import { newRoomCode } from "./ids.js";
import { Room } from "./room.js";

export interface RoomManagerOptions {
  catalog: GameCatalog;
  maxRooms: number;
  maxRoomsPerIp: number;
  roomIdleTimeoutMs: number;
  orphanRoomTimeoutMs: number;
  reconnectGraceMs: number;
  stateCoalesceMs: number;
  log: FastifyBaseLogger;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Offene Räume pro Ersteller-IP-Schlüssel. */
  private readonly perOwner = new Map<string, number>();

  constructor(private readonly opts: RoomManagerOptions) {}

  get size(): number {
    return this.rooms.size;
  }

  roomsOf(ownerKey: string): number {
    return this.perOwner.get(ownerKey) ?? 0;
  }

  /**
   * Neuer Raum. Fehler: "server_full" (Instanzlimit) bzw. "owner_limit" (zu viele offene
   * Räume dieser IP / dieses IPv6-/64; die Zuordnung bleibt beim Ersteller, auch nach room.resume).
   */
  create(publicBaseUrl: string, ownerKey: string): Room | "server_full" | "owner_limit" {
    if (this.roomsOf(ownerKey) >= this.opts.maxRoomsPerIp) return "owner_limit";
    if (this.rooms.size >= this.opts.maxRooms) return "server_full";
    const code = newRoomCode(this.rooms);
    const room = new Room({
      code,
      joinUrl: buildJoinUrl(publicBaseUrl, code),
      catalog: this.opts.catalog,
      reconnectGraceMs: this.opts.reconnectGraceMs,
      stateCoalesceMs: this.opts.stateCoalesceMs,
      ownerKey,
      log: this.opts.log,
      onClosed: (r) => {
        if (this.rooms.get(r.code) !== r) return;
        this.rooms.delete(r.code);
        const n = this.roomsOf(r.ownerKey) - 1;
        if (n <= 0) this.perOwner.delete(r.ownerKey);
        else this.perOwner.set(r.ownerKey, n);
      },
    });
    this.rooms.set(code, room);
    this.perOwner.set(ownerKey, this.roomsOf(ownerKey) + 1);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /**
   * Schließt Räume ohne Client-Nachricht seit roomIdleTimeoutMs sowie verwaiste Räume
   * (kein TV, kein verbundener Spieler) nach orphanRoomTimeoutMs.
   */
  sweepIdle(now = Date.now()): void {
    for (const room of [...this.rooms.values()]) {
      const idle = now - room.lastActivity >= this.opts.roomIdleTimeoutMs;
      const orphaned = room.emptySince !== null && now - room.emptySince >= this.opts.orphanRoomTimeoutMs;
      if (idle || orphaned) room.close("idle");
    }
  }

  closeAll(reason: RoomClosedReason): void {
    for (const room of [...this.rooms.values()]) room.close(reason);
  }
}
