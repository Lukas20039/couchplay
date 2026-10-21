// Controller-View Wortgarten (Handy). Das Raster liegt auf dem Handy: Wörter entstehen durch
// Wischen über benachbarte Felder (auch schräg) oder durch Antippen nacheinander. Der Server
// prüft Pfad und Wörterbuch und meldet das Ergebnis über `last` zurück.
// Die Garten-Erfahrung speichert das Handy im localStorage und meldet sie im Intro (hello).
import type { ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { preactControllerView } from "@couchplay/game-sdk/preact";
import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { FEEDBACK, MODE_LABELS, UNLOCK_LABELS, errorText, t } from "../i18n/de.js";
import { XP_STORAGE_KEY, comboMultiplier, isAdjacent, type Board, type Feedback, type WgInput, type WgPlayerView } from "../shared.js";
import { ensureStyles, levelShare } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type V<P extends WgPlayerView["phase"]> = Extract<WgPlayerView, { phase: P }>;
type Props = ControllerComponentProps<WgPlayerView, WgInput>;
type Api = Props["api"];

// ------------------------------------------------------------- Erfahrung (lokal)

function readXp(): number {
  try {
    const v = Number.parseInt(globalThis.localStorage?.getItem(XP_STORAGE_KEY) ?? "0", 10);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function writeXp(xp: number): void {
  try {
    if (xp > readXp()) globalThis.localStorage?.setItem(XP_STORAGE_KEY, String(xp));
  } catch {
    // Privater Modus o. Ä.: dann wächst der Garten nur innerhalb des Raums (über ctx.previous).
  }
}

// ------------------------------------------------------------------ Raster

/** Trefferprüfung: beim Ziehen nur der innere Kreis einer Zelle, damit Schrägen nicht die Nachbarn streifen. */
function cellAt(el: HTMLElement, size: number, x: number, y: number, inner: boolean): number | null {
  const r = el.getBoundingClientRect();
  const cell = r.width / size;
  const cx = x - r.left;
  const cy = y - r.top;
  if (cx < 0 || cy < 0 || cx >= r.width || cy >= r.height) return null;
  const col = Math.floor(cx / cell);
  const row = Math.floor(cy / cell);
  if (inner) {
    const dx = cx - (col + 0.5) * cell;
    const dy = cy - (row + 0.5) * cell;
    if (dx * dx + dy * dy > (cell * 0.4) ** 2) return null;
  }
  return row * size + col;
}

function useSquareSide(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSide(Math.floor(Math.min(el.clientWidth, el.clientHeight)));
    measure();
    if (typeof ResizeObserver === "undefined") {
      addEventListener("resize", measure);
      return () => removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, side];
}

function TraceGrid({
  board,
  disabled,
  tipStart,
  onSubmit,
  onPath,
}: {
  board: Board;
  disabled: boolean;
  tipStart: number | null;
  onSubmit: (path: number[]) => void;
  onPath: (path: number[]) => void;
}) {
  const [wrapRef, side] = useSquareSide();
  const gridRef = useRef<HTMLDivElement>(null);
  const path = useRef<number[]>([]);
  const drag = useRef<{ active: boolean; startLen: number }>({ active: false, startLen: 0 });
  const [, setTick] = useState(0);
  const gold = new Set(board.gold);

  const setPath = (p: number[]): void => {
    path.current = p;
    onPath(p);
    setTick((x) => x + 1);
  };
  const submit = (): void => {
    const p = path.current;
    setPath([]);
    if (p.length > 0) onSubmit(p);
  };

  const onDown = (e: PointerEvent): void => {
    if (disabled || !gridRef.current) return;
    const idx = cellAt(gridRef.current, board.size, e.clientX, e.clientY, false);
    if (idx === null) return;
    e.preventDefault();
    gridRef.current.setPointerCapture?.(e.pointerId);
    const p = path.current;
    const last = p[p.length - 1];
    if (last === idx && p.length > 0) {
      // Letztes Feld nochmal antippen → abschicken.
      drag.current = { active: false, startLen: 0 };
      submit();
      return;
    }
    if (last !== undefined && !p.includes(idx) && isAdjacent(last, idx, board.size)) setPath([...p, idx]);
    else setPath([idx]);
    drag.current = { active: true, startLen: path.current.length };
  };

  const onMove = (e: PointerEvent): void => {
    if (!drag.current.active || !gridRef.current) return;
    const idx = cellAt(gridRef.current, board.size, e.clientX, e.clientY, true);
    if (idx === null) return;
    const p = path.current;
    const last = p[p.length - 1];
    if (idx === last) return;
    if (p.length >= 2 && idx === p[p.length - 2]) setPath(p.slice(0, -1)); // zurückziehen
    else if (last !== undefined && !p.includes(idx) && isAdjacent(last, idx, board.size)) setPath([...p, idx]);
  };

  const onUp = (): void => {
    if (!drag.current.active) return;
    const swiped = path.current.length > drag.current.startLen;
    drag.current.active = false;
    // Gewischt → abschicken. Nur getippt → Pfad bleibt für den Tipp-Modus stehen.
    if (swiped && path.current.length >= 2) submit();
  };

  const onCancel = (): void => {
    drag.current.active = false;
  };

  const selected = path.current;
  const tileSide = side / board.size;
  return (
    <div class="wg-trace-wrap" ref={wrapRef}>
      <div
        ref={gridRef}
        class={`wg-trace s${board.size} ${disabled ? "is-disabled" : ""}`}
        data-testid="wg-trace"
        style={{ width: `${side}px`, height: `${side}px`, "--side": `${side}px` }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        role="grid"
        aria-label={t.ctrlSwipe}
      >
        <svg class="wg-trace-line" viewBox={`0 0 ${side} ${side}`} aria-hidden="true">
          {selected.length > 1 && (
            <polyline
              points={selected
                .map((c) => `${((c % board.size) + 0.5) * tileSide},${(Math.floor(c / board.size) + 0.5) * tileSide}`)
                .join(" ")}
            />
          )}
        </svg>
        {board.letters.map((l, i) => {
          const pos = selected.indexOf(i);
          const cls = [
            "wg-cell",
            pos >= 0 ? "is-on" : "",
            pos === selected.length - 1 && pos >= 0 ? "is-last" : "",
            gold.has(i) ? "is-gold" : "",
            tipStart === i ? "is-tip" : "",
          ].join(" ");
          return (
            <div class={cls} key={i} role="gridcell" aria-selected={pos >= 0}>
              <span>{l}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Runde

function FeedbackLine({ last, word }: { last: Feedback | null; word: string }) {
  const [shown, setShown] = useState<Feedback | null>(null);
  useEffect(() => {
    if (!last) return;
    setShown(last);
    const id = setTimeout(() => setShown(null), 1700);
    return () => clearTimeout(id);
  }, [last?.seq]);
  if (word) return <div class="wg-current">{word}</div>;
  if (!shown) return <div class="wg-current is-empty">{t.ctrlSwipe}</div>;
  if (shown.result === "ok") {
    return (
      <div class="wg-current is-ok" key={shown.seq} data-testid="wg-feedback" data-result="ok">
        {shown.word} <b>{t.plusPoints(shown.points)}</b>
        {shown.multiplier > 1 && <small>{t.factor(shown.multiplier)}</small>}
      </div>
    );
  }
  return (
    <div class="wg-current is-bad" key={shown.seq} data-testid="wg-feedback" data-result={shown.result}>
      {shown.word && <s>{shown.word}</s>} <small>{FEEDBACK[shown.result]}</small>
    </div>
  );
}

function Round({ v, api, now }: { v: V<"round">; api: Api; now: number }) {
  const [current, setCurrent] = useState<number[]>([]);
  const expired = now >= v.endsAt;
  const remaining = Math.max(0, v.endsAt - now);
  const share = v.durationMs > 0 ? Math.min(1, remaining / v.durationMs) : 0;
  const lastSeq = useRef(v.last?.seq ?? 0);

  // Haptik einmal je Rückmeldung (Replays nach Rejoin schaltet die Plattform stumm).
  useEffect(() => {
    if (!v.last || v.last.seq === lastSeq.current) return;
    lastSeq.current = v.last.seq;
    api.vibrate(v.last.result === "ok" ? 35 : [60, 40, 60]);
  }, [v.last?.seq]);

  const comboActive = v.streak >= 2 && now < v.streakEndsAt;
  const nextMult = comboActive ? comboMultiplier(v.streak + 1, v.config.mode) : 1;
  const word = current.map((c) => v.board.letters[c]).join("");

  return (
    <>
      <div class="wg-top">
        <strong>{t.ctrlRound(v.round, v.rounds)}</strong>
        <span>{t.points(v.score)}</span>
      </div>
      <div class={`wg-time ${remaining <= 10_000 ? "is-low" : ""}`} aria-hidden="true">
        <span key={v.endsAt} style={{ transform: `scaleX(${share})`, animation: `wg-drain ${remaining}ms linear forwards` }} />
      </div>
      <FeedbackLine last={v.last} word={word} />
      <TraceGrid
        board={v.board}
        disabled={expired}
        tipStart={v.tip?.start ?? null}
        onPath={setCurrent}
        onSubmit={(path) => api.sendInput({ type: "word", path })}
      />
      <div class="wg-tools">
        {v.tip ? (
          <div class="wg-tip" role="status">
            💡 <b>{t.ctrlTipText(v.tip.prefix, v.tip.length - [...v.tip.prefix].length)}</b> <small>{t.ctrlTipLen(v.tip.length)}</small>
          </div>
        ) : v.config.tipsPerRound > 0 ? (
          <button type="button" class="wg-btn" disabled={v.tipsLeft <= 0 || expired} onClick={() => api.sendInput({ type: "tip" })}>
            {t.ctrlTip(v.tipsLeft)}
          </button>
        ) : (
          <span />
        )}
        {nextMult > 1 && (
          <div class="wg-combo" key={v.streak}>
            🔥 {t.ctrlCombo(t.factor(nextMult))}
            <span style={{ animation: `wg-drain ${Math.max(0, v.streakEndsAt - now)}ms linear forwards` }} />
          </div>
        )}
      </div>
      <div class="wg-found" aria-label={t.words(v.found.length)} data-testid="wg-found" data-count={v.found.length}>
        {v.found.length === 0 ? (
          <span class="wg-soft">{t.ctrlFoundNone}</span>
        ) : (
          v.found.map((f) => (
            <span class="wg-chip" key={f.word}>
              {f.word} <small>{f.points}</small>
            </span>
          ))
        )}
      </div>
    </>
  );
}

// --------------------------------------------------------------- übrige Phasen

function Intro({ v, api }: { v: V<"intro">; api: Api }) {
  const sent = useRef(false);
  useEffect(() => {
    if (v.helloReceived || sent.current) return;
    sent.current = true;
    api.sendInput({ type: "hello", xp: readXp() });
  }, [v.helloReceived]);
  return (
    <div class="wg-info">
      <div class="wg-logo" aria-hidden="true">
        🌻
      </div>
      <h2>{t.ctrlIntro}</h2>
      <p>{t.ctrlSwipe}.</p>
      <p class="wg-soft">{t.ctrlTapHint}</p>
      <p class="wg-pill">
        {t.level(v.level.level)} · {t.gridSize(v.config.size)} · {MODE_LABELS[v.config.mode]}
      </p>
    </div>
  );
}

function RoundEnd({ v }: { v: V<"roundEnd"> }) {
  const unique = v.words.filter((w) => w.unique).length;
  return (
    <div class="wg-info is-top">
      <p class="wg-soft">{t.roundOf(v.round, v.rounds)}</p>
      <div class="wg-big">{t.plusPoints(v.roundPoints)}</div>
      {v.uniqueBonus && unique > 0 && <p class="wg-gold">★ {t.ctrlUnique(unique)}</p>}
      <div class="wg-found is-wrap">
        {v.words.map((w) => (
          <span class={`wg-chip ${w.unique ? "is-unique" : ""}`} key={w.word}>
            {w.unique ? "★ " : ""}
            {w.word} <small>{w.points}</small>
          </span>
        ))}
      </div>
      <p class="wg-place">{t.ctrlPlace(v.rank, v.playerCount)}</p>
      <p class="wg-soft">
        {t.ctrlTotal(v.score)} · {t.ctrlLookTv}
      </p>
    </div>
  );
}

function Final({ v }: { v: V<"final"> }) {
  useEffect(() => writeXp(v.xpAfter), [v.xpAfter]);
  return (
    <div class="wg-info">
      <p class="wg-soft">{t.ctrlFinal}</p>
      <div class="wg-big">{t.rank(v.rank)}</div>
      <h2>{v.rank === 1 && v.playerCount > 1 ? t.ctrlWinner : t.ctrlPlace(v.rank, v.playerCount)}</h2>
      <p>{t.ctrlTotal(v.score)}</p>
      {v.longest && <p class="wg-soft">{t.ctrlLongest(v.longest)}</p>}
      <div class="wg-level-mini">
        <div class="wg-level-row">
          <b>🌻 {t.level(v.level.level)}</b>
          <span>{t.ctrlXpGain(v.xpAfter - v.xpBefore)}</span>
        </div>
        <div class="wg-bar">
          <span style={{ transform: `scaleX(${levelShare(v.level)})` }} />
        </div>
      </div>
      {v.newUnlocks.map((u) => (
        <p class="wg-unlock" key={u}>
          {UNLOCK_LABELS[u].icon} <b>{UNLOCK_LABELS[u].title}</b> – {UNLOCK_LABELS[u].text}
        </p>
      ))}
    </div>
  );
}

export function WortgartenController({ view, api, error }: Props) {
  ensureStyles("wg-pad-css", CONTROLLER_CSS);
  const [now, setNow] = useState(api.serverNow);
  const ticking = view?.phase === "round";
  useEffect(() => {
    setNow(api.serverNow());
    if (!ticking) return;
    const id = setInterval(() => setNow(api.serverNow()), 250);
    return () => clearInterval(id);
  }, [ticking, api]);

  let body;
  switch (view?.phase) {
    case "intro":
      body = <Intro v={view} api={api} />;
      break;
    case "round":
      body = <Round key={`r${view.round}`} v={view} api={api} now={now} />;
      break;
    case "roundEnd":
      body = <RoundEnd v={view} />;
      break;
    case "final":
      body = <Final v={view} />;
      break;
    default:
      body = (
        <div class="wg-info">
          <div class="wg-logo" aria-hidden="true">
            🌱
          </div>
          <p>{t.waiting}</p>
        </div>
      );
  }
  return (
    <div class={`wg-pad is-${view?.phase ?? "wait"}`} data-testid="wg-pad" data-phase={view?.phase ?? "wait"}>
      {body}
      {error && <p class="wg-error" role="alert">{errorText(error.code)}</p>}
    </div>
  );
}

export default preactControllerView<WgPlayerView, WgInput>(WortgartenController);
