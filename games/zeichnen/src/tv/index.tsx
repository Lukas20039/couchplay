// TV-View „Zeichnen & Raten“ (1920×1080, 1rem = 1/60 der Höhe laut tv-web).
// Links das Zeichenblatt (live), rechts Wortlücken, Zeit, Spielerliste und Sprechblasen der Fehltipps.
// Nur Darstellung des empfangenen Zustands – keine Spielregeln.
import { preactTvView, type TvComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef } from "preact/hooks";
import { t } from "../i18n/de.js";
import type { Bubble, Drawer, Hint, Stroke, ZgPlayerInfo, ZgTvState } from "../shared.js";
import { fitCanvas, SheetRenderer } from "../ui/canvas.js";
import { avatarEmoji, ensureStyles, playerColor, secondsLeft, useServerNow } from "../ui/common.js";
import { TV_CSS } from "./styles.js";

type S<P extends ZgTvState["phase"]> = Extract<ZgTvState, { phase: P }>;

function ZeichnenTv({ state, api }: TvComponentProps<ZgTvState>) {
  ensureStyles("zg-tv-css", TV_CSS);
  const now = useServerNow(api.serverNow, state !== null && state.phase !== "final");
  if (!state) return <div class="zg-tv" />;
  let body;
  switch (state.phase) {
    case "intro":
      body = <Intro s={state} now={now} />;
      break;
    case "choose":
      body = <Choose s={state} now={now} />;
      break;
    case "draw":
    case "reveal":
      body = <Play s={state} now={now} />;
      break;
    case "standings":
      body = <Ranking s={state} title={t.tv.standings} />;
      break;
    case "final":
      body = <Final s={state} />;
      break;
  }
  return (
    <div class={`zg-tv zg-tv--${state.phase}`} data-testid="zg-tv" data-phase={state.phase}>
      {body}
    </div>
  );
}

