// Controller-View „Stadt, Land, Fluss“ (Hochformat).
// Schreiben: ein Feld je Kategorie (Enter springt ins nächste), Eingaben gehen entprellt als Ganzes an den Server,
// spätestens beim Sperren („Stifte weg!“) bzw. beim Abbau. Vom Server zurückgemeldete Antworten stellen nach einem
// Reload den Stand wieder her; weicht der Server ab (z. B. nach Reconnect), wird der lokale Stand erneut geschickt.
// „Stopp!“ erst mit allen Feldern ausgefüllt. Der Hinweis „beginnt nicht mit …“ ist nur eine Hilfe – es zählt die
// Prüfung des Servers.
// Prüfung: fremde Antworten der Kategorie mit Abstimm-Knopf gegen die Voreinstellung (👎 streichen bzw. 👍 retten,
// wenn das Lexikon die Antwort nicht kennt), „Passt – weiter“.
// Eigene Kategorien (setup): Nur das Host-Handy (api.isHost()) zeigt den Editor – vorbelegt mit der zuletzt bestätigten
// Liste aus localStorage (sonst Stadt, Land, Fluss …), Stand geht entprellt an den Server, „Los geht’s!“ speichert
// die Liste. Die anderen Handys warten. Nach einem Reload übernimmt der Editor den Stand vom Server.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { useEffect, useRef, useState } from "preact/hooks";
import { ANSWER_MAX, CATEGORY_IDS, CUSTOM_MIN, CUSTOM_NAME_MAX, MAX_CATEGORIES } from "../constants.js";
import { cleanCategoryList, loadCustom, saveCustom } from "../custom.js";
import { AWARDS, CATEGORY_LABELS, CUSTOM_DEFAULTS, STATUS_LABELS, categoryLabel, t } from "../i18n/de.js";
import { answerKey, answerLength, checkAnswer, cleanAnswer } from "../normalize.js";
import { SEND_DEBOUNCE_MS, type SlInput, type SlPhoneEntry, type SlPlayerView } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, secondsLeft, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<SlPlayerView, SlInput>;
type V<P extends SlPlayerView["phase"]> = Extract<SlPlayerView, { phase: P }>;
type Api = Props["api"];

