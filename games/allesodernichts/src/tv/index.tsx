// TV-View „Alles oder nichts“ (10-Fuß-UI, 1920×1080). Rendert ausschließlich den empfangenen
// TV-Zustand; läuft ohne jede Interaktion (Countdowns und Lauflicht über Serverzeit).
import type { TvComponentProps } from "@couchplay/game-sdk/preact";
import { preactTvView } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { CATEGORY_LABELS, t } from "../i18n/de.js";
import { STAGES, TIMING, spinStepAt, type AonPlayerInfo, type AonTvState } from "../shared.js";
import { Shape, avatarEmoji, ensureStyles, playerColor, secondsLeft, shapeLabel, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends AonTvState["phase"]> = Extract<AonTvState, { phase: P }>;
type QState = S<"pick"> | S<"spin"> | S<"decide"> | S<"reveal">;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (players: readonly Player[], id: string): boolean => players.find((p) => p.id === id)?.connected === false;

function Avatar({ p, cls = "", badge }: { p: Pick<AonPlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string }) {
  return (
    <div class={`an-avatar ${cls}`} style={{ "--pc": playerColor(p.color) }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="an-badge">{badge}</span>}
    </div>
  );
}

function Mini({ p }: { p: Pick<AonPlayerInfo, "avatar" | "color" | "name"> }) {
  return (
    <span class="an-mini" style={{ "--pc": playerColor(p.color) }} title={p.name}>
      {avatarEmoji(p.avatar)}
    </span>
  );
}

function Ring({ endsAt, durationMs, now, warn = true }: { endsAt: number; durationMs: number; now: number; warn?: boolean }) {
  const len = 2 * Math.PI * 44;
  const remaining = Math.max(0, endsAt - now);
  const share = durationMs > 0 ? Math.min(1, remaining / durationMs) : 0;
  const secs = secondsLeft(endsAt, now);
  return (
    <div class={`an-ring ${warn && secs <= 5 ? "is-low" : ""}`} role="timer" aria-label={t.secondsLeft(secs)}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="an-ring-track" cx="50" cy="50" r="44" />
        <circle class="an-ring-bar" cx="50" cy="50" r="44" stroke-dasharray={len} stroke-dashoffset={len * (1 - share)} />
      </svg>
      <div class="an-ring-num">{secs}</div>
    </div>
  );
}

/** Einsatzleiter: Runde 1–3 mit ±1/±2/±3; `passed` = überstandene Eliminationen, `now` = laufende/nächste. */
function Stakes({ passed, now }: { passed: number; now: number | null }) {
  return (
    <div class="an-stakes" aria-hidden="true">
      {Array.from({ length: STAGES }, (_, i) => {
        const stage = i + 1;
        const cls = stage <= passed ? "is-passed" : stage === now ? "is-now" : "";
        return (
          <div class={`an-stake ${cls}`} key={stage}>
            <span class="an-stake-label">{t.stakeLabel(stage)}</span>
            <span class="an-stake-value">{t.stakeValue(stage)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Head({ s, children }: { s: QState; children?: ComponentChildren }) {
  let passed = 0;
  let now: number | null = null;
  if (s.phase === "pick") now = 1;
  else if (s.phase === "spin") [passed, now] = [s.stage - 1, s.stage];
  else if (s.phase === "decide") [passed, now] = [s.stage, s.stage + 1];
  else passed = s.struck.length;
  return (
    <header class="an-head">
      <div class="an-meta">
        <span class="an-cat">{CATEGORY_LABELS[s.category]}</span>
        <div class="an-progress">
          <span>{t.progress(s.index, s.total)}</span>
          <div class="an-ticks" aria-hidden="true">
            {Array.from({ length: s.total }, (_, i) => (
              <span class={`an-tick ${i < s.index ? "is-done" : i === s.index ? "is-now" : ""}`} />
            ))}
          </div>
        </div>
      </div>
      <Stakes passed={passed} now={now} />
      <div class="an-head-end">{children}</div>
    </header>
  );
}

interface TileOpts {
  lit?: number | null;
  hit?: number | null;
  correctIndex?: number;
  pickers?: (i: number) => AonPlayerInfo[];
}

function Answers({ s, lit = null, hit = null, correctIndex, pickers }: { s: QState } & TileOpts) {
  return (
    <div class="an-answers">
      {s.answers.map((a, i) => {
        const struckAt = s.struck.indexOf(i);
        const cls = [
          `an-answer a${i}`,
          struckAt >= 0 ? "is-struck" : "",
          i === lit && i !== hit ? "is-lit" : "",
          i === hit ? "is-hit" : "",
          correctIndex === i ? "is-correct" : "",
        ].join(" ");
        const who = pickers?.(i) ?? [];
        return (
          <div class={cls} key={i} data-testid={`an-answer-${i}`} aria-label={`${shapeLabel(i)}: ${a}`}>
            {correctIndex === i ? <span class="an-check" aria-hidden="true">✓</span> : <Shape index={i} />}
            <span class="an-answer-text">{a}</span>
            {struckAt >= 0 && <span class="an-struck-tag">{t.struckTag(struckAt + 1)}</span>}
            {i === hit && <span class="an-hit-tag">{t.hit}</span>}
            {who.length > 0 && (
              <span class="an-answer-votes">
                {who.map((p) => (
                  <Mini key={p.id} p={p} />
                ))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Spieler mit Status der laufenden Frage. `decided` nur in der Entscheidungsphase. */
function StatusStrip({ s, live, decided }: { s: QState; live: readonly Player[]; decided?: ReadonlySet<string> }) {
  return (
    <footer class="an-strip">
      {s.players
        .filter((p) => !p.left || (p.status !== null && p.status !== "abstain"))
        .map((p) => {
          const off = isOffline(live, p.id);
          let tag: string;
          let cls: string;
          switch (p.status) {
            case "in":
              tag = decided?.has(p.id) ? t.tagDecided : t.tagIn;
              cls = decided?.has(p.id) ? "is-in is-decided" : "is-in";
              break;
            case "cashed":
              tag = t.tagCashed(p.roundPoints);
              cls = "is-cashed";
              break;
            case "out":
              tag = t.tagOut(p.roundPoints);
              cls = "is-out";
              break;
            case "won":
              tag = t.tagWon(p.roundPoints);
              cls = "is-won";
              break;
            default:
              tag = t.tagAbstain;
              cls = "is-abstain";
          }
          return (
            <div class={`an-pl ${cls}`} key={p.id} data-testid={`an-status-${p.id}`} data-status={p.status ?? ""}>
              <Avatar p={p} cls={off ? "is-off" : ""} />
              <span class="an-pl-name">{p.name}</span>
              <span class="an-pl-tag">{tag}</span>
            </div>
          );
        })}
    </footer>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <section class="an-intro">
      <div>
        <h1>{t.title}</h1>
        <p class="an-sub">
          {t.introQuestions(s.total)} {t.introCategories(s.categories.length)}
        </p>
        <ol class="an-rules">
          {t.introRules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
        <div class="an-cats">
          {s.categories.map((c) => (
            <span key={c}>{CATEGORY_LABELS[c]}</span>
          ))}
        </div>
      </div>
      <div class="an-intro-count">
        <span>{t.introStartsIn}</span>
        <Ring endsAt={s.endsAt} durationMs={TIMING.introMs} now={now} warn={false} />
      </div>
    </section>
  );
}

function Pick({ s, now, live }: { s: S<"pick">; now: number; live: readonly Player[] }) {
  const answered = new Set(s.answered);
  const active = s.players.filter((p) => !p.left);
  return (
    <>
      <Head s={s}>
        <Ring endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      </Head>
      <h2 class="an-question" data-testid="an-question">{s.text}</h2>
      <Answers s={s} />
      <footer class="an-strip">
        {active.map((p) => {
          const done = answered.has(p.id);
          const off = isOffline(live, p.id);
          return <Avatar key={p.id} p={p} cls={off && !done ? "is-off" : done ? "is-done" : "is-waiting"} badge={done ? "✓" : undefined} />;
        })}
        <span class="an-strip-label">{t.answeredCount(s.answered.length, active.length)}</span>
      </footer>
    </>
  );
}

function Spin({ s, now, live }: { s: S<"spin">; now: number; live: readonly Player[] }) {
  const elapsed = now - s.startedAt;
  const step = spinStepAt(elapsed, s.path.length, s.runMs);
  const landed = elapsed >= s.runMs;
  return (
    <>
      <Head s={s}>
        <div class="an-phase-note">
          <strong>{t.spinTitle(s.stage)}</strong>
          <span>{t.spinHint}</span>
        </div>
      </Head>
      <h2 class="an-question is-small">{s.text}</h2>
      <Answers s={s} lit={s.path[step] ?? null} hit={landed ? (s.path[s.path.length - 1] ?? null) : null} />
      <StatusStrip s={s} live={live} />
    </>
  );
}

function Decide({ s, now, live }: { s: S<"decide">; now: number; live: readonly Player[] }) {
  const decided = new Set(s.decided);
  const inCount = s.players.filter((p) => p.status === "in").length;
  return (
    <>
      <Head s={s}>
        <Ring endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      </Head>
      <div class="an-decide">
        <h2>{t.decideTitle(s.stage)}</h2>
        <p>
          {t.decideHint(s.stage)} <span class="an-dim">{t.decidedCount(decided.size, inCount)}</span>
        </p>
      </div>
      <Answers s={s} />
      <StatusStrip s={s} live={live} decided={decided} />
    </>
  );
}

function Reveal({ s, live }: { s: S<"reveal">; live: readonly Player[] }) {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const pickers = (i: number) =>
    s.picks
      .filter((p) => p.choice === i)
      .map((p) => byId.get(p.playerId))
      .filter((p): p is AonPlayerInfo => p !== undefined);
  const solo = s.soloBonus ? byId.get(s.soloBonus) : undefined;
  const anyPick = s.picks.some((p) => p.choice !== null);
  const anyWon = s.picks.some((p) => p.status === "won");
  return (
    <>
      <Head s={s} />
      <h2 class="an-question is-small">{s.text}</h2>
      <Answers s={s} correctIndex={s.correctIndex} pickers={pickers} />
      <div class="an-reveal-note">{solo ? t.revealSolo(solo.name) : !anyPick ? t.revealAllAbstained : !anyWon ? t.revealNobody : ""}</div>
      <StatusStrip s={s} live={live} />
    </>
  );
}

/** Rangliste mit FLIP-Animation: Zeilen starten auf der alten Position und gleiten per transform zur neuen. */
function Board({ players, live, animate }: { players: AonPlayerInfo[]; live: readonly Player[]; animate: boolean }) {
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
    <div class="an-board" style={{ height: `${players.length * ROW}rem` }}>
      {players.map((p, i) => {
        const pos = moved ? i : before.indexOf(p);
        const off = isOffline(live, p.id);
        const delta = p.roundPoints > 0 ? "is-plus" : p.roundPoints < 0 ? "is-minus" : "is-zero";
        return (
          <div
            key={p.id}
            class={`an-row ${p.rank === 1 ? "is-first" : ""} ${p.left ? "is-left" : ""}`}
            style={{ transform: `translateY(${pos * ROW}rem)` }}
          >
            <span class="an-row-rank">{t.rank(moved ? p.rank : (p.previousRank ?? p.rank))}</span>
            <Avatar p={p} cls={off || p.left ? "is-off" : ""} />
            <span class="an-row-name">
              <span>{p.name}</span>
              {p.left ? <span class="an-tag">{t.left}</span> : null}
            </span>
            <span class={`an-delta ${delta}`}>{t.signed(p.roundPoints)}</span>
            <span class="an-score">{t.signed(moved ? p.score : p.score - p.roundPoints).replace(/^\+/, "")}</span>
          </div>
        );
      })}
    </div>
  );
}

function Standings({ s, live }: { s: S<"standings">; live: readonly Player[] }) {
  return (
    <>
      <div class="an-title">
        <h2>{t.standingsTitle}</h2>
        <p>{t.standingsAfter(s.index, s.total)}</p>
      </div>
      <Board key={`b${s.index}`} players={s.players} live={live} animate />
    </>
  );
}

function Final({ s, now }: { s: S<"final">; now: number }) {
  // Fortschritt bis zum Ergebnis-Screen (0 → 1), aus endsAt der Serverzeit.
  const progress = Math.min(1, Math.max(0, 1 - (s.endsAt - now) / TIMING.finalMs));
  const top = s.players.slice(0, 3);
  // Klassische Podest-Anordnung: 2 – 1 – 3
  const order = [top[1], top[0], top[2]].filter((p): p is AonPlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  return (
    <>
      <div class="an-title">
        <h2>{t.finalTitle}</h2>
        <p>{t.finalSubtitle(s.total)}</p>
      </div>
      <div class="an-podium">
        {order.map((p) => (
          <div class={`an-step r${Math.min(p.rank, 3)}`} key={p.id}>
            <div class="an-who">
              <Avatar p={p} />
              <span class="an-step-name">{p.name}</span>
              <span class="an-step-score">
                {t.pointsLong(p.score)}
                {p.left ? ` (${t.left})` : ""}
              </span>
              <span class="an-step-extra">{t.jackpots(p.jackpots)}</span>
            </div>
            <div class="an-block">{p.rank}</div>
          </div>
        ))}
      </div>
      <div class="an-rest">
        {rest.map((p) => (
          <span class="an-chip" key={p.id}>
            <span>{t.rank(p.rank)}</span>
            <Mini p={p} />
            <span>{p.name}</span>
            <span class="an-pts">{t.points(p.score)}</span>
          </span>
        ))}
      </div>
      <div class="an-final-bar" role="progressbar" aria-label={t.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </>
  );
}

export function AonTv({ state, api, players }: TvComponentProps<AonTvState>) {
  ensureStyles("an-tv-css", TV_CSS);
  const phase = state?.phase;
  // Lauflicht braucht feine Schritte, Countdowns reichen 4× pro Sekunde.
  const interval = phase === "spin" ? 40 : 250;
  const ticking = phase === "pick" || phase === "intro" || phase === "final" || phase === "spin" || phase === "decide";
  const now = useServerNow(api.serverNow, ticking, interval);
  let body;
  switch (state?.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "pick":
      body = <Pick s={state} now={now} live={players} />;
      break;
    case "spin":
      body = <Spin key={`s${state.index}-${state.stage}`} s={state} now={now} live={players} />;
      break;
    case "decide":
      body = <Decide s={state} now={now} live={players} />;
      break;
    case "reveal":
      body = <Reveal key={`r${state.index}`} s={state} live={players} />;
      break;
    case "standings":
      body = <Standings s={state} live={players} />;
      break;
    case "final":
      body = <Final s={state} now={now} />;
      break;
    default:
      body = <div class="an-wait">{t.waiting}</div>;
  }
  return (
    <div class={`an-tv is-${phase ?? "wait"}`} data-testid="an-tv" data-phase={phase ?? "wait"}>
      {body}
    </div>
  );
}

export default preactTvView<AonTvState>(AonTv);
