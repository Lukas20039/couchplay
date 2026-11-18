// Controller-View „Alles oder nichts“ (Handy): vier Antwort-Buttons plus „Enthalten“, danach der
// eigene Stand während der Eliminationen und die Entscheidung „Aussteigen oder weiter“.
// Welche Antwort gestrichen wird und welche richtig ist, erfährt das Handy erst hinterher.
import type { ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { preactControllerView } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { errorText, t } from "../i18n/de.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import type { AonInput, AonPlayerView } from "../shared.js";
import { Shape, ensureStyles, shapeLabel } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type V<P extends AonPlayerView["phase"]> = Extract<AonPlayerView, { phase: P }>;
type QV = V<"spin"> | V<"decide"> | V<"reveal">;
type Props = ControllerComponentProps<AonPlayerView, AonInput>;

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const remaining = Math.max(0, endsAt - now);
  const share = durationMs > 0 ? Math.min(1, remaining / durationMs) : 0;
  return (
    <div class="an-time" aria-hidden="true">
      <span key={endsAt} style={{ transform: `scaleX(${share})`, animation: `an-drain ${remaining}ms linear forwards` }} />
    </div>
  );
}

function Top({ index, total, score, right }: { index: number; total: number; score: number; right?: string }) {
  return (
    <div class="an-top">
      <strong>{t.ctrlQuestion(index, total)}</strong>
      <span>{right ?? t.points(score)}</span>
    </div>
  );
}

/** Kompakte Liste der Antworten: gestrichene durchgestrichen, eigener Tipp markiert, ggf. die richtige. */
function AnswerList({ v, correctIndex }: { v: QV; correctIndex?: number }) {
  return (
    <ul class="an-list">
      {v.answers.map((a, i) => {
        const struck = v.struck.includes(i);
        const cls = [`a${i}`, struck ? "is-struck" : "", v.choice === i ? "is-mine" : "", correctIndex === i ? "is-correct" : ""].join(" ");
        return (
          <li class={cls} key={i} aria-label={`${shapeLabel(i)}: ${a}`}>
            <Shape index={i} />
            <span>{a}</span>
            {v.choice === i && <em>{t.ctrlYourPick}</em>}
          </li>
        );
      })}
    </ul>
  );
}

function Pick({ v, api, now, error }: { v: V<"pick">; api: Props["api"]; now: number; error: Props["error"] }) {
  // Lokale Sperre sofort beim Tippen (gegen Doppeltipps), bis der Server bestätigt.
  // Lehnt der Server ab, wird die Sperre wieder aufgehoben.
  const [pending, setPending] = useState<number | "abstain" | null>(null);
  useEffect(() => {
    if (error) setPending(null);
  }, [error]);
  const expired = now >= v.endsAt;
  const top = (
    <>
      <Top index={v.index} total={v.total} score={v.score} />
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
    </>
  );
  const choice = v.locked ? (v.choice ?? "abstain") : pending;

  if (choice === "abstain") {
    return (
      <>
        {top}
        <div class="an-panel" role="status" data-testid="an-locked">
          <h2>{t.ctrlAbstained}</h2>
          <p>{t.ctrlAbstainedHint}</p>
        </div>
      </>
    );
  }
  if (choice !== null) {
    return (
      <>
        {top}
        <div class={`an-locked a${choice}`} role="status" data-testid="an-locked">
          <Shape index={choice} />
          <h2>{t.ctrlLocked}</h2>
          <p class="an-chosen">{v.answers[choice]}</p>
          <p>{t.ctrlLockedHint}</p>
        </div>
      </>
    );
  }

  const send = (input: AonInput, p: number | "abstain") => {
    if (pending !== null || expired) return;
    setPending(p);
    api.sendInput(input);
  };
  return (
    <>
      {top}
      <div class="an-grid" role="group" aria-label={expired ? t.ctrlTimeUp : t.ctrlChoose}>
        {v.answers.map((a, i) => (
          <button
            type="button"
            class={`an-btn a${i}`}
            data-testid={`an-pick-${i}`}
            aria-label={`${shapeLabel(i)}: ${a}`}
            disabled={expired}
            onClick={() => send({ type: "pick", index: i }, i)}
          >
            <Shape index={i} />
            <span class="an-btn-text">{a}</span>
          </button>
        ))}
      </div>
      <button type="button" class="an-abstain" data-testid="an-abstain" disabled={expired} onClick={() => send({ type: "abstain" }, "abstain")}>
        <strong>{t.ctrlAbstain}</strong>
        <span>{t.ctrlAbstainHint}</span>
      </button>
    </>
  );
}

