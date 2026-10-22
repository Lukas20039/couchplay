// Spiel-Einstellungen, generiert aus dem Settings-Schema des Manifests.
// Bedienung: OK auf einer Zeile → Schalter wechselt direkt, sonst Auswahlliste als Overlay.
import { useState } from "preact/hooks";
import type { GameManifest, SettingField, SettingsValues, SettingValue } from "@couchplay/protocol";
import { unlockedFields } from "@couchplay/protocol/settings";
import { t } from "../i18n/index.js";
import { fill } from "../lib/format.js";
import { Overlay } from "./common.js";
import { useApi } from "./context.js";

/** Aktueller Wert eines Feldes (Raumzustand, sonst Default). */
export function fieldValue(field: SettingField, values: SettingsValues): SettingValue {
  return values[field.key] ?? field.default;
}

/** Werteliste eines Zahlenfeldes (min..max in step), höchstens 100 Einträge. */
export function numberOptions(field: Extract<SettingField, { type: "number" }>): number[] {
  const step = field.step && field.step > 0 ? field.step : 1;
  const out: number[] = [];
  for (let v = field.min; v <= field.max + 1e-9 && out.length < 100; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** Höchstlänge einer aufgelisteten Mehrfachauswahl in der Wert-Pille. */
const MAX_VALUE_CHARS = 14;

/** Kurzer Anzeigetext des aktuellen Wertes. */
export function valueText(field: SettingField, values: SettingsValues): string {
  const v = fieldValue(field, values);
  switch (field.type) {
    case "toggle":
      return v === true ? t.settings.on : t.settings.off;
    case "number":
      return String(v);
    case "select":
      return field.options.find((o) => o.value === v)?.label ?? String(v);
    case "multiselect": {
      const list = Array.isArray(v) ? v : [];
      if (list.length === field.options.length) return t.settings.all;
      const labels = field.options.filter((o) => list.includes(o.value)).map((o) => o.label);
      // Wert-Pille wird nie gekürzt → nur kurze Auflistungen, sonst „n von m“.
      const joined = labels.join(", ");
      return labels.length <= 2 && joined.length <= MAX_VALUE_CHARS
        ? joined
        : fill(t.settings.selectedCount, { n: labels.length, total: field.options.length });
    }
  }
}

/**
 * Multiselect umschalten unter Beachtung von minSelected/maxSelected.
 * Reihenfolge folgt den Optionen. Gibt null zurück, wenn die Änderung unzulässig ist.
 */
export function toggleMulti(field: Extract<SettingField, { type: "multiselect" }>, current: readonly string[], value: string): string[] | null {
  const has = current.includes(value);
  const next = has ? current.filter((x) => x !== value) : [...current, value];
  if (has && next.length < (field.minSelected ?? 0)) return null;
  if (!has && field.maxSelected !== undefined && next.length > field.maxSelected) return null;
  const order = field.options.map((o) => o.value);
  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** `progress` = Fortschritt des Raums für dieses Spiel; noch gesperrte Optionen werden nicht gezeigt. */
export function SettingsPanel(props: { game: GameManifest | null; values: SettingsValues; progress: number }) {
  const api = useApi();
  const [open, setOpen] = useState<string | null>(null);
  const { game, values } = props;
  if (!game) return <p class="muted">{t.settings.noGame}</p>;
  const fields = unlockedFields(game.settings, props.progress);
  if (fields.length === 0) return <p class="muted">{t.settings.none}</p>;
  const openField = fields.find((f) => f.key === open) ?? null;
  const update = (key: string, value: SettingValue): void => api.send({ t: "lobby.updateSettings", settings: { [key]: value } });

  return (
    <div class="settings" data-testid="settings">
      {fields.map((field) => (
        <button
          key={field.key}
          class={`setting-row ${field.type === "toggle" ? "setting-toggle" : ""}`}
          data-nav="settings"
          data-testid="setting"
          data-setting-key={field.key}
          aria-pressed={field.type === "toggle" ? fieldValue(field, values) === true : undefined}
          onClick={() => (field.type === "toggle" ? update(field.key, fieldValue(field, values) !== true) : setOpen(field.key))}
        >
          <span class="setting-label">{field.label}</span>
          <span class="setting-value">{valueText(field, values)}</span>
        </button>
      ))}
      {openField && <FieldPicker field={openField} values={values} onChange={update} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FieldPicker(props: {
  field: SettingField;
  values: SettingsValues;
  onChange: (key: string, value: SettingValue) => void;
  onClose: () => void;
}) {
  const { field, values, onChange, onClose } = props;
  const current = fieldValue(field, values);

  if (field.type === "multiselect") {
    const list = Array.isArray(current) ? current : [];
    const atMin = list.length <= (field.minSelected ?? 0);
    return (
      <Overlay onClose={onClose} class="picker" testId="setting-picker">
        <h2>{field.label}</h2>
        <p class="muted">{fill(t.settings.selectedCount, { n: list.length, total: field.options.length })}</p>
        <div class="picker-list picker-grid">
          {field.options.map((o, i) => {
            const checked = list.includes(o.value);
            return (
              <button
                key={o.value}
                class={`pick ${checked ? "is-checked" : ""}`}
                data-nav="picker"
                data-nav-autofocus={i === 0 ? true : undefined}
                role="checkbox"
                aria-checked={checked}
                aria-disabled={checked && atMin ? "true" : undefined}
                onClick={() => {
                  const next = toggleMulti(field, list, o.value);
                  if (next) onChange(field.key, next);
                }}
              >
                <span class="check" aria-hidden="true" />
                {o.label}
              </button>
            );
          })}
        </div>
        {field.minSelected ? <p class="muted small">{fill(t.settings.minSelected, { n: field.minSelected })}</p> : null}
        <button class="btn btn-primary" data-nav="picker-actions" onClick={onClose}>
          {t.settings.done}
        </button>
      </Overlay>
    );
  }

  const options: Array<{ value: SettingValue; label: string }> =
    field.type === "select"
      ? field.options.map((o) => ({ value: o.value, label: o.label }))
      : field.type === "number"
        ? numberOptions(field).map((n) => ({ value: n, label: String(n) }))
        : [
            { value: true, label: t.settings.on },
            { value: false, label: t.settings.off },
          ];

  return (
    <Overlay onClose={onClose} class="picker" testId="setting-picker">
      <h2>{field.label}</h2>
      <div class={`picker-list ${options.length > 6 ? "picker-grid" : ""}`}>
        {options.map((o) => {
          const selected = o.value === current;
          return (
            <button
              key={String(o.value)}
              class={`pick ${selected ? "is-selected" : ""}`}
              data-nav="picker"
              data-nav-autofocus={selected ? true : undefined}
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (!selected) onChange(field.key, o.value);
                onClose();
              }}
            >
              <span class="radio" aria-hidden="true" />
              {o.label}
            </button>
          );
        })}
      </div>
    </Overlay>
  );
}
