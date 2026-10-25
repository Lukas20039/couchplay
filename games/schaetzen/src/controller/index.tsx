// Controller-View „Schätzen!“ (Hochformat).
// Eigenes Ziffernfeld (keine System-Tastatur): Ziffern, Komma, Löschen, „Fertig“. Nach „Fertig“ ist der Tipp fix.
// In der Auflösung erst nach der TV-Animation das eigene Ergebnis zeigen (sonst verrät das Handy die Lösung).
// Merkt sich gestellte Fragen (seen.ts), damit dieselbe Runde sie nicht so bald wieder bekommt.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { isYearUnit } from "../constants.js";
import { applyKey, distanceText, formatEntry, formatValue, parseEntry, type PadKey } from "../format.js";
import { t } from "../i18n/de.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import { REVEAL_STEPS, type EsInput, type EsPlayerView } from "../shared.js";
import { ensureStyles, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<EsPlayerView, EsInput>;
type V<P extends EsPlayerView["phase"]> = Extract<EsPlayerView, { phase: P }>;

const KEYS: PadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "del"];

function SchaetzenController({ view, api, error }: Props) {
  ensureStyles("es-ctl-css", CONTROLLER_CSS);
  // Bei jedem Render die aktuelle Serverzeit nehmen (neue Ansicht kommt sonst bis zu 250 ms „zu spät“).
  const now = Math.max(useServerNow(api.serverNow, view?.phase === "question" || view?.phase === "reveal"), api.serverNow());

  // Gedächtnis: einmal je Spiel melden, jede gestellte Frage merken.
  const reported = useRef(false);
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || reported.current) return;
    reported.current = true;
    api.sendInput({ type: "seen", ids: packSeen(loadSeen(storage())) });
  }, [hasView]);
  const questionId = view?.phase === "question" ? view.questionId : null;
  useEffect(() => {
    if (questionId) rememberSeen(storage(), questionId);
  }, [questionId]);

  // Einmal pro Auflösung vibrieren, sobald das Ergebnis sichtbar wird.
  const resultShown = view?.phase === "reveal" && now - view.revealAt >= REVEAL_STEPS.resultMs;
  const vibrateKey = resultShown ? `${view.round}` : null;
  useEffect(() => {
    if (view?.phase === "reveal" && vibrateKey) api.vibrate(view.bullseye ? [60, 40, 60, 40, 120] : view.points > 0 ? [60, 40, 60] : [200]);
  }, [vibrateKey]);

  if (!view) {
    return (
      <div class="es-ctl">
        <p class="es-msg">{t.controller.loading}</p>
      </div>
    );
  }
  let body;
  switch (view.phase) {
    case "intro":
      body = <p class="es-msg">{t.controller.intro}</p>;
      break;
    case "question":
      body = <Ask key={`q${view.round}`} v={view} api={api} now={now} rejected={error !== null} />;
      break;
    case "reveal":
      body = resultShown ? <Reveal v={view} /> : <p class="es-msg es-big">{t.controller.watchTv}</p>;
      break;
    case "standings":
      body = <p class="es-msg es-big">{t.controller.standings(view.rank, view.playerCount)}</p>;
      break;
    case "final":
      body = (
        <div class="es-result">
          <strong>{t.controller.finalTitle}</strong>
          {!view.solo && <span>{t.controller.standings(view.rank, view.playerCount)}</span>}
          <span class="es-gain">{t.points(view.score)}</span>
          {view.bullseyes > 0 && <span>🎯 {t.controller.bullseyes(view.bullseyes)}</span>}
        </div>
      );
      break;
  }
  return (
    <div class={`es-ctl es-ctl--${view.phase}`} data-testid="es-controller" data-phase={view.phase}>
      <header class="es-top">
        <span>{view.phase === "intro" ? t.title : t.round(view.round, view.total)}</span>
        <span>{t.points(view.score)}</span>
      </header>
      {body}
    </div>
  );
}

