// TV-View „Flunkern“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Schreiben: Frage groß, Timer-Balken, wer schon gelogen hat. Wählen: Antworten als Kacheln (2 bzw. 3 Spalten).
// Auflösung: Der Server schaltet Schritt für Schritt weiter (stepAt). Innerhalb eines Schritts laufen die
// Animationen per CSS mit Verzögerungen relativ zu stepAt – ein TV-Reconnect setzt also an der richtigen Stelle ein.
// Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import type { ComponentChildren } from "preact";
import { AWARDS, CATEGORY_LABELS, joinNames, t } from "../i18n/de.js";
import { STEP_TIMES, type FlPlayerInfo, type FlRevealStep, type FlTvState } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, progress, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends FlTvState["phase"]> = Extract<FlTvState, { phase: P }>;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (live: readonly Player[], id: string): boolean => live.find((p) => p.id === id)?.connected === false;

/** Spaltenzahl des Antwortrasters: bis 6 Antworten 2 Spalten, darüber 3. */
export const gridColumns = (n: number): number => (n <= 6 ? 2 : 3);

/** CSS-Animation, die `delayMs` nach Schrittbeginn startet (negativ = schon gelaufen, z. B. nach Reconnect). */
const at = (delayMs: number, elapsed: number) => ({ animationDelay: `${Math.round(delayMs - elapsed)}ms` });

function FlunkernTv({ state, api, players }: TvComponentProps<FlTvState>) {
  ensureStyles("fl-tv-css", TV_CSS);
  const ticking = state !== null && state.phase !== "reveal" && state.phase !== "standings";
  const now = useServerNow(api.serverNow, ticking);
  if (!state) return <div class="fl-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "write":
      body = <Write s={state} now={now} live={players} />;
      break;
    case "choose":
      body = <Choose s={state} now={now} live={players} />;
      break;
    case "reveal":
      body = <Reveal s={state} elapsed={Math.max(0, api.serverNow() - state.stepAt)} />;
      break;
    case "standings":
      body = <Standings s={state} live={players} />;
      break;
    case "final":
      body = <Final s={state} now={now} />;
      break;
  }
  return (
    <div class={`fl-tv fl-tv--${state.phase}`} data-testid="fl-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Avatar({ p, cls = "", badge, style }: { p: Pick<FlPlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string; style?: Record<string, string> }) {
  return (
    <span class={`fl-av ${cls}`} style={{ "--c": playerColor(p.color), ...style }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="fl-av__badge">{badge}</span>}
    </span>
  );
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span class={`fl-logo ${small ? "fl-logo--small" : ""}`} aria-hidden="true">
      <span class="fl-logo__face">🤥</span>
      <span class="fl-logo__nose" />
    </span>
  );
}

function Head({ s, children }: { s: S<"write"> | S<"choose"> | S<"reveal">; children?: ComponentChildren }) {
  return (
    <header class="fl-head">
      <span class="fl-cat">{CATEGORY_LABELS[s.category]}</span>
      <span class="fl-round">{t.round(s.round, s.total)}</span>
      {/* In der Schreibphase steht der große Hinweis unter dem Kopf. */}
      {s.double && s.phase !== "write" && <span class="fl-double fl-double--chip">{t.double}</span>}
      <span class="fl-spacer" />
      {children}
    </header>
  );
}

function Clock({ endsAt, now }: { endsAt: number; now: number }) {
  const secs = secondsLeft(endsAt, now);
  return (
    <span class={`fl-clock ${secs <= 5 ? "is-hurry" : ""}`} role="timer" aria-label={t.tv.secondsLeft(secs)} data-testid="fl-clock">
      {secs}
    </span>
  );
}

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const share = durationMs > 0 ? Math.min(1, Math.max(0, (endsAt - now) / durationMs)) : 0;
  return (
    <div class="fl-timebar" aria-hidden="true">
      <span class={secondsLeft(endsAt, now) <= 5 ? "is-hurry" : ""} style={{ transform: `scaleX(${share})` }} />
    </div>
  );
}

