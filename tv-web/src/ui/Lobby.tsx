// Lobby: Beitritts-Karte (Code, QR, URL), Spielkatalog, Spielerliste, Einstellungen, Start.
import { useState } from "preact/hooks";
import type { GameManifest, Player, RoomState } from "@couchplay/protocol";
import { t } from "../i18n/index.js";
import { MAX_PLAYERS } from "@couchplay/protocol/constants";
import { avatarEmoji, displayUrl, fallbackJoinUrl, fill, gameIcon, playerColorVar, splitRoomCode, urlHost } from "../lib/format.js";
import { hasNative, openNativeSettings } from "../lib/native.js";
import { selectedGame, startCheck, type StartCheck } from "../state/selectors.js";
import type { AppState } from "../state/store.js";
import { ChooseOverlay } from "./Choose.js";
import { Logo, StatusPill } from "./common.js";
import { useApi } from "./context.js";
import { Qr } from "./Qr.js";
import { SettingsPanel } from "./Settings.js";

export function Lobby(props: { state: AppState; room: RoomState }) {
  const { state, room } = props;
  const api = useApi();
  const [choosing, setChoosing] = useState(false);
  const game = selectedGame(room, state.catalog);
  const check = startCheck(room, state.catalog);
  const joinUrl = room.joinUrl || state.session?.joinUrl || fallbackJoinUrl(location.origin, room.code);

  const start = (): void => {
    if (check.kind === "ready") api.send({ t: "lobby.start" });
    else if (check.kind === "choose") setChoosing(true);
  };

  return (
    <div class="screen lobby">
      <div class="lobby-logo">
        <Logo />
      </div>

      <section class="join-card" aria-label={t.join.heading}>
        <h2 class="join-heading">{t.join.heading}</h2>
        <RoomCode code={room.code} />
        <Qr class="qr" value={joinUrl} label={t.join.qrLabel} />
        <p class="join-help">{fill(t.join.instructions, { host: urlHost(joinUrl) })}</p>
        <p class="join-url" data-testid="join-url" data-join-url={joinUrl}>
          {displayUrl(joinUrl)}
        </p>
      </section>

      <section class="catalog" aria-label={t.catalog.heading}>
        <div class="section-head">
          <h2>{t.catalog.heading}</h2>
          <div class="section-tools">
            <StatusPill conn={state.conn} />
            {hasNative() && (
              <button class="btn btn-quiet" data-nav="top" onClick={openNativeSettings}>
                {t.start.settings}
              </button>
            )}
          </div>
        </div>
        <GameCatalog games={state.catalog} selectedId={room.selectedGameId} autoFocus={check.kind !== "ready" && check.kind !== "choose"} />
      </section>

      <section class="players-panel" aria-label={t.players.heading}>
        <h2>
          {t.players.heading} <span class="count">{fill(t.players.count, { n: room.players.length, max: MAX_PLAYERS })}</span>
        </h2>
        <PlayerList players={room.players} />
      </section>

      <section class="settings-panel" aria-label={t.settings.heading}>
        <h2>{t.settings.heading}</h2>
        <SettingsPanel game={game} values={room.settings} />
      </section>

      <section class="start-bar">
        <StartButton check={check} onStart={start} />
      </section>

      {choosing && check.kind === "choose" && (
        <ChooseOverlay room={room} min={check.min} max={check.max} onClose={() => setChoosing(false)} />
      )}
    </div>
  );
}

export function RoomCode(props: { code: string }) {
  const [a, b] = splitRoomCode(props.code);
  let i = 0;
  const digits = (group: string) =>
    group.split("").map((d) => {
      const color = i++;
      return (
        <span class="digit" style={{ "--digit-color": playerColorVar(color) }}>
          {d}
        </span>
      );
    });
  return (
    <div class="room-code" data-testid="room-code" data-code={props.code} aria-label={`${t.join.codeLabel} ${props.code.split("").join(" ")}`}>
      <span class="code-group">{digits(a)}</span>
      <span class="code-group">{digits(b)}</span>
    </div>
  );
}

function GameCatalog(props: { games: readonly GameManifest[]; selectedId: string | null; autoFocus: boolean }) {
  const api = useApi();
  if (props.games.length === 0) return <p class="muted">{t.catalog.empty}</p>;
  return (
    <div class="tiles" data-testid="game-catalog">
      {props.games.map((g, i) => {
        const selected = g.id === props.selectedId;
        const auto = props.autoFocus && (selected || (props.selectedId === null && i === 0));
        return (
          <button
            key={g.id}
            class={`tile ${selected ? "is-selected" : ""}`}
            style={{ "--accent": g.accentColor ?? "#7c4dff" }}
            data-nav="games"
            data-testid="game-tile"
            data-game-id={g.id}
            data-nav-autofocus={auto ? true : undefined}
            aria-pressed={selected}
            onClick={() => {
              if (!selected) api.send({ t: "lobby.selectGame", gameId: g.id });
            }}
          >
            <span class="tile-icon" aria-hidden="true">
              {gameIcon(g)}
            </span>
            <span class="tile-text">
              <span class="tile-name">{g.name}</span>
              <span class="tile-meta">
                {g.minPlayers === g.maxPlayers
                  ? fill(t.catalog.playersSolo, { min: g.minPlayers })
                  : fill(t.catalog.players, { min: g.minPlayers, max: g.maxPlayers })}
                {selected && <span class="tile-badge">{t.catalog.selected}</span>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PlayerList(props: { players: readonly Player[] }) {
  if (props.players.length === 0) {
    return (
      <p class="muted players-empty" data-testid="player-list" data-count="0">
        {t.players.empty}
      </p>
    );
  }
  return (
    <ul class="player-list" data-testid="player-list" data-count={props.players.length}>
      {props.players.map((p) => (
        <li
          key={p.id}
          class={`player ${p.connected ? "" : "is-offline"}`}
          style={{ "--pc": playerColorVar(p.color) }}
          data-testid="player-item"
          data-player-id={p.id}
          data-connected={p.connected ? "true" : "false"}
          data-host={p.isHost ? "true" : "false"}
        >
          <span class="avatar">
            <span aria-hidden="true">{avatarEmoji(p.avatar)}</span>
            {p.isHost && (
              <span class="crown" title={t.players.host} aria-label={t.players.host} data-testid="host-crown">
                {t.players.hostCrown}
              </span>
            )}
          </span>
          <span class="player-text">
            <span class="player-name">{p.name}</span>
            {!p.connected && <span class="offline-tag">{t.players.offline}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function startHint(check: StartCheck): string {
  switch (check.kind) {
    case "noGame":
      return t.startButton.hintNoGame;
    case "tooFew":
      return check.missing === check.min ? t.startButton.hintWaiting : fill(t.startButton.hintTooFew, { n: check.missing });
    case "choose":
      return fill(t.startButton.hintChoose, { max: check.max });
    case "ready":
      return fill(t.startButton.hintReady, { n: check.count });
  }
}

function StartButton(props: { check: StartCheck; onStart: () => void }) {
  const { check } = props;
  const enabled = check.kind === "ready" || check.kind === "choose";
  return (
    <div class="start">
      <button
        class={`btn btn-start ${enabled ? "" : "is-disabled"}`}
        data-nav="start"
        data-testid="start-button"
        data-state={check.kind}
        data-nav-autofocus={enabled ? true : undefined}
        aria-disabled={enabled ? undefined : "true"}
        onClick={() => enabled && props.onStart()}
      >
        {t.startButton.label}
      </button>
      <p class="start-hint" data-testid="start-hint">
        {startHint(check)}
      </p>
    </div>
  );
}