/** Stand außerhalb des Rennens (ausgestiegen, raus, enthalten). null = noch drin. */
function OutOfRace({ v }: { v: QV }) {
  switch (v.status) {
    case "cashed":
      return (
        <div class="an-state is-cashed" role="status" data-testid="an-state">
          <h2>{t.ctrlCashed(v.points)}</h2>
          <p>{t.ctrlCashedHint}</p>
        </div>
      );
    case "out":
      return (
        <div class="an-state is-out" role="status" data-testid="an-state">
          <h2>{t.ctrlOut}</h2>
          <p>{t.ctrlOutHint(v.points)}</p>
        </div>
      );
    case "abstain":
      return (
        <div class="an-state" role="status" data-testid="an-state">
          <h2>{t.ctrlWatching}</h2>
          <p>{t.ctrlLookTv}</p>
        </div>
      );
    default:
      return null;
  }
}

function Spin({ v }: { v: V<"spin"> }) {
  return (
    <>
      <Top index={v.index} total={v.total} score={v.score} right={t.ctrlStage(v.stage)} />
      {OutOfRace({ v }) ?? (
        <div class="an-state is-in is-pulse" role="status" data-testid="an-state">
          <h2>{t.ctrlSpinIn}</h2>
          <p>{t.ctrlSpinInHint}</p>
        </div>
      )}
      <AnswerList v={v} />
    </>
  );
}

function Decide({ v, api, now, error }: { v: V<"decide">; api: Props["api"]; now: number; error: Props["error"] }) {
  const [pending, setPending] = useState<"stay" | "cash" | null>(null);
  useEffect(() => {
    if (error) setPending(null);
  }, [error]);
  const decision = v.decision ?? pending;
  const expired = now >= v.endsAt;
  const top = (
    <>
      <Top index={v.index} total={v.total} score={v.score} right={t.ctrlStage(v.stage)} />
      <TimeBar endsAt={v.endsAt} durationMs={v.durationMs} now={now} />
    </>
  );
  const out = OutOfRace({ v });
  if (out) {
    return (
      <>
        {top}
        {out}
        <AnswerList v={v} />
      </>
    );
  }
  if (decision !== null) {
    return (
      <>
        {top}
        <div class={`an-state ${decision === "stay" ? "is-in" : "is-cashed"}`} role="status" data-testid="an-state">
          <h2>{decision === "stay" ? t.ctrlStayNow : t.ctrlCashedNow(v.stage)}</h2>
          <p>{t.ctrlWaitOthers}</p>
        </div>
        <AnswerList v={v} />
      </>
    );
  }
  const send = (stay: boolean) => {
    if (pending !== null || expired) return;
    setPending(stay ? "stay" : "cash");
    api.sendInput({ type: "decide", stay });
  };
  return (
    <>
      {top}
      <h2 class="an-ask">{t.ctrlStillIn}</h2>
      <AnswerList v={v} />
      <div class="an-choices">
        <button type="button" class="an-choice is-cash" data-testid="an-cash" disabled={expired} onClick={() => send(false)}>
          <strong>{t.ctrlCash}</strong>
          <span>{t.ctrlCashValue(v.stage)}</span>
        </button>
        <button type="button" class="an-choice is-stay" data-testid="an-stay" disabled={expired} onClick={() => send(true)}>
          <strong>{t.ctrlStay}</strong>
          <span>{t.ctrlStayValue(v.stage)}</span>
        </button>
      </div>
      <p class="an-note">{t.ctrlDecideDefault}</p>
    </>
  );
}

