// Controller-View „Wer ist der Spion?“ (Hochformat).
// Die geheime Rolle liegt als verdeckte Karte oben: Halten zeigt sie, solange der Finger drauf ist; kurzes
// Antippen zeigt sie für ein paar Sekunden (erneutes Tippen verdeckt sie sofort). So können Nachbarn nicht
// mitlesen. Die Karte ist in jeder Phase der Runde da – auch nach einem Reconnect (der Server schickt `secret`
// in jeder Ansicht mit).
// Hinweise: Wer dran ist, bekommt ein Textfeld (ein Wort, max. 24 Zeichen) + „Abschicken“/„Auslassen“, alle
// anderen sehen, wer gerade dran ist und wann sie selbst drankommen. Abstimmen: große Kacheln der Mitspieler.
// Raten: Nur der enttarnte Spion sieht die acht Wörter als Buttons.
// Merkt sich gespielte Wörter (seen.ts) – erst im Rundenergebnis, vorher kennt das Handy die Wort-ID nicht.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { CLUE_MAX } from "../constants.js";
import { AWARDS, CATEGORY_LABELS, t } from "../i18n/de.js";
import { cleanText, clueLength, hasSpace, isValidClue } from "../normalize.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import type { SpInput, SpPerson, SpPlayerView, SpSecret } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<SpPlayerView, SpInput>;
type V<P extends SpPlayerView["phase"]> = Extract<SpPlayerView, { phase: P }>;

/** Ab dieser Druckdauer gilt es als „Halten“ (Loslassen verdeckt sofort), darunter als „Antippen“. */
export const HOLD_MS = 350;
/** So lange bleibt die Karte nach einem Antippen offen. */
export const PEEK_MS = 4_000;

function SpionController({ view, api, error }: Props) {
  ensureStyles("sp-ctl-css", CONTROLLER_CSS);
  const timed = view?.phase === "role" || view?.phase === "clue" || view?.phase === "vote" || view?.phase === "guess";
  const now = Math.max(useServerNow(api.serverNow, timed), api.serverNow());

  // Gedächtnis: einmal je Spiel melden, jedes gespielte Wort im Rundenergebnis merken.
  const reported = useRef(false);
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || reported.current) return;
    reported.current = true;
    api.sendInput({ type: "seen", ids: packSeen(loadSeen(storage())) });
  }, [hasView]);
  const wordId = view?.phase === "result" ? view.wordId : null;
  useEffect(() => {
    if (wordId) rememberSeen(storage(), wordId);
  }, [wordId]);

  // Vibrieren: wenn man dran ist und beim eigenen Ergebnis.
  const myTurnKey = view?.phase === "clue" && view.myTurn ? `${view.round}-${view.clueRound}` : null;
  useEffect(() => {
    if (myTurnKey) api.vibrate([40, 60, 40]);
  }, [myTurnKey]);
  const resultKey = view?.phase === "result" ? `${view.round}` : null;
  useEffect(() => {
    if (view?.phase === "result") api.vibrate(view.won ? [60, 40, 60] : [200]);
  }, [resultKey]);

  if (!view) {
    return (
      <div class="sp-ctl">
        <p class="sp-msg">{t.controller.loading}</p>
      </div>
    );
  }
  let body;
  switch (view.phase) {
    case "intro":
      body = (
        <p class="sp-msg">
          <span class="sp-msg__icon" aria-hidden="true">
            🕵️
          </span>
          {t.controller.intro}
        </p>
      );
      break;
    case "role":
      body = <Role key={`r${view.round}`} v={view} api={api} />;
      break;
    case "clue":
      body = <Clue key={`c${view.round}-${view.clueRound}-${view.turn.id}`} v={view} api={api} now={now} failed={error !== null} />;
      break;
    case "vote":
      body = <Vote key={`v${view.round}-${view.runoff}`} v={view} api={api} now={now} failed={error !== null} />;
      break;
    case "reveal":
      body = <p class="sp-msg sp-big">{t.controller.watchTv}</p>;
      break;
    case "guess":
      body = <Guess key={`g${view.round}`} v={view} api={api} now={now} failed={error !== null} />;
      break;
    case "result":
      body = <Result v={view} />;
      break;
    case "final":
      body = (
        <div class="sp-result" data-testid="sp-final">
          <strong>{t.controller.finalTitle}</strong>
          <span>{t.controller.standings(view.rank, view.playerCount)}</span>
          <span class="sp-gain">{t.points(view.score)}</span>
          <span>{t.controller.finalStats(view.correctVotes, view.spyWins)}</span>
          {view.awards.map((a) => (
            <span key={a} class="sp-award">
              {AWARDS[a].icon} {AWARDS[a].title}
            </span>
          ))}
        </div>
      );
      break;
  }
  const showCard = view.secret !== null && view.phase !== "role" && view.phase !== "result";
  return (
    <div class={`sp-ctl sp-ctl--${view.phase}`} data-testid="sp-controller" data-phase={view.phase}>
      <header class="sp-top">
        <span>{view.phase === "intro" || view.phase === "final" ? t.title : t.round(view.round, view.total)}</span>
        <span>{t.points(view.score)}</span>
      </header>
      {showCard && <SecretCard key={`s${view.round}`} secret={view.secret!} compact />}
      {body}
    </div>
  );
}

