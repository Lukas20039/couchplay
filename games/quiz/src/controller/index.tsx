// Controller-View Quiz (Handy). Zeigt vier große Antwort-Buttons (Farbe + Form),
// danach „Antwort gesperrt“ und nach der Auflösung richtig/falsch, Punkte und Platz.
// Die richtige Antwort kennt das Handy erst in der Phase "reveal" (Server sendet sie erst dann).
import type { ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { preactControllerView } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { t, errorText } from "../i18n/de.js";
import type { QuizInput, QuizPlayerView } from "../shared.js";
import { Shape, ensureStyles, shapeLabel } from "../ui/common.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import { CONTROLLER_CSS } from "./styles.js";

type V<P extends QuizPlayerView["phase"]> = Extract<QuizPlayerView, { phase: P }>;

function LockIcon() {
  return (
    <svg class="qz-lock-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z" />
    </svg>
  );
}

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const remaining = Math.max(0, endsAt - now);
  const share = durationMs > 0 ? Math.min(1, remaining / durationMs) : 0;
  return (
    <div class="qz-time" aria-hidden="true">
      <span key={endsAt} style={{ transform: `scaleX(${share})`, animation: `qz-drain ${remaining}ms linear forwards` }} />
    </div>
  );
}

type Props = ControllerComponentProps<QuizPlayerView, QuizInput>;

function Question({ v, api, now, error }: { v: V<"question">; api: Props["api"]; now: number; error: Props["error"] }) {
  // Lokale Sperre sofort beim Tippen (gegen Doppeltipps), bis der Server bestätigt.
  // Lehnt der Server ab, wird die Sperre wieder aufgehoben.
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (error) setPending(null);
  }, [error]);
  const choice = v.choice ?? pending;
  const expired = now >= v.endsAt;

  const top = (
    <>
      <div class="qz-top">
        <strong>{t.ctrlQuestion(v.index, v.total)}</strong>
        <span>{t.points(v.score)}</span>
      </div>
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
    </>
  );

  if (choice !== null) {
    return (
      <>
        {top}
        <div class={`qz-locked a${choice}`} role="status">
          <Shape index={choice} />
          <h2>
            <LockIcon />
            <span>{t.ctrlLocked}</span>
          </h2>
          <p class="qz-chosen">{v.answers[choice]}</p>
          <p>{t.ctrlLockedHint}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {top}
      <div class="qz-grid" role="group" aria-label={expired ? t.ctrlTimeUp : t.ctrlChoose}>
        {v.answers.map((a, i) => (
          <button
            type="button"
            class={`qz-btn a${i}`}
            aria-label={`${shapeLabel(i)}: ${a}`}
            disabled={expired}
            onClick={() => {
              if (choice !== null || expired) return;
              setPending(i);
              api.sendInput({ type: "answer", index: i });
            }}
          >
            <Shape index={i} />
            <span class="qz-btn-text">{a}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function Reveal({ v, vibrate }: { v: V<"reveal">; vibrate: (p: number | number[]) => void }) {
  // Einmal pro Auflösung vibrieren. Nur über api.vibrate – die Plattform schaltet Replays (Rejoin) stumm.
  useEffect(() => {
    vibrate(v.correct ? [60, 50, 60] : [250]);
  }, [v.index]);

  const answered = v.choice !== null;
  const cls = v.correct ? "is-good" : answered ? "is-bad" : "";
  return (
    <div class={`qz-result ${cls}`} role="status">
      <h2>{v.correct ? t.ctrlCorrect : answered ? t.ctrlWrong : t.ctrlNone}</h2>
      <div class="qz-big">{t.plusPoints(v.points)}</div>
      {!v.correct && (
        <div class={`qz-right a${v.correctIndex}`}>
          <Shape index={v.correctIndex} />
          <span>
            {t.ctrlRightWas}: {v.answers[v.correctIndex]}
          </span>
        </div>
      )}
      <p class="qz-place">{t.ctrlPlace(v.rank, v.playerCount)}</p>
      <p class="qz-soft">{t.ctrlScore(v.score)}</p>
    </div>
  );
}

function Shapes() {
  return (
    <div class="qz-mini-shapes" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Shape index={i} class={`a${i}`} />
      ))}
    </div>
  );
}

function Standings({ v }: { v: V<"standings"> }) {
  const diff = v.previousRank !== null ? v.previousRank - v.rank : 0;
  return (
    <div class="qz-info">
      <p>{t.ctrlStandings}</p>
      <div class="qz-big">{t.rank(v.rank)}</div>
      <h2>{t.ctrlOf(v.playerCount)}</h2>
      {diff !== 0 && <p>{diff > 0 ? t.ctrlRankUp(diff) : t.ctrlRankDown(-diff)}</p>}
      <p>{t.ctrlScore(v.score)}</p>
      <p>{t.ctrlLookTv}</p>
    </div>
  );
}

function Final({ v }: { v: V<"final"> }) {
  return (
    <div class="qz-info">
      <p>{t.ctrlFinal}</p>
      <div class="qz-big">{t.rank(v.rank)}</div>
      <h2>{v.rank === 1 ? t.ctrlWinner : t.ctrlOf(v.playerCount)}</h2>
      <p>{t.ctrlScore(v.score)}</p>
      <p>{t.correctOf(v.correctCount, v.total)}</p>
    </div>
  );
}

export function QuizController({ view, api, error }: Props) {
  ensureStyles("qz-pad-css", CONTROLLER_CSS);
  const [now, setNow] = useState(api.serverNow);
  const ticking = view?.phase === "question";
  useEffect(() => {
    setNow(api.serverNow());
    if (!ticking) return;
    const id = setInterval(() => setNow(api.serverNow()), 250);
    return () => clearInterval(id);
  }, [ticking, api]);

  // Gedächtnis: einmal je Spiel die schon gesehenen Fragen melden, jede neue Frage merken.
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

  let body;
  switch (view?.phase) {
    case "question":
      body = <Question key={`q${view.index}`} v={view} api={api} now={now} error={error} />;
      break;
    case "reveal":
      body = <Reveal v={view} vibrate={(p) => api.vibrate(p)} />;
      break;
    case "standings":
      body = <Standings v={view} />;
      break;
    case "final":
      body = <Final v={view} />;
      break;
    case "intro":
      body = (
        <div class="qz-info">
          <Shapes />
          <h2>{t.ctrlIntro}</h2>
          <p>{t.ctrlIntroHint}</p>
        </div>
      );
      break;
    default:
      body = (
        <div class="qz-info">
          <Shapes />
          <p>{t.waiting}</p>
        </div>
      );
  }
  return (
    <div class={`qz-pad is-${view?.phase ?? "wait"}`}>
      {body}
      {error && <p class="qz-error" role="alert">{errorText(error.code)}</p>}
    </div>
  );
}

export default preactControllerView<QuizPlayerView, QuizInput>(QuizController);

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
