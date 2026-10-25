// Controller-View „Flunkern“ (Hochformat).
// Schreiben: Textfeld (System-Tastatur, max. 40 Zeichen) mit Zeichenzähler und „Abschicken“; danach ist die Lüge fix.
// Wählen: große Buttons, die eigene Lüge ist markiert und gesperrt. Auflösung: erst nach dem Aufdecken der
// Wahrheit am TV das eigene Ergebnis (der Server schickt es auch erst dann).
// Merkt sich gestellte Fragen (seen.ts), damit dieselbe Runde sie nicht so bald wieder bekommt.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { LIE_MAX } from "../constants.js";
import { AWARDS, joinNames, t } from "../i18n/de.js";
import { cleanText, isValidLie, lieLength } from "../normalize.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import type { FlInput, FlPlayerView } from "../shared.js";
import { ensureStyles, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<FlPlayerView, FlInput>;
type V<P extends FlPlayerView["phase"]> = Extract<FlPlayerView, { phase: P }>;

function FlunkernController({ view, api, error }: Props) {
  ensureStyles("fl-ctl-css", CONTROLLER_CSS);
  const now = Math.max(useServerNow(api.serverNow, view?.phase === "write" || view?.phase === "choose"), api.serverNow());

  // Gedächtnis: einmal je Spiel melden, jede gestellte Frage merken.
  const reported = useRef(false);
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || reported.current) return;
    reported.current = true;
    api.sendInput({ type: "seen", ids: packSeen(loadSeen(storage())) });
  }, [hasView]);
  const questionId = view?.phase === "write" ? view.questionId : null;
  useEffect(() => {
    if (questionId) rememberSeen(storage(), questionId);
  }, [questionId]);

  // Einmal pro Auflösung vibrieren, sobald das eigene Ergebnis da ist.
  const result = view?.phase === "reveal" ? view.result : null;
  const vibrateKey = result ? `${view!.round}` : null;
  useEffect(() => {
    if (result) api.vibrate(result.points > 0 ? [60, 40, 60] : [200]);
  }, [vibrateKey]);

  if (!view) {
    return (
      <div class="fl-ctl">
        <p class="fl-msg">{t.controller.loading}</p>
      </div>
    );
  }
  let body;
  switch (view.phase) {
    case "intro":
      body = (
        <p class="fl-msg">
          <span class="fl-msg__icon" aria-hidden="true">
            🤥
          </span>
          {t.controller.intro}
        </p>
      );
      break;
    case "write":
      body = <Write key={`w${view.round}`} v={view} api={api} now={now} failed={error !== null} />;
      break;
    case "choose":
      body = <Choose key={`c${view.round}`} v={view} api={api} now={now} failed={error !== null} />;
      break;
    case "reveal":
      body = view.result ? <Result v={view} /> : <p class="fl-msg fl-big">{t.controller.watchTv}</p>;
      break;
    case "standings":
      body = <p class="fl-msg fl-big">{t.controller.standings(view.rank, view.playerCount)}</p>;
      break;
    case "final":
      body = (
        <div class="fl-result">
          <strong>{t.controller.finalTitle}</strong>
          <span>{t.controller.standings(view.rank, view.playerCount)}</span>
          <span class="fl-gain">{t.points(view.score)}</span>
          <span>{t.controller.finalStats(view.fooled, view.truths)}</span>
          {view.awards.map((a) => (
            <span key={a} class="fl-award">
              {AWARDS[a].icon} {AWARDS[a].title}
            </span>
          ))}
        </div>
      );
      break;
  }
  return (
    <div class={`fl-ctl fl-ctl--${view.phase}`} data-testid="fl-controller" data-phase={view.phase}>
      <header class="fl-top">
        <span>{view.phase === "intro" ? t.title : t.round(view.round, view.total)}</span>
        <span>{t.points(view.score)}</span>
      </header>
      {view.double && (view.phase === "write" || view.phase === "choose") && <p class="fl-double">{t.double}</p>}
      {body}
    </div>
  );
}

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const remaining = Math.max(0, endsAt - now);
  return (
    <div class="fl-time" aria-hidden="true">
      <span key={endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / durationMs)})`, animation: `fl-drain ${remaining}ms linear forwards` }} />
    </div>
  );
}

function Write({ v, api, now, failed }: { v: V<"write">; api: Props["api"]; now: number; failed: boolean }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  // Jede neue Ansicht (z. B. Ablehnung) bzw. ein Fehler gibt das Feld wieder frei.
  useEffect(() => {
    if (v.lie === null) setPending(null);
  }, [v]);
  useEffect(() => {
    if (failed) setPending(null);
  }, [failed]);
  const locked = v.lie ?? pending;
  const clean = cleanText(text);
  const length = lieLength(clean);
  const valid = isValidLie(clean);

  const submit = (e: Event): void => {
    e.preventDefault();
    if (locked !== null || !valid || now >= v.endsAt) return;
    setPending(clean);
    api.vibrate(30);
    api.sendInput({ type: "lie", text: clean });
  };

  return (
    <>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <h2 class="fl-q">{v.text}</h2>
      {locked !== null ? (
        <div class="fl-locked" role="status" data-testid="fl-locked">
          <span>{t.controller.yourLie}</span>
          <strong>{locked}</strong>
          <small>{t.controller.waiting}</small>
        </div>
      ) : (
        <form class="fl-form" onSubmit={submit} data-testid="fl-form">
          <label class="fl-label" for="fl-lie">
            {t.controller.writeLabel}
            <span class={`fl-counter ${length > LIE_MAX ? "is-over" : ""}`} data-testid="fl-counter">
              {t.controller.counter(length, LIE_MAX)}
            </span>
          </label>
          <input
            id="fl-lie"
            class="fl-input"
            type="text"
            value={text}
            maxLength={LIE_MAX}
            placeholder={t.controller.placeholder}
            autocomplete="off"
            spellcheck={false}
            enterkeyhint="send"
            data-testid="fl-input"
            onInput={(e) => setText(e.currentTarget.value)}
          />
          {v.rejected && (
            <p class="fl-rejected" role="alert" data-testid="fl-rejected">
              {t.controller.rejected}
            </p>
          )}
          <button type="submit" class="fl-submit" disabled={!valid} data-testid="fl-submit">
            {t.controller.submit}
          </button>
        </form>
      )}
    </>
  );
}

function Choose({ v, api, now, failed }: { v: V<"choose">; api: Props["api"]; now: number; failed: boolean }) {
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (failed) setPending(null);
  }, [failed]);
  const choice = v.choice ?? pending;
  const dense = v.options.length >= 6;
  return (
    <>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <h2 class={`fl-q fl-q--small ${dense ? "is-dense" : ""}`}>{v.text}</h2>
      <p class="fl-lead">{choice === null ? t.controller.chooseLead : t.controller.chosen}</p>
      <div class={`fl-btns ${dense ? "is-dense" : ""}`} role="group">
        {v.options.map((o, i) => {
          const own = i === v.own;
          const picked = i === choice;
          return (
            <button
              key={i}
              type="button"
              class={`fl-btn ${own ? "is-own" : ""} ${picked ? "is-picked" : ""} ${choice !== null && !picked ? "is-dim" : ""}`}
              disabled={own || choice !== null}
              aria-label={t.controller.answerLabel(o)}
              aria-pressed={picked}
              data-testid={`fl-btn-${i}`}
              onClick={() => {
                setPending(i);
                api.vibrate(30);
                api.sendInput({ type: "choose", index: i });
              }}
            >
              <span class="fl-btn__text">{o}</span>
              {own && <span class="fl-btn__own">{v.auto ? t.controller.ownLieAuto : t.controller.ownLie}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Result({ v }: { v: V<"reveal"> }) {
  const r = v.result!;
  let headline: string;
  if (r.foundTruth) headline = t.controller.foundTruth;
  else if (r.fooledBy !== null) headline = r.fooledBy.length > 0 ? t.controller.fooledByPlayers(joinNames(r.fooledBy)) : t.controller.fooledByHouse;
  else headline = t.controller.noChoiceResult;
  return (
    <div class={`fl-result ${r.foundTruth ? "is-good" : r.fooledBy !== null ? "is-bad" : ""}`} role="status" data-testid="fl-result">
      <strong>{headline}</strong>
      <dl class="fl-facts">
        <dt>{t.controller.truthWas}</dt>
        <dd>{r.truth}</dd>
        {r.choice !== null && !r.foundTruth && (
          <>
            <dt>{t.controller.yourChoice}</dt>
            <dd>{r.choice}</dd>
          </>
        )}
        {r.lie !== null && (
          <>
            <dt>{t.controller.yourLieLabel}</dt>
            <dd>{r.lie}</dd>
          </>
        )}
      </dl>
      {r.lie !== null && (
        <span class="fl-fooled" data-testid="fl-fooled">
          {r.fooledNames.length > 0 ? t.controller.fooledYou(joinNames(r.fooledNames)) : t.controller.nobodyFooled}
        </span>
      )}
      {r.points > 0 && <span class="fl-gain">{t.plus(r.points)}</span>}
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

export default preactControllerView<FlPlayerView, FlInput>(FlunkernController);
