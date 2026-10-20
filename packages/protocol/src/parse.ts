// Parser-/Encoder-Helfer für Server und Clients.
import type { z } from "zod";
import { MAX_MESSAGE_BYTES } from "./constants.js";
import type { ErrorCode } from "./errors.js";
import {
  ClientMessageSchema,
  ServerMessageSchema,
  type ClientMessage,
  type ServerMessage,
  type ServerMessageOf,
} from "./messages.js";

export type ParseResult<T> =
  | { ok: true; msg: T }
  | { ok: false; code: Extract<ErrorCode, "BAD_MESSAGE" | "MESSAGE_TOO_LARGE">; message: string; rid?: string };

/** Rohdaten wie sie von `ws` (Buffer) oder Browser-WebSocket (string) kommen. */
export type RawMessage = string | Uint8Array | ArrayBuffer | readonly Uint8Array[];

const decoder = new TextDecoder("utf-8", { fatal: false });

function byteLength(raw: RawMessage): number {
  if (typeof raw === "string") {
    // UTF-16-Einheit ≤ 3 UTF-8-Bytes: kurze Strings müssen nicht kodiert werden.
    return raw.length * 3 <= MAX_MESSAGE_BYTES ? raw.length : new TextEncoder().encode(raw).length;
  }
  if (raw instanceof ArrayBuffer) return raw.byteLength;
  if (raw instanceof Uint8Array) return raw.byteLength;
  return raw.reduce((n, part) => n + part.byteLength, 0);
}

function toText(raw: RawMessage): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof ArrayBuffer || raw instanceof Uint8Array) return decoder.decode(raw);
  return raw.map((part) => decoder.decode(part)).join("");
}

function extractRid(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null && "rid" in value) {
    const r = (value as { rid: unknown }).rid;
    if (typeof r === "string" && r.length > 0 && r.length <= 64) return r;
  }
  return undefined;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

function parseWith<T>(schema: z.ZodType<T>, raw: RawMessage): ParseResult<T> {
  if (byteLength(raw) > MAX_MESSAGE_BYTES) {
    return { ok: false, code: "MESSAGE_TOO_LARGE", message: `Nachricht größer als ${MAX_MESSAGE_BYTES} Bytes` };
  }
  let json: unknown;
  try {
    json = JSON.parse(toText(raw));
  } catch {
    return { ok: false, code: "BAD_MESSAGE", message: "Kein gültiges JSON" };
  }
  const rid = extractRid(json);
  if (typeof json !== "object" || json === null || Array.isArray(json) || typeof (json as { t?: unknown }).t !== "string") {
    return { ok: false, code: "BAD_MESSAGE", message: "Feld 't' fehlt", ...(rid ? { rid } : {}) };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, code: "BAD_MESSAGE", message: formatIssues(result.error), ...(rid ? { rid } : {}) };
  }
  return { ok: true, msg: result.data };
}

/** Server: eingehende Client-Nachricht prüfen. Unbekannte Felder werden entfernt. */
export function parseClientMessage(raw: RawMessage): ParseResult<ClientMessage> {
  return parseWith(ClientMessageSchema, raw);
}

/** Client: eingehende Server-Nachricht prüfen. */
export function parseServerMessage(raw: RawMessage): ParseResult<ServerMessage> {
  return parseWith(ServerMessageSchema, raw);
}

/** Serialisiert eine Nachricht (beide Richtungen). */
export function encodeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

/** Bequemer Konstruktor für Fehlerpakete. */
export function errorMessage(
  code: ErrorCode,
  message: string,
  extra: { rid?: string | undefined; fatal?: boolean; retryAfterMs?: number } = {},
): ServerMessageOf<"error"> {
  const msg: ServerMessageOf<"error"> = { t: "error", code, message };
  if (extra.rid !== undefined) msg.rid = extra.rid;
  if (extra.fatal !== undefined) msg.fatal = extra.fatal;
  if (extra.retryAfterMs !== undefined) msg.retryAfterMs = extra.retryAfterMs;
  return msg;
}
