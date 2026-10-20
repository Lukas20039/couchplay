// Kleine gemeinsame Bausteine: Overlay-Ebene, Statusanzeige, Hinweis-Toast, Logo.
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { ErrorCode } from "@couchplay/protocol/errors";
import { errorText, t } from "../i18n/index.js";
import { fill } from "../lib/format.js";
import { tvNav } from "../nav/navigator.js";
import type { AppState } from "../state/store.js";
import { BACK_LEVEL, useBack } from "./context.js";

/** Modale Ebene: fängt Fokus und Zurück; gibt beim Schließen den Fokus zurück. */
export function Overlay(props: { onClose: () => void; class?: string; testId?: string; children: ComponentChildren }) {
  const opener = useRef<HTMLElement | null>(null);
  useBack(BACK_LEVEL.overlay, () => {
    props.onClose();
    return true;
  });
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    tvNav.ensureFocus();
    return () => {
      const el = opener.current;
      // Nach dem Entfernen der Ebene Fokus zurück an den Auslöser.
      requestAnimationFrame(() => {
        if (el && el.isConnected) tvNav.focus(el);
        else tvNav.ensureFocus();
      });
    };
  }, []);
  return (
    <div class="overlay" data-nav-layer data-testid={props.testId}>
      <div class={`overlay-panel ${props.class ?? ""}`}>{props.children}</div>
    </div>
  );
}

export function Logo(props: { large?: boolean }) {
  return (
    <div class={props.large ? "logo logo-large" : "logo"} aria-label={t.appName}>
      <span class="logo-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span class="logo-text">{t.appName}</span>
    </div>
  );
}

export function statusText(conn: AppState["conn"]): string {
  if (conn.status === "online") return t.status.online;
  if (conn.status === "connecting") return t.status.connecting;
  return fill(t.status.reconnecting, { n: conn.attempt });
}

export function StatusPill(props: { conn: AppState["conn"] }) {
  return (
    <div class={`status status-${props.conn.status}`} data-testid="connection-status" data-status={props.conn.status}>
      <span class="status-dot" aria-hidden="true" />
      {statusText(props.conn)}
    </div>
  );
}

/** Banner über allem, solange die Verbindung zu einem bestehenden Raum fehlt. */
export function ReconnectBanner(props: { conn: AppState["conn"] }) {
  if (props.conn.status === "online") return null;
  return (
    <div class="banner banner-warn" role="status" data-testid="reconnect-banner">
      <span class="status-dot" aria-hidden="true" />
      {statusText(props.conn)}
    </div>
  );
}

const NOTICE_MS = 4500;

export function Toast(props: { notice: { code: ErrorCode; id: number } | null; onDone: () => void }) {
  const { notice, onDone } = props;
  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(onDone, NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice?.id]);
  if (!notice) return null;
  return (
    <div class="toast" role="alert" data-testid="toast" data-error-code={notice.code} key={notice.id}>
      {errorText(notice.code)}
    </div>
  );
}

/** Sekundengenaue Uhr für Countdowns (nur solange benötigt). */
export function useNow(intervalMs = 1000, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, active]);
  return now;
}