/** Verdeckte Rollenkarte: Halten = anzeigen solange gedrückt, Antippen = kurz anzeigen. */
function SecretCard({ secret, compact = false, onPeek }: { secret: SpSecret; compact?: boolean; onPeek?: () => void }) {
  const [shown, setShown] = useState(false);
  const downAt = useRef(0);
  const latched = useRef(false);
  const ignoreUp = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const hide = (): void => {
    clear();
    latched.current = false;
    setShown(false);
  };
  const down = (e: Event): void => {
    e.preventDefault();
    if (latched.current) {
      // Zweites Antippen verdeckt sofort.
      ignoreUp.current = true;
      hide();
      return;
    }
    ignoreUp.current = false;
    downAt.current = Date.now();
    setShown(true);
    onPeek?.();
  };
  const up = (): void => {
    if (ignoreUp.current) {
      ignoreUp.current = false;
      return;
    }
    if (!shown && !downAt.current) return;
    if (Date.now() - downAt.current >= HOLD_MS) {
      hide();
    } else {
      latched.current = true;
      clear();
      timer.current = setTimeout(hide, PEEK_MS);
    }
    downAt.current = 0;
  };
  const cancel = (): void => {
    if (!latched.current) hide();
    downAt.current = 0;
  };
  const key = (e: KeyboardEvent): void => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (shown) hide();
    else {
      latched.current = true;
      setShown(true);
      onPeek?.();
      clear();
      timer.current = setTimeout(hide, PEEK_MS);
    }
  };
  const spy = secret.kind === "spy";
  return (
    <div
      class={`sp-secret ${compact ? "is-compact" : ""} ${shown ? "is-shown" : ""} ${shown && spy ? "is-spy" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={shown}
      aria-label={t.controller.holdToReveal}
      data-testid="sp-secret"
      data-shown={shown ? "1" : "0"}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={key}
    >
      {shown ? (
        <span class="sp-secret__face" data-testid="sp-secret-face">
          <small>{t.controller.category(CATEGORY_LABELS[secret.category])}</small>
          {spy ? (
            <>
              <strong data-testid="sp-secret-text">{t.controller.youAreSpy}</strong>
              {!compact && <em>{t.controller.spyHint}</em>}
            </>
          ) : (
            <>
              {!compact && <em>{t.controller.yourWord}</em>}
              <strong data-testid="sp-secret-text">{secret.word}</strong>
            </>
          )}
        </span>
      ) : (
        <span class="sp-secret__back">
          <b>{t.topSecret}</b>
          <small>🔒 {compact ? t.controller.hiddenCompact : t.controller.holdToReveal}</small>
        </span>
      )}
    </div>
  );
}

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const remaining = Math.max(0, endsAt - now);
  return (
    <div class="sp-time" aria-hidden="true">
      <span key={endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / durationMs)})`, animation: `sp-drain ${remaining}ms linear forwards` }} />
    </div>
  );
}

function Dot({ p }: { p: SpPerson }) {
  return (
    <span class="sp-dot" style={{ "--c": playerColor(p.color) }} aria-hidden="true">
      {avatarEmoji(p.avatar)}
    </span>
  );
}

