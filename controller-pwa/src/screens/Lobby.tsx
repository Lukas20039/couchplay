// Lobby: Spielerliste, „Warte auf Start“; Host zusätzlich Spielauswahl, Einstellungen,
// Teilnehmerauswahl und Start-Button.
import type { GameManifest, Player, SettingField, SettingValue } from "@couchplay/protocol";
import { MAX_PLAYERS } from "@couchplay/protocol/constants";
import { useEffect, useState } from "preact/hooks";
import { Avatar, SelfBar } from "../components/common.js";
import { useApp, useAppState } from "../hooks.js";
import { t } from "../i18n/index.js";
import { defaultSelection, needsPicker, reconcileSelection, startCheck, toggleSelection } from "../lib/participants.js";
import { isSelfHost, selectedGame, selfPlayer } from "../state/store.js";

export function Lobby() {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const me = selfPlayer(s);
  const host = isSelfHost(s);
  const game = selectedGame(s);
  const hostPlayer = room.players.find((p) => p.id === room.hostId);
  const limits = room.playerLimits;
  const [selection, setSelection] = useState<string[]>(() => (limits ? defaultSelection(room.players, limits) : []));

  // Spielwechsel → Vorauswahl neu; Spielerliste ändert sich → Auswahl bereinigen.
  useEffect(() => {
    if (limits) setSelection(defaultSelection(room.players, limits));
  }, [room.selectedGameId, limits?.maxPlayers]);
  useEffect(() => {
    setSelection((sel) => reconcileSelection(sel, room.players));
  }, [room.players]);

  return (
    <main class="screen screen--lobby">
      {me && <SelfBar player={me} />}
      <section class="lobby">
        <div class="status" data-testid="lobby-status">
          <h1 class="title">{host ? t.lobby.hostTitle : t.lobby.waiting}</h1>
          {!host && (
            <p class="lead">
              {hostPlayer ? t.lobby.waitingHost(hostPlayer.name) : t.lobby.waitingNoHost}
              {" "}
              {game ? t.lobby.selectedGame(game.name) : t.lobby.noGameYet}
            </p>
          )}
          {!room.tvConnected && <p class="hint hint--warn">{t.lobby.tvAway}</p>}
        </div>

        {host && <HostPanel game={game} selection={selection} setSelection={setSelection} />}

        <PlayerList players={room.players} selfId={s.playerId} />

        <button
          type="button"
          class="link link--quiet"
          data-testid="leave-button"
          onClick={() => {
            if (confirm(t.lobby.leaveConfirm)) app.leave();
          }}
        >
          {t.lobby.leave}
        </button>
      </section>
      {host && <StartButton selection={selection} />}
    </main>
  );
}