function Ask({ v, api, now, rejected }: { v: V<"question">; api: Props["api"]; now: number; rejected: boolean }) {
  const year = isYearUnit(v.unit);
  const [raw, setRaw] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (rejected) setPending(null);
  }, [rejected]);
  const locked = v.guess ?? pending;
  const value = parseEntry(raw);
  const remaining = Math.max(0, v.endsAt - now);

  const press = (key: PadKey): void => {
    if (locked !== null) return;
    setRaw((r) => applyKey(r, key, year));
  };
  const submit = (): void => {
    if (locked !== null || value === null) return;
    setPending(value);
    api.vibrate(30);
    api.sendInput({ type: "guess", value });
  };

  // Hardware-Tastatur (Tablet/Desktop) als Komfort.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent): void => {
      if (/^\d$/.test(e.key)) press(e.key as PadKey);
      else if (e.key === "," || e.key === ".") press(",");
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") submit();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const unit = year ? t.yearHint : v.unit;
  return (
    <>
      <div class="es-time" aria-hidden="true">
        <span key={v.endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / v.durationMs)})`, animation: `es-drain ${remaining}ms linear forwards` }} />
      </div>
      <h2 class="es-q">{v.text}</h2>
      {locked !== null ? (
        <div class="es-locked" role="status" data-testid="es-locked">
          <span>{t.controller.yourGuess}</span>
          <strong>{formatValue(locked, v.unit)}</strong>
          <small>{v.solo ? t.controller.lockedSolo : t.controller.locked}</small>
        </div>
      ) : (
        <>
          <div class={`es-display ${raw ? "" : "is-empty"}`} data-testid="es-display" aria-live="polite">
            <span class="es-display__num">{raw ? formatEntry(raw, year) : t.controller.placeholder}</span>
            {unit && <span class="es-display__unit">{unit}</span>}
          </div>
          <div class="es-pad">
            {KEYS.map((k) => {
              const disabled = k === "," && year;
              const label = k === "del" ? "⌫" : k;
              const aria = k === "del" ? t.controller.delete : k === "," ? t.controller.comma : k;
              return (
                <button
                  key={k}
                  type="button"
                  class={`es-key ${k === "del" ? "is-del" : ""}`}
                  disabled={disabled}
                  aria-label={aria}
                  data-testid={`es-key-${k === "," ? "comma" : k}`}
                  onClick={() => press(k)}
                >
                  {disabled ? "" : label}
                </button>
              );
            })}
          </div>
          <button type="button" class="es-done" disabled={value === null} data-testid="es-done" onClick={submit}>
            {t.controller.done}
          </button>
        </>
      )}
    </>
  );
}

function Reveal({ v }: { v: V<"reveal"> }) {
  let headline: string;
  if (v.guess === null) headline = t.controller.noGuess;
  else if (v.bullseye) headline = t.controller.bullseye;
  else if (v.solo) headline = v.points > 0 ? t.controller.soloGood : t.controller.soloBad;
  else headline = v.place === 1 ? t.controller.nearest : t.controller.place(v.place ?? 0);
  return (
    <div class={`es-result ${v.points > 0 ? "is-good" : ""}`} role="status" data-testid="es-result">
      <strong>{headline}</strong>
      <dl class="es-facts">
        {v.guess !== null && (
          <>
            <dt>{t.controller.yourGuess}</dt>
            <dd>{formatValue(v.guess, v.unit)}</dd>
          </>
        )}
        <dt>{t.controller.solution}</dt>
        <dd>{formatValue(v.answer, v.unit)}</dd>
        {v.distance !== null && (
          <>
            <dt>{t.controller.distance}</dt>
            <dd>{distanceText(v.distance, v.unit)}</dd>
          </>
        )}
      </dl>
      {v.points > 0 && <span class="es-gain">{t.plus(v.points)}</span>}
    </div>
  );
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export default preactControllerView<EsPlayerView, EsInput>(SchaetzenController);
