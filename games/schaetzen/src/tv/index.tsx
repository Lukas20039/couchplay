// TV-View „Schätzen!“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Frage mit Einheit und Timer-Balken; in der Auflösung ein Zahlenstrahl mit den Tipps als Avatar-Pins,
// auf dem die Lösung einfährt und hochzählt. Nur Darstellung des empfangenen Zustands – keine Spielregeln.
// Die Animation läuft relativ zu revealAt (Serverzeit), ein TV-Reconnect setzt also an der richtigen Stelle ein.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import type { ComponentChildren } from "preact";
import { isYearUnit } from "../constants.js";
import { distanceText, formatCompact, formatNumber, formatValue } from "../format.js";
import { CATEGORY_LABELS, t } from "../i18n/de.js";
import { buildScale, place, stackLanes } from "../scale.js";
import { REVEAL_STEPS, type EsPlayerInfo, type EsTvState } from "../shared.js";
import { avatarEmoji, easeOut, ensureStyles, playerColor, progress, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends EsTvState["phase"]> = Extract<EsTvState, { phase: P }>;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (live: readonly Player[], id: string): boolean => live.find((p) => p.id === id)?.connected === false;

/** Höchstens so viele Pin-Ebenen übereinander; Pins näher als PIN_GAP (Anteil der Breite) weichen aus. */
const MAX_LANES = 3;
const PIN_GAP = 0.085;

function SchaetzenTv({ state, api, players }: TvComponentProps<EsTvState>) {
  ensureStyles("es-tv-css", TV_CSS);
  const ticking = state !== null && state.phase !== "reveal" && state.phase !== "standings";
  const now = useServerNow(api.serverNow, ticking);
  if (!state) return <div class="es-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "question":
      body = <Question s={state} now={now} live={players} />;
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
    <div class={`es-tv es-tv--${state.phase}`} data-testid="es-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Avatar({ p, cls = "", badge }: { p: Pick<EsPlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string }) {
  return (
    <span class={`es-av ${cls}`} style={{ "--c": playerColor(p.color) }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="es-av__badge">{badge}</span>}
    </span>
  );
}

function Head({ s, children }: { s: S<"question"> | S<"reveal">; children?: ComponentChildren }) {
  return (
    <header class="es-head">
      <span class="es-cat">{CATEGORY_LABELS[s.category]}</span>
      <span class="es-round">{t.round(s.round, s.total)}</span>
      {children}
    </header>
  );
}

/** Hinweis zur erwarteten Antwort: Einheit, Jahreszahl oder Anzahl. */
const unitHint = (unit: string): string => (isYearUnit(unit) ? t.yearHint : unit ? t.tv.unitLabel(unit) : t.countHint);

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  const rules = s.solo ? t.tv.introRulesSolo : t.tv.introRules;
  return (
    <div class="es-intro">
      <h1 class="es-title">
        <span aria-hidden="true">🎯</span> {t.title}
      </h1>
      <p class="es-lead">{t.tv.introLead(s.total)}</p>
      <div class="es-cats">
        {s.categories.map((c) => (
          <span key={c}>{CATEGORY_LABELS[c]}</span>
        ))}
      </div>
      <ol class="es-rules">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p class="es-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <div class="es-avatars">
        {s.players.map((p) => (
          <span key={p.id} class="es-avatars__item">
            <Avatar p={p} />
            <small>{p.name}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function Question({ s, now, live }: { s: S<"question">; now: number; live: readonly Player[] }) {
  const answered = new Set(s.answered);
  const active = s.players.filter((p) => !p.left);
  const secs = secondsLeft(s.endsAt, now);
  const share = s.durationMs > 0 ? Math.min(1, Math.max(0, (s.endsAt - now) / s.durationMs)) : 0;
  return (
    <>
      <Head s={s}>
        <span class={`es-clock ${secs <= 5 ? "is-hurry" : ""}`} role="timer" aria-label={t.tv.secondsLeft(secs)} data-testid="es-clock">
          {secs}
        </span>
      </Head>
      <h2 class="es-question" data-testid="es-question">
        {s.text}
      </h2>
      <p class="es-unit" data-testid="es-unit">
        {unitHint(s.unit)}
      </p>
      <div class="es-timebar" aria-hidden="true">
        <span class={secs <= 5 ? "is-hurry" : ""} style={{ transform: `scaleX(${share})` }} />
      </div>
      <footer class="es-strip" role="status">
        {active.map((p) => {
          const done = answered.has(p.id);
          const off = isOffline(live, p.id);
          return (
            <span key={p.id} class="es-strip__item">
              <Avatar p={p} cls={done ? "is-done" : off ? "is-off" : "is-waiting"} badge={done ? "✅" : undefined} />
              <small>{p.name}</small>
            </span>
          );
        })}
        <span class="es-strip__label">{t.tv.answered(s.answered.length, active.length)}</span>
      </footer>
    </>
  );
}

function Reveal({ s, serverNow }: { s: S<"reveal">; serverNow: () => number }) {
  // Eigene, feinere Uhr nur während der Animation.
  const first = serverNow();
  const now = useServerNow(serverNow, first - s.revealAt < REVEAL_STEPS.resultMs + 300, 50);
  const elapsed = Math.max(now, first) - s.revealAt;
  const year = isYearUnit(s.unit);
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const tips = s.guesses.filter((g) => g.value !== null && byId.has(g.playerId));
  const scale = buildScale(
    s.answer,
    tips.map((g) => g.value!),
    year,
  );
  const placements = tips.map((g) => place(scale, g.value!));
  const lanes = stackLanes(
    placements.map((p) => p.x),
    PIN_GAP,
  );
  const answerX = place(scale, s.answer).x;

  const count = easeOut(progress(elapsed, REVEAL_STEPS.countFromMs, REVEAL_STEPS.countToMs));
  const showAnswer = elapsed >= REVEAL_STEPS.countFromMs;
  const showResult = elapsed >= REVEAL_STEPS.resultMs;
  const drum = elapsed >= REVEAL_STEPS.drumMs && !showAnswer;
  const from = scale.kind === "lin" ? Math.max(0, scale.lo) : 0;
  const shown = count >= 1 ? s.answer : from + (s.answer - from) * count;
  const shownText = formatValue(Number.isInteger(s.answer) ? Math.round(shown) : Math.round(shown * 100) / 100, s.unit);
  const nearestNames = s.nearest.map((id) => byId.get(id)?.name).filter((n): n is string => n !== undefined);
  const ordered = [...s.guesses].filter((g) => byId.has(g.playerId)).sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
  const soloGuess = s.solo ? s.guesses[0] : undefined;

  return (
    <>
      <Head s={s} />
      <h2 class="es-question es-question--small" data-testid="es-question">
        {s.text}
      </h2>
      <div class={`es-line ${showResult ? "is-result" : ""}`} data-testid="es-line" data-scale={scale.kind}>
        <div class="es-axis" />
        {scale.ticks.map((v) => (
          <span key={v} class="es-tick" style={{ left: `${place(scale, v).x * 100}%` }}>
            {formatCompact(v, year)}
          </span>
        ))}
        {scale.kind === "log" && <span class="es-scale-note">{t.tv.logScale}</span>}
        {tips.map((g, i) => {
          const p = byId.get(g.playerId)!;
          const pl = placements[i]!;
          const visible = elapsed >= REVEAL_STEPS.pinsMs + i * 150;
          if (!visible) return null;
          const best = showResult && g.place === 1;
          const lane = Math.min(lanes[i]!, MAX_LANES - 1);
          return (
            <div
              key={g.playerId}
              class={`es-pin ${best ? "is-best" : ""} ${showResult && !best ? "is-dim" : ""} ${pl.clamped ? "is-clamped" : ""}`}
              style={{ left: `${pl.x * 100}%`, "--c": playerColor(p.color), "--lane": lane, zIndex: best ? 6 : MAX_LANES - lane }}
              data-testid={`es-pin-${g.playerId}`}
            >
              <span class="es-pin__tag">
                {pl.clamped === -1 && <b class="es-pin__arrow">◀ </b>}
                {formatCompact(g.value!, year)}
                {pl.clamped === 1 && <b class="es-pin__arrow"> ▶</b>}
              </span>
              <Avatar p={p} />
              <span class="es-pin__stem" />
            </div>
          );
        })}
        {showAnswer && (
          <div class="es-answer" style={{ left: `${answerX * count * 100}%` }} data-testid="es-answer">
            <span class="es-answer__line" />
            <span class="es-answer__value">{shownText}</span>
          </div>
        )}
        {drum && (
          <p class="es-drum" role="status">
            {t.tv.drumroll}
          </p>
        )}
      </div>
      <div class={`es-outcome ${showResult ? "is-shown" : ""}`} role="status" data-testid="es-outcome">
        {showResult && (
          <>
            <p class="es-nearest">
              {tips.length === 0
                ? t.tv.nobodyGuessed
                : s.solo
                  ? t.tv.soloResult(soloGuess?.points ?? 0)
                  : t.tv.nearest(nearestNames)}
            </p>
            <div class="es-chips" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, ordered.length))}, 23.5rem)` }}>
              {ordered.map((g) => {
                const p = byId.get(g.playerId)!;
                return (
                  <span key={g.playerId} class={`es-chip ${g.place === 1 && !s.solo ? "is-best" : ""}`} style={{ "--c": playerColor(p.color) }}>
                    <Avatar p={p} cls="es-av--mini" />
                    <span class="es-chip__text">
                      <span class="es-chip__name">{p.name}</span>
                      <span class="es-chip__detail">
                        <span class="es-chip__off">{g.value === null ? t.tv.noGuess : t.tv.off(distanceText(g.distance!, s.unit))}</span>
                        {g.bullseye && <span class="es-chip__bull">🎯</span>}
                        <span class="es-chip__pts">{t.plus(g.points)}</span>
                      </span>
                    </span>
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
      {s.fact && showResult && (
        <p class="es-fact">
          <b>{t.tv.factLabel}</b> {s.fact}
        </p>
      )}
    </>
  );
}

function Standings({ s, live }: { s: S<"standings">; live: readonly Player[] }) {
  return (
    <div class="es-ranking">
      <h1 class="es-title">{t.tv.standings}</h1>
      <p class="es-sub">{t.tv.standingsAfter(s.round, s.total)}</p>
      <ol class="es-list">
        {s.players.map((p) => (
          <li key={p.id} class={`es-row ${p.left ? "is-left" : ""} ${p.rank === 1 ? "is-first" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <span class="es-row__rank">{t.rank(p.rank)}</span>
            <Avatar p={p} cls={isOffline(live, p.id) || p.left ? "is-off" : ""} />
            <span class="es-row__name">
              {p.name}
              {p.left && <small> ({t.left})</small>}
            </span>
            {p.roundPoints > 0 && <span class="es-row__gain">{t.plus(p.roundPoints)}</span>}
            <span class="es-row__score">{formatNumber(p.score)}</span>
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
  const order = [top[1], top[0], top[2]].filter((p): p is EsPlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  return (
    <div class="es-final">
      <h1 class="es-title">{s.solo ? t.tv.finalSolo : t.tv.final}</h1>
      <div class="es-podium">
        {order.map((p) => (
          <div key={p.id} class={`es-step r${Math.min(p.rank, 3)} ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <Avatar p={p} />
            <span class="es-step__name">{p.name}</span>
            <span class="es-step__score">{t.points(p.score)}</span>
            {p.bullseyes > 0 && <span class="es-step__bull">🎯 {t.tv.bullseyes(p.bullseyes)}</span>}
            <span class="es-step__block">{p.rank}</span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div class="es-rest">
          {rest.map((p) => (
            <span key={p.id} class="es-chip" style={{ "--c": playerColor(p.color) }}>
              <span class="es-chip__name">{t.rank(p.rank)}</span>
              <Avatar p={p} cls="es-av--mini" />
              <span class="es-chip__name">{p.name}</span>
              <span class="es-chip__pts">{t.points(p.score)}</span>
            </span>
          ))}
        </div>
      )}
      <div class="es-finalbar" role="progressbar" aria-label={t.tv.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
    </div>
  );
}

export default preactTvView<EsTvState>(SchaetzenTv);
