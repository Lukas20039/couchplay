// TV-View „Wie gut kennst du mich?“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Zeigt Hauptperson, Frage und Antworten; in der Auflösung die Antwort der Hauptperson und wer was getippt hat.
// Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import { CATEGORY_LABELS, LETTERS, t } from "../i18n/de.js";
import type { KdPlayerInfo, KdTvState } from "../shared.js";
import { ANSWER_COLORS, avatarEmoji, ensureStyles, playerColor, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends KdTvState["phase"]> = Extract<KdTvState, { phase: P }>;

function KennstduTv({ state, api }: TvComponentProps<KdTvState>) {
  ensureStyles("kd-tv-css", TV_CSS);
  const now = useServerNow(api.serverNow, state !== null && state.phase !== "final");
  if (!state) return <div class="kd-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "ask":
    case "reveal":
      body = <QuestionScreen s={state} now={now} />;
      break;
    case "standings":
      body = <Ranking s={state} title={t.tv.standings} />;
      break;
    case "final":
      body = <Ranking s={state} title={t.tv.final} />;
      break;
  }
  return (
    <div class={`kd-tv kd-tv--${state.phase}`} data-testid="kd-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <div class="kd-intro">
      <h1 class="kd-title">💬 {t.title}</h1>
      <p class="kd-lead">{t.tv.introLead}</p>
      <ol class="kd-rules">
        {t.tv.introRules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p class="kd-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <Avatars players={s.players} />
    </div>
  );
}

function QuestionScreen({ s, now }: { s: S<"ask"> | S<"reveal">; now: number }) {
  const hot = s.hotseat;
  const reveal = s.phase === "reveal" ? s : null;
  const guessers = s.players.filter((p) => p.id !== hot.id && !p.left);
  const right = reveal ? reveal.guesses.filter((g) => g.correct).length : 0;
  return (
    <>
      <header class="kd-head">
        <span class="kd-cat">{CATEGORY_LABELS[s.category]}</span>
        <span class="kd-round">{t.round(s.round, s.total)}</span>
        {s.phase === "ask" && (
          <span class={`kd-clock ${secondsLeft(s.endsAt, now) <= 5 ? "is-hurry" : ""}`} data-testid="kd-clock">
            {secondsLeft(s.endsAt, now)}
          </span>
        )}
      </header>
      <section class="kd-hot" style={{ "--c": playerColor(hot.color) }}>
        <span class="kd-hot__avatar" aria-hidden="true">
          {avatarEmoji(hot.avatar)}
        </span>
        <span class="kd-hot__name">{t.tv.turnOf(hot.name)}</span>
      </section>
      <h2 class="kd-question" data-testid="kd-question">
        {s.text}
      </h2>
      <div class={`kd-answers kd-answers--${s.answers.length}`}>
        {s.answers.map((a, i) => {
          const chosen = reveal?.hotseatChoice === i;
          const voters = reveal ? reveal.guesses.filter((g) => g.choice === i) : [];
          const cls = ["kd-answer", reveal ? (chosen ? "is-chosen" : "is-dim") : ""].join(" ");
          return (
            <div key={i} class={cls} style={{ "--a": ANSWER_COLORS[i] }} data-testid={`kd-answer-${i}`}>
              <span class="kd-answer__letter">{LETTERS[i]}</span>
              <span class="kd-answer__text">{a}</span>
              {chosen && <span class="kd-answer__check">✓</span>}
              {reveal && voters.length > 0 && (
                <span class="kd-answer__voters">
                  {voters.map((g) => {
                    const p = s.players.find((x) => x.id === g.playerId);
                    return p ? (
                      <span key={p.id} class="kd-mini" style={{ "--c": playerColor(p.color) }} title={p.name}>
                        {avatarEmoji(p.avatar)}
                      </span>
                    ) : null;
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <footer class="kd-foot" role="status" data-testid="kd-status">
        {s.phase === "ask" ? (
          <>
            <span class={`kd-pill ${s.hotseatAnswered ? "is-done" : ""}`}>{s.hotseatAnswered ? t.tv.hotDone(hot.name) : t.tv.waitingHot(hot.name)}</span>
            <span class="kd-pill">{t.tv.guessed(s.guessed.length, guessers.length)}</span>
          </>
        ) : reveal!.hotseatChoice === null ? (
          <span class="kd-pill">{t.tv.noAnswer(hot.name)}</span>
        ) : (
          <span class="kd-pill is-big">{right === 0 ? t.tv.nobody : right === guessers.length ? t.tv.everyone : t.tv.some(right)}</span>
        )}
      </footer>
    </>
  );
}

function Ranking({ s, title }: { s: S<"standings"> | S<"final">; title: string }) {
  return (
    <div class="kd-ranking">
      <h1 class="kd-title">{title}</h1>
      <ol class="kd-list">
        {s.players.map((p) => (
          <li key={p.id} class={`kd-row ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <span class="kd-row__rank">{p.rank}.</span>
            <span class="kd-row__avatar" aria-hidden="true">
              {avatarEmoji(p.avatar)}
            </span>
            <span class="kd-row__name">{p.name}</span>
            {p.roundPoints > 0 && s.phase === "standings" && <span class="kd-row__gain">{t.tv.gain(p.roundPoints)}</span>}
            <span class="kd-row__score">{p.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Avatars({ players }: { players: KdPlayerInfo[] }) {
  return (
    <div class="kd-avatars">
      {players.map((p) => (
        <span key={p.id} class="kd-avatar" style={{ "--c": playerColor(p.color) }}>
          <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
          <small>{p.name}</small>
        </span>
      ))}
    </div>
  );
}

export default preactTvView<KdTvState>(KennstduTv);
