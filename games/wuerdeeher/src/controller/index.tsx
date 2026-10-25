// Controller-View „Wer würde eher …?“ (Hochformat).
// Aussage oben, darunter alle Mitspieler als große Kacheln (eigene Kachel „Ich“). Ein Tipp = Stimme, danach fix.
// In der Auflösung erst nach der Krönung am TV das Ergebnis zeigen (sonst verrät das Handy den Ausgang).
// Merkt sich gestellte Aussagen (seen.ts), damit dieselbe Runde sie nicht so bald wieder bekommt.
import { preactControllerView, type ControllerComponentProps } from "@couchplay/game-sdk/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../i18n/de.js";
import { loadSeen, packSeen, rememberSeen } from "../seen.js";
import { revealSchedule, statement, type WeInput, type WePerson, type WePlayerView } from "../shared.js";
import { avatarEmoji, ensureStyles, playerColor, useServerNow } from "../ui/common.js";
import { CONTROLLER_CSS } from "./styles.js";

type Props = ControllerComponentProps<WePlayerView, WeInput>;
type V<P extends WePlayerView["phase"]> = Extract<WePlayerView, { phase: P }>;

function WuerdeeherController({ view, api, error }: Props) {
  ensureStyles("we-ctl-css", CONTROLLER_CSS);
  // Bei jedem Render die aktuelle Serverzeit nehmen (neue Ansicht kommt sonst bis zu 250 ms „zu spät“).
  const now = Math.max(useServerNow(api.serverNow, view?.phase === "vote" || view?.phase === "reveal"), api.serverNow());

  // Gedächtnis: einmal je Spiel melden (im Intro), jede gestellte Aussage merken.
  const reported = useRef(false);
  const hasView = view !== null;
  useEffect(() => {
    if (!hasView || reported.current) return;
    reported.current = true;
    api.sendInput({ type: "seen", ids: packSeen(loadSeen(storage())) });
  }, [hasView]);
  const promptId = view?.phase === "vote" ? view.promptId : null;
  useEffect(() => {
    if (promptId) rememberSeen(storage(), promptId);
  }, [promptId]);

  // Einmal pro Auflösung vibrieren, sobald das Ergebnis sichtbar wird.
  const resultShown = view?.phase === "reveal" && now - view.revealAt >= revealSchedule(view.voteCount).crownMs;
  const vibrateKey = resultShown ? `${view.round}` : null;
  useEffect(() => {
    if (view?.phase === "reveal" && vibrateKey) api.vibrate(view.withMajority ? [60, 40, 60] : [200]);
  }, [vibrateKey]);

  if (!view) {
    return (
      <div class="we-ctl">
        <p class="we-msg">{t.controller.loading}</p>
      </div>
    );
  }
  let body;
  switch (view.phase) {
    case "intro":
      body = <p class="we-msg">{t.controller.intro}</p>;
      break;
    case "vote":
      body = <Vote key={`v${view.round}`} v={view} api={api} now={now} rejected={error !== null} />;
      break;
    case "reveal":
      body = resultShown ? <Reveal v={view} me={api.playerId} /> : <p class="we-msg we-big">{t.controller.watchTv}</p>;
      break;
    case "standings":
      body = <p class="we-msg we-big">{t.controller.standings(view.rank, view.playerCount)}</p>;
      break;
    case "final":
      body = (
        <div class="we-result" data-testid="we-final">
          <strong>{t.controller.finalTitle}</strong>
          <span>{t.controller.standings(view.rank, view.playerCount)}</span>
          <span class="we-gain">{t.points(view.score)}</span>
          {view.title && (
            <span class="we-title-claim">
              <b>{t.controller.yourTitle}</b>
              {t.tv.titleText(view.title.text)} ({t.votes(view.title.votes)})
            </span>
          )}
        </div>
      );
      break;
  }
  return (
    <div class={`we-ctl we-ctl--${view.phase}`} data-testid="we-controller" data-phase={view.phase}>
      <header class="we-top">
        <span>{view.phase === "intro" ? t.title : t.round(view.round, view.total)}</span>
        <span>{t.points(view.score)}</span>
      </header>
      {body}
    </div>
  );
}

