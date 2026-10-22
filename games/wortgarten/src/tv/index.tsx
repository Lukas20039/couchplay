// TV-View Wortgarten (10-Fuß-UI, 1920×1080). Rendert ausschließlich den empfangenen
// TV-Zustand; läuft ohne Interaktion (Countdowns über endsAt + serverNow()).
// Während der Runde zeigt der TV nur Blumen je gefundenem Wort – nie die Wörter selbst.
import type { TvComponentProps } from "@couchplay/game-sdk/preact";
import { preactTvView } from "@couchplay/game-sdk/preact";
import type { Player } from "@couchplay/protocol";
import { MODE_HINTS, MODE_LABELS, UNLOCK_LABELS, t } from "../i18n/de.js";
import { unlocksUpTo, type Board, type LevelInfo, type WgPlayerInfo, type WgTvState } from "../shared.js";
import { avatarEmoji, bloom, ensureStyles, levelShare, playerColor, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends WgTvState["phase"]> = Extract<WgTvState, { phase: P }>;

const isOffline = (players: readonly Player[], id: string): boolean => players.find((p) => p.id === id)?.connected === false;

function Avatar({ p, cls = "" }: { p: Pick<WgPlayerInfo, "avatar" | "color" | "name">; cls?: string }) {
  return (
    <div class={`wg-avatar ${cls}`} style={{ "--pc": playerColor(p.color) }} title={p.name}>
      <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
    </div>
  );
}

function Ring({ endsAt, durationMs, now, warn = true }: { endsAt: number; durationMs: number; now: number; warn?: boolean }) {
  const len = 2 * Math.PI * 44;
  const remaining = Math.max(0, endsAt - now);
  const share = durationMs > 0 ? Math.min(1, remaining / durationMs) : 0;
  const secs = secondsLeft(endsAt, now);
  return (
    <div class={`wg-ring ${warn && secs <= 10 ? "is-low" : ""}`} role="timer" aria-label={t.secondsLeft(secs)}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="wg-ring-track" cx="50" cy="50" r="44" />
        <circle class="wg-ring-bar" cx="50" cy="50" r="44" stroke-dasharray={len} stroke-dashoffset={len * (1 - share)} />
      </svg>
      <div class="wg-ring-num">{secs}</div>
    </div>
  );
}

function Grid({ board, cls = "" }: { board: Board; cls?: string }) {
  const gold = new Set(board.gold);
  return (
    <div class={`wg-grid s${board.size} ${cls}`} role="img" aria-label={board.letters.join(" ")}>
      {board.letters.map((l, i) => (
        <div class={`wg-tile ${gold.has(i) ? "is-gold" : ""}`} key={i} data-testid="wg-tile">
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

function LevelCard({ level, title }: { level: LevelInfo; title?: string }) {
  return (
    <div class="wg-level">
      {title && <p class="wg-level-title">{title}</p>}
      <div class="wg-level-head">
        <span class="wg-level-badge">🌻 {t.level(level.level)}</span>
        <span class="wg-dim">{level.nextXp === null ? t.xpMax(level.xp) : t.xpProgress(level.xp, level.nextXp)}</span>
      </div>
      <div class="wg-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${levelShare(level)})` }} />
      </div>
      {level.nextUnlock && level.nextXp !== null && <p class="wg-dim">{t.nextUnlock(level.nextXp - level.xp)}</p>}
    </div>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  const unlocked = [...unlocksUpTo(s.level.level)];
  return (
    <section class="wg-intro">
      <div class="wg-intro-main">
        <h1>
          <span aria-hidden="true">🌻</span> {t.title}
        </h1>
        <p class="wg-sub">{t.introSub}</p>
        <ul class="wg-rules">
          {t.introRules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p class="wg-setup">
          {t.introSetup(s.rounds, s.config.size, MODE_LABELS[s.config.mode])} – {MODE_HINTS[s.config.mode]}
        </p>
        {s.locked.mode && <p class="wg-locked">🔒 {t.introLockedMode(MODE_LABELS[s.locked.mode])}</p>}
        {s.locked.size && <p class="wg-locked">🔒 {t.introLockedSize(s.locked.size)}</p>}
      </div>
      <aside class="wg-intro-side">
        <LevelCard level={s.level} />
        {unlocked.length > 0 && (
          <div class="wg-unlocked">
            <p class="wg-dim">{t.unlocked}</p>
            <div class="wg-chips">
              {unlocked.map((u) => (
                <span class="wg-chip" key={u}>
                  {UNLOCK_LABELS[u].icon} {UNLOCK_LABELS[u].title}
                </span>
              ))}
            </div>
          </div>
        )}
        <div class="wg-intro-count">
          <span>{t.introStartsIn}</span>
          <Ring endsAt={s.endsAt} durationMs={s.durationMs} now={now} warn={false} />
        </div>
      </aside>
    </section>
  );
}

function Beds({ players, live }: { players: WgPlayerInfo[]; live: readonly Player[] }) {
  return (
    <div class={`wg-beds n${Math.min(players.length, 8)}`}>
      {players.map((p) => {
        const shown = p.blooms.slice(-14);
        return (
          <div class={`wg-bed ${p.left ? "is-left" : ""}`} key={p.id} style={{ "--pc": playerColor(p.color) }}>
            <Avatar p={p} cls={isOffline(live, p.id) || p.left ? "is-off" : ""} />
            <div class="wg-bed-main">
              <div class="wg-bed-top">
                <span class="wg-bed-name">{p.name}</span>
                <span class="wg-bed-score">{t.number(p.score)}</span>
              </div>
              <div class="wg-flowers" aria-label={t.foundCount(p.blooms.length)}>
                {shown.map((len, i) => (
                  <span class="wg-flower" key={p.blooms.length - shown.length + i}>
                    {bloom(len)}
                  </span>
                ))}
                <span class="wg-bed-count">{t.foundCount(p.blooms.length)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Round({ s, now, live }: { s: S<"round">; now: number; live: readonly Player[] }) {
  return (
    <section class="wg-round">
      <div class="wg-board-wrap">
        <Grid board={s.board} />
        {s.board.gold.length > 0 && <p class="wg-gold-hint">✨ {t.goldHint}</p>}
      </div>
      <aside class="wg-side">
        <header class="wg-side-head">
          <div>
            <p class="wg-kicker">{t.roundOf(s.round, s.rounds)}</p>
            <p class="wg-mode">
              {MODE_LABELS[s.config.mode]} · {t.gridSize(s.board.size)}
            </p>
          </div>
          <Ring endsAt={s.endsAt} durationMs={s.durationMs} now={now} />
        </header>
        <Beds players={s.players} live={live} />
      </aside>
    </section>
  );
}

function RoundEnd({ s }: { s: S<"roundEnd"> }) {
  const byId = new Map(s.players.map((p) => [p.id, p]));
  const many = s.results.length > 4;
  const limit = many ? 8 : 14;
  return (
    <section class="wg-end">
      <aside class="wg-end-side">
        <h2>{t.roundEndTitle(s.round)}</h2>
        <Grid board={s.board} cls="is-small" />
        <p class="wg-dim">{t.possible(s.possible)}</p>
        {s.longest && (
          <div class="wg-longest">
            <p class="wg-kicker">{t.longest}</p>
            <p class="wg-longest-word">{s.longest.word}</p>
            <div class="wg-longest-who">
              {s.longest.playerIds.map((id) => {
                const p = byId.get(id);
                return p ? <Avatar key={id} p={p} cls="is-mini" /> : null;
              })}
            </div>
          </div>
        )}
        {s.missed.length > 0 && (
          <div class="wg-missed">
            <p class="wg-kicker">{t.missed}</p>
            <p>{s.missed.join(" · ")}</p>
          </div>
        )}
      </aside>
      <div class={`wg-results ${many ? "is-many" : ""}`}>
        {s.uniqueBonus && (
          <p class="wg-legend">
            <span class="wg-word is-unique">{t.uniqueLegend}</span>
            <span class="wg-word is-shared">{t.sharedLegend}</span>
          </p>
        )}
        <div class="wg-cards">
          {s.results.map((r) => {
            const p = byId.get(r.playerId);
            if (!p) return null;
            return (
              <div class="wg-card" key={r.playerId} style={{ "--pc": playerColor(p.color) }}>
                <div class="wg-card-head">
                  <Avatar p={p} cls="is-mini" />
                  <span class="wg-card-name">{p.name}</span>
                  <span class="wg-card-pts">{t.plusPoints(r.points)}</span>
                </div>
                <div class="wg-words">
                  {r.words.length === 0 && <span class="wg-dim">{t.noWords}</span>}
                  {r.words.slice(0, limit).map((w) => (
                    <span class={`wg-word ${w.unique ? "is-unique" : s.uniqueBonus ? "is-shared" : ""}`} key={w.word}>
                      {w.unique ? "★ " : ""}
                      {w.word} <small>{w.points}</small>
                    </span>
                  ))}
                  {r.words.length > limit && <span class="wg-dim">{t.moreWords(r.words.length - limit)}</span>}
                </div>
                <div class="wg-card-total">{t.points(p.score)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Final({ s, now, live }: { s: S<"final">; now: number; live: readonly Player[] }) {
  const progress = s.durationMs > 0 ? Math.min(1, Math.max(0, 1 - (s.endsAt - now) / s.durationMs)) : 1;
  const grew = s.level.level > s.levelBefore;
  return (
    <section class="wg-final">
      <h2>{t.finalTitle}</h2>
      <div class="wg-final-body">
        <ol class="wg-ranking">
          {s.players.map((p) => (
            <li class={`wg-rank-row ${p.rank === 1 ? "is-first" : ""} ${p.left ? "is-left" : ""}`} key={p.id}>
              <span class="wg-rank-num">{t.rank(p.rank)}</span>
              <Avatar p={p} cls={isOffline(live, p.id) || p.left ? "is-off" : ""} />
              <span class="wg-rank-name">
                {p.name}
                {p.left && <small> ({t.left})</small>}
              </span>
              <span class="wg-rank-score">{t.pointsLong(p.score)}</span>
            </li>
          ))}
        </ol>
        <div class="wg-final-garden">
          <LevelCard level={s.level} title={grew ? t.gardenGrew : undefined} />
          {s.newUnlocks.length > 0 && (
            <div class="wg-news">
              <p class="wg-kicker">{t.newUnlocks}</p>
              {s.newUnlocks.map((u) => (
                <div class="wg-news-item" key={u}>
                  <span class="wg-news-icon" aria-hidden="true">
                    {UNLOCK_LABELS[u].icon}
                  </span>
                  <div>
                    <strong>{UNLOCK_LABELS[u].title}</strong>
                    <p class="wg-dim">{UNLOCK_LABELS[u].text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div class="wg-final-bar" role="progressbar" aria-label={t.finalProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </section>
  );
}

export function WortgartenTv({ state, api, players }: TvComponentProps<WgTvState>) {
  ensureStyles("wg-tv-css", TV_CSS);
  const ticking = state?.phase === "round" || state?.phase === "intro" || state?.phase === "final";
  const now = useServerNow(api.serverNow, ticking);
  let body;
  switch (state?.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "round":
      body = <Round s={state} now={now} live={players} />;
      break;
    case "roundEnd":
      body = <RoundEnd key={`e${state.round}`} s={state} />;
      break;
    case "final":
      body = <Final s={state} now={now} live={players} />;
      break;
    default:
      body = <div class="wg-wait">{t.waiting}</div>;
  }
  return (
    <div class={`wg-tv is-${state?.phase ?? "wait"}`} data-testid="wg-tv" data-phase={state?.phase ?? "wait"}>
      {body}
    </div>
  );
}

export default preactTvView<WgTvState>(WortgartenTv);
