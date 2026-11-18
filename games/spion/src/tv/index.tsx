// TV-View „Wer ist der Spion?“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web). Agenten-Look: Akten, Stempel.
// Hinweise: alle Spieler als Akten-Karten in Zugreihenfolge, wer dran ist leuchtet. Abstimmung: dieselben Karten
// mit ✅ für „hat abgestimmt“. Auflösung: Der Server schaltet die Schritte weiter (stepAt); innerhalb eines
// Schritts laufen die Animationen per CSS mit Verzögerung relativ zu stepAt – ein TV-Reconnect setzt also an der
// richtigen Stelle ein. Das geheime Wort zeigt der TV erst im Rundenergebnis (er bekommt es vorher gar nicht).
// Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import type { ComponentChildren } from "preact";
import { AWARDS, CATEGORY_LABELS, REASONS, joinNames, t } from "../i18n/de.js";
import { VERDICT_TIMES, voteSchedule, type SpPlayerInfo, type SpTvState } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, progress, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends SpTvState["phase"]> = Extract<SpTvState, { phase: P }>;
type RoundState = Exclude<SpTvState, { phase: "intro" } | { phase: "final" }>;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (live: readonly Player[], id: string): boolean => live.find((p) => p.id === id)?.connected === false;

/** Spaltenzahl des Kartenrasters: bis 4 Spieler eine Reihe, sonst zwei Reihen. */
export const gridColumns = (n: number): number => (n <= 4 ? Math.max(1, n) : Math.ceil(n / 2));

/** CSS-Animation, die `delayMs` nach Schrittbeginn startet (negativ = schon gelaufen, z. B. nach Reconnect). */
const at = (delayMs: number, elapsed: number) => ({ animationDelay: `${Math.round(delayMs - elapsed)}ms` });

function SpionTv({ state, api, players }: TvComponentProps<SpTvState>) {
  ensureStyles("sp-tv-css", TV_CSS);
  const ticking = state !== null && state.phase !== "reveal";
  const now = useServerNow(api.serverNow, ticking);
  if (!state) return <div class="sp-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "role":
      body = <Role s={state} now={now} live={players} />;
      break;
    case "clue":
      body = <Clue s={state} now={now} live={players} />;
      break;
    case "vote":
      body = <Vote s={state} now={now} live={players} />;
      break;
    case "reveal":
      body = <Reveal s={state} elapsed={Math.max(0, api.serverNow() - state.stepAt)} />;
      break;
    case "guess":
      body = <Guess s={state} now={now} />;
      break;
    case "result":
      body = <Result s={state} now={now} />;
      break;
    case "final":
      body = <Final s={state} now={now} />;
      break;
  }
  return (
    <div class={`sp-tv sp-tv--${state.phase}`} data-testid="sp-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Avatar({ p, cls = "", badge, style }: { p: Pick<SpPlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string; style?: Record<string, string> }) {
  return (
    <span class={`sp-av ${cls}`} style={{ "--c": playerColor(p.color), ...style }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="sp-av__badge">{badge}</span>}
    </span>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span class={`sp-logo ${small ? "sp-logo--small" : ""}`} aria-hidden="true">
      <span class="sp-logo__face">🕵️</span>
      <span class="sp-logo__beam" />
    </span>
  );
}

function Head({ s, children }: { s: RoundState; children?: ComponentChildren }) {
  return (
    <header class="sp-head">
      <span class="sp-cat" data-testid="sp-category">
        {CATEGORY_LABELS[s.category]}
      </span>
      <span class="sp-round">{t.round(s.round, s.total)}</span>
      <span class="sp-mode">{t.tv.modeChip(s.mode)}</span>
      <span class="sp-spacer" />
      {children}
    </header>
  );
}

function Clock({ endsAt, now }: { endsAt: number; now: number }) {
  const secs = secondsLeft(endsAt, now);
  return (
    <span class={`sp-clock ${secs <= 5 ? "is-hurry" : ""}`} role="timer" aria-label={t.tv.secondsLeft(secs)} data-testid="sp-clock">
      {secs}
    </span>
  );
}

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const share = durationMs > 0 ? Math.min(1, Math.max(0, (endsAt - now) / durationMs)) : 0;
  return (
    <div class="sp-timebar" aria-hidden="true">
      <span class={secondsLeft(endsAt, now) <= 5 ? "is-hurry" : ""} style={{ transform: `scaleX(${share})` }} />
    </div>
  );
}

