// Controller-View „Wie gut kennst du mich?“ (Hochformat).
// Hauptperson: Frage in du-Form, ehrlich antworten. Alle anderen: raten, was die Hauptperson wählt.
// Merkt sich gestellte Fragen (seen.ts), damit dieselbe Runde sie nicht so bald wieder bekommt.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { LETTERS, t } from "../i18n/de.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import type { KdInput, KdPlayerView } from "../shared.js";
import { ANSWER_COLORS, ensureStyles, playerColor, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<KdPlayerView, KdInput>;
type V<P extends KdPlayerView["phase"]> = Extract<KdPlayerView, { phase: P }>;

function KennstduController({ view, api, error }: Props) {
  ensureStyles("kd-ctl-css", CONTROLLER_CSS);
  const now = useServerNow(api.serverNow, view?.phase === "ask");

  // Gedächtnis: einmal je Spiel melden, jede gestellte Frage merken.
  const reported = useRef(false);
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || reported.current) return;
    reported.current = true;
    api.sendInput({ type: "seen", ids: packSeen(loadSeen(storage())) });
  }, [hasView]);
  const questionId = view?.phase === "ask" ? view.questionId : null;
  useEffect(() => {
    if (questionId) rememberSeen(storage(), questionId);
  }, [questionId]);

  // Einmal pro Auflösung vibrieren (Plattform schaltet Replays stumm).
  const revealKey = view?.phase === "reveal" ? `${view.round}` : null;
  useEffect(() => {
    if (view?.phase === "reveal") api.vibrate(view.correct ? [60, 40, 60] : [200]);
  }, [revealKey]);

  if (!view) return <div class="kd-ctl"><p class="kd-msg">{t.controller.loading}</p></div>;
  let body;
  switch (view.phase) {
    case "intro":
      body = <p class="kd-msg">{t.controller.introHot}</p>;
      break;
    case "ask":
      body = <Ask key={`a${view.round}`} v={view} api={api} now={now} rejected={error !== null} />;
      break;
    case "reveal":
      body = <Reveal v={view} />;
      break;
    case "standings":
      body = <p class="kd-msg kd-big">{t.controller.standings(view.rank, view.playerCount)}</p>;
      break;
    case "final":
      body = (
        <div class="kd-result">
          <strong>{t.controller.finalTitle}</strong>
          <span>{t.controller.standings(view.rank, view.playerCount)}</span>
          <span>{t.controller.matches(view.matches)}</span>
        </div>
      );
      break;
  }
  return (
    <div class={`kd-ctl kd-ctl--${view.phase}`} data-testid="kd-controller" data-phase={view.phase}>
      <header class="kd-top">
        <span>{view.phase === "intro" ? t.title : t.round(view.round, view.total)}</span>
        <span>{t.points(view.score)}</span>
      </header>
      {body}
    </div>
  );
}

function Ask({ v, api, now, rejected }: { v: V<"ask">; api: Props["api"]; now: number; rejected: boolean }) {
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (rejected) setPending(null);
  }, [rejected]);
  const choice = v.choice ?? pending;
  const hot = v.role === "hotseat";
  const remaining = Math.max(0, v.endsAt - now);
  const lead = hot ? t.controller.youAreUp : t.controller.guessFor(v.hotseat.name);
  return (
    <>
      <div class="kd-time" aria-hidden="true">
        <span key={v.endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / v.durationMs)})`, animation: `kd-drain ${remaining}ms linear forwards` }} />
      </div>
      <p class={`kd-lead ${hot ? "is-hot" : ""}`} style={{ "--c": playerColor(v.hotseat.color) }} data-testid="kd-role" data-role={v.role}>
        {lead}
      </p>
      <h2 class="kd-q">{v.text}</h2>
      {choice !== null ? (
        <div class="kd-locked" style={{ "--a": ANSWER_COLORS[choice] }} role="status" data-testid="kd-locked">
          <span class="kd-letter">{LETTERS[choice]}</span>
          <strong>{v.answers[choice]}</strong>
          <span>{hot ? t.controller.lockedHot : t.controller.lockedGuess}</span>
        </div>
      ) : (
        <div class={`kd-btns kd-btns--${v.answers.length}`}>
          {v.answers.map((a, i) => (
            <button
              key={i}
              type="button"
              class="kd-btn"
              style={{ "--a": ANSWER_COLORS[i] }}
              aria-label={t.controller.answerLabel(LETTERS[i]!, a)}
              data-testid={`kd-btn-${i}`}
              onClick={() => {
                setPending(i);
                api.sendInput({ type: "answer", index: i });
              }}
            >
              <span class="kd-letter">{LETTERS[i]}</span>
              <span class="kd-btn__text">{a}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Reveal({ v }: { v: V<"reveal"> }) {
  const hot = v.role === "hotseat";
  const answer = v.hotseatChoice === null ? null : v.answers[v.hotseatChoice];
  let headline: string;
  if (hot) headline = v.hotseatChoice === null ? t.controller.hotNoAnswer : v.rightGuessers > 0 ? t.controller.hotRight(v.rightGuessers) : t.controller.hotNobody;
  else headline = v.choice === null ? t.controller.noGuess : v.correct ? t.controller.right : t.controller.wrong;
  return (
    <div class={`kd-result ${v.correct ? "is-good" : ""}`} role="status" data-testid="kd-result">
      <strong>{headline}</strong>
      {answer !== null && answer !== undefined && (
        <span class="kd-answer-line">
          {hot ? t.controller.yourAnswer : t.controller.theAnswer(v.hotseat.name)}
          <b>{answer}</b>
        </span>
      )}
      {v.points > 0 && <span class="kd-gain">+{v.points}</span>}
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

export default preactControllerView<KdPlayerView, KdInput>(KennstduController);
