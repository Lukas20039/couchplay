// TV-View „Sortiert!“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Sortierphase: Kriterium groß, gemischte Karten ohne Werte, Richtungshinweis, Timer-Balken, wer fertig ist.
// Auflösung: Die richtige Reihenfolge baut sich Platz für Platz von oben auf (je TIMING.revealStepMs), mit Wert,
// Anmerkung und den Avataren derer, die die Karte genau richtig hatten; rechts je Spieler ✅/≈/❌ je Platz,
// am Ende Punkte und „Perfekt!“. Nur Darstellung des empfangenen Zustands – keine Spielregeln.
// Die Animation läuft relativ zu revealAt (Serverzeit), ein TV-Reconnect setzt also an der richtigen Stelle ein.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import type { ComponentChildren } from "preact";
import { formatNumber, formatValue } from "../format.js";
import { CATEGORY_LABELS, t } from "../i18n/de.js";
import { cardRevealOffset, type SoPlayerInfo, type SoTvState } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, progress, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends SoTvState["phase"]> = Extract<SoTvState, { phase: P }>;

/** Live-Verbindungsstatus aus der Spielerliste des Raums. */
const isOffline = (live: readonly Player[], id: string): boolean => live.find((p) => p.id === id)?.connected === false;

function SortiertTv({ state, api, players }: TvComponentProps<SoTvState>) {
  ensureStyles("so-tv-css", TV_CSS);
  const ticking = state !== null && state.phase !== "reveal" && state.phase !== "standings";
  const now = useServerNow(api.serverNow, ticking);
  if (!state) return <div class="so-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "sort":
      body = <Sort s={state} now={now} live={players} />;
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
    <div class={`so-tv so-tv--${state.phase}`} data-testid="so-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Avatar({ p, cls = "", badge }: { p: Pick<SoPlayerInfo, "avatar" | "color" | "name">; cls?: string; badge?: string }) {
  return (
    <span class={`so-av ${cls}`} style={{ "--c": playerColor(p.color) }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
      {badge && <span class="so-av__badge">{badge}</span>}
    </span>
  );
}

function Head({ s, children }: { s: S<"sort"> | S<"reveal">; children?: ComponentChildren }) {
  return (
    <header class="so-head">
      <span class="so-cat">{CATEGORY_LABELS[s.category]}</span>
      <span class="so-round">{t.round(s.round, s.total)}</span>
      {children}
    </header>
  );
}

/** Richtungshinweis: ▲ oben = … ↕ ▼ unten = … */
function Direction({ top, bottom, small = false }: { top: string; bottom: string; small?: boolean }) {
  return (
    <div class={`so-dir ${small ? "so-dir--small" : ""}`} data-testid="so-dir">
      <span class="so-dir__end">▲ {t.topIs(top)}</span>
      <span class="so-dir__arrow" aria-hidden="true">
        ⇅
      </span>
      <span class="so-dir__end">▼ {t.bottomIs(bottom)}</span>
    </div>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <div class="so-intro">
      <h1 class="so-title">
        <span aria-hidden="true">📊</span> {t.title}
      </h1>
      <p class="so-lead">{t.tv.introLead(s.total, s.itemsPerRound)}</p>
      <div class="so-cats">
        {s.categories.map((c) => (
          <span key={c}>{CATEGORY_LABELS[c]}</span>
        ))}
      </div>
      <ol class="so-rules">
        {t.tv.introRules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p class="so-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <div class="so-avatars">
        {s.players.map((p) => (
          <span key={p.id} class="so-avatars__item">
            <Avatar p={p} />
            <small>{p.name}</small>
          </span>
        ))}
      </div>
    </div>
  );
}

function Sort({ s, now, live }: { s: S<"sort">; now: number; live: readonly Player[] }) {
  const done = new Set(s.done);
  const active = s.players.filter((p) => !p.left);
  const secs = secondsLeft(s.endsAt, now);
  const share = s.durationMs > 0 ? Math.min(1, Math.max(0, (s.endsAt - now) / s.durationMs)) : 0;
  const cols = s.cards.length <= 4 ? 2 : 3;
  return (
    <>
      <Head s={s}>
        <span class={`so-clock ${secs <= 5 ? "is-hurry" : ""}`} role="timer" aria-label={t.tv.secondsLeft(secs)} data-testid="so-clock">
          {secs}
        </span>
      </Head>
      <h2 class="so-prompt" data-testid="so-prompt">
        {s.prompt}
      </h2>
      <Direction top={s.top} bottom={s.bottom} />
      <div class="so-cards" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} data-testid="so-cards">
        {s.cards.map((c, i) => (
          <div key={i} class="so-card" style={{ animationDelay: `${i * 0.08}s` }}>
            {c.label}
          </div>
        ))}
      </div>
      <div class="so-timebar" aria-hidden="true">
        <span class={secs <= 5 ? "is-hurry" : ""} style={{ transform: `scaleX(${share})` }} />
      </div>
      <footer class="so-strip" role="status">
        {active.map((p) => {
          const ok = done.has(p.id);
          const off = isOffline(live, p.id);
          return (
            <span key={p.id} class="so-strip__item">
              <Avatar p={p} cls={ok ? "is-done" : off ? "is-off" : "is-waiting"} badge={ok ? "✅" : undefined} />
              <small>{p.name}</small>
            </span>
          );
        })}
        <span class="so-strip__label">{t.tv.done(s.done.length, active.length)}</span>
      </footer>
    </>
  );
}

function Reveal({ s, serverNow }: { s: S<"reveal">; serverNow: () => number }) {
  // Feinere Uhr nur während des Aufbaus.
  const first = serverNow();
  const now = Math.max(useServerNow(serverNow, first < s.resultAt + 500, 100), first);
  const elapsed = now - s.revealAt;
  const n = s.items.length;
  const shown = (pos: number): boolean => elapsed >= cardRevealOffset(pos);
  const done = now >= s.resultAt;
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const results = s.results.filter((r) => byId.has(r.playerId));
  const perfectNames = results.filter((r) => r.perfect).map((r) => byId.get(r.playerId)!.name);
  const best = Math.max(0, ...results.map((r) => r.points));
  const bestNames = results.filter((r) => r.points === best && best > 0).map((r) => byId.get(r.playerId)!.name);

  return (
    <>
      <Head s={s}>
        <Direction top={s.top} bottom={s.bottom} small />
      </Head>
      <h2 class="so-prompt so-prompt--small" data-testid="so-prompt">
        {s.prompt}
      </h2>
      <div class="so-reveal">
        <ol class="so-ladder" style={{ "--n": n }} data-testid="so-ladder">
          {s.items.map((item, pos) => {
            const open = shown(pos);
            const who = (s.correctBy[pos] ?? []).map((id) => byId.get(id)).filter((p): p is SoPlayerInfo => p !== undefined);
            return (
              <li key={pos} class={`so-slot ${open ? "is-open" : ""}`} data-testid={`so-slot-${pos}`}>
                <span class="so-slot__rank">{pos + 1}</span>
                {open ? (
                  <>
                    <span class="so-slot__text">
                      <span class={`so-slot__label ${item.label.length > 22 ? "is-long" : ""}`}>{item.label}</span>
                      <span class="so-slot__line">
                        <span class="so-slot__value" data-testid={`so-value-${pos}`}>
                          {formatValue(item.value, s.unit)}
                        </span>
                        {item.note && <span class="so-slot__note">{item.note}</span>}
                      </span>
                    </span>
                    <span class="so-slot__who">
                      {who.map((p) => (
                        <Avatar key={p.id} p={p} cls="so-av--mini" />
                      ))}
                    </span>
                  </>
                ) : (
                  <span class="so-slot__pending">{t.tv.pending}</span>
                )}
              </li>
            );
          })}
        </ol>
        <section class="so-panel" aria-label={t.tv.yourOrders}>
          <h3 class="so-panel__title">{results.length === 0 ? t.tv.nobody : t.tv.yourOrders}</h3>
          {results.map((r) => {
            const p = byId.get(r.playerId)!;
            return (
              <div
                key={r.playerId}
                class={`so-res ${done && r.perfect ? "is-perfect" : ""}`}
                style={{ "--c": playerColor(p.color) }}
                data-testid={`so-res-${r.playerId}`}
              >
                <Avatar p={p} cls="so-av--mini" />
                <span class="so-res__name">{p.name}</span>
                <span class="so-res__marks">
                  {r.marks.map((m, pos) => (
                    <span key={pos} class={`so-mark so-mark--${shown(pos) ? m : "hidden"}`} title={shown(pos) ? t.markLabels[m] : undefined}>
                      {shown(pos) ? t.marks[m] : ""}
                    </span>
                  ))}
                </span>
                <span class="so-res__pts">{done ? t.plus(r.points) : ""}</span>
              </div>
            );
          })}
          {done && perfectNames.length === 0 && bestNames.length > 0 && (
            <p class="so-best" role="status">
              {t.tv.bestRound(bestNames, best)}
            </p>
          )}
        </section>
      </div>
      {done && perfectNames.length > 0 && (
        <div class="so-perfect" role="status" data-testid="so-perfect">
          <span class="so-perfect__burst" aria-hidden="true">
            🎉
          </span>
          <strong>{t.perfect}</strong>
          <span class="so-perfect__names">{t.tv.perfectBy(perfectNames)}</span>
        </div>
      )}
    </>
  );
}

function Standings({ s, live }: { s: S<"standings">; live: readonly Player[] }) {
  return (
    <div class="so-ranking">
      <h1 class="so-title">{t.tv.standings}</h1>
      <p class="so-sub">{t.tv.standingsAfter(s.round, s.total)}</p>
      <ol class="so-list">
        {s.players.map((p) => (
          <li key={p.id} class={`so-row ${p.left ? "is-left" : ""} ${p.rank === 1 ? "is-first" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <span class="so-row__rank">{t.rank(p.rank)}</span>
            <Avatar p={p} cls={isOffline(live, p.id) || p.left ? "is-off" : ""} />
            <span class="so-row__name">
              {p.name}
              {p.left && <small> ({t.left})</small>}
            </span>
            {p.roundPoints > 0 && <span class="so-row__gain">{t.plus(p.roundPoints)}</span>}
            <span class="so-row__score">{formatNumber(p.score)}</span>
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
  const order = [top[1], top[0], top[2]].filter((p): p is SoPlayerInfo => p !== undefined);
  const rest = s.players.slice(3);
  return (
    <div class="so-final">
      <h1 class="so-title">{s.solo ? t.tv.finalSolo : t.tv.final}</h1>
      <div class="so-podium">
        {order.map((p) => (
          <div key={p.id} class={`so-step r${Math.min(p.rank, 3)} ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
            <Avatar p={p} />
            <span class="so-step__name">{p.name}</span>
            <span class="so-step__score">{t.points(p.score)}</span>
            {p.perfects > 0 && <span class="so-step__perfect">✨ {t.tv.perfects(p.perfects)}</span>}
            <span class="so-step__block">{p.rank}</span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div class="so-rest">
          {rest.map((p) => (
            <span key={p.id} class="so-chip" style={{ "--c": playerColor(p.color) }}>
              <span class="so-chip__name">{t.rank(p.rank)}</span>
              <Avatar p={p} cls="so-av--mini" />
              <span class="so-chip__name">{p.name}</span>
              <span class="so-chip__pts">{t.points(p.score)}</span>
            </span>
          ))}
        </div>
      )}
      <div class="so-finalbar" role="progressbar" aria-label={t.tv.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
        <span style={{ transform: `scaleX(${share})` }} />
      </div>
    </div>
  );
}

export default preactTvView<SoTvState>(SortiertTv);