/** Spieler in Zugreihenfolge (Ausgeschiedene am Ende, ausgegraut). */
function inOrder(s: RoundState): SpPlayerInfo[] {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const ordered = s.order.map((id) => byId.get(id)).filter((p): p is SpPlayerInfo => p !== undefined);
  return [...ordered, ...s.players.filter((p) => !s.order.includes(p.id))];
}

/** Hinweis-Plätze einer Karte: geschriebene Hinweise, „—“ für ausgelassen, leere Plätze für später. */
function Clues({ p, slots, fresh = false }: { p: SpPlayerInfo; slots: number; fresh?: boolean }) {
  return (
    <ol class="sp-clues" data-testid={`sp-clues-${p.id}`}>
      {Array.from({ length: slots }, (_, i) => {
        const has = i < p.clues.length;
        const c = has ? p.clues[i] : undefined;
        return (
          <li key={i} class={`sp-clue ${!has ? "is-empty" : c === null ? "is-passed" : ""} ${fresh && i === p.clues.length - 1 ? "is-new" : ""}`}>
            {has ? (c ?? t.passed) : ""}
          </li>
        );
      })}
    </ol>
  );
}

/** Akte eines Spielers. */
function Card({
  p,
  slots,
  cls = "",
  live,
  badge,
  fresh,
  children,
}: {
  p: SpPlayerInfo;
  slots: number;
  cls?: string;
  live?: readonly Player[];
  badge?: string;
  /** Hinweisphase: der jeweils neueste Hinweis „ploppt“ ein. */
  fresh?: boolean;
  children?: ComponentChildren;
}) {
  return (
    <div class={`sp-card ${cls} ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }} data-testid={`sp-card-${p.id}`}>
      <div class="sp-card__head">
        <Avatar p={p} cls={live && isOffline(live, p.id) ? "is-off" : ""} badge={badge} />
        <span class="sp-card__name">
          {p.name}
          {p.left && <small> ({t.left})</small>}
        </span>
      </div>
      <Clues p={p} slots={slots} fresh={fresh} />
      {children}
    </div>
  );
}

function Grid({ n, children, cls = "" }: { n: number; children: ComponentChildren; cls?: string }) {
  const cols = gridColumns(n);
  return (
    <div class={`sp-grid sp-grid--c${cols} ${n > 4 ? "is-two" : ""} ${cls}`} data-testid="sp-grid" data-cols={cols}>
      {children}
    </div>
  );
}

/** Wer ist schon fertig (Avatar mit ✅). */
function Strip({ players, done, live, label }: { players: SpPlayerInfo[]; done: readonly string[]; live: readonly Player[]; label: string }) {
  const finished = new Set(done);
  return (
    <footer class="sp-strip" role="status">
      {players.map((p) => {
        const ok = finished.has(p.id);
        return (
          <span key={p.id} class="sp-strip__item">
            <Avatar p={p} cls={ok ? "is-done" : isOffline(live, p.id) ? "is-off" : "is-waiting"} badge={ok ? "✅" : undefined} />
            <small>{p.name}</small>
          </span>
        );
      })}
      <span class="sp-strip__label">{label}</span>
    </footer>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <div class="sp-intro">
      <span class="sp-stamp sp-stamp--top" aria-hidden="true">
        {t.topSecret}
      </span>
      <h1 class="sp-title">
        <Logo /> {t.title}
      </h1>
      <p class="sp-lead">{t.tv.introLead(s.total)}</p>
      <div class="sp-cats">
        <span class="sp-cats__mode">{t.tv.modeChip(s.mode)}</span>
        {s.categories.map((c) => (
          <span key={c}>{CATEGORY_LABELS[c]}</span>
        ))}
      </div>
      <ol class="sp-rules">
        {t.tv.introRules[s.mode].map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p class="sp-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <div class="sp-avatars">
        {s.players.map((p) => (
          <span key={p.id} class="sp-avatars__item">
            <Avatar p={p} />
            <small>{p.name}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function Role({ s, now, live }: { s: S<"role">; now: number; live: readonly Player[] }) {
  const act = inOrder(s).filter((p) => !p.left);
  return (
    <>
      <Head s={s}>
        <Clock endsAt={s.endsAt} now={now} />
      </Head>
      <div class="sp-role">
        <div class="sp-folder" aria-hidden="true">
          <span class="sp-folder__tab">{t.round(s.round, s.total)}</span>
          <span class="sp-folder__eye">🕵️</span>
          <span class="sp-stamp sp-stamp--folder">{t.topSecret}</span>
        </div>
        <h2 class="sp-headline">{t.tv.roleTitle}</h2>
        <p class="sp-hint">{t.tv.roleHint}</p>
      </div>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      <Strip players={act} done={s.ready} live={live} label={t.tv.roleReady(s.ready.filter((id) => act.some((p) => p.id === id)).length, act.length)} />
    </>
  );
}

function Clue({ s, now, live }: { s: S<"clue">; now: number; live: readonly Player[] }) {
  const ps = inOrder(s);
  const current = s.players.find((p) => p.id === s.turn);
  return (
    <>
      <Head s={s}>
        <span class="sp-step">{t.clueRound(s.clueRound, s.clueRounds)}</span>
        <Clock endsAt={s.endsAt} now={now} />
      </Head>
      <p class="sp-turn" key={`${s.turn}-${s.clueRound}`} style={{ "--c": playerColor(current?.color ?? 0) }} data-testid="sp-turn">
        {current && <Avatar p={current} cls="sp-av--mini" />}
        <b>{t.tv.onTurn(current?.name ?? "?")}</b>
        <small>{t.tv.clueHint}</small>
      </p>
      <Grid n={ps.length}>
        {ps.map((p) => (
          <Card key={p.id} p={p} slots={s.clueRounds} live={live} fresh cls={p.id === s.turn ? "is-turn" : ""}>
            {p.id === s.turn && <span class="sp-card__tag">{t.tv.turnTag}</span>}
          </Card>
        ))}
      </Grid>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
    </>
  );
}

function Vote({ s, now, live }: { s: S<"vote">; now: number; live: readonly Player[] }) {
  const ps = inOrder(s);
  const voted = new Set(s.voted);
  const voters = ps.filter((p) => !p.left);
  return (
    <>
      <Head s={s}>
        <Clock endsAt={s.endsAt} now={now} />
      </Head>
      <h2 class={`sp-headline sp-headline--vote ${s.runoff ? "is-runoff" : ""}`} data-testid="sp-vote-title">
        {s.runoff ? t.tv.runoffTitle : t.tv.voteTitle}
        <small>{s.runoff ? t.tv.runoffHint : t.tv.voteHint}</small>
      </h2>
      <Grid n={ps.length}>
        {ps.map((p) => (
          <Card
            key={p.id}
            p={p}
            slots={s.clueRounds}
            live={live}
            badge={voted.has(p.id) ? "✅" : undefined}
            cls={s.runoff ? (s.candidates.includes(p.id) ? "is-candidate" : "is-dim") : ""}
          />
        ))}
      </Grid>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      <p class="sp-count" role="status">
        {t.tv.voted(s.voted.filter((id) => voters.some((p) => p.id === id)).length, voters.length)}
      </p>
    </>
  );
}

function Reveal({ s, elapsed }: { s: S<"reveal">; elapsed: number }) {
  const ps = inOrder(s);
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const sched = voteSchedule(s.flights.length);
  // Im Urteil sind die Stimmen schon ausgezählt: alles sofort sichtbar.
  const countElapsed = s.verdict ? sched.doneMs : elapsed;
  const v = s.verdict;
  const accused = s.accused ? byId.get(s.accused) : undefined;
  const spy = v ? byId.get(v.spyId) : undefined;
  let headline: ComponentChildren;
  if (!v) {
    const msg = s.accused ? t.tv.accuses(accused?.name ?? "?") : s.tie ? (s.next === "runoff" ? t.tv.tieRunoff : t.tv.tieAgain) : t.tv.noVotes;
    headline = (
      <>
        <span class="sp-reveal__count" style={at(0, elapsed)}>
          {t.tv.countTitle}
        </span>
        <span class="sp-reveal__msg" style={at(sched.accuseMs, elapsed)} data-testid="sp-accuse">
          {msg}
        </span>
      </>
    );
  } else if (accused) {
    headline = (
      <>
        <span class="sp-reveal__drum" style={at(VERDICT_TIMES.stampMs, elapsed)}>
          {t.tv.drumroll}
        </span>
        <span class={`sp-reveal__msg ${v.caught ? "is-caught" : "is-wrong"}`} style={at(VERDICT_TIMES.stampMs, elapsed)} data-testid="sp-verdict">
          {v.caught ? t.tv.caught(accused.name) : t.tv.innocent(accused.name)}
        </span>
        {!v.caught && spy && (
          <span class="sp-reveal__msg is-spy" style={at(VERDICT_TIMES.spyMs, elapsed)} data-testid="sp-real-spy">
            {t.tv.realSpy(spy.name)}
          </span>
        )}
      </>
    );
  } else {
    headline = (
      <>
        <span class="sp-reveal__msg is-wrong">{s.tie ? t.tv.tieAgain : t.tv.noVotes}</span>
        {spy && (
          <span class="sp-reveal__msg is-spy" style={at(VERDICT_TIMES.stampMs, elapsed)} data-testid="sp-real-spy">
            {t.tv.realSpy(spy.name)}
          </span>
        )}
      </>
    );
  }
  return (
    <>
      <Head s={s}>{s.runoff && <span class="sp-step">{t.tv.runoffTitle}</span>}</Head>
      <h2 class="sp-headline sp-headline--reveal" key={v ? "verdict" : "count"} data-testid="sp-reveal-headline">
        {headline}
      </h2>
      <Grid n={ps.length} cls={v ? "is-verdict" : ""}>
        {ps.map((p) => {
          const mine = s.flights.map((f, i) => ({ f, i })).filter(({ f }) => f.target === p.id);
          const votes = s.counts.find((c) => c.playerId === p.id)?.votes ?? 0;
          const isAccused = p.id === s.accused;
          const isSpy = v?.spyId === p.id;
          const cls = [
            s.candidates.includes(p.id) ? "" : "is-dim",
            isAccused ? "is-accused" : "",
            isAccused && v ? (v.caught ? "is-caught" : "is-innocent") : "",
            isSpy ? "is-spy" : "",
          ].join(" ");
          const lastAt = mine.length > 0 ? sched.firstMs + mine.at(-1)!.i * sched.stepMs : sched.firstMs;
          return (
            <Card key={p.id} p={p} slots={s.clueRounds} cls={cls}>
              <div class="sp-voters" aria-hidden="true">
                {mine.map(({ f, i }) => {
                  const voter = byId.get(f.voter);
                  return voter ? <Avatar key={f.voter} p={voter} cls="sp-av--vote" style={at(sched.firstMs + i * sched.stepMs, countElapsed)} /> : null;
                })}
                {votes > 0 && (
                  <span class="sp-votes" style={at(lastAt + 250, countElapsed)} data-testid={`sp-votes-${p.id}`}>
                    {t.votes(votes)}
                  </span>
                )}
              </div>
              {isAccused && !v && <span class="sp-spot" style={at(sched.accuseMs, elapsed)} aria-hidden="true" />}
              {isAccused && v && (
                <span class={`sp-stamp sp-stamp--card ${v.caught ? "" : "is-innocent"}`} style={at(VERDICT_TIMES.stampMs, elapsed)}>
                  {v.caught ? t.tv.stampSpy : t.tv.stampInnocent}
                </span>
              )}
              {isSpy && !isAccused && v && (
                <span class="sp-stamp sp-stamp--card" style={at(s.accused ? VERDICT_TIMES.spyMs : VERDICT_TIMES.stampMs, elapsed)}>
                  {t.tv.stampSpy}
                </span>
              )}
            </Card>
          );
        })}
      </Grid>
    </>
  );
}

function Guess({ s, now }: { s: S<"guess">; now: number }) {
  const spy = s.players.find((p) => p.id === s.spyId);
  return (
    <>
      <Head s={s}>
        <Clock endsAt={s.endsAt} now={now} />
      </Head>
      <div class="sp-guess">
        {spy && <Avatar p={spy} cls="sp-av--big" />}
        <h2 class="sp-headline">
          {t.tv.guessTitle(spy?.name ?? "?")}
          <small>{t.tv.guessHint}</small>
        </h2>
      </div>
      <div class="sp-options" data-testid="sp-options">
        {s.options.map((o, i) => (
          <span key={o} class={`sp-option ${[...o].length > 10 ? "is-long" : ""}`} style={{ animationDelay: `${i * 70}ms` }}>
            {o}
          </span>
        ))}
      </div>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
    </>
  );
}

function Result({ s, now }: { s: S<"result">; now: number }) {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const spy = byId.get(s.spyId);
  const right = s.guess !== null && s.reason === "guessed";
  return (
    <>
      <Head s={s}>
        <span class="sp-step">{s.last ? t.tv.nextFinal : t.tv.nextRound}</span>
        <Clock endsAt={s.endsAt} now={now} />
      </Head>
      <p class={`sp-banner is-${s.winner}`} data-testid="sp-banner">
        {REASONS[s.reason]}
      </p>
      <div class="sp-result">
        <div class="sp-paper" data-testid="sp-word">
          <span class="sp-paper__label">{t.tv.wordLabel}</span>
          <strong class="sp-paper__word">{s.word}</strong>
          {s.spyWord && (
            <span class="sp-paper__spy" data-testid="sp-spyword">
              {t.tv.spyWordLabel}: <b>{s.spyWord}</b>
            </span>
          )}
          {s.reason !== "left" &&
            (s.guess !== null ? (
              <span class={`sp-paper__guess ${right ? "is-right" : "is-wrong"}`}>{right ? t.tv.guessedRight(s.guess) : t.tv.guessedWrong(s.guess)}</span>
            ) : (
              s.mode === "klassisch" && s.reason === "caught" && <span class="sp-paper__guess is-wrong">{t.tv.noGuess}</span>
            ))}
          <span class="sp-stamp sp-stamp--paper">{t.topSecret}</span>
        </div>
        <div class="sp-agent">
          <span class="sp-agent__label">{t.tv.spyLabel}</span>
          {spy && <Avatar p={spy} cls="sp-av--big" />}
          <b class="sp-agent__name">{spy?.name ?? "?"}</b>
          {s.correctVoters.length > 0 && (
            <small class="sp-agent__voters">
              {t.tv.correctVoters} {joinNames(s.correctVoters.map((id) => byId.get(id)?.name ?? "?"))}
            </small>
          )}
        </div>
      </div>
      <ol class="sp-scores">
        {s.players.map((p) => (
          <li key={p.id} class={`sp-score ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <span class="sp-score__rank">{t.rank(p.rank)}</span>
            <Avatar p={p} cls="sp-av--mini" />
            <span class="sp-score__name">{p.name}</span>
            {p.roundPoints > 0 && <span class="sp-score__gain">{t.plus(p.roundPoints)}</span>}
            <span class="sp-score__pts">{p.score}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

type ById = Map<string, SpPlayerInfo>;
const names = (ids: readonly string[], byId: ById): string => joinNames(ids.map((id) => byId.get(id)?.name ?? "?"));

function Final({ s, now }: { s: S<"final">; now: number }) {
  const share = progress(now, s.endsAt - s.durationMs, s.endsAt);
  const top = s.players.slice(0, 3);
  // Klassische Podest-Anordnung: 2 – 1 – 3
  const order = [top[1], top[0], top[2]].filter((p): p is SpPlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const winners = s.players.filter((p) => p.rank === 1 && !p.left).map((p) => p.id);
  return (
    <div class="sp-final">
      <h1 class="sp-title sp-title--mid">
        <Logo small /> {t.tv.final}
      </h1>
      {winners.length > 0 && (
        <p class="sp-winners" data-testid="sp-winners">
          {t.tv.winners(names(winners, byId))}
        </p>
      )}
      <div class="sp-podium">
        {order.map((p) => (
          <div key={p.id} class={`sp-pod r${Math.min(p.rank, 3)} ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <Avatar p={p} />
            <span class="sp-pod__name">{p.name}</span>
            <span class="sp-pod__score">{t.points(p.score)}</span>
            <span class="sp-pod__block">{p.rank}</span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div class="sp-rest">
          {rest.map((p) => (
            <span key={p.id} class="sp-chip" style={{ "--c": playerColor(p.color) }}>
              <span>{t.rank(p.rank)}</span>
              <Avatar p={p} cls="sp-av--mini" />
              <span class="sp-chip__name">{p.name}</span>
              <span class="sp-chip__pts">{t.points(p.score)}</span>
            </span>
          ))}
        </div>
      )}
      {s.awards.length > 0 && (
        <div class="sp-awards" data-testid="sp-awards">
          {s.awards.map((a, i) => {
            const info = AWARDS[a.kind];
            return (
              <div key={a.kind} class="sp-award" style={{ animationDelay: `${900 + i * 300}ms` }}>
                <span class="sp-award__icon" aria-hidden="true">
                  {info.icon}
                </span>
                <span class="sp-award__text">
                  <b>{info.title}</b>
                  <span class="sp-award__who">{names(a.playerIds, byId)}</span>
                  <small>{info.detail(a.count)}</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div class="sp-finalbar" role="progressbar" aria-label={t.tv.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
    </div>
  );
}

export default preactTvView<SpTvState>(SpionTv);