function PlayerList({ players, selfId }: { players: readonly Player[]; selfId: string | null }) {
  return (
    <section class="players" aria-labelledby="players-h">
      <h2 id="players-h" class="subtitle">
        {t.lobby.players(players.length, MAX_PLAYERS)}
      </h2>
      <ul class="players__list" data-testid="player-list">
        {players.map((p) => (
          <li key={p.id} class={`player${p.connected ? "" : " player--away"}`} style={{ "--c": `var(--p${p.color})` }}>
            <Avatar player={p} size="s" />
            <span class="player__name">{p.name}</span>
            {p.id === selfId && <span class="tag tag--you">{t.lobby.you}</span>}
            {p.isHost && <span class="tag">{t.lobby.host}</span>}
            {!p.connected && <span class="tag tag--away">{t.lobby.away}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StartButton({ selection }: { selection: readonly string[] }) {
  const app = useApp();
  const room = useAppState().room!;
  const limits = room.playerLimits;
  const check = startCheck(room.players, limits, selection);
  const label = check.ok
    ? t.lobby.start
    : check.reason === "noGame"
      ? t.lobby.startNeedsGame
      : t.lobby.startCount(limits!.minPlayers, limits!.maxPlayers);
  return (
    <div class="actions actions--sticky">
      <button
        type="button"
        class="btn btn--primary"
        data-testid="start-button"
        disabled={!check.ok}
        onClick={() => {
          if (!check.ok) return;
          app.send(check.playerIds ? { t: "lobby.start", playerIds: check.playerIds } : { t: "lobby.start" });
        }}
      >
        {label}
      </button>
    </div>
  );
}

interface HostPanelProps {
  game: GameManifest | null;
  selection: string[];
  setSelection: (ids: string[]) => void;
}

function HostPanel({ game, selection, setSelection }: HostPanelProps) {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const limits = room.playerLimits;
  const picker = needsPicker(room.players, limits);

  return (
    <>
      <section class="panel" aria-labelledby="games-h">
        <h2 id="games-h" class="subtitle">
          {t.lobby.chooseGame}
        </h2>
        <div class="games" role="radiogroup" aria-labelledby="games-h" data-testid="host-game-select">
          {s.catalog.map((g) => {
            const on = g.id === room.selectedGameId;
            return (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={on}
                class={`gamecard${on ? " gamecard--on" : ""}`}
                style={g.accentColor ? { "--a": g.accentColor } : undefined}
                data-testid={`game-option-${g.id}`}
                onClick={() => !on && app.send({ t: "lobby.selectGame", gameId: g.id })}
              >
                <span class="gamecard__name">{g.name}</span>
                <span class="gamecard__meta">{t.lobby.playersRange(g.minPlayers, g.maxPlayers)}</span>
                <span class="gamecard__desc">{g.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      {game && game.settings.length > 0 && (
        <section class="panel" aria-labelledby="settings-h" data-testid="host-settings">
          <h2 id="settings-h" class="subtitle">
            {t.lobby.settings}
          </h2>
          {game.settings.map((f) => (
            <SettingControl
              key={`${game.id}:${f.key}`}
              field={f}
              value={room.settings[f.key] ?? f.default}
              onChange={(v) => app.send({ t: "lobby.updateSettings", settings: { [f.key]: v } })}
            />
          ))}
        </section>
      )}

      {picker && limits && (
        <section class="panel" aria-labelledby="pick-h" data-testid="host-participants">
          <h2 id="pick-h" class="subtitle">
            {t.lobby.participants}
          </h2>
          <p class="hint">{t.lobby.participantsHint(limits.maxPlayers)}</p>
          <div class="chips">
            {room.players
              .filter((p) => p.connected)
              .map((p) => {
                const on = selection.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    class={`chip chip--toggle${on ? " chip--on" : ""}`}
                    style={{ "--c": `var(--p${p.color})` }}
                    data-testid={`participant-${p.id}`}
                    onClick={() => setSelection(toggleSelection(selection, p.id, room.players, limits))}
                  >
                    <Avatar player={p} size="s" />
                    {p.name}
                  </button>
                );
              })}
          </div>
          <p class="hint">{t.lobby.participantsCount(selection.length, limits.minPlayers, limits.maxPlayers)}</p>
        </section>
      )}

    </>
  );
}

function SettingControl({ field, value, onChange }: { field: SettingField; value: SettingValue; onChange: (v: SettingValue) => void }) {
  const id = `set-${field.key}`;
  switch (field.type) {
    case "select":
      return (
        <div class="setting" role="group" aria-labelledby={id} data-testid={`setting-${field.key}`}>
          <span id={id} class="setting__label">
            {field.label}
          </span>
          {field.options.length <= 4 ? (
            <div class="segmented">
              {field.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={value === o.value}
                  class={`segmented__opt${value === o.value ? " segmented__opt--on" : ""}`}
                  onClick={() => value !== o.value && onChange(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : (
            <select class="input" aria-labelledby={id} value={String(value)} onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}>
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      );
    case "multiselect": {
      const list = Array.isArray(value) ? value : field.default;
      const min = field.minSelected ?? 0;
      const max = field.maxSelected ?? field.options.length;
      return (
        <div class="setting" role="group" aria-labelledby={id} data-testid={`setting-${field.key}`}>
          <span id={id} class="setting__label">
            {field.label}
          </span>
          <div class="chips">
            {field.options.map((o) => {
              const on = list.includes(o.value);
              const locked = on ? list.length <= min : list.length >= max;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-disabled={locked}
                  class={`chip chip--toggle${on ? " chip--on" : ""}`}
                  onClick={() => {
                    if (locked) return;
                    // Reihenfolge der Optionen beibehalten.
                    const next = field.options.map((x) => x.value).filter((v) => (v === o.value ? !on : list.includes(v)));
                    onChange(next);
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "number": {
      const n = typeof value === "number" ? value : field.default;
      const step = field.step ?? 1;
      return (
        <div class="setting setting--row" data-testid={`setting-${field.key}`}>
          <span id={id} class="setting__label">
            {field.label}
          </span>
          <div class="stepper" role="group" aria-labelledby={id}>
            <button type="button" class="stepper__btn" aria-label={t.lobby.decrease} disabled={n - step < field.min} onClick={() => onChange(Math.max(field.min, n - step))}>
              −
            </button>
            <output class="stepper__value" aria-live="polite">
              {n}
            </output>
            <button type="button" class="stepper__btn" aria-label={t.lobby.increase} disabled={n + step > field.max} onClick={() => onChange(Math.min(field.max, n + step))}>
              +
            </button>
          </div>
        </div>
      );
    }
    case "toggle": {
      const on = value === true;
      return (
        <div class="setting setting--row" data-testid={`setting-${field.key}`}>
          <span id={id} class="setting__label">
            {field.label}
          </span>
          <button type="button" role="switch" aria-checked={on} aria-labelledby={id} class={`switch${on ? " switch--on" : ""}`} onClick={() => onChange(!on)}>
            <span class="switch__knob" />
            <span class="sr-only">{on ? t.lobby.on : t.lobby.off}</span>
          </button>
        </div>
      );
    }
  }
}
