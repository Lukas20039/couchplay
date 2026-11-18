// Controller-View „Stadt, Land, Fluss“ (Hochformat).
// Schreiben: ein Feld je Kategorie (Enter springt ins nächste), Eingaben gehen entprellt als Ganzes an den Server,
// spätestens beim Sperren („Stifte weg!“) bzw. beim Abbau. Vom Server zurückgemeldete Antworten stellen nach einem
// Reload den Stand wieder her; weicht der Server ab (z. B. nach Reconnect), wird der lokale Stand erneut geschickt.
// „Stopp!“ erst mit allen Feldern ausgefüllt. Der Hinweis „beginnt nicht mit …“ ist nur eine Hilfe – es zählt die
// Prüfung des Servers.
// Prüfung: fremde Antworten der Kategorie mit Daumen-runter-Knopf, „Passt – weiter“.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ANSWER_MAX } from "../constants.js";
import { AWARDS, CATEGORY_LABELS, STATUS_LABELS, t } from "../i18n/de.js";
import { answerLength, checkAnswer, cleanAnswer } from "../normalize.js";
import { SEND_DEBOUNCE_MS, type SlInput, type SlPhoneEntry, type SlPlayerView } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, secondsLeft, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<SlPlayerView, SlInput>;
type V<P extends SlPlayerView["phase"]> = Extract<SlPlayerView, { phase: P }>;
type Api = Props["api"];