function StadtlandController({ view, api, error, players }: Props) {
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
    case "setup":
      body = api.isHost() ? <SetupEditor v={view} api={api} /> : <SetupWait v={view} players={players} />;
      break;
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
        <span>{view.phase === "intro" || view.phase === "setup" ? t.title : t.round(view.round, view.total)}</span>
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

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Wartebildschirm der anderen Handys, solange der Host die Kategorien festlegt (Stand live). */
function SetupWait({ v, players }: { v: V<"setup">; players: readonly Player[] }) {
  const host = players.find((p) => p.isHost)?.name ?? null;
  return (
    <div class="sl-msg sl-setup-wait" data-testid="sl-setup-wait">
      <span class="sl-msg__icon sl-spin" aria-hidden="true">
        📝
      </span>
      {t.controller.setupWait(host)}
      {v.categories.length > 0 && (
        <ol class="sl-setup-wait__list">
          {v.categories.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Editor für eigene Kategorien (nur Host-Handy). */
function SetupEditor({ v, api }: { v: V<"setup">; api: Api }) {
  const [fields, setFields] = useState<string[]>(() => {
    const initial = v.categories.length > 0 ? v.categories : (loadCustom(storage(), CUSTOM_MIN) ?? CUSTOM_DEFAULTS);
    const out = initial.slice(0, MAX_CATEGORIES);
    while (out.length < CUSTOM_MIN) out.push("");
    return out;
  });
  const [done, setDone] = useState(false);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const sent = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndex = useRef<number | null>(null);

  const flush = (final = false): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    const list = cleanCategoryList(fieldsRef.current);
    const json = JSON.stringify(list);
    if (!final && json === sent.current) return;
    sent.current = json;
    api.sendInput({ type: "custom", categories: list, done: final });
  };
  const schedule = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(), SEND_DEBOUNCE_MS);
  };
  // Startstand sofort zeigen (TV), beim Abbau Ausstehendes senden.
  useEffect(() => {
    flush();
    return () => {
      if (timer.current !== null) flush();
    };
  }, []);
  useEffect(() => {
    if (focusIndex.current === null) return;
    inputs.current[focusIndex.current]?.focus();
    focusIndex.current = null;
  }, [fields]);

  const update = (next: string[], focus: number | null = null): void => {
    if (done) return;
    fieldsRef.current = next;
    focusIndex.current = focus;
    setFields(next);
    schedule();
  };
  // Immer vom aktuellsten Stand aus (schnelle Taps vor dem nächsten Render).
  const setAt = (i: number, text: string): void => update(fieldsRef.current.map((f, j) => (j === i ? text : f)));
  const remove = (i: number): void => update(fieldsRef.current.filter((_, j) => j !== i));
  const add = (text = ""): void => {
    const cur = fieldsRef.current;
    const empty = cur.findIndex((f) => cleanAnswer(f) === "");
    if (text !== "" && empty >= 0) return update(cur.map((f, j) => (j === empty ? text : f)));
    if (cur.length >= MAX_CATEGORIES) return;
    update([...cur, text], text === "" ? cur.length : null);
  };
  const onKey = (i: number, e: KeyboardEvent): void => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = inputs.current[i + 1];
    if (next) next.focus();
    else inputs.current[i]?.blur();
  };

  const keys = fields.map((f) => answerKey(f));
  const duplicate = (i: number): boolean => keys[i] !== "" && keys.indexOf(keys[i]!) < i;
  const count = cleanCategoryList(fields).length;
  const full = fields.length >= MAX_CATEGORIES && fields.every((f) => cleanAnswer(f) !== "");
  const used = new Set(keys);
  const suggestions = CATEGORY_IDS.map((c) => CATEGORY_LABELS[c]).filter((l) => [...l].length <= CUSTOM_NAME_MAX && !used.has(answerKey(l)));

  return (
    <div class="sl-setup" data-testid="sl-setup-editor">
      <p class="sl-lead">{t.controller.setupLead(CUSTOM_MIN, MAX_CATEGORIES)}</p>
      <div class="sl-setup__fields">
        {fields.map((f, i) => (
          <div key={i} class={`sl-setup__row ${duplicate(i) ? "is-dup" : ""}`}>
            <span class="sl-setup__num" aria-hidden="true">
              {i + 1}
            </span>
            <input
              ref={(el) => {
                inputs.current[i] = el;
              }}
              class="sl-input"
              type="text"
              value={f}
              maxLength={CUSTOM_NAME_MAX}
              placeholder={t.controller.setupPlaceholder(i)}
              autocomplete="off"
              autocapitalize="words"
              spellcheck={false}
              enterkeyhint={i + 1 < fields.length ? "next" : "done"}
              disabled={done}
              aria-label={t.controller.setupPlaceholder(i)}
              data-testid={`sl-custom-${i}`}
              onInput={(e) => setAt(i, e.currentTarget.value)}
              onKeyDown={(e) => onKey(i, e)}
              onBlur={() => flush()}
            />
            {duplicate(i) && <em class="sl-setup__dup">{t.controller.setupDuplicate}</em>}
            <button
              type="button"
              class="sl-setup__remove"
              disabled={done || fields.length <= CUSTOM_MIN}
              aria-label={t.controller.setupRemove(f || t.controller.setupPlaceholder(i))}
              data-testid={`sl-custom-remove-${i}`}
              onClick={() => remove(i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {fields.length < MAX_CATEGORIES && (
        <button type="button" class="sl-setup__add" disabled={done} data-testid="sl-custom-add" onClick={() => add()}>
          {t.controller.setupAdd}
        </button>
      )}
      {!done && !full && suggestions.length > 0 && (
        <>
          <p class="sl-setup__label">{t.controller.setupSuggest}</p>
          <div class="sl-chips" data-testid="sl-custom-chips">
            {suggestions.map((l) => (
              <button key={l} type="button" class="sl-chipbtn" onClick={() => add(l)}>
                {l}
              </button>
            ))}
          </div>
        </>
      )}
      <div class="sl-setup__go">
        {count < CUSTOM_MIN && !done && <small>{t.controller.setupMin(CUSTOM_MIN)}</small>}
        <button
          type="button"
          class="sl-ready"
          disabled={done || count < CUSTOM_MIN}
          data-testid="sl-custom-go"
          onClick={() => {
            const list = cleanCategoryList(fieldsRef.current);
            saveCustom(storage(), list);
            setDone(true);
            api.vibrate(30);
            flush(true);
          }}
        >
          {done ? t.controller.setupSent : t.controller.setupGo}
        </button>
      </div>
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
            <label key={i} class={`sl-field is-${check}`}>
              <span class="sl-field__label">
                <span>{categoryLabel(c)}</span>
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
  const anyRescue = v.entries.some((e) => e.canVote && !e.preset);
  return (
    <>
      <div class="sl-letterbar">
        <span class="sl-letter sl-letter--small">{v.letter}</span>
        <span class="sl-cat" data-testid="sl-category">
          {categoryLabel(category)}
          <small>
            {" "}
            {v.index + 1}/{v.categories.length}
          </small>
        </span>
      </div>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      {anyVote && <p class="sl-lead">{anyRescue ? t.controller.reviewLeadRescue : t.controller.reviewLead}</p>}
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
        class={`sl-ready ${api.isHost() ? "has-skip" : ""}`}
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
  const rescued = e.status === "ok" && !e.preset;
  return (
    <li
      class={`sl-entry is-${e.status} ${rescued ? "is-rescued" : ""} ${e.mine ? "is-mine" : ""}`}
      style={{ "--c": playerColor(e.color) }}
      data-testid={`sl-entry-${e.playerId}`}
      data-status={e.status}
    >
      <span class="sl-entry__av" aria-hidden="true">
        {avatarEmoji(e.avatar)}
      </span>
      <span class="sl-entry__body">
        <small>
          {e.mine ? t.controller.mine : e.name}
          {reason && <em class={e.status === "unlisted" ? "is-lex" : ""}> · {reason}</em>}
          {rescued && <b class="sl-good"> · {t.controller.rescued}</b>}
          {e.lexicon === "known" && <b class="sl-good"> · {t.controller.lexiconKnown}</b>}
          {e.lexicon === "unknown" && e.status === "ok" && !rescued && <em class="is-lex"> · {t.controller.lexiconUnknown}</em>}
        </small>
        <span class="sl-entry__text">{e.text || t.controller.noAnswer}</span>
      </span>
      <span class="sl-entry__pts">{e.points > 0 ? t.plus(e.points) : "0"}</span>
      {e.canVote && (
        <button
          type="button"
          class={`sl-thumb ${e.preset ? "" : "is-up"} ${voted ? "is-on" : ""}`}
          aria-pressed={voted}
          aria-label={e.preset ? t.controller.voteLabel(e.text) : t.controller.rescueLabel(e.text)}
          data-testid={`sl-thumb-${e.playerId}`}
          data-kind={e.preset ? "down" : "up"}
          onClick={() => onVote(!voted)}
        >
          {e.preset ? "👎" : "👍"}
          <small>{e.needed !== null ? `${e.votes}/${e.needed}` : ""}</small>
        </button>
      )}
    </li>
  );
}

export default preactControllerView<SlPlayerView, SlInput>(StadtlandController);
