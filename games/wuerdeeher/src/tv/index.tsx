// TV-View „Wer würde eher …?“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Abstimmung: Aussage riesig, Timer-Balken, Avatare mit ✅ (nur WER abgestimmt hat). Auflösung: Spieler nebeneinander,
// die Stimmen fliegen nacheinander als Chips ein (anonym: neutrale Chips), Balken wachsen, Zahlen zählen hoch,
// dann Krone(n) und die Aussage groß; danach +100 für alle, die mit der Mehrheit lagen.
// Nur Darstellung des empfangenen Zustands – keine Spielregeln. Die Animation läuft relativ zu revealAt (Serverzeit),
// ein TV-Reconnect setzt also an der richtigen Stelle ein.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { CATEGORY_LABELS, t } from "../i18n/de.js";
import { POINTS, revealSchedule, statement, type WePlayerInfo, type WeTvState } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, progress, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends WeTvState["phase"]> = Extract<WeTvState, { phase: P }>;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (live: readonly Player[], id: string): boolean => live.find((p) => p.id === id)?.connected === false;

function WuerdeeherTv({ state, api, players }: TvComponentProps<WeTvState>) {
  ensureStyles("we-tv-css", TV_CSS);
  const ticking = state !== null && state.phase !== "reveal" && state.phase !== "standings";
  const now = useServerNow(api.serverNow, ticking);
  if (!state) return <div class="we-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "vote":
      body = <Vote s={state} now={now} live={players} />;
      break;
    case "reveal":
      body = <Reveal key={`r${state.round}`} s={state} serverNow={api.serverNow} />;
      break;
    case "standings":
      body = <Standings s={state} live={players} />;
      break;
    case "final":
      body = <Final s={state} now={now} />;
      break;
  }
  return (
    <div class={`we-tv we-tv--${state.phase}`} data-testid="we-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Avatar({ p, cls = "", badge }: { p: Pick<WePlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string }) {
  return (
    <span class={`we-av ${cls}`} style={{ "--c": playerColor(p.color) }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="we-av__badge">{badge}</span>}
    </span>
  );
}

