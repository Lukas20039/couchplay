// Controller-View „Zeichnen & Raten“ (Hochformat).
// Zeichner: Begriff wählen, dann auf der Canvas zeichnen (drawpad.tsx). Alle anderen: Tipps eintippen;
// die Zeichnung sehen sie nur am Fernseher. Merkt sich gespielte Begriffe (seen.ts).
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { GUESS_LIMITS } from "../constants.js";
import { CATEGORY_LABELS, t } from "../i18n/de.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import type { Hint, ZgInput, ZgPlayerView } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, useServerNow } from "../ui/common.js";
import { DrawPad } from "./drawpad.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<ZgPlayerView, ZgInput>;
type Api = Props["api"];
type V<P extends ZgPlayerView["phase"]> = Extract<ZgPlayerView, { phase: P }>;

function ZeichnenController({ view, api }: Props) {
  ensureStyles("zg-ctl-css", CONTROLLER_CSS);
  const timed = view?.phase === "draw" || view?.phase === "choose";
  const now = useServerNow(api.serverNow, timed);

  // Gedächtnis: einmal je Spiel melden, jeden gespielten Begriff merken.
  const reported = useRef(false);
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || reported.current) return;
    reported.current = true;
    api.sendInput({ type: "seen", ids: packSeen(loadSeen(storage())) });
  }, [hasView]);
  const wordId = view?.phase === "reveal" || (view?.phase === "draw" && view.role === "draw") ? view.wordId : null;
  useEffect(() => {
    if (wordId) rememberSeen(storage(), wordId);
  }, [wordId]);

  // Einmal pro Auflösung vibrieren (Plattform schaltet Replays stumm).
  const revealKey = view?.phase === "reveal" ? `${view.round}` : null;
  useEffect(() => {
    if (view?.phase === "reveal" && view.role === "guess") api.vibrate(view.correct ? [60, 40, 60] : [200]);
  }, [revealKey]);

  if (!view) {
    return (
      <div class="zg-ctl">
        <p class="zg-msg">{t.controller.loading}</p>
      </div>
    );
  }
  let body;
  switch (view.phase) {
    case "intro":
      body = <p class="zg-msg">{t.controller.intro}</p>;
      break;
    case "choose":
      body = view.role === "draw" ? <ChooseWord v={view} api={api} now={now} /> : <p class="zg-msg">{t.controller.chooseWait(view.drawer.name)}</p>;
      break;
    case "draw":
      body =
        view.role === "draw" ? (
          <DrawScreen key={`d${view.round}`} v={view} api={api} now={now} />
        ) : (
          <GuessScreen key={`g${view.round}`} v={view} api={api} now={now} />
        );
      break;
    case "reveal":
      body = <Reveal v={view} />;
      break;
    case "standings":
      body = <p class="zg-msg zg-big">{t.controller.standings(view.rank, view.playerCount)}</p>;
      break;
    case "final":
      body = (
        <div class="zg-result">
          <strong>{t.controller.finalTitle}</strong>
          <span>{t.controller.standings(view.rank, view.playerCount)}</span>
          <span class="zg-gain">{t.points(view.score)}</span>
        </div>
      );
      break;
  }
  return (
    <div class={`zg-ctl zg-ctl--${view.phase}`} data-testid="zg-controller" data-phase={view.phase}>
      <header class="zg-top">
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
    <div class="zg-time" aria-hidden="true">
      <span key={endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / durationMs)})`, animation: `zg-drain ${remaining}ms linear forwards` }} />
    </div>
  );
}

function ChooseWord({ v, api, now }: { v: V<"choose"> & { role: "draw" }; api: Api; now: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <p class="zg-lead is-me">{t.controller.chooseLead}</p>
      <div class="zg-options">
        {v.options.map((o, i) => (
          <button
            key={o.word}
            type="button"
            class={`zg-option ${picked === i ? "is-on" : ""}`}
            data-testid={`zg-option-${i}`}
            disabled={picked !== null}
            onClick={() => {
              setPicked(i);
              api.sendInput({ type: "choose", index: i });
            }}
          >
            <small>{CATEGORY_LABELS[o.category]}</small>
            <strong>{o.word}</strong>
          </button>
        ))}
      </div>
    </>
  );
}

function DrawScreen({ v, api, now }: { v: V<"draw"> & { role: "draw" }; api: Api; now: number }) {
  return (
    <div class="zg-draw">
      <div class="zg-wordbar">
        <span>{t.controller.drawWord}</span>
        <strong data-testid="zg-drawword">{v.word}</strong>
        <small>{t.controller.guessedOf(v.guessed, v.guessers)}</small>
      </div>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <DrawPad v={v} api={api} locked={now >= v.endsAt} />
    </div>
  );
}

function HintMini({ hint }: { hint: Hint }) {
  return (
    <div class="zg-hintmini" aria-hidden="true">
      {hint.map((c, i) =>
        c === " " ? <i key={i} class="gap" /> : c === null || /[\p{L}\p{N}]/u.test(c) ? <b key={i}>{c ?? ""}</b> : <span key={i}>{c}</span>,
      )}
    </div>
  );
}

function GuessScreen({ v, api, now }: { v: V<"draw"> & { role: "guess" }; api: Api; now: number }) {
  const [text, setText] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (cooldownTimer.current && clearTimeout(cooldownTimer.current)), []);

  // Neuer „Knapp daneben“-Tipp → kurz vibrieren.
  const latest = v.guesses[0];
  useEffect(() => {
    if (latest?.close) api.vibrate(40);
  }, [v.guessSeq]);
  useEffect(() => {
    if (v.correct) api.vibrate([60, 40, 60]);
  }, [v.correct]);

  if (v.correct) {
    return (
      <div class="zg-success" role="status" data-testid="zg-success">
        <span class="zg-success__icon" aria-hidden="true">
          ✅
        </span>
        <strong>{t.controller.correct}</strong>
        <span class="zg-gain">{t.gain(v.roundPoints)}</span>
        <span>{t.controller.correctSub}</span>
      </div>
    );
  }

  const submit = (e: Event): void => {
    e.preventDefault();
    const guess = text.trim();
    if (guess.length === 0 || cooldown || now >= v.endsAt) return;
    api.sendInput({ type: "guess", text: guess.slice(0, GUESS_LIMITS.maxLength) });
    setText("");
    setCooldown(true);
    cooldownTimer.current = setTimeout(() => setCooldown(false), GUESS_LIMITS.minIntervalMs);
  };

  return (
    <div class="zg-guess">
      <p class="zg-lead" style={{ "--c": playerColor(v.drawer.color) }}>
        <span class="zg-mini" aria-hidden="true">
          {avatarEmoji(v.drawer.avatar)}
        </span>
        {t.controller.guessLead(v.drawer.name)}
      </p>
      <HintMini hint={v.hint} />
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
      <form class="zg-form" onSubmit={submit} data-testid="zg-form">
        <input
          ref={input}
          class="zg-input"
          type="text"
          value={text}
          maxLength={GUESS_LIMITS.maxLength}
          placeholder={t.controller.guessPlaceholder}
          aria-label={t.controller.guessLabel}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck={false}
          enterkeyhint="send"
          data-testid="zg-input"
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button
          type="submit"
          class="zg-send"
          disabled={cooldown || text.trim().length === 0}
          data-testid="zg-send"
          // Fokus im Textfeld lassen, damit die Tastatur offen bleibt.
          onPointerDown={(e) => e.preventDefault()}
        >
          {cooldown ? t.controller.wait : t.controller.guessButton}
        </button>
      </form>
      {latest?.close && (
        <p class="zg-close" role="status" data-testid="zg-close" key={v.guessSeq}>
          {t.controller.close}
        </p>
      )}
      {v.guesses.length > 0 && (
        <ul class="zg-mine" aria-label={t.controller.yourGuesses}>
          {v.guesses.map((g, i) => (
            <li key={`${v.guessSeq - i}`} class={g.close ? "is-close" : ""}>
              {g.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Reveal({ v }: { v: V<"reveal"> }) {
  const drawer = v.role === "draw";
  const headline = drawer
    ? v.guessed > 0
      ? t.controller.drawerGot(v.guessed)
      : t.controller.drawerNone
    : v.correct
      ? t.controller.youHadIt
      : t.controller.youMissed;
  return (
    <div class={`zg-result ${v.correct || (drawer && v.guessed > 0) ? "is-good" : ""}`} role="status" data-testid="zg-result">
      <span>{t.controller.wordWas}</span>
      <strong class="zg-result__word">{v.word}</strong>
      <span class="zg-result__line">{headline}</span>
      {v.roundPoints > 0 && <span class="zg-gain">{t.gain(v.roundPoints)}</span>}
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

export default preactControllerView<ZgPlayerView, ZgInput>(ZeichnenController);