function Role({ v, api }: { v: V<"role">; api: Props["api"] }) {
  const [peeked, setPeeked] = useState(false);
  const [pending, setPending] = useState(false);
  const done = v.ready || pending;
  return (
    <>
      <SecretCard secret={v.secret!} onPeek={() => setPeeked(true)} />
      <button
        type="button"
        class="sp-submit"
        disabled={done || !peeked}
        data-testid="sp-ready"
        onClick={() => {
          setPending(true);
          api.vibrate(30);
          api.sendInput({ type: "ready" });
        }}
      >
        {done ? t.controller.readyWait : peeked ? t.controller.readyButton : t.controller.readyLocked}
      </button>
    </>
  );
}

function MyClues({ clues }: { clues: ReadonlyArray<string | null> }) {
  if (clues.length === 0) return null;
  return (
    <p class="sp-mine" data-testid="sp-my-clues">
      <span>{t.controller.myClues}</span>
      {clues.map((c, i) => (
        <b key={i}>{c ?? t.passed}</b>
      ))}
    </p>
  );
}

function Clue({ v, api, now, failed }: { v: V<"clue">; api: Props["api"]; now: number; failed: boolean }) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  // Jede neue Ansicht (z. B. Ablehnung) bzw. ein Fehler gibt das Feld wieder frei.
  useEffect(() => setPending(false), [v]);
  useEffect(() => {
    if (failed) setPending(false);
  }, [failed]);
  const clean = cleanText(text);
  const length = clueLength(clean);
  const valid = isValidClue(clean);

  if (!v.myTurn) {
    return (
      <>
        <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
        <div class="sp-wait" role="status" data-testid="sp-wait">
          <small>{t.clueRound(v.clueRound, v.clueRounds)}</small>
          <span class="sp-wait__who" style={{ "--c": playerColor(v.turn.color) }}>
            <Dot p={v.turn} />
            <strong>{t.controller.othersTurn(v.turn.name)}</strong>
          </span>
          <span>{v.turnsUntil === null ? t.controller.noMoreTurns : t.controller.turnsUntil(v.turnsUntil)}</span>
        </div>
        <MyClues clues={v.myClues} />
      </>
    );
  }

  const submit = (e: Event): void => {
    e.preventDefault();
    if (pending || !valid || now >= v.endsAt) return;
    setPending(true);
    api.vibrate(30);
    api.sendInput({ type: "clue", text: clean });
  };
  return (
    <>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <p class="sp-lead sp-lead--turn">
        {t.controller.yourTurn} <small>{t.clueRound(v.clueRound, v.clueRounds)}</small>
      </p>
      <form class="sp-form" onSubmit={submit} data-testid="sp-form">
        <label class="sp-label" for="sp-clue">
          {t.controller.clueLabel}
          <span class={`sp-counter ${length > CLUE_MAX ? "is-over" : ""}`} data-testid="sp-counter">
            {t.controller.counter(length, CLUE_MAX)}
          </span>
        </label>
        <input
          id="sp-clue"
          class="sp-input"
          type="text"
          value={text}
          maxLength={CLUE_MAX}
          placeholder={t.controller.placeholder}
          autocomplete="off"
          autocapitalize="sentences"
          spellcheck={false}
          enterkeyhint="send"
          data-testid="sp-input"
          onInput={(e) => setText(e.currentTarget.value)}
        />
        {hasSpace(clean) && (
          <p class="sp-warn" role="alert" data-testid="sp-one-word">
            {t.controller.oneWord}
          </p>
        )}
        {v.rejected && (
          <p class="sp-warn is-bad" role="alert" data-testid="sp-rejected">
            {t.controller.rejected}
          </p>
        )}
        <div class="sp-row">
          <button
            type="button"
            class="sp-pass"
            disabled={pending}
            data-testid="sp-pass"
            onClick={() => {
              setPending(true);
              api.sendInput({ type: "pass" });
            }}
          >
            {t.controller.pass}
          </button>
          <button type="submit" class="sp-submit" disabled={!valid || pending} data-testid="sp-submit">
            {t.controller.submit}
          </button>
        </div>
      </form>
      <MyClues clues={v.myClues} />
    </>
  );
}

