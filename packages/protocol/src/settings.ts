// Validierung von Spiel-Einstellungen gegen das deklarative Settings-Schema des Manifests.
import type { SettingField, SettingsValues, SettingValue } from "./common.js";

type Option = { value: string; minProgress?: number | undefined };

/** Ist die Option beim Fortschritt `progress` freigeschaltet? */
export function isOptionUnlocked(option: Option, progress: number): boolean {
  return (option.minProgress ?? 0) <= progress;
}

/** Freigeschaltete Optionen eines Felds; gesperrte zeigen TV und Handy nicht an. */
export function unlockedOptions<O extends Option>(options: readonly O[], progress: number): O[] {
  return options.filter((o) => isOptionUnlocked(o, progress));
}

/**
 * Settings-Formular für den Fortschritt `progress`: nur freigeschaltete Optionen. Auswahlfelder
 * mit höchstens einer freien Option entfallen ganz (es gibt nichts zu wählen).
 */
export function unlockedFields(fields: readonly SettingField[], progress: number): SettingField[] {
  const out: SettingField[] = [];
  for (const f of fields) {
    if (f.type !== "select" && f.type !== "multiselect") {
      out.push(f);
      continue;
    }
    const options = unlockedOptions(f.options, progress);
    if (options.length === f.options.length) out.push(f);
    else if (options.length > (f.type === "select" ? 1 : 0)) out.push({ ...f, options });
  }
  return out;
}

/** Gesperrte Werte in `values` (z. B. nach Fortschrittsverlust) → Feld-Default. */
export function relockSettings(fields: readonly SettingField[], values: SettingsValues, progress: number): SettingsValues {
  const out: SettingsValues = { ...values };
  for (const f of fields) if (lockedValue(f, out[f.key], progress)) out[f.key] = Array.isArray(f.default) ? [...f.default] : f.default;
  return out;
}

function lockedValue(field: SettingField, value: SettingValue | undefined, progress: number): boolean {
  if (field.type !== "select" && field.type !== "multiselect") return false;
  const picked = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return field.options.some((o) => !isOptionUnlocked(o, progress) && picked.includes(o.value));
}

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
 * Fehlende Keys behalten den Basiswert, unbekannte Keys und gesperrte Optionen sind ein Fehler.
 */
export function validateSettings(
  fields: readonly SettingField[],
  input: SettingsValues,
  base: SettingsValues = defaultSettings(fields),
  /** Fortschritt im Raum; Optionen mit höherem `minProgress` sind gesperrt. */
  progress = Number.POSITIVE_INFINITY,
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
    const err = checkField(field, value) ?? (lockedValue(field, value, progress) ? "Noch nicht freigeschaltet" : null);
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