function Reveal({ v }: { v: V<"reveal"> }) {
  const cls = v.status === "won" ? "is-good" : v.status === "cashed" ? "is-cashed" : v.status === "out" ? "is-bad" : "";
  const title = v.status === "won" ? t.ctrlWon : v.status === "cashed" ? t.ctrlCashed(v.points) : v.status === "out" ? t.ctrlOut : t.ctrlNoAnswer;
  return (
    <div class={`an-result ${cls}`} role="status" data-testid="an-result">
      <h2>{title}</h2>
      <div class="an-big">{t.signed(v.points)}</div>
      {v.bonus && <p class="an-bonus">{t.ctrlBonus}</p>}
      <div class={`an-right a${v.correctIndex}`}>
        <Shape index={v.correctIndex} />
        <span>
          {t.ctrlRightWas}: {v.answers[v.correctIndex]}
        </span>
      </div>
      <p class="an-place">{t.ctrlPlace(v.rank, v.playerCount)}</p>
      <p class="an-soft">{t.ctrlScore(v.score)}</p>
    </div>
  );
}

function Shapes() {
  return (
    <div class="an-mini-shapes" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Shape index={i} class={`a${i}`} />
      ))}
    </div>
  );
}

function Standings({ v }: { v: V<"standings"> }) {
  const diff = v.previousRank !== null ? v.previousRank - v.rank : 0;
  return (
    <div class="an-info">
      <p>{t.ctrlStandings}</p>
      <div class="an-big">{t.rank(v.rank)}</div>
      <h2>{t.ctrlOf(v.playerCount)}</h2>
      {diff !== 0 && <p>{diff > 0 ? t.ctrlRankUp(diff) : t.ctrlRankDown(-diff)}</p>}
      <p>{t.ctrlScore(v.score)}</p>
      <p>{t.ctrlLookTv}</p>
    </div>
  );
}

function Final({ v }: { v: V<"final"> }) {
  return (
    <div class="an-info">
      <p>{t.ctrlFinal}</p>
      <div class="an-big">{t.rank(v.rank)}</div>
      <h2>{v.rank === 1 ? t.ctrlWinner : t.ctrlOf(v.playerCount)}</h2>
      <p>{t.ctrlScore(v.score)}</p>
      <p>{t.jackpots(v.jackpots)}</p>
    </div>
  );
}

export function AonController({ view, api, error }: Props) {
  ensureStyles("an-pad-css", CONTROLLER_CSS);
  const [now, setNow] = useState(api.serverNow);
  const ticking = view?.phase === "pick" || view?.phase === "decide";
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
  const questionId = view?.phase === "pick" ? view.questionId : null;
  useEffect(() => {
    if (questionId) rememberSeen(storage(), questionId);
  }, [questionId]);

  // Vibration, sobald die eigene Antwort fliegt bzw. bis zum Schluss hält (je Frage einmal).
  // Nur über api.vibrate – die Plattform schaltet Replays (Rejoin) stumm.
  const status = view && "status" in view ? view.status : null;
  const qIndex = view && "index" in view ? view.index : -1;
  useEffect(() => {
    if (status === "out") api.vibrate([250]);
    else if (status === "won") api.vibrate([60, 50, 60, 50, 120]);
  }, [status, qIndex]);

  let body;
  switch (view?.phase) {
    case "pick":
      body = <Pick key={`p${view.index}`} v={view} api={api} now={now} error={error} />;
      break;
    case "spin":
      body = <Spin v={view} />;
      break;
    case "decide":
      body = <Decide key={`d${view.index}-${view.stage}`} v={view} api={api} now={now} error={error} />;
      break;
    case "reveal":
      body = <Reveal v={view} />;
      break;
    case "standings":
      body = <Standings v={view} />;
      break;
    case "final":
      body = <Final v={view} />;
      break;
    case "intro":
      body = (
        <div class="an-info">
          <Shapes />
          <h2>{t.ctrlIntro}</h2>
          <p>{t.ctrlIntroHint}</p>
        </div>
      );
      break;
    default:
      body = (
        <div class="an-info">
          <Shapes />
          <p>{t.waiting}</p>
        </div>
      );
  }
  return (
    <div class={`an-pad is-${view?.phase ?? "wait"}`} data-testid="an-pad" data-phase={view?.phase ?? "wait"}>
      {body}
      {error && <p class="an-error" role="alert">{errorText(error.code)}</p>}
    </div>
  );
}

export default preactControllerView<AonPlayerView, AonInput>(AonController);

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