function Dot({ p }: { p: WePerson }) {
  return (
    <span class="we-dot" style={{ "--c": playerColor(p.color) }} aria-hidden="true">
      {avatarEmoji(p.avatar)}
    </span>
  );
}

function Vote({ v, api, now, rejected }: { v: V<"vote">; api: Props["api"]; now: number; rejected: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    if (rejected) setPending(null);
  }, [rejected]);
  // Fällt der gewählte Spieler weg, setzt der Server die Wahl zurück (choice null) – dann darf neu gewählt werden.
  const chosenId = v.choice ?? (pending !== null && v.candidates.some((c) => c.id === pending) ? pending : null);
  const chosen = v.candidates.find((c) => c.id === chosenId) ?? null;
  const remaining = Math.max(0, v.endsAt - now);
  const many = v.candidates.length > 6;
  return (
    <>
      <div class="we-time" aria-hidden="true">
        <span key={v.endsAt} style={{ transform: `scaleX(${Math.min(1, remaining / v.durationMs)})`, animation: `we-drain ${remaining}ms linear forwards` }} />
      </div>
      <h2 class="we-q">
        <small>{t.lead}</small>
        <strong data-testid="we-prompt">{v.text}</strong>
      </h2>
      {chosen ? (
        <div class="we-locked" role="status" data-testid="we-locked">
          <span class="we-locked__label">{t.controller.yourVote}</span>
          <span class="we-locked__who">
            <Dot p={chosen} />
            <span>{chosen.id === api.playerId ? `${chosen.name} (${t.controller.me})` : chosen.name}</span>
          </span>
          <small>{t.controller.locked}</small>
        </div>
      ) : (
        <div class={`we-tiles ${many ? "we-tiles--many" : ""}`}>
          {v.candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              class="we-tile"
              style={{ "--c": playerColor(c.color) }}
              aria-label={t.controller.voteFor(c.name)}
              data-testid={`we-tile-${c.id}`}
              onClick={() => {
                if (chosenId !== null) return;
                setPending(c.id);
                api.vibrate(30);
                api.sendInput({ type: "vote", target: c.id });
              }}
            >
              {c.id === api.playerId && <span class="we-tile__me">{t.controller.me}</span>}
              <span class="we-tile__emoji" aria-hidden="true">
                {avatarEmoji(c.avatar)}
              </span>
              <span class="we-tile__name">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function Reveal({ v, me }: { v: V<"reveal">; me: string }) {
  const iWon = v.winners.some((w) => w.id === me);
  const headline = v.choice === null ? t.controller.noVote : v.withMajority ? t.controller.withMajority : t.controller.against;
  return (
    <div class={`we-result ${v.withMajority ? "is-good" : ""}`} role="status" data-testid="we-result">
      {v.winners.length > 0 ? (
        <>
          <div class="we-crowns">
            {v.winners.map((w) => (
              <Dot key={w.id} p={w} />
            ))}
          </div>
          <span class="we-winner">
            👑 {t.crowned(
              v.winners.map((w) => w.name),
              statement(v.text),
            )}
          </span>
        </>
      ) : (
        <span class="we-winner">{t.controller.nobody}</span>
      )}
      <strong>{headline}</strong>
      {v.choice && (
        <span>
          {t.controller.yourVote} {v.choice.name}
        </span>
      )}
      {v.points > 0 && <span class="we-gain">{t.plus(v.points)}</span>}
      {iWon ? <span class="we-me-won">{t.controller.youWon}</span> : <span>{t.controller.youGot(v.myVotes)}</span>}
      {iWon && <span>{t.controller.youGot(v.myVotes)}</span>}
    </div>
  );
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export default preactControllerView<WePlayerView, WeInput>(WuerdeeherController);
