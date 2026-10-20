// TV-View Quiz (10-Fuß-UI, 1920×1080). Rendert ausschließlich den empfangenen
// TV-Zustand; läuft ohne jede Interaktion (Countdowns über endsAt + serverNow()).
import type { TvComponentProps } from "@couchplay/game-sdk/preact";
import { preactTvView } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { CATEGORY_LABELS, t } from "../i18n/de.js";
import { TIMING } from "../constants.js";
import type { QuizPlayerInfo, QuizTvState } from "../shared.js";
import { Shape, avatarEmoji, ensureStyles, playerColor, secondsLeft, shapeLabel, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends QuizTvState["phase"]> = Extract<QuizTvState, { phase: P }>;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (players: readonly Player[], id: string): boolean => players.find((p) => p.id === id)?.connected === false;

function Avatar({ p, cls = "", badge }: { p: Pick<QuizPlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string }) {
  return (
    <div class={`qz-avatar ${cls}`} style={{ "--pc": playerColor(p.color) }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="qz-badge">{badge}</span>}
    </div>
  );
}

function Ring({ endsAt, durationMs, now, warn = true }: { endsAt: number; durationMs: number; now: number; warn?: boolean }) {
  const len = 2 * Math.PI * 44;
  const remaining = Math.max(0, endsAt - now);
  const share = durationMs > 0 ? Math.min(1, remaining / durationMs) : 0;
  const secs = secondsLeft(endsAt, now);
  return (
    <div class={`qz-ring ${warn && secs <= 5 ? "is-low" : ""}`} role="timer" aria-label={t.secondsLeft(secs)}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="qz-ring-track" cx="50" cy="50" r="44" />
        <circle class="qz-ring-bar" cx="50" cy="50" r="44" stroke-dasharray={len} stroke-dashoffset={len * (1 - share)} />
      </svg>
      <div class="qz-ring-num">{secs}</div>
    </div>
  );
}

function Head({ s, children }: { s: S<"question"> | S<"reveal">; children?: ComponentChildren }) {
  return (
    <header class="qz-head">
      <div class="qz-meta">
        <span class="qz-cat">{CATEGORY_LABELS[s.category]}</span>
        <div class="qz-progress">
          <span>{t.progress(s.index, s.total)}</span>
          <div class="qz-ticks" aria-hidden="true">
            {Array.from({ length: s.total }, (_, i) => (
              <span class={`qz-tick ${i < s.index ? "is-done" : i === s.index ? "is-now" : ""}`} />
            ))}
          </div>
        </div>
      </div>
      {children}
    </header>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <section class="qz-intro">
      <div>
        <h1>{t.title}</h1>
        <p class="qz-sub">
          {t.introQuestions(s.total)} {t.introCategories(s.categories.length)}
        </p>
        <div class="qz-cats">
          {s.categories.map((c) => (
            <span key={c}>{CATEGORY_LABELS[c]}</span>
          ))}
        </div>
        <p class="qz-hint">{t.introHint}</p>
      </div>
      <div class="qz-intro-count">
        <div class="qz-intro-shapes" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div class={`a${i}`}>
              <Shape index={i} />
            </div>
          ))}
        </div>
        <span>{t.introStartsIn}</span>
        <Ring endsAt={s.endsAt} durationMs={TIMING.introMs} now={now} warn={false} />
      </div>
    </section>
  );
}

function Question({ s, now, live }: { s: S<"question">; now: number; live: readonly Player[] }) {
  const answered = new Set(s.answered);
  const active = s.players.filter((p) => !p.left);
  return (
    <>
      <Head s={s}>
        <Ring endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      </Head>
      <h2 class="qz-question">{s.text}</h2>
      <div class="qz-answers">
        {s.answers.map((a, i) => (
          <div class={`qz-answer a${i}`} aria-label={`${shapeLabel(i)}: ${a}`}>
            <Shape index={i} />
            <span class="qz-answer-text">{a}</span>
          </div>
        ))}
      </div>
      <footer class="qz-strip">
        {active.map((p) => {
          const done = answered.has(p.id);
          const off = isOffline(live, p.id);
          return <Avatar key={p.id} p={p} cls={off && !done ? "is-off" : done ? "is-done" : "is-waiting"} badge={done ? "✓" : undefined} />;
        })}
        <span class="qz-strip-label">{t.answeredCount(s.answered.length, active.length)}</span>
      </footer>
    </>
  );
}

