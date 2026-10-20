// Wurzelkomponente: wählt den Screen anhand von Verbindungs- und Raumzustand.
import { useEffect, useMemo } from "preact/hooks";
import type { AppController } from "./app.js";
import { Brand, ConnectionBanner, Toast } from "./components/common.js";
import { AppContext, useApp, useAppState } from "./hooks.js";
import { t } from "./i18n/index.js";
import { createWakeLock } from "./lib/platform.js";
import { GameScreen } from "./screens/Game.js";
import { JoinFlow } from "./screens/Join.js";
import { Lobby } from "./screens/Lobby.js";
import { Results } from "./screens/Results.js";

export function App({ app }: { app: AppController }) {
  return (
    <AppContext.Provider value={app}>
      <Root />
    </AppContext.Provider>
  );
}

function Root() {
  const s = useAppState();
  const inRoom = s.room !== null && s.playerId !== null && (s.conn === "joined" || s.conn === "reconnecting");
  const wake = useMemo(createWakeLock, []);
  useEffect(() => wake.setActive(inRoom), [inRoom]);

  // Farbe des eigenen Platzes als Theme-Akzent (Statusleiste etc. bleiben dunkel).
  const color = s.room?.players.find((p) => p.id === s.playerId)?.color;
  useEffect(() => {
    const root = document.documentElement;
    if (inRoom && color !== undefined) root.style.setProperty("--me", `var(--p${color})`);
    else root.style.removeProperty("--me");
  }, [inRoom, color]);

  let screen;
  if (inRoom) {
    const phase = s.room!.phase;
    screen = phase === "game" ? <GameScreen /> : phase === "results" ? <Results /> : <Lobby />;
  } else if (s.autoJoin) {
    screen = <AutoJoining code={s.code} />;
  } else if (s.conn === "reconnecting" || s.conn === "joined") {
    screen = <Resuming />;
  } else {
    screen = <JoinFlow />;
  }

  return (
    <>
      <ConnectionBanner />
      {screen}
      <Toast />
    </>
  );
}

/** QR-Link + bekanntes Profil: Beitritt läuft ohne Zwischenschritt. */
function AutoJoining({ code }: { code: string }) {
  const app = useApp();
  return (
    <main class="screen screen--resume">
      <Brand />
      <section class="resume" role="status" data-testid="auto-joining">
        <span class="spinner" aria-hidden="true" />
        <p class="lead">{t.join.autoJoining(code)}</p>
      </section>
      <footer class="actions">
        <button type="button" class="btn btn--ghost" data-testid="auto-join-cancel" onClick={() => app.cancelAutoJoin()}>
          {t.join.autoJoinCancel}
        </button>
      </footer>
    </main>
  );
}

/** App-Start mit gespeicherter Sitzung: Verbindung läuft, Abbruch möglich. */
function Resuming() {
  const app = useApp();
  return (
    <main class="screen screen--resume">
      <Brand />
      <section class="resume" role="status" data-testid="resuming">
        <span class="spinner" aria-hidden="true" />
        <p class="lead">{t.join.resuming}</p>
      </section>
      <footer class="actions">
        <button type="button" class="btn btn--ghost" data-testid="resume-cancel" onClick={() => app.abandon()}>
          {t.join.back}
        </button>
      </footer>
    </main>
  );
}
