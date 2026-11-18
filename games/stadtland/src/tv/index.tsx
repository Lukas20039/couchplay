// TV-View „Stadt, Land, Fluss“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Buchstabe: Walze per CSS-Animation relativ zum Phasenbeginn (ein TV-Reconnect setzt an der richtigen Stelle ein).
// Schreiben: Buchstabe groß, Kategorien als Liste, Uhr; unten der Fortschritt je Spieler (nur Anzahl Felder).
// Prüfung: eine Kategorie, alle Antworten als Karten mit Status, Daumen und vorläufigen Punkten.
// Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { AWARDS, CATEGORY_LABELS, SET_LABELS, STATUS_LABELS, joinNames, t } from "../i18n/de.js";
import { LETTERS, POINTS, TIMING, type SlEntry, type SlPlayerInfo, type SlProgress, type SlTvState } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, progress, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends SlTvState["phase"]> = Extract<SlTvState, { phase: P }>;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (live: readonly Player[], id: string): boolean => live.find((p) => p.id === id)?.connected === false;

/** Buchstaben der Walze: REEL_LENGTH - 1 andere, zuletzt der echte (deterministisch je Runde). */
export const REEL_LENGTH = 12;
export function reelLetters(letter: string, round: number): string[] {
  const others = LETTERS.filter((l) => l !== letter);
  const start = (letter.charCodeAt(0) * 7 + round * 5) % others.length;
  const out: string[] = [];
  for (let i = 0; i < REEL_LENGTH - 1; i++) out.push(others[(start + i * 3) % others.length]!);
  out.push(letter);
  return out;
}

/** CSS-Animation, die `delayMs` nach Phasenbeginn startet (negativ = schon gelaufen, z. B. nach Reconnect). */
const at = (delayMs: number, elapsed: number) => ({ animationDelay: `${Math.round(delayMs - elapsed)}ms` });

function StadtlandTv({ state, api, players }: TvComponentProps<SlTvState>) {
  ensureStyles("sl-tv-css", TV_CSS);
  const ticking = state !== null && state.phase !== "timeup";
  const now = useServerNow(api.serverNow, ticking);
  if (!state) return <div class="sl-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "letter":
      body = <LetterReveal s={state} elapsed={Math.max(0, api.serverNow() - (state.endsAt - state.durationMs))} />;
      break;
    case "write":
      body = <Write s={state} now={now} live={players} />;
      break;
    case "timeup":
      body = <TimeUp s={state} live={players} />;
      break;
    case "review":
      body = <Review s={state} now={now} live={players} />;
      break;
    case "standings":
      body = <Standings s={state} live={players} />;
      break;
    case "final":
      body = <Final s={state} now={now} />;
      break;
  }
  return (
    <div class={`sl-tv sl-tv--${state.phase}`} data-testid="sl-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Avatar({ p, cls = "", badge }: { p: Pick<SlPlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string }) {
  return (
    <span class={`sl-av ${cls}`} style={{ "--c": playerColor(p.color) }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="sl-av__badge">{badge}</span>}
    </span>
  );
}

/** Logo: drei Karteikarten S · L · F. */
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span class={`sl-logo ${small ? "sl-logo--small" : ""}`} aria-hidden="true">
      <span>S</span>
      <span>L</span>
      <span>F</span>
    </span>
  );
}

function Clock({ endsAt, now }: { endsAt: number; now: number }) {
  const secs = secondsLeft(endsAt, now);
  return (
    <span class={`sl-clock ${secs <= 10 ? "is-hurry" : ""}`} role="timer" aria-label={t.tv.secondsLeft(secs)} data-testid="sl-clock">
      {secs}
    </span>
  );
}