function StadtlandController({ view, api, error }: Props) {
  ensureStyles("sl-ctl-css", CONTROLLER_CSS);
  const ticking = view?.phase === "write" || view?.phase === "review";
  const now = Math.max(useServerNow(api.serverNow, ticking), api.serverNow());

  if (!view) {
    return (
      <div class="sl-ctl">
        <p class="sl-msg">{t.controller.loading}</p>
      </div>
    );
  }
  let body;
  switch (view.phase) {
    case "intro":
      body = (
        <p class="sl-msg">
          <span class="sl-msg__icon" aria-hidden="true">
            ✍️
          </span>
          {t.controller.intro}
        </p>
      );
      break;
    case "letter":
      body = (
        <p class="sl-msg sl-big">
          <span class="sl-msg__icon sl-spin" aria-hidden="true">
            🎰
          </span>
          {t.controller.letterWait}
        </p>
      );
      break;
    case "write":
    case "timeup":
      body = <Write key={`w${view.round}`} v={view} api={api} now={now} />;
      break;
    case "review":
      body = <Review key={`r${view.round}-${view.index}`} v={view} api={api} now={now} failed={error !== null} />;
      break;
    case "standings":
      body = (
        <div class="sl-result">
          <strong>{t.controller.standings(view.rank, view.playerCount)}</strong>
          <span class="sl-gain">{t.controller.roundPoints(view.roundPoints)}</span>
          <span>{t.points(view.score)}</span>
        </div>
      );
      break;
    case "final":
      body = (
        <div class="sl-result">
          <strong>{t.controller.finalTitle}</strong>
          <span>{t.controller.standings(view.rank, view.playerCount)}</span>
          <span class="sl-gain">{t.points(view.score)}</span>
          <span>{t.controller.finalStats(view.valid, view.solos)}</span>
          {view.awards.map((a) => (
            <span key={a} class="sl-award">
              {AWARDS[a].icon} {AWARDS[a].title}
            </span>
          ))}
        </div>
      );
      break;
  }
  return (
    <div class={`sl-ctl sl-ctl--${view.phase}`} data-testid="sl-controller" data-phase={view.phase}>
      <header class="sl-top">
        <span>{view.phase === "intro" ? t.title : t.round(view.round, view.total)}</span>
        <span>{t.points(view.score)}</span>
      </header>
      {body}
    </div>
  );
}

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const remaining = Math.max(0, endsAt - now);
  return (
    <div class="sl-time" aria-hidden="true">
      <span key={endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / durationMs)})`, animation: `sl-drain ${remaining}ms linear forwards` }} />
    </div>
  );
}

const pad = (answers: readonly string[], n: number): string[] => Array.from({ length: n }, (_, i) => answers[i] ?? "");
const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

function Write({ v, api, now }: { v: V<"write"> | V<"timeup">; api: Api; now: number }) {
  const n = v.categories.length;
  const [values, setValues] = useState(() => pad(v.answers, n));
  const valuesRef = useRef(values);
  valuesRef.current = values;
  /** Zuletzt gesendeter bzw. vom Server bestätigter Stand (bereinigt). */
  const sent = useRef(pad(v.answers, n).map(cleanAnswer));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const locked = v.phase === "timeup" || now >= v.endsAt;

  const flush = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const clean = valuesRef.current.map(cleanAnswer);
    if (same(clean, sent.current)) return;
    sent.current = clean;
    api.sendInput({ type: "answers", round: v.round, answers: clean });
  };
  const schedule = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SEND_DEBOUNCE_MS);
  };

  // Server-Stand übernehmen; weicht er vom lokalen ab (Reconnect, verlorene Nachricht), erneut senden.
  useEffect(() => {
    sent.current = pad(v.answers, n);
    if (!same(valuesRef.current.map(cleanAnswer), sent.current)) schedule();
  }, [v]);
  // Beim Sperren und beim Abbau sofort senden – so geht am Rundenende nichts verloren.
  useEffect(() => {
    if (locked) flush();
  }, [locked]);
  useEffect(() => flush, []);

  const set = (i: number, text: string): void => {
    if (locked) return;
    const next = [...valuesRef.current];
    next[i] = text;
    valuesRef.current = next;
    setValues(next);
    schedule();
  };
  const onKey = (i: number, e: KeyboardEvent): void => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = inputs.current[i + 1];
    if (next) next.focus();
    else inputs.current[i]?.blur();
  };

  const complete = values.every((x) => cleanAnswer(x) !== "");
  const stop = v.phase === "write" ? v.stop : null;
  const canStop = v.phase === "write" && complete && stop === null && !locked;

  return (
    <>
      <div class="sl-letterbar">
        <span class="sl-letter" data-testid="sl-letter">
          {v.letter}
        </span>
        {v.phase === "write" && !locked ? (
          <span class={`sl-secs ${secondsLeft(v.endsAt, now) <= 10 ? "is-hurry" : ""}`}>{secondsLeft(v.endsAt, now)}</span>
        ) : (
          <span class="sl-timeup" role="status" data-testid="sl-timeup">
            {t.controller.timeUp}
          </span>
        )}
      </div>
      {v.phase === "write" && <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />}
      {stop && !locked && (
        <p class="sl-stopbar" role="alert" data-testid="sl-stopbar">
          {stop.mine ? t.controller.stopMine : t.controller.stopBy(stop.by)} {t.controller.stopLeft(secondsLeft(stop.endsAt, now))}
        </p>
      )}
      <form class="sl-fields" data-testid="sl-form" onSubmit={(e) => e.preventDefault()}>
        {v.categories.map((c, i) => {
          const value = values[i] ?? "";
          const check = cleanAnswer(value) === "" ? "empty" : checkAnswer(value, v.letter);
          return (
            <label key={c} class={`sl-field is-${check}`}>
              <span class="sl-field__label">
                <span>{CATEGORY_LABELS[c]}</span>
                {check === "ok" && <b aria-hidden="true">✓</b>}
                {(check === "letter" || check === "short") && <em>{check === "letter" ? t.controller.wrongLetter(v.letter) : STATUS_LABELS.short}</em>}
                {answerLength(value) >= ANSWER_MAX && <em>{t.controller.counter(answerLength(value), ANSWER_MAX)}</em>}
              </span>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                class="sl-input"
                type="text"
                value={value}
                maxLength={ANSWER_MAX}
                placeholder={t.controller.placeholder(v.letter)}
                autocomplete="off"
                autocapitalize="words"
                spellcheck={false}
                enterkeyhint={i + 1 < n ? "next" : "done"}
                disabled={locked}
                data-testid={`sl-input-${i}`}
                onInput={(e) => set(i, e.currentTarget.value)}
                onKeyDown={(e) => onKey(i, e)}
                onBlur={flush}
              />
            </label>
          );
        })}
      </form>
      {v.phase === "write" && !locked ? (
        <button
          type="button"
          class="sl-stop"
          disabled={!canStop}
          data-testid="sl-stop"
          onClick={() => {
            flush();
            api.vibrate([40, 30, 80]);
            api.sendInput({ type: "stop", round: v.round });
          }}
        >
          {stop ? t.controller.stopBy(stop.by) : complete ? t.controller.stop : t.controller.stopHint}
        </button>
      ) : (
        <p class="sl-lead">{t.controller.timeUpLead}</p>
      )}
    </>
  );
}

function Review({ v, api, now, failed }: { v: V<"review">; api: Api; now: number; failed: boolean }) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [readyPending, setReadyPending] = useState(false);
  useEffect(() => setPending({}), [v]);
  useEffect(() => {
    if (failed) {
      setPending({});
      setReadyPending(false);
    }
  }, [failed]);
  const ready = v.ready || readyPending;
  const category = v.categories[v.index]!;
  const anyVote = v.entries.some((e) => e.canVote);
  return (
    <>
      <div class="sl-letterbar">
        <span class="sl-letter sl-letter--small">{v.letter}</span>
        <span class="sl-cat" data-testid="sl-category">
          {CATEGORY_LABELS[category]}
          <small>
            {" "}
            {v.index + 1}/{v.categories.length}
          </small>
        </span>
      </div>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      {anyVote && <p class="sl-lead">{t.controller.reviewLead}</p>}
      <ul class={`sl-entries ${v.entries.length > 5 ? "is-dense" : ""}`} data-testid="sl-entries">
        {v.entries.map((e) => (
          <EntryRow
            key={e.playerId}
            e={e}
            voted={pending[e.key] ?? e.voted}
            onVote={(on) => {
              setPending((p) => ({ ...p, [e.key]: on }));
              api.vibrate(25);
              api.sendInput({ type: "challenge", round: v.round, category: v.index, key: e.key, on });
            }}
          />
        ))}
      </ul>
      <button
        type="button"
        class="sl-ready"
        disabled={ready}
        data-testid="sl-ready"
        onClick={() => {
          setReadyPending(true);
          api.sendInput({ type: "ready", round: v.round, category: v.index });
        }}
      >
        {ready ? t.controller.readyDone : t.controller.ready}
      </button>
    </>
  );
}

function EntryRow({ e, voted, onVote }: { e: SlPhoneEntry; voted: boolean; onVote: (on: boolean) => void }) {
  const reason = STATUS_LABELS[e.status];
  return (
    <li class={`sl-entry is-${e.status} ${e.mine ? "is-mine" : ""}`} style={{ "--c": playerColor(e.color) }} data-testid={`sl-entry-${e.playerId}`}>
      <span class="sl-entry__av" aria-hidden="true">
        {avatarEmoji(e.avatar)}
      </span>
      <span class="sl-entry__body">
        <small>
          {e.mine ? t.controller.mine : e.name}
          {reason && <em> · {reason}</em>}
        </small>
        <span class="sl-entry__text">{e.text || t.controller.noAnswer}</span>
      </span>
      <span class="sl-entry__pts">{e.points > 0 ? t.plus(e.points) : "0"}</span>
      {e.canVote && (
        <button
          type="button"
          class={`sl-thumb ${voted ? "is-on" : ""}`}
          aria-pressed={voted}
          aria-label={t.controller.voteLabel(e.text)}
          data-testid={`sl-thumb-${e.playerId}`}
          onClick={() => onVote(!voted)}
        >
          👎<small>{e.needed !== null ? `${e.votes}/${e.needed}` : ""}</small>
        </button>
      )}
    </li>
  );
}

export default preactControllerView<SlPlayerView, SlInput>(StadtlandController);