function Intro({ s, now }: { s: S<"intro">; now: number }) {
  return (
    <div class="zg-center">
      <h1 class="zg-title">🎨 {t.title}</h1>
      <p class="zg-lead">{t.tv.introLead}</p>
      <ol class="zg-rules">
        {t.tv.introRules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
      <p class="zg-starts">
        {t.tv.startsIn} <b>{secondsLeft(s.endsAt, now)}</b>
      </p>
      <Avatars players={s.players} />
    </div>
  );
}

function Choose({ s, now }: { s: S<"choose">; now: number }) {
  return (
    <div class="zg-center">
      <p class="zg-round">{t.round(s.round, s.total)}</p>
      <span class="zg-big-avatar" style={{ "--c": playerColor(s.drawer.color) }} aria-hidden="true">
        {avatarEmoji(s.drawer.avatar)}
      </span>
      <h1 class="zg-choosing" data-testid="zg-choosing">
        {t.tv.choosing(s.drawer.name)}
      </h1>
      <span class="zg-clock">{secondsLeft(s.endsAt, now)}</span>
    </div>
  );
}

function Play({ s, now }: { s: S<"draw"> | S<"reveal">; now: number }) {
  return (
    <div class="zg-play">
      <Sheet strokes={s.strokes} rev={s.rev} />
      <aside class="zg-side">
        <DrawerHead drawer={s.drawer} round={s.round} total={s.total} />
        {s.phase === "draw" ? <DrawSide s={s} now={now} /> : <RevealSide s={s} />}
      </aside>
    </div>
  );
}

/** Weißes Zeichenblatt; zeichnet bei jedem Update nur die neuen Punkte nach. */
function Sheet({ strokes, rev }: { strokes: Stroke[]; rev: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef(new SheetRenderer());
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = (): void => {
      if (fitCanvas(c, c.clientWidth || 1)) renderer.current.invalidate();
    };
    fit();
    const onResize = (): void => {
      fit();
      renderer.current.render(c, latest.current.strokes, latest.current.rev);
    };
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);
  const latest = useRef({ strokes, rev });
  latest.current = { strokes, rev };
  useEffect(() => {
    renderer.current.render(canvas.current, strokes, rev);
  }, [strokes, rev]);
  return (
    <div class="zg-sheet">
      <canvas ref={canvas} class="zg-canvas" aria-label={t.tv.drawingLabel} data-testid="zg-canvas" />
    </div>
  );
}

function DrawerHead({ drawer, round, total }: { drawer: Drawer; round: number; total: number }) {
  return (
    <header class="zg-head" style={{ "--c": playerColor(drawer.color) }}>
      <span class="zg-head__avatar" aria-hidden="true">
        {avatarEmoji(drawer.avatar)}
      </span>
      <span class="zg-head__name">{t.tv.drawing(drawer.name)}</span>
      <span class="zg-head__round">{t.round(round, total)}</span>
    </header>
  );
}

function DrawSide({ s, now }: { s: S<"draw">; now: number }) {
  const remaining = Math.max(0, s.endsAt - now);
  const secs = secondsLeft(s.endsAt, now);
  return (
    <>
      <HintLine hint={s.hint} />
      <div class="zg-timer">
        <div class="zg-timer__bar">
          <span style={{ transform: `scaleX(${Math.min(1, remaining / s.durationMs)})` }} class={secs <= 10 ? "is-hurry" : ""} />
        </div>
        <span class={`zg-timer__secs ${secs <= 10 ? "is-hurry" : ""}`} data-testid="zg-clock">
          {secs}
        </span>
      </div>
      <PlayerList players={s.players} drawerId={s.drawer.id} />
      <Bubbles bubbles={s.bubbles} players={s.players} max={bubbleSlots(s.players.length)} />
    </>
  );
}

function HintLine({ hint }: { hint: Hint }) {
  const letters = hint.filter((c) => c === null || /[\p{L}\p{N}]/u.test(c)).length;
  // Schriftgröße nach Länge, damit auch 24 Zeichen in die Spalte passen.
  const size = Math.max(1.8, Math.min(3.8, 40 / Math.max(1, hint.length)));
  return (
    <div class="zg-hint-box">
      <div class="zg-hint" style={{ fontSize: `${size}rem` }} data-testid="zg-hint" aria-label={t.tv.letters(letters)}>
        {hint.map((c, i) =>
          c === " " ? (
            <span key={i} class="zg-hint__gap" />
          ) : c === null ? (
            <span key={i} class="zg-hint__cell" />
          ) : /[\p{L}\p{N}]/u.test(c) ? (
            <span key={i} class="zg-hint__cell is-shown">
              {c}
            </span>
          ) : (
            <span key={i} class="zg-hint__sep">
              {c}
            </span>
          ),
        )}
      </div>
      <small class="zg-hint__count">{t.tv.letters(letters)}</small>
    </div>
  );
}

/** Ab 6 Spielern zweispaltige Spielerliste, damit Platz für Sprechblasen bleibt. */
const gridList = (n: number): boolean => n > 5;
/** So viele Sprechblasen passen unter die Spielerliste (Höhen in rem, siehe styles.ts). */
const bubbleSlots = (n: number): number => {
  const rows = gridList(n) ? Math.ceil(n / 2) : n;
  return Math.max(1, Math.min(4, Math.floor((34 - rows * 3.8) / 3.9)));
};

function PlayerList({ players, drawerId, reveal }: { players: ZgPlayerInfo[]; drawerId: string; reveal?: boolean }) {
  return (
    <ol class={`zg-players ${gridList(players.length) ? "zg-players--grid" : ""}`} data-testid="zg-players">
      {players.map((p) => (
        <li
          key={p.id}
          class={`zg-pl ${p.left ? "is-left" : ""} ${p.guessed ? "is-guessed" : ""} ${p.id === drawerId ? "is-drawer" : ""}`}
          style={{ "--c": playerColor(p.color) }}
        >
          <span class="zg-pl__avatar" aria-hidden="true">
            {avatarEmoji(p.avatar)}
          </span>
          <span class="zg-pl__name">{p.name}</span>
          {p.id === drawerId && <span class="zg-pl__mark">✏️</span>}
          {p.guessed && <span class="zg-pl__mark">✅</span>}
          {(reveal || p.guessed || p.id === drawerId) && p.roundPoints > 0 && <span class="zg-pl__gain">{t.gain(p.roundPoints)}</span>}
          <span class="zg-pl__score">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

function Bubbles({ bubbles, players, max }: { bubbles: Bubble[]; players: ZgPlayerInfo[]; max: number }) {
  return (
    <ul class="zg-bubbles" data-testid="zg-bubbles">
      {bubbles
        .slice()
        .reverse()
        .slice(0, max)
        .map((b) => {
          const p = players.find((x) => x.id === b.playerId);
          if (!p) return null;
          return (
            <li key={b.n} class={`zg-bubble ${b.correct ? "is-correct" : ""}`} style={{ "--c": playerColor(p.color) }}>
              {b.correct ? (
                <b>{t.tv.hasIt(p.name)}</b>
              ) : (
                <>
                  <b>{p.name}</b>
                  <span>{b.text}</span>
                </>
              )}
            </li>
          );
        })}
    </ul>
  );
}

function RevealSide({ s }: { s: S<"reveal"> }) {
  const guessers = s.players.filter((p) => p.id !== s.drawer.id && !p.left);
  const right = guessers.filter((p) => p.guessed).length;
  const status =
    s.reason === "left" ? t.tv.drawerLeft(s.drawer.name) : right === 0 ? t.tv.nobody : right === guessers.length ? t.tv.allGuessed : t.tv.some(right);
  return (
    <>
      <div class="zg-word">
        <span>{t.tv.wordWas}</span>
        <strong data-testid="zg-word">{s.word}</strong>
      </div>
      <p class="zg-status" role="status">
        {status}
      </p>
      <PlayerList players={s.players} drawerId={s.drawer.id} reveal />
    </>
  );
}

function Ranking({ s, title }: { s: S<"standings">; title: string }) {
  return (
    <div class="zg-center">
      <h1 class="zg-title">{title}</h1>
      <ol class="zg-list">
        {s.players.map((p) => (
          <Row key={p.id} p={p} gain />
        ))}
      </ol>
    </div>
  );
}

function Row({ p, gain }: { p: ZgPlayerInfo; gain?: boolean }) {
  return (
    <li class={`zg-row ${p.left ? "is-left" : ""}`} style={{ "--c": playerColor(p.color) }}>
      <span class="zg-row__rank">{p.rank}.</span>
      <span class="zg-row__avatar" aria-hidden="true">
        {avatarEmoji(p.avatar)}
      </span>
      <span class="zg-row__name">{p.name}</span>
      {gain && p.roundPoints > 0 && <span class="zg-row__gain">{t.gain(p.roundPoints)}</span>}
      <span class="zg-row__score">{p.score}</span>
    </li>
  );
}

/** Finale: Podium für die ersten drei (Gleichstand teilt sich den Platz), darunter der Rest. */
function Final({ s }: { s: S<"final"> }) {
  const podium = s.players.filter((p) => p.rank <= 3 && !p.left).slice(0, 3);
  const rest = s.players.filter((p) => !podium.includes(p));
  // Reihenfolge auf dem Podium: 2. – 1. – 3.
  const order = [podium[1], podium[0], podium[2]];
  return (
    <div class="zg-center">
      <h1 class="zg-title">🏆 {t.tv.final}</h1>
      <div class="zg-podium" data-testid="zg-podium">
        {order.map((p, i) =>
          p ? (
            <div key={p.id} class={`zg-step zg-step--${p.rank}`} style={{ "--c": playerColor(p.color) }}>
              <span class="zg-step__avatar" aria-hidden="true">
                {avatarEmoji(p.avatar)}
              </span>
              <span class="zg-step__name">{p.name}</span>
              <span class="zg-step__score">{p.score}</span>
              <span class="zg-step__block">{p.rank}</span>
            </div>
          ) : (
            <div key={`empty${i}`} class="zg-step is-empty" />
          ),
        )}
      </div>
      {rest.length > 0 && (
        <ol class={`zg-list zg-list--rest ${rest.length > 2 ? "is-grid" : ""}`}>
          {rest.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Avatars({ players }: { players: ZgPlayerInfo[] }) {
  return (
    <div class="zg-avatars">
      {players.map((p) => (
        <span key={p.id} class="zg-avatar" style={{ "--c": playerColor(p.color) }}>
          <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
          <small>{p.name}</small>
        </span>
      ))}
    </div>
  );
}

export default preactTvView<ZgTvState>(ZeichnenTv);