function TimeBar({ endsAt, durationMs, now }: { endsAt: number; durationMs: number; now: number }) {
  const share = durationMs > 0 ? Math.min(1, Math.max(0, (endsAt - now) / durationMs)) : 0;
  return (
    <div class="sl-timebar" aria-hidden="true">
      <span class={secondsLeft(endsAt, now) <= 10 ? "is-hurry" : ""} style={{ transform: `scaleX(${share})` }} />
    </div>
  );
}

function LetterTile({ letter, cls = "" }: { letter: string; cls?: string }) {
  return (
    <span class={`sl-tile ${cls}`} data-testid="sl-letter" aria-label={`${t.letter} ${letter}`}>
      {letter}
    </span>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <div class="sl-intro">
      <h1 class="sl-title">
        <Logo /> {t.title}
      </h1>
      <p class="sl-lead">{t.tv.introLead(s.total, SET_LABELS[s.set])}</p>
      <ol class="sl-rules">
        {t.tv.introRules(s.categoryCount, s.durationSeconds).map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p class="sl-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <div class="sl-avatars">
        {s.players.map((p) => (
          <span key={p.id} class="sl-avatars__item">
            <Avatar p={p} />
            <small>{p.name}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function LetterReveal({ s, elapsed }: { s: S<"letter">; elapsed: number }) {
  const reel = reelLetters(s.letter, s.round);
  return (
    <div class="sl-reveal">
      <p class="sl-round sl-round--center">{t.round(s.round, s.total)}</p>
      <p class="sl-lead">{t.tv.letterLead}</p>
      <div class="sl-reel" data-testid="sl-reel">
        <div class="sl-reel__strip" style={at(0, elapsed)}>
          {reel.map((l, i) => (
            <span key={i} class="sl-reel__item">
              {l}
            </span>
          ))}
        </div>
        <span class="sl-reel__glow" style={at(TIMING.reelMs, elapsed)} aria-hidden="true" />
      </div>
      <p class="sl-sr" data-testid="sl-letter">
        {s.letter}
      </p>
      <div class="sl-cats" style={at(TIMING.reelMs + 200, elapsed)}>
        {s.categories.map((c) => (
          <span key={c}>{CATEGORY_LABELS[c]}</span>
        ))}
      </div>
    </div>
  );
}

/** Fortschritt je Spieler: Punkte für ausgefüllte Felder, ✅ wenn alles voll ist. */
function ProgressStrip({ s, progress: prog, live }: { s: S<"write"> | S<"timeup">; progress: SlProgress[]; live: readonly Player[] }) {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const of = s.categories.length;
  const done = prog.filter((x) => x.filled >= of).length;
  return (
    <footer class="sl-strip" role="status">
      {prog.map((x) => {
        const p = byId.get(x.playerId);
        if (!p) return null;
        const full = x.filled >= of;
        return (
          <span key={p.id} class="sl-strip__item" data-testid={`sl-progress-${p.id}`} data-filled={x.filled} aria-label={t.tv.filledLabel(p.name, x.filled, of)}>
            <Avatar p={p} cls={full ? "is-done" : isOffline(live, p.id) ? "is-off" : ""} badge={full ? "✅" : undefined} />
            <small>{p.name}</small>
            <span class="sl-dots" aria-hidden="true">
              {s.categories.map((_, i) => (
                <i key={i} class={i < x.filled ? "is-on" : ""} />
              ))}
            </span>
          </span>
        );
      })}
      <span class="sl-strip__label">{t.tv.allDone(done, prog.length)}</span>
    </footer>
  );
}

function Write({ s, now, live }: { s: S<"write">; now: number; live: readonly Player[] }) {
  const stopper = s.stop ? s.players.find((p) => p.id === s.stop!.by) : undefined;
  return (
    <>
      <header class="sl-head">
        <span class="sl-round">{t.round(s.round, s.total)}</span>
        <span class="sl-spacer" />
        <Clock endsAt={s.endsAt} now={now} />
      </header>
      <div class="sl-board">
        <LetterTile letter={s.letter} />
        <ol class={`sl-catlist ${s.categories.length > 5 ? "is-six" : ""}`} data-testid="sl-catlist">
          {s.categories.map((c) => (
            <li key={c}>{CATEGORY_LABELS[c]}</li>
          ))}
        </ol>
      </div>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
      <ProgressStrip s={s} progress={s.progress} live={live} />
      {s.stop && (
        <div class="sl-stop" role="alert" data-testid="sl-stop">
          <span class="sl-stop__word">{t.stop}</span>
          <span class="sl-stop__who">
            {stopper && <Avatar p={stopper} cls="sl-av--mini" />}
            {t.tv.stopBy(stopper?.name ?? "?")}
          </span>
          <span class="sl-stop__count">{secondsLeft(s.stop.endsAt, now)}</span>
        </div>
      )}
    </>
  );
}

function TimeUp({ s, live }: { s: S<"timeup">; live: readonly Player[] }) {
  const stopper = s.stoppedBy ? s.players.find((p) => p.id === s.stoppedBy) : undefined;
  return (
    <>
      <div class="sl-timeup" data-testid="sl-timeup">
        <LetterTile letter={s.letter} cls="sl-tile--small" />
        <h1 class="sl-timeup__word">{t.tv.timeUp}</h1>
        {stopper && <p class="sl-sub">{t.tv.timeUpStop(stopper.name)}</p>}
      </div>
      <ProgressStrip s={s} progress={s.progress} live={live} />
    </>
  );
}

function Review({ s, now, live }: { s: S<"review">; now: number; live: readonly Player[] }) {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const category = s.categories[s.index]!;
  // Gleiche gültige Antworten bekommen dieselbe Markierungsfarbe.
  const sharedKeys = [...new Set(s.entries.filter((e) => e.shared).map((e) => e.key))];
  const dense = s.entries.length > 4;
  const anyValid = s.entries.some((e) => e.needed !== null);
  const readyCount = s.ready.length;
  return (
    <>
      <header class="sl-head">
        <LetterTile letter={s.letter} cls="sl-tile--chip" />
        <span class="sl-round">{t.tv.reviewOf(s.index, s.categories.length)}</span>
        <span class="sl-spacer" />
        <Clock endsAt={s.endsAt} now={now} />
      </header>
      <h2 class="sl-category" data-testid="sl-category">
        {CATEGORY_LABELS[category]}
      </h2>
      <div class={`sl-entries ${dense ? "is-dense" : ""}`} key={`c${s.index}`} data-testid="sl-entries">
        {s.entries.map((e, i) => {
          const p = byId.get(e.playerId);
          return p ? <Entry key={e.playerId} e={e} p={p} i={i} group={sharedKeys.indexOf(e.key)} off={isOffline(live, p.id)} ready={s.ready.includes(p.id)} /> : null;
        })}
      </div>
      <footer class="sl-foot">
        <span>{anyValid ? t.tv.reviewHint : t.tv.reviewEmpty}</span>
        <span class="sl-spacer" />
        {anyValid && <span>{t.tv.readyLabel(readyCount, s.entries.length)}</span>}
      </footer>
      <TimeBar endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
    </>
  );
}

function Entry({ e, p, i, group, off, ready }: { e: SlEntry; p: SlPlayerInfo; i: number; group: number; off: boolean; ready: boolean }) {
  const reason = STATUS_LABELS[e.status];
  return (
    <div
      class={`sl-entry is-${e.status} ${group >= 0 ? `is-group g${group % 4}` : ""}`}
      style={{ "--c": playerColor(p.color), animationDelay: `${i * 70}ms` }}
      data-testid={`sl-entry-${p.id}`}
      data-status={e.status}
    >
      <Avatar p={p} cls={off ? "is-off" : ""} badge={ready ? "✅" : undefined} />
      <span class="sl-entry__body">
        <small>{p.name}</small>
        <span class="sl-entry__text">{e.text || t.controller.noAnswer}</span>
      </span>
      <span class="sl-entry__side">
        {reason && <span class="sl-reason">{reason}</span>}
        {e.shared && <span class="sl-tag">{t.tv.sharedTag}</span>}
        {e.points === POINTS.solo && <span class="sl-tag sl-tag--solo">{t.tv.soloTag}</span>}
        {e.needed !== null && e.votes > 0 && (
          <span class="sl-votes" data-testid={`sl-votes-${p.id}`}>
            {t.tv.votes(e.votes, e.needed)}
          </span>
        )}
        <span class={`sl-pts ${e.points > 0 ? "is-on" : ""}`}>{e.points > 0 ? t.plus(e.points) : "0"}</span>
      </span>
    </div>
  );
}

function Standings({ s, live }: { s: S<"standings">; live: readonly Player[] }) {
  return (
    <div class="sl-ranking">
      <h1 class="sl-title sl-title--mid">{t.tv.standings}</h1>
      <p class="sl-sub">{t.tv.standingsAfter(s.round, s.total, s.letter)}</p>
      <ol class={`sl-list ${s.players.length > 6 ? "is-dense" : ""}`}>
        {s.players.map((p, i) => (
          <li
            key={p.id}
            class={`sl-row ${p.left ? "is-left" : ""} ${p.rank === 1 ? "is-first" : ""}`}
            style={{ "--c": playerColor(p.color), animationDelay: `${i * 70}ms` }}
          >
            <span class="sl-row__rank">{t.rank(p.rank)}</span>
            <Avatar p={p} cls={isOffline(live, p.id) || p.left ? "is-off" : ""} />
            <span class="sl-row__name">
              {p.name}
              {p.left && <small> ({t.left})</small>}
            </span>
            {p.roundPoints > 0 && <span class="sl-row__gain">{t.plus(p.roundPoints)}</span>}
            <span class="sl-row__score">{p.score}</span>
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
  const order = [top[1], top[0], top[2]].filter((p): p is SlPlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const names = (ids: readonly string[]): string => joinNames(ids.map((id) => byId.get(id)?.name ?? "?"));
  return (
    <div class="sl-final">
      <h1 class="sl-title sl-title--mid">
        <Logo small /> {t.tv.final}
      </h1>
      {s.letters.length > 0 && <p class="sl-sub">{t.tv.finalLetters(s.letters.join(" · "))}</p>}
      <div class={`sl-podium ${rest.length > 2 ? "is-compact" : ""}`}>
        {order.map((p) => (
          <div key={p.id} class={`sl-step r${Math.min(p.rank, 3)} ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <Avatar p={p} />
            <span class="sl-step__name">{p.name}</span>
            <span class="sl-step__score">{t.points(p.score)}</span>
            <span class="sl-step__block">{p.rank}</span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div class="sl-rest">
          {rest.map((p) => (
            <span key={p.id} class="sl-chip" style={{ "--c": playerColor(p.color) }}>
              <span>{t.rank(p.rank)}</span>
              <Avatar p={p} cls="sl-av--mini" />
              <span class="sl-chip__name">{p.name}</span>
              <span class="sl-chip__pts">{t.points(p.score)}</span>
            </span>
          ))}
        </div>
      )}
      {s.awards.length > 0 && (
        <div class="sl-awards" data-testid="sl-awards">
          {s.awards.map((a, i) => {
            const info = AWARDS[a.kind];
            return (
              <div key={a.kind} class="sl-award" style={{ animationDelay: `${900 + i * 300}ms` }}>
                <span class="sl-award__icon" aria-hidden="true">
                  {info.icon}
                </span>
                <span class="sl-award__text">
                  <b>{info.title}</b>
                  <span class="sl-award__who">{names(a.playerIds)}</span>
                  <small>{info.detail(a.count)}</small>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div class="sl-finalbar" role="progressbar" aria-label={t.tv.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
    </div>
  );
}

export default preactTvView<SlTvState>(StadtlandTv);