/** Wer ist schon fertig (Avatar mit ✅). */
function Strip({ players, done, live, label }: { players: FlPlayerInfo[]; done: readonly string[]; live: readonly Player[]; label: string }) {
  const finished = new Set(done);
  return (
    <footer class="fl-strip" role="status">
      {players.map((p) => {
        const ok = finished.has(p.id);
        return (
          <span key={p.id} class="fl-strip__item">
            <Avatar p={p} cls={ok ? "is-done" : isOffline(live, p.id) ? "is-off" : "is-waiting"} badge={ok ? "✅" : undefined} />
            <small>{p.name}</small>
          </span>
        );
      })}
      <span class="fl-strip__label">{label}</span>
    </footer>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <div class="fl-intro">
      <h1 class="fl-title">
        <Logo /> {t.title}
      </h1>
      <p class="fl-lead">{t.tv.introLead(s.total)}</p>
      <div class="fl-cats">
        {s.categories.map((c) => (
          <span key={c}>{CATEGORY_LABELS[c]}</span>
        ))}
      </div>
      <ol class="fl-rules">
        {t.tv.introRules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p class="fl-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <div class="fl-avatars">
        {s.players.map((p) => (
          <span key={p.id} class="fl-avatars__item">
            <Avatar p={p} />
            <small>{p.name}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function Write({ s, now, live }: { s: S<"write">; now: number; live: readonly Player[] }) {
  const active = s.players.filter((p) => !p.left);
  return (
    <>
      <Head s={s}>
        <Clock endsAt={s.endsAt} now={now} />
      </Head>
      {s.double && <p class="fl-double fl-double--banner">{t.double}</p>}
      <h2 class="fl-question" data-testid="fl-question">
        {s.text}
      </h2>
      <p class="fl-hint">
        <Logo small /> {t.tv.writeHint}
      </p>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      <Strip players={active} done={s.done} live={live} label={t.tv.written(s.done.filter((id) => active.some((p) => p.id === id)).length, active.length)} />
    </>
  );
}

function Choose({ s, now, live }: { s: S<"choose">; now: number; live: readonly Player[] }) {
  const active = s.players.filter((p) => !p.left);
  const cols = gridColumns(s.options.length);
  return (
    <>
      <Head s={s}>
        <Clock endsAt={s.endsAt} now={now} />
      </Head>
      <h2 class="fl-question fl-question--small" data-testid="fl-question">
        {s.text}
      </h2>
      <div class={`fl-grid fl-grid--c${cols} ${s.options.length > 6 ? "is-dense" : ""}`} data-testid="fl-grid" data-cols={cols}>
        {s.options.map((o, i) => (
          <div key={i} class="fl-tile" style={{ animationDelay: `${i * 80}ms` }} data-testid={`fl-tile-${i}`}>
            <span class="fl-tile__text">{o}</span>
          </div>
        ))}
      </div>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      <Strip players={active} done={s.chosen} live={live} label={t.tv.chosen(s.chosen.filter((id) => active.some((p) => p.id === id)).length, active.length)} />
    </>
  );
}

function Reveal({ s, elapsed }: { s: S<"reveal">; elapsed: number }) {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const current = s.steps.at(-1)!;
  const index = s.steps.length - 1;
  // Bereits aufgedeckte Antworten fürs Brett unten.
  const marks = new Map<number, "lie" | "truth">(s.steps.map((st) => [st.option, st.kind]));
  return (
    <>
      <Head s={s}>
        <span class="fl-steps">{t.tv.stepOf(index, s.stepCount)}</span>
      </Head>
      <h2 class="fl-question fl-question--small" data-testid="fl-question">
        {s.text}
      </h2>
      <div class="fl-stage" key={`st${index}`} data-testid="fl-stage" data-kind={current.kind}>
        {current.kind === "lie" ? <LieStep st={current} byId={byId} elapsed={elapsed} /> : <TruthStep st={current} byId={byId} elapsed={elapsed} />}
      </div>
      <div class="fl-board" aria-hidden="true">
        {s.options.map((o, i) => {
          const mark = marks.get(i);
          return (
            <span key={i} class={`fl-board__item ${mark ? `is-${mark}` : ""} ${i === current.option ? "is-current" : ""}`}>
              {mark === "lie" ? "✗ " : mark === "truth" ? "✓ " : ""}
              {o}
            </span>
          );
        })}
      </div>
    </>
  );
}

type ById = Map<string, FlPlayerInfo>;
const names = (ids: readonly string[], byId: ById): string => joinNames(ids.map((id) => byId.get(id)?.name ?? "?"));

function Fallers({ ids, byId, elapsed, label }: { ids: readonly string[]; byId: ById; elapsed: number; label: string }) {
  return (
    <div class="fl-fallers" data-testid="fl-fallers">
      <span class="fl-fallers__label" style={at(STEP_TIMES.avatarsMs, elapsed)}>
        {label}
      </span>
      {ids.map((id, i) => {
        const p = byId.get(id);
        if (!p) return null;
        return (
          <span key={id} class="fl-faller" style={at(STEP_TIMES.avatarsMs + i * STEP_TIMES.avatarStaggerMs, elapsed)}>
            <Avatar p={p} />
            <small>{p.name}</small>
          </span>
        );
      })}
    </div>
  );
}

function LieStep({ st, byId, elapsed }: { st: Extract<FlRevealStep, { kind: "lie" }>; byId: ById; elapsed: number }) {
  const house = st.authors.length === 0;
  return (
    <>
      <div class="fl-card fl-card--lie" style={at(0, elapsed)}>
        <span class="fl-card__text" data-testid="fl-card-text">
          {st.text}
        </span>
        <span class="fl-stamp fl-stamp--lie" style={at(STEP_TIMES.stampMs, elapsed)}>
          {t.tv.lied}
        </span>
      </div>
      <Fallers ids={st.fooled} byId={byId} elapsed={elapsed} label={t.tv.fooledLabel} />
      <p class="fl-author" style={at(STEP_TIMES.stampMs + 200, elapsed)} data-testid="fl-author">
        {house ? (
          <>
            <b>{t.tv.houseLie}</b> <small>{t.tv.houseNoPoints}</small>
          </>
        ) : (
          <>
            {st.authors.map((id) => {
              const p = byId.get(id);
              return p ? <Avatar key={id} p={p} cls="fl-av--mini" /> : null;
            })}
            <b>{t.tv.liedBy(names(st.authors, byId))}</b>
            {st.points > 0 && <span class="fl-gain">{t.plus(st.points)}</span>}
            {st.auto && <small>{t.tv.autoLie}</small>}
          </>
        )}
      </p>
    </>
  );
}

function TruthStep({ st, byId, elapsed }: { st: Extract<FlRevealStep, { kind: "truth" }>; byId: ById; elapsed: number }) {
  return (
    <>
      <p class="fl-drum" style={at(STEP_TIMES.drumMs, elapsed)} role="status">
        {t.tv.drumroll}
      </p>
      <div class="fl-card fl-card--truth" style={at(STEP_TIMES.drumMs, elapsed)}>
        <span class="fl-card__text" data-testid="fl-card-text">
          {st.text}
        </span>
        <span class="fl-stamp fl-stamp--truth" style={at(STEP_TIMES.drumMs + 300, elapsed)}>
          {t.tv.true}
        </span>
      </div>
      {st.finders.length > 0 ? (
        <Fallers ids={st.finders} byId={byId} elapsed={elapsed - (STEP_TIMES.drumMs + 200 - STEP_TIMES.avatarsMs)} label={t.tv.finders} />
      ) : (
        <p class="fl-author" style={at(STEP_TIMES.drumMs + 400, elapsed)}>
          <b>{t.tv.nobodyFound}</b>
        </p>
      )}
      {st.finders.length > 0 && (
        <p class="fl-author" style={at(STEP_TIMES.drumMs + 600, elapsed)}>
          <span class="fl-gain">{t.plus(st.points)}</span>
        </p>
      )}
      {st.fact && (
        <p class="fl-fact" style={at(STEP_TIMES.factMs, elapsed)} data-testid="fl-fact">
          <b>{t.tv.factLabel}</b> {st.fact}
        </p>
      )}
    </>
  );
}

function Standings({ s, live }: { s: S<"standings">; live: readonly Player[] }) {
  return (
    <div class="fl-ranking">
      <h1 class="fl-title fl-title--mid">{t.tv.standings}</h1>
      <p class="fl-sub">{t.tv.standingsAfter(s.round, s.total)}</p>
      <ol class={`fl-list ${s.players.length > 6 ? "is-dense" : ""}`}>
        {s.players.map((p, i) => (
          <li
            key={p.id}
            class={`fl-row ${p.left ? "is-left" : ""} ${p.rank === 1 ? "is-first" : ""}`}
            style={{ "--c": playerColor(p.color), animationDelay: `${i * 70}ms` }}
          >
            <span class="fl-row__rank">{t.rank(p.rank)}</span>
            <Avatar p={p} cls={isOffline(live, p.id) || p.left ? "is-off" : ""} />
            <span class="fl-row__name">
              {p.name}
              {p.left && <small> ({t.left})</small>}
            </span>
            {p.roundPoints > 0 && <span class="fl-row__gain">{t.plus(p.roundPoints)}</span>}
            <span class="fl-row__score">{p.score}</span>
          </li>
        ))}
      </ol>
      {s.nextDouble && <p class="fl-double fl-double--banner">{t.tv.nextDouble}</p>}
    </div>
  );
}

function Final({ s, now }: { s: S<"final">; now: number }) {
  const share = progress(now, s.endsAt - s.durationMs, s.endsAt);
  const top = s.players.slice(0, 3);
  // Klassische Podest-Anordnung: 2 – 1 – 3
  const order = [top[1], top[0], top[2]].filter((p): p is FlPlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  const byId = new Map(s.players.map((p) => [p.id, p]));
  return (
    <div class="fl-final">
      <h1 class="fl-title fl-title--mid">
        <Logo small /> {t.tv.final}
      </h1>
      <div class="fl-podium">
        {order.map((p) => (
          <div key={p.id} class={`fl-step r${Math.min(p.rank, 3)} ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <Avatar p={p} />
            <span class="fl-step__name">{p.name}</span>
            <span class="fl-step__score">{t.points(p.score)}</span>
            <span class="fl-step__block">{p.rank}</span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div class="fl-rest">
          {rest.map((p) => (
            <span key={p.id} class="fl-chip" style={{ "--c": playerColor(p.color) }}>
              <span>{t.rank(p.rank)}</span>
              <Avatar p={p} cls="fl-av--mini" />
              <span class="fl-chip__name">{p.name}</span>
              <span class="fl-chip__pts">{t.points(p.score)}</span>
            </span>
          ))}
        </div>
      )}
      {s.awards.length > 0 && (
        <div class="fl-awards" data-testid="fl-awards">
          {s.awards.map((a, i) => {
            const info = AWARDS[a.kind];
            return (
              <div key={a.kind} class="fl-award" style={{ animationDelay: `${900 + i * 300}ms` }}>
                <span class="fl-award__icon" aria-hidden="true">
                  {info.icon}
                </span>
                <span class="fl-award__text">
                  <b>{info.title}</b>
                  <span class="fl-award__who">{names(a.playerIds, byId)}</span>
                  <small>{info.detail(a.count)}</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div class="fl-finalbar" role="progressbar" aria-label={t.tv.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
    </div>
  );
}

export default preactTvView<FlTvState>(FlunkernTv);
