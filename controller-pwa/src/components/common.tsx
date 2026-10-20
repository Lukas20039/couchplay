// Kleine wiederverwendbare Bausteine.
import type { Player } from "@couchplay/protocol";
import { avatarEmoji } from "@couchplay/protocol/constants";
import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { useApp, useAppState } from "../hooks.js";
import { errorText, t } from "../i18n/index.js";

/** Markenzeichen: acht Sitzplätze in den Spielerfarben. `lit` hebt den eigenen Platz hervor. */
export function Seats({ lit }: { lit?: number | null }) {
  return (
    <div class={`seats${lit != null ? " seats--lit" : ""}`} aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} class={`seat${lit === i ? " seat--on" : ""}`} style={{ "--c": `var(--p${i})` }} />
      ))}
    </div>
  );
}

export function Brand({ lit }: { lit?: number | null }) {
  return (
    <header class="brand">
      <span class="brand__name">{t.appName}</span>
      <Seats lit={lit ?? null} />
    </header>
  );
}

export function Avatar({ player, size = "m" }: { player: Pick<Player, "avatar" | "color">; size?: "s" | "m" | "l" }) {
  return (
    <span class={`avatar avatar--${size}`} style={{ "--c": `var(--p${player.color})` }} role="img" aria-label={t.avatars[player.avatar]}>
      {avatarEmoji(player.avatar)}
    </span>
  );
}

/** Eigene Identität oben auf jedem Raum-Screen: dein Platz, deine Farbe. */
export function SelfBar({ player, right }: { player: Player; right?: ComponentChildren }) {
  return (
    <header class="selfbar" style={{ "--c": `var(--p${player.color})` }}>
      <Avatar player={player} size="m" />
      <span class="selfbar__name">{player.name}</span>
      {player.isHost && <span class="tag">{t.lobby.host}</span>}
      <span class="selfbar__right">{right}</span>
    </header>
  );
}

export function ConnectionBanner() {
  const s = useAppState();
  const show = s.room !== null && (s.conn === "reconnecting" || !s.online);
  if (!show) return null;
  return (
    <div class="banner" role="status" data-testid="connection-banner">
      <span class="banner__dot" aria-hidden="true" />
      {s.online ? t.connection.reconnecting : t.connection.offline}
    </div>
  );
}

export function Toast() {
  const app = useApp();
  const s = useAppState();
  const toast = s.toast;
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => app.store.dispatch({ type: "toastClear", id: toast.id }), 3500);
    return () => clearTimeout(id);
  }, [toast?.id]);
  if (!toast) return null;
  return (
    <div class="toast" role="alert" data-testid="toast">
      {errorText(toast.code)}
    </div>
  );
}
