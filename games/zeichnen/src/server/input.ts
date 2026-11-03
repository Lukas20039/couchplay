// Schema der Handy-Eingaben (zod bleibt so aus den Views heraus).
// Zeichnungsdaten: Koordinaten ganzzahlig 0–1000, höchstens DRAW_LIMITS.chunkPoints Punkte je Nachricht.
import { z } from "zod";
import { CANVAS_UNITS, DRAW_LIMITS, GUESS_LIMITS, PALETTE, SIZES } from "../constants.js";
import { SEEN_MAX } from "../seen.js";
import type { ZgInput } from "../shared.js";

const Coord = z.number().int().min(0).max(CANVAS_UNITS);

export const ZgInputSchema: z.ZodType<ZgInput> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("choose"), index: z.number().int().min(0).max(2) }),
  z.object({
    type: z.literal("stroke"),
    id: z.number().int().min(0).max(1_000_000_000),
    color: z.number().int().min(0).max(PALETTE.length - 1),
    size: z.number().int().min(0).max(SIZES.length - 1),
    points: z
      .array(Coord)
      .min(2)
      .max(DRAW_LIMITS.chunkPoints * 2)
      .refine((p) => p.length % 2 === 0, "Punkte paarweise"),
  }),
  z.object({
    type: z.literal("fill"),
    id: z.number().int().min(0).max(1_000_000_000),
    color: z.number().int().min(0).max(PALETTE.length - 1),
    x: Coord,
    y: Coord,
  }),
  z.object({ type: z.literal("undo") }),
  z.object({ type: z.literal("clear") }),
  z.object({ type: z.literal("guess"), text: z.string().max(GUESS_LIMITS.maxLength) }),
  z.object({
    type: z.literal("seen"),
    ids: z
      .record(z.string().regex(/^[a-z]{2,8}$/), z.array(z.number().int().min(0).max(999)).max(SEEN_MAX))
      .refine((r) => Object.keys(r).length <= 20 && Object.values(r).reduce((n, a) => n + a.length, 0) <= SEEN_MAX, "Zu viele"),
  }),
]);