function Head({ s, secs }: { s: S<"vote"> | S<"reveal">; secs?: number }) {
  return (
    <header class="we-head">
      <span class="we-cat">{CATEGORY_LABELS[s.category]}</span>
      <span class="we-round">{t.round(s.round, s.total)}</span>
      {secs !== undefined && (
        <span class={`we-clock ${secs <= 5 ? "is-hurry" : ""}`} role="timer" aria-label={t.tv.secondsLeft(secs)} data-testid="we-clock">
          {secs}
        </span>
      )}
    </header>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <div class="we-intro">
      <h1 class="we-title">
        <span aria-hidden="true">🙋</span> {t.title}
      </h1>
      <p class="we-lead">{t.tv.introLead(s.total)}</p>
      <div class="we-cats">
        {s.categories.map((c) => (
          <span key={c}>{CATEGORY_LABELS[c]}</span>
        ))}
      </div>
      <ol class="we-rules">
        {t.tv.introRules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      {s.anonymous && <p class="we-note">{t.tv.anonymousNote}</p>}
      <p class="we-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <div class="we-avatars">
        {s.players.map((p) => (
          <span key={p.id} class="we-avatars__item">
            <Avatar p={p} />
            <small>{p.name}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function Vote({ s, now, live }: { s: S<"vote">; now: number; live: readonly Player[] }) {
  const voted = new Set(s.voted);
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const cands = s.candidates.map((id) => byId.get(id)).filter((p): p is WePlayerInfo => p !== undefined);
  const secs = secondsLeft(s.endsAt, now);
  const share = s.durationMs > 0 ? Math.min(1, Math.max(0, (s.endsAt - now) / s.durationMs)) : 0;
  return (
    <>
      <Head s={s} secs={secs} />
      <section class="we-ask">
        <p class="we-ask__lead">{t.lead}</p>
        <h2 class="we-ask__text" data-testid="we-prompt">
          {s.text}
        </h2>
      </section>
      <div class="we-timebar" aria-hidden="true">
        <span class={secs <= 5 ? "is-hurry" : ""} style={{ transform: `scaleX(${share})` }} />
      </div>
      <footer class="we-strip" role="status">
        {cands.map((p) => {
          const done = voted.has(p.id);
          return (
            <span key={p.id} class="we-strip__item" data-testid={`we-voter-${p.id}`} data-voted={done ? "1" : "0"}>
              <Avatar p={p} cls={done ? "is-done" : isOffline(live, p.id) ? "is-off" : "is-waiting"} badge={done ? "✅" : undefined} />
              <small>{p.name}</small>
            </span>
          );
        })}
        <span class="we-strip__label">{t.tv.voted(s.voted.length, cands.length)}</span>
      </footer>
    </>
  );
}

function Reveal({ s, serverNow }: { s: S<"reveal">; serverNow: () => number }) {
  const plan = revealSchedule(s.flights.length);
  // Eigene, feinere Uhr nur während der Animation.
  const first = serverNow();
  const now = useServerNow(serverNow, first - s.revealAt < plan.pointsMs + 300, 50);
  const elapsed = Math.max(now, first) - s.revealAt;
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const cols = s.candidates.map((id) => byId.get(id)).filter((p): p is WePlayerInfo => p !== undefined);
  const landed = s.flights.filter((_, i) => elapsed >= plan.firstMs + i * plan.stepMs);
  const shown = new Map<string, number>();
  for (const f of landed) shown.set(f.target, (shown.get(f.target) ?? 0) + 1);
  const crowned = elapsed >= plan.crownMs;
  const pointsShown = elapsed >= plan.pointsMs;
  const winners = new Set(s.winners);
  const majority = new Set(s.majority ?? []);
  const scaleMax = Math.max(1, s.maxVotes);
  const colWidth = Math.min(19, Math.floor(1040 / Math.max(1, cols.length)) / 10 - 1.6);
  const winnerNames = s.winners.map((id) => byId.get(id)?.name).filter((n): n is string => n !== undefined);

  return (
    <>
      <Head s={s} />
      <section class="we-headline" role="status" data-testid="we-headline">
        {crowned && winnerNames.length > 0 ? (
          <p class="we-crowned" data-testid="we-crowned">
            {t.crowned(winnerNames, statement(s.text))}
          </p>
        ) : (
          <>
            <p class="we-headline__lead">{t.lead}</p>
            <h2 class="we-headline__text" data-testid="we-prompt">
              {s.text}
            </h2>
          </>
        )}
      </section>
      <div class="we-stage" data-testid="we-stage">
        {cols.map((p) => {
          const count = shown.get(p.id) ?? 0;
          const win = crowned && winners.has(p.id);
          const chips = landed.filter((f) => f.target === p.id);
          return (
            <div
              key={p.id}
              class={`we-col ${win ? "is-win" : ""} ${crowned && !win ? "is-dim" : ""}`}
              style={{ width: `${colWidth}rem`, "--c": playerColor(p.color) }}
              data-testid={`we-col-${p.id}`}
              data-count={count}
            >
              <span class="we-col__count">
                {win && (
                  <span class="we-crown" aria-hidden="true">
                    👑
                  </span>
                )}
                {count}
              </span>
              <div class="we-col__area">
                <span class="we-col__bar" style={{ transform: `scaleY(${count / scaleMax})` }} />
                <div class="we-col__chips">
                  {chips.map((f, i) => {
                    const voter = f.voter ? byId.get(f.voter) : undefined;
                    return voter ? (
                      <span key={i} class="we-chip" style={{ "--c": playerColor(voter.color) }} title={voter.name}>
                        <span aria-hidden="true">{avatarEmoji(voter.avatar)}</span>
                      </span>
                    ) : (
                      <span key={i} class="we-chip is-anon" aria-hidden="true">
                        ✓
                      </span>
                    );
                  })}
                </div>
              </div>
              <div class="we-col__who">
                <Avatar p={p} />
                <span class="we-col__name">{p.name}</span>
                <span class="we-col__pts" data-testid={`we-pts-${p.id}`}>
                  {pointsShown && majority.has(p.id) && <span>{t.plus(POINTS.majority)}</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p class="we-outcome" data-testid="we-outcome">
        {pointsShown && <span>{s.flights.length === 0 ? t.tv.nobodyVoted : t.tv.majorityCount(s.majorityCount, s.voterCount)}</span>}
      </p>
    </>
  );
}

function Standings({ s, live }: { s: S<"standings">; live: readonly Player[] }) {
  const twoCols = s.players.length > 5;
  return (
    <div class="we-ranking">
      <h1 class="we-title">{t.tv.standings}</h1>
      <p class="we-sub">{t.tv.standingsAfter(s.round, s.total)}</p>
      <ol class={`we-list ${twoCols ? "we-list--2" : ""}`} style={{ gridTemplateRows: twoCols ? `repeat(${Math.ceil(s.players.length / 2)}, auto)` : "none" }}>
        {s.players.map((p) => (
          <li key={p.id} class={`we-row ${p.left ? "is-left" : ""} ${p.rank === 1 ? "is-first" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <span class="we-row__rank">{t.rank(p.rank)}</span>
            <Avatar p={p} cls={isOffline(live, p.id) || p.left ? "is-off" : ""} />
            <span class="we-row__name">
              {p.name}
              {p.left && <small> ({t.left})</small>}
            </span>
            {p.roundPoints > 0 && <span class="we-row__gain">{t.plus(p.roundPoints)}</span>}
            <span class="we-row__score">{p.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Final({ s, now }: { s: S<"final">; now: number }) {
  const share = progress(now, s.endsAt - s.durationMs, s.endsAt);
  const top = s.players.slice(0, 3);
  // Klassische Podest-Anordnung: 2 – 1 – 3
  const order = [top[1], top[0], top[2]].filter((p): p is WePlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  const titles = new Map(s.titles.map((x) => [x.playerId, x.title]));
  return (
    <div class="we-final">
      <h1 class="we-title">
        <span aria-hidden="true">🏆</span> {t.tv.final}
      </h1>
      <div class="we-final__body">
        <section class="we-final__left">
          <div class="we-podium">
            {order.map((p) => (
              <div key={p.id} class={`we-step r${Math.min(p.rank, 3)} ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
                <Avatar p={p} />
                <span class="we-step__name">{p.name}</span>
                <span class="we-step__score">{t.points(p.score)}</span>
                <span class="we-step__block">{p.rank}</span>
              </div>
            ))}
          </div>
          {rest.length > 0 && (
            <div class="we-rest">
              {rest.map((p) => (
                <span key={p.id} class="we-pill" style={{ "--c": playerColor(p.color) }}>
                  <span>{t.rank(p.rank)}</span>
                  <Avatar p={p} cls="we-av--mini" />
                  <span class="we-pill__name">{p.name}</span>
                  <span class="we-pill__pts">{p.score}</span>
                </span>
              ))}
            </div>
          )}
        </section>
        <section class="we-final__right">
          <h2 class="we-final__h">{t.tv.titles}</h2>
          <ol class={`we-titles ${s.players.length > 5 ? "we-titles--dense" : ""}`} data-testid="we-titles">
            {s.players.map((p, i) => {
              const title = titles.get(p.id) ?? null;
              return (
                <li
                  key={p.id}
                  class={`we-title-row ${title ? "" : "is-none"}`}
                  style={{ "--c": playerColor(p.color), animationDelay: `${0.8 + i * 0.15}s` }}
                  data-testid={`we-title-${p.id}`}
                >
                  <Avatar p={p} cls="we-av--mini" />
                  <span class="we-title-row__text">
                    <span class="we-title-row__name">{p.name}</span>
                    <span class="we-title-row__claim">{title ? t.tv.titleClaim(title.text) : t.tv.noTitle}</span>
                    {title && <span class="we-title-row__votes">{t.tv.titleVotes(title.votes)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
      <div class="we-finalbar" role="progressbar" aria-label={t.tv.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
    </div>
  );
}

export default preactTvView<WeTvState>(WuerdeeherTv);
