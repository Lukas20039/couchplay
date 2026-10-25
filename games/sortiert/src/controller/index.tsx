// Controller-View „Sortiert!“ (Hochformat).
// Bedienung per Antippen in Reihenfolge: Die erste angetippte Karte kommt auf Platz 1, die nächste auf Platz 2 …
// Antippen einer platzierten Karte nimmt sie heraus, die folgenden rücken nach. „Zurücksetzen“ leert alles.
// Bleibt beim Platzieren nur noch eine Karte übrig, rutscht sie automatisch auf den letzten Platz.
// Jede Änderung geht als Zwischenstand an den Server (zählt bei Zeitablauf), „Fertig“ macht die Reihenfolge fix.
// Der lokale Stand ist maßgeblich, solange die Runde läuft; beim (Neu-)Aufbau kommt er aus der Server-Ansicht.
// In der Auflösung erst nach dem TV-Aufbau das eigene Ergebnis zeigen (sonst verrät das Handy die Lösung).
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { formatValue } from "../format.js";
import { t } from "../i18n/de.js";
import { completeOrder } from "../scoring.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import type { SoInput, SoPlayerView } from "../shared.js";
import { ensureStyles, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<SoPlayerView, SoInput>;
type V<P extends SoPlayerView["phase"]> = Extract<SoPlayerView, { phase: P }>;

function SortiertController({ view, api, error }: Props) {
  ensureStyles("sc-ctl-css", CONTROLLER_CSS);
  // Bei jedem Render die aktuelle Serverzeit nehmen (neue Ansicht kommt sonst bis zu 250 ms „zu spät“).
  const now = Math.max(useServerNow(api.serverNow, view?.phase === "sort" || view?.phase === "reveal"), api.serverNow());

  // Gedächtnis: einmal je Spiel melden, jedes gespielte Set merken.
  const reported = useRef(false);
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || reported.current) return;
    reported.current = true;
    api.sendInput({ type: "seen", ids: packSeen(loadSeen(storage())) });
  }, [hasView]);
  const setId = view?.phase === "sort" ? view.setId : null;
  useEffect(() => {
    if (setId) rememberSeen(storage(), setId);
  }, [setId]);

  // Einmal pro Auflösung vibrieren, sobald das Ergebnis sichtbar wird.
  const resultShown = view?.phase === "reveal" && now >= view.resultAt;
  const vibrateKey = resultShown ? `${view.round}` : null;
  useEffect(() => {
    if (view?.phase === "reveal" && vibrateKey) api.vibrate(view.perfect ? [60, 40, 60, 40, 160] : view.points > 0 ? [60, 40, 60] : [200]);
  }, [vibrateKey]);

  if (!view) {
    return (
      <div class="sc-ctl">
        <p class="sc-msg">{t.controller.loading}</p>
      </div>
    );
  }
  let body;
  switch (view.phase) {
    case "intro":
      body = <p class="sc-msg">{t.controller.intro}</p>;
      break;
    case "sort":
      body = <Sorter key={`s${view.round}`} v={view} api={api} now={now} rejected={error !== null} />;
      break;
    case "reveal":
      body = resultShown ? <Result v={view} /> : <p class="sc-msg sc-big">{t.controller.watchTv}</p>;
      break;
    case "standings":
      body = <p class="sc-msg sc-big">{t.controller.rank(view.rank, view.playerCount)}</p>;
      break;
    case "final":
      body = (
        <div class="sc-result">
          <strong>{t.controller.finalTitle}</strong>
          {!view.solo && <span>{t.controller.rank(view.rank, view.playerCount)}</span>}
          <span class="sc-gain">{t.points(view.score)}</span>
          {view.perfects > 0 && <span>✨ {t.controller.perfects(view.perfects)}</span>}
        </div>
      );
      break;
  }
  return (
    <div class={`sc-ctl sc-ctl--${view.phase}`} data-testid="sc-controller" data-phase={view.phase}>
      <header class="sc-top">
        <span>{view.phase === "intro" ? t.title : t.round(view.round, view.total)}</span>
        <span>{t.points(view.score)}</span>
      </header>
      {body}
    </div>
  );
}