function Vote({ v, api, now, failed }: { v: V<"vote">; api: Props["api"]; now: number; failed: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (failed) setPending(null);
  }, [failed]);
  // Fällt der Verdächtige weg, setzt der Server die Wahl zurück (choice null) – dann darf neu gewählt werden.
  const chosenId = v.choice ?? (pending !== null && v.candidates.some((c) => c.id === pending) ? pending : null);
  const chosen = v.candidates.find((c) => c.id === chosenId) ?? null;
  const many = v.candidates.length > 5;
  return (
    <>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <p class={`sp-lead ${v.runoff ? "is-runoff" : ""}`}>{v.runoff ? t.controller.runoffLead : t.controller.voteLead}</p>
      {v.inRunoff && <p class="sp-note">{t.controller.inRunoff}</p>}
      {chosen ? (
        <div class="sp-locked" role="status" data-testid="sp-locked">
          <span class="sp-locked__label">{t.controller.yourVote}</span>
          <span class="sp-locked__who">
            <Dot p={chosen} />
            <span>{chosen.name}</span>
          </span>
          <small>{t.controller.locked}</small>
        </div>
      ) : (
        <div class={`sp-tiles ${many ? "sp-tiles--many" : ""}`}>
          {v.candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              class="sp-tile"
              style={{ "--c": playerColor(c.color) }}
              aria-label={t.controller.voteFor(c.name)}
              data-testid={`sp-tile-${c.id}`}
              onClick={() => {
                if (chosenId !== null) return;
                setPending(c.id);
                api.vibrate(30);
                api.sendInput({ type: "vote", target: c.id });
              }}
            >
              <span class="sp-tile__emoji" aria-hidden="true">
                {avatarEmoji(c.avatar)}
              </span>
              <span class="sp-tile__name">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Guess({ v, api, now, failed }: { v: V<"guess">; api: Props["api"]; now: number; failed: boolean }) {
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (failed) setPending(null);
  }, [failed]);
  if (!v.canGuess) {
    return (
      <>
        <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
        <div class="sp-wait" role="status" data-testid="sp-guess-wait">
          <span class="sp-wait__who" style={{ "--c": playerColor(v.spy.color) }}>
            <Dot p={v.spy} />
          </span>
          <strong>{t.controller.guessWait(v.spy.name)}</strong>
        </div>
      </>
    );
  }
  const choice = v.choice ?? pending;
  return (
    <>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <p class="sp-lead">{choice === null ? t.controller.guessLead : t.controller.guessSent}</p>
      <div class="sp-btns" role="group">
        {v.options.map((o, i) => (
          <button
            key={o}
            type="button"
            class={`sp-btn ${i === choice ? "is-picked" : ""} ${choice !== null && i !== choice ? "is-dim" : ""}`}
            disabled={choice !== null}
            aria-label={t.controller.guessOption(o)}
            aria-pressed={i === choice}
            data-testid={`sp-guess-${i}`}
            onClick={() => {
              setPending(i);
              api.vibrate(30);
              api.sendInput({ type: "guess", index: i });
            }}
          >
            {o}
          </button>
        ))}
      </div>
    </>
  );
}

function Result({ v }: { v: V<"result"> }) {
  const headline = v.winner === "none" ? t.controller.voided : v.won ? t.controller.won : t.controller.lost;
  return (
    <div class={`sp-result ${v.winner === "none" ? "" : v.won ? "is-good" : "is-bad"}`} role="status" data-testid="sp-result">
      <strong>{headline}</strong>
      {v.wasSpy && <span class="sp-you-spy">{t.controller.youWereSpy}</span>}
      <dl class="sp-facts">
        <dt>{t.controller.wordWas}</dt>
        <dd data-testid="sp-result-word">{v.word}</dd>
        {v.spyWord && (
          <>
            <dt>{t.controller.spyWordWas}</dt>
            <dd>{v.spyWord}</dd>
          </>
        )}
        <dt>{t.controller.spyWas}</dt>
        <dd>{v.spy.name}</dd>
      </dl>
      {v.votedRight && <span class="sp-right">{t.controller.votedRight}</span>}
      {v.points > 0 && <span class="sp-gain">{t.plus(v.points)}</span>}
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

export default preactControllerView<SpPlayerView, SpInput>(SpionController);
