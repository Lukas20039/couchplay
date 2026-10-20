// Validierung von Spiel-Einstellungen gegen das deklarative Settings-Schema des Manifests.
import type { SettingField, SettingsValues, SettingValue } from "./common.js";

export type SettingsValidation =
  | { ok: true; settings: SettingsValues }
  | { ok: false; errors: Array<{ key: string; message: string }> };

/** Default-Werte aller Felder. */
export function defaultSettings(fields: readonly SettingField[]): SettingsValues {
  const out: SettingsValues = {};
  for (const f of fields) out[f.key] = Array.isArray(f.default) ? [...f.default] : f.default;
  return out;
}

function checkField(field: SettingField, value: SettingValue): string | null {
  switch (field.type) {
    case "select":
      if (typeof value !== "string") return "Erwartet String";
      if (!field.options.some((o) => o.value === value)) return `Unbekannte Option '${value}'`;
      return null;
    case "multiselect": {
      if (!Array.isArray(value)) return "Erwartet Liste";
      const allowed = new Set(field.options.map((o) => o.value));
      if (value.some((v) => !allowed.has(v))) return "Unbekannte Option";
      if (new Set(value).size !== value.length) return "Doppelte Option";
      if (field.minSelected !== undefined && value.length < field.minSelected) return `Mindestens ${field.minSelected}`;
      if (field.maxSelected !== undefined && value.length > field.maxSelected) return `Höchstens ${field.maxSelected}`;
      return null;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Erwartet Zahl";
      if (value < field.min || value > field.max) return `Bereich ${field.min}–${field.max}`;
      if (field.step !== undefined) {
        const steps = (value - field.min) / field.step;
        if (Math.abs(steps - Math.round(steps)) > 1e-9) return `Schrittweite ${field.step}`;
      }
      return null;
    }
    case "toggle":
      return typeof value === "boolean" ? null : "Erwartet true/false";
  }
}

/**
 * Prüft `input` gegen `fields` und mergt mit `base` (Standard: Defaults).
 * Fehlende Keys behalten den Basiswert, unbekannte Keys sind ein Fehler.
 */
export function validateSettings(
  fields: readonly SettingField[],
  input: SettingsValues,
  base: SettingsValues = defaultSettings(fields),
): SettingsValidation {
  const errors: Array<{ key: string; message: string }> = [];
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const merged: SettingsValues = { ...defaultSettings(fields), ...pickKnown(base, byKey) };
  for (const [key, value] of Object.entries(input)) {
    const field = byKey.get(key);
    if (!field) {
      errors.push({ key, message: "Unbekannte Einstellung" });
      continue;
    }
    const err = checkField(field, value);
    if (err) errors.push({ key, message: err });
    else merged[key] = Array.isArray(value) ? [...value] : value;
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, settings: merged };
}

function pickKnown(values: SettingsValues, byKey: Map<string, SettingField>): SettingsValues {
  const out: SettingsValues = {};
  for (const [k, v] of Object.entries(values)) if (byKey.has(k)) out[k] = v;
  return out;
}