function Sorter({ v, api, now, rejected }: { v: V<"sort">; api: Props["api"]; now: number; rejected: boolean }) {
  const n = v.cards.length;
  // Lokaler Stand (Ref für schnelle Mehrfach-Taps zwischen zwei Renders), Start aus der Server-Ansicht.
  const ref = useRef<number[]>(v.order.filter((i) => i >= 0 && i < n));
  const [order, setOrder] = useState<number[]>(ref.current);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (rejected) setPending(false);
  }, [rejected]);
  const locked = v.submitted || pending;
  const remaining = Math.max(0, v.endsAt - now);

  const commit = (next: number[]): void => {
    ref.current = next;
    setOrder(next);
    api.sendInput({ type: "order", order: next, final: false });
  };
  const place = (card: number): void => {
    const cur = ref.current;
    if (locked || cur.includes(card)) return;
    api.vibrate(12);
    // Bleibt nur noch eine Karte übrig, rutscht sie automatisch ans Ende.
    commit(completeOrder([...cur, card], n));
  };
  const remove = (pos: number): void => {
    if (locked) return;
    commit(ref.current.filter((_, i) => i !== pos));
  };
  const reset = (): void => {
    if (locked || ref.current.length === 0) return;
    commit([]);
  };
  const submit = (): void => {
    if (locked || ref.current.length !== n) return;
    setPending(true);
    api.vibrate(30);
    api.sendInput({ type: "order", order: ref.current, final: true });
  };

  const shown = v.submitted ? v.order : order;
  const placed = new Set(shown);
  const pool = v.cards.map((c, i) => ({ ...c, i })).filter((c) => !placed.has(c.i));

  return (
    <>
      <div class="sc-time" aria-hidden="true">
        <span key={v.endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / v.durationMs)})`, animation: `sc-drain ${remaining}ms linear forwards` }} />
      </div>
      <h2 class="sc-q" data-testid="sc-prompt">
        {v.prompt}
      </h2>
      <p class="sc-end">▲ {t.topIs(v.top)}</p>
      <ol class={`sc-slots ${locked ? "is-locked" : ""}`} data-testid="sc-slots">
        {Array.from({ length: n }, (_, pos) => {
          const card = shown[pos];
          if (card === undefined) {
            return (
              <li key={`e${pos}`} class={`sc-slot is-empty ${pos === shown.length ? "is-next" : ""}`} data-testid={`sc-slot-${pos}`}>
                <span class="sc-slot__no">{pos + 1}</span>
                <span class="sc-slot__label">{t.controller.slotEmpty}</span>
              </li>
            );
          }
          return (
            <li key={`c${card}`} class="sc-slot" data-testid={`sc-slot-${pos}`}>
              <button type="button" class="sc-slot__btn" disabled={locked} aria-label={`${t.controller.place(pos + 1)}: ${v.cards[card]!.label}`} onClick={() => remove(pos)}>
                <span class="sc-slot__no">{pos + 1}</span>
                <span class="sc-slot__label">{v.cards[card]!.label}</span>
                {!locked && (
                  <span class="sc-slot__x" aria-hidden="true">
                    ×
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <p class="sc-end">▼ {t.bottomIs(v.bottom)}</p>
      {locked ? (
        <div class="sc-locked" role="status" data-testid="sc-locked">
          <strong>{t.controller.submitted}</strong>
          <small>{v.solo ? t.controller.waitingSolo : t.controller.waiting}</small>
        </div>
      ) : (
        <>
          <div class="sc-pool" data-testid="sc-pool">
            {pool.length === 0 ? (
              <p class="sc-hint">{t.controller.removeHint}</p>
            ) : (
              pool.map((c) => (
                <button key={c.i} type="button" class="sc-card" data-testid={`sc-card-${c.i}`} onClick={() => place(c.i)}>
                  {c.label}
                </button>
              ))
            )}
          </div>
          <div class="sc-actions">
            <button type="button" class="sc-reset" disabled={order.length === 0} data-testid="sc-reset" onClick={reset}>
              {t.controller.reset}
            </button>
            <button type="button" class="sc-done" disabled={order.length !== n} data-testid="sc-done" onClick={submit}>
              {t.controller.done}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Result({ v }: { v: V<"reveal"> }) {
  const placed = v.mine.some((m) => m.label !== null);
  return (
    <div class={`sc-res ${v.perfect ? "is-perfect" : ""}`} role="status" data-testid="sc-result">
      <div class="sc-res__head">
        <strong>{v.perfect ? t.perfect : placed ? t.controller.yourOrder : t.controller.nothing}</strong>
        <span class="sc-gain">{t.controller.roundPoints(v.points)}</span>
      </div>
      {placed && !v.submitted && <p class="sc-hint">{t.controller.partial}</p>}
      <ol class="sc-res__list">
        {v.items.map((item, pos) => {
          const mine = v.mine[pos]!;
          return (
            <li key={pos} class={`sc-res__row is-${mine.mark}`}>
              <span class="sc-res__mark" aria-label={t.markLabels[mine.mark]}>
                {t.marks[mine.mark]}
              </span>
              <span class="sc-res__text">
                <span class={`sc-res__label ${mine.label === null ? "is-empty" : ""}`}>{mine.label ?? t.controller.slotEmpty}</span>
                {mine.mark !== "exact" && <span class="sc-res__correct">{t.controller.correct(item.label)}</span>}
              </span>
              <span class="sc-res__value">{formatValue(item.value, v.unit)}</span>
            </li>
          );
        })}
      </ol>
      <p class="sc-res__rank">{t.controller.rank(v.rank, v.playerCount)}</p>
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

export default preactControllerView<SoPlayerView, SoInput>(SortiertController);
