// Startbildschirm (Raum wird erstellt / Server nicht erreichbar) und Endzustände.
import { t } from "../i18n/index.js";
import { fill } from "../lib/format.js";
import { hasNative, openNativeSettings } from "../lib/native.js";
import type { AppState, Fatal } from "../state/store.js";
import { Logo, StatusPill, useNow } from "./common.js";
import { useApi } from "./context.js";

export function StartScreen(props: { conn: AppState["conn"]; resuming: boolean }) {
  const { conn, resuming } = props;
  const api = useApi();
  const failing = conn.status === "reconnecting";
  const now = useNow(1000, failing);
  const seconds = conn.retryAt ? Math.max(0, Math.ceil((conn.retryAt - now) / 1000)) : 0;
  return (
    <div class="screen start-screen" data-testid="start-screen">
      <Logo large />
      {failing ? (
        <>
          <p class="start-text" role="status">
            {fill(t.start.retryIn, { s: seconds })}
          </p>
          <div class="button-row">
            <button class="btn btn-primary" data-nav="start" data-nav-autofocus data-testid="retry" onClick={api.retryNow}>
              {t.start.retryNow}
            </button>
            {hasNative() && (
              <button class="btn" data-nav="start" onClick={openNativeSettings}>
                {t.start.settings}
              </button>
            )}
          </div>
        </>
      ) : (
        <p class="start-text" role="status">
          {resuming ? t.start.resuming : t.start.creating}
        </p>
      )}
      <StatusPill conn={conn} />
    </div>
  );
}

export function FatalScreen(props: { fatal: Fatal }) {
  const { fatal } = props;
  const api = useApi();
  let title: string;
  let text: string;
  let primary: { label: string; run: () => void };
  let secondary: { label: string; run: () => void } | null = null;
  switch (fatal.kind) {
    case "version":
      title = t.fatal.versionTitle;
      text = t.fatal.versionText;
      primary = { label: t.fatal.reload, run: api.reload };
      break;
    case "replaced":
      title = t.fatal.replacedTitle;
      text = t.fatal.replacedText;
      primary = { label: t.fatal.resumeHere, run: api.retryNow };
      secondary = { label: t.fatal.newRoom, run: api.newRoom };
      break;
    case "closed":
      title = t.fatal.closedTitle;
      text = t.fatal.closedText[fatal.reason];
      primary = { label: t.fatal.newRoom, run: api.newRoom };
      break;
    case "error":
      title = t.fatal.errorTitle;
      text = t.errors[fatal.code];
      primary = { label: t.fatal.newRoom, run: api.newRoom };
      break;
  }
  return (
    <div class="screen start-screen" data-testid="fatal-screen" data-kind={fatal.kind}>
      <Logo large />
      <h1 class="fatal-title">{title}</h1>
      <p class="start-text">{text}</p>
      <div class="button-row">
        <button class="btn btn-primary" data-nav="fatal" data-nav-autofocus onClick={primary.run}>
          {primary.label}
        </button>
        {secondary && (
          <button class="btn" data-nav="fatal" onClick={secondary.run}>
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}