function Reveal({ s }: { s: S<"reveal"> }) {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const votes = s.distribution.reduce((a, b) => a + b, 0);
  const [shown, setShown] = useState(false);
  // Balken einmal von 0 auf ihren Wert wachsen lassen (transform).
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [s.index]);
  const pickers = (i: number) => s.picks.filter((p) => p.choice === i).map((p) => byId.get(p.playerId)).filter((p) => p !== undefined);
  const correctCount = s.picks.filter((p) => p.correct).length;
  const participants = s.picks.filter((p) => !byId.get(p.playerId)?.left);
  return (
    <>
      <Head s={s} />
      <h2 class="qz-question">{s.text}</h2>
      <div class="qz-answers">
        {s.answers.map((a, i) => {
          const ok = i === s.correctIndex;
          const share = votes > 0 ? (s.distribution[i] ?? 0) / votes : 0;
          return (
            <div class={`qz-answer a${i} ${ok ? "is-correct" : "is-wrong"}`} aria-label={`${shapeLabel(i)}: ${a}${ok ? ` – ${t.correctAnswer}` : ""}`}>
              {ok ? <span class="qz-check" aria-hidden="true">✓</span> : <Shape index={i} />}
              <span class="qz-answer-text">{a}</span>
              <span class="qz-answer-votes">
                {pickers(i).map((p) => (
                  <span class="qz-mini" style={{ "--pc": playerColor(p.color) }} title={p.name}>
                    {avatarEmoji(p.avatar)}
                  </span>
                ))}
                <span>{s.distribution[i] ?? 0}</span>
              </span>
              <span class="qz-bar" style={{ transform: `scaleX(${shown ? share : 0})` }} />
            </div>
          );
        })}
      </div>
      <footer class="qz-round">
        {correctCount === 0 ? (
          <span class="qz-note">{t.nobodyCorrect}</span>
        ) : correctCount === participants.length && participants.length > 1 ? (
          <span class="qz-note">{t.allCorrect}</span>
        ) : null}
        {[...s.picks]
          .filter((p) => p.points > 0)
          .sort((a, b) => b.points - a.points)
          .map((pick) => {
            const p = byId.get(pick.playerId);
            if (!p) return null;
            return (
              <span class="qz-chip" key={p.id}>
                <span class="qz-mini" style={{ "--pc": playerColor(p.color) }}>
                  {avatarEmoji(p.avatar)}
                </span>
                {p.name}
                <span class="qz-pts">{t.plusPoints(pick.points)}</span>
              </span>
            );
          })}
      </footer>
    </>
  );
}

/** Rangliste mit FLIP-Animation: Zeilen starten auf der alten Position und gleiten per transform zur neuen. */
function Board({ players, live, animate }: { players: QuizPlayerInfo[]; live: readonly Player[]; animate: boolean }) {
  const ROW = 6.3; // rem
  const before = [...players].sort(
    (a, b) => (a.previousRank ?? a.rank) - (b.previousRank ?? b.rank) || players.indexOf(a) - players.indexOf(b),
  );
  const [moved, setMoved] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = setTimeout(() => setMoved(true), 700);
    return () => clearTimeout(id);
  }, [animate]);
  return (
    <div class="qz-board" style={{ height: `${players.length * ROW}rem` }}>
      {players.map((p, i) => {
        const pos = moved ? i : before.indexOf(p);
        const off = isOffline(live, p.id);
        return (
          <div
            key={p.id}
            class={`qz-row ${p.rank === 1 ? "is-first" : ""} ${p.left ? "is-left" : ""}`}
            style={{ transform: `translateY(${pos * ROW}rem)` }}
          >
            <span class="qz-row-rank">{t.rank(moved ? p.rank : (p.previousRank ?? p.rank))}</span>
            <Avatar p={p} cls={off || p.left ? "is-off" : ""} />
            <span class="qz-row-name">
              <span>{p.name}</span>
              {p.left ? <span class="qz-tag">{t.left}</span> : off ? <span class="qz-tag">{t.offline}</span> : null}
            </span>
            <span class={`qz-delta ${p.roundPoints > 0 ? "" : "is-zero"}`}>{t.plusPoints(p.roundPoints)}</span>
            <span class="qz-score">{t.number(moved ? p.score : p.score - p.roundPoints)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Standings({ s, live }: { s: S<"standings">; live: readonly Player[] }) {
  return (
    <>
      <div class="qz-title">
        <h2>{t.standingsTitle}</h2>
        <p>{t.standingsAfter(s.index, s.total)}</p>
      </div>
      <Board key={`b${s.index}`} players={s.players} live={live} animate />
    </>
  );
}

function Final({ s }: { s: S<"final"> }) {
  const top = s.players.slice(0, 3);
  // Klassische Podest-Anordnung: 2 – 1 – 3
  const order = [top[1], top[0], top[2]].filter((p): p is QuizPlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  return (
    <>
      <div class="qz-title">
        <h2>{t.finalTitle}</h2>
        <p>{t.finalSubtitle(s.total)}</p>
      </div>
      <div class="qz-podium">
        {order.map((p) => (
          <div class={`qz-step r${Math.min(p.rank, 3)}`} key={p.id}>
            <div class="qz-who">
              <Avatar p={p} />
              <span class="qz-step-name">{p.name}</span>
              <span class="qz-step-score">
                {t.pointsLong(p.score)}
                {p.left ? ` (${t.left})` : ""}
              </span>
            </div>
            <div class="qz-block">{p.rank}</div>
          </div>
        ))}
      </div>
      <div class="qz-rest">
        {rest.map((p) => (
          <span class="qz-chip" key={p.id}>
            {t.rank(p.rank)}
            <span class="qz-mini" style={{ "--pc": playerColor(p.color) }}>
              {avatarEmoji(p.avatar)}
            </span>
            {p.name}
            <span class="qz-pts is-dim">{t.points(p.score)}</span>
          </span>
        ))}
      </div>
    </>
  );
}

export function QuizTv({ state, api, players }: TvComponentProps<QuizTvState>) {
  ensureStyles("qz-tv-css", TV_CSS);
  const ticking = state?.phase === "question" || state?.phase === "intro";
  const now = useServerNow(api.serverNow, ticking);
  let body;
  switch (state?.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "question":
      body = <Question s={state} now={now} live={players} />;
      break;
    case "reveal":
      body = <Reveal key={`r${state.index}`} s={state} />;
      break;
    case "standings":
      body = <Standings s={state} live={players} />;
      break;
    case "final":
      body = <Final s={state} />;
      break;
    default:
      body = <div class="qz-wait">{t.waiting}</div>;
  }
  return <div class={`qz-tv is-${state?.phase ?? "wait"}`}>{body}</div>;
}

export default preactTvView<QuizTvState>(QuizTv);
