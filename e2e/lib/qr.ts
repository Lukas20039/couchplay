// QR-Code aus einem PNG-Screenshot dekodieren (jsQR + pngjs). Für Browser- und Emulator-E2E.
import { createRequire } from "node:module";
import { PNG } from "pngjs";

// jsqr ist CommonJS (module.exports = Funktion) – per require laden, Typen vom Default-Export.
const jsQR = createRequire(import.meta.url)("jsqr") as (typeof import("jsqr"))["default"];

/** Liefert den Inhalt des (ersten) QR-Codes im Bild oder null. */
export function decodeQrPng(png: Buffer): string | null {
  const img = PNG.sync.read(png);
  const data = new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  const hit = jsQR(data, img.width, img.height, { inversionAttempts: "attemptBoth" });
  return hit?.data ?? null;
}
