// Spieleabend auf dem TV: Planer (Overlay), Spielplan und Teams in der Lobby,
// Wertungsspalte im Ergebnis und Siegerehrung nach dem letzten Spiel.
import { useState } from "preact/hooks";
import type { GameManifest, Player, RoomState } from "@couchplay/protocol";
import { EVENING_MAX_GAMES, EVENING_MIN_GAMES } from "@couchplay/protocol/constants";
import { eveningIsFinal } from "@couchplay/protocol/evening";
import { plural, t } from "../i18n/index.js";
import { avatarEmoji, fill, gameIcon, playerColorVar } from "../lib/format.js";
import {
  eveningRows,
  lastAwards,
  suggestGames,
  teamColorVar,
  teamEmoji,
  teamPoints,
  toggleGame,
  type EveningRow,
} from "../state/evening.js";
import { connectedPlayers } from "../state/selectors.js";
import { Overlay } from "./common.js";
import { BACK_LEVEL, useApi, useBack } from "./context.js";

const teamName = (team: number): string => t.evening.teamNames[team] ?? `Team ${team + 1}`;
const pointsText = (n: number): string => plural(t.evening.points, n);

// ---------------------------------------------------------------------------
// Planer
// ---------------------------------------------------------------------------

export function EveningSetup(props: { room: RoomState; catalog: readonly GameManifest[]; onClose: () => void }) {
  const { room, catalog, onClose } = props;
  const api = useApi();
  const playerCount = connectedPlayers(room).length;
  const [games, setGames] = useState(() => suggestGames(catalog, playerCount));
  const [teams, setTeams] = useState(0);
  const [doubleFinal, setDoubleFinal] = useState(true);
  const ok = games.length >= EVENING_MIN_GAMES && games.length <= EVENING_MAX_GAMES;
  const teamChoices = [0, 2, 3, 4];

  return (
    <Overlay onClose={onClose} class="evening-setup" testId="evening-setup">
      <h2>{t.evening.heading}</h2>
      <p class="muted">{t.evening.gamesHint}</p>
      <div class="picker-list evening-games">
        {catalog.map((g, i) => {
          const pos = games.indexOf(g.id);
          return (
            <button
              key={g.id}
              class={`pick evening-game ${pos >= 0 ? "is-checked" : ""}`}
              style={{ "--accent": g.accentColor ?? "#7c4dff" }}
              data-nav="evening-games"
              data-nav-autofocus={i === 0 ? true : undefined}
              data-testid="evening-game"
              data-game-id={g.id}
              role="checkbox"
              aria-checked={pos >= 0}
              onClick={() => setGames(toggleGame(games, g.id))}
            >
              <span class="evening-order" aria-hidden="true">
                {pos >= 0 ? pos + 1 : ""}
              </span>
              <span class="evening-game-icon" aria-hidden="true">
                {gameIcon(g)}
              </span>
              {g.name}
            </button>
          );
        })}
      </div>
      <div class="evening-options">
        <span class="setting-label">{t.evening.teams}</span>
        <div class="evening-team-choices">
          {teamChoices.map((n, i) => {
            const disabled = n > 0 && playerCount < n;
            return (
              <button
                key={n}
                class={`pick evening-choice ${teams === n ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
                data-nav="evening-teams"
                data-testid="evening-teams"
                data-teams={n}
                role="radio"
                aria-checked={teams === n}
                aria-disabled={disabled ? "true" : undefined}
                onClick={() => !disabled && setTeams(n)}
              >
                <span class="radio" aria-hidden="true" />
                {t.evening.teamOptions[i]}
              </button>
            );
          })}
        </div>
        <button
          class={`pick evening-choice ${doubleFinal ? "is-checked" : ""}`}
          data-nav="evening-double"
          data-testid="evening-double"
          role="checkbox"
          aria-checked={doubleFinal}
          onClick={() => setDoubleFinal(!doubleFinal)}
        >
          <span class="check" aria-hidden="true" />
          {t.evening.doubleFinal}
        </button>
      </div>
      <div class="button-row">
        <button
          class={`btn btn-primary ${ok ? "" : "is-disabled"}`}
          data-nav="evening-actions"
          data-testid="evening-start"
          aria-disabled={ok ? undefined : "true"}
          onClick={() => {
            if (!ok) return;
            api.send({ t: "evening.start", games, teams, doubleFinal });
            onClose();
          }}
        >
          {t.evening.start}
        </button>
        <button class="btn" data-nav="evening-actions" onClick={onClose}>
          {t.evening.cancel}
        </button>
      </div>
    </Overlay>
  );
}

// ---------------------------------------------------------------------------
// Lobby: Spielplan und Teams
// ---------------------------------------------------------------------------

/** Spielplan als Leiste: erledigte Spiele mit ✓, aktuelles hervorgehoben. */
export function EveningPlan(props: { room: RoomState; catalog: readonly GameManifest[] }) {
  const e = props.room.evening!;
  const done = e.rounds.length;
  return (
    <div class="evening-plan" data-testid="evening-plan" data-done={done}>
      <p class="evening-progress">
        {fill(t.evening.progress, { n: Math.min(done + 1, e.games.length), total: e.games.length })}
        {eveningIsFinal(e) && <span class="evening-final-badge">{t.evening.finalBadge}</span>}
      </p>
      <ol class="evening-chips">
        {e.games.map((id, i) => {
          const g = props.catalog.find((x) => x.id === id);
          const state = i < done ? "done" : i === done ? "current" : "todo";
          return (
            <li key={`${i}-${id}`} class={`evening-chip is-${state}`} style={{ "--accent": g?.accentColor ?? "#7c4dff" }} data-testid="evening-chip" data-state={state}>
              <span aria-hidden="true">{state === "done" ? "✓" : gameIcon(g)}</span>
              <span class="evening-chip-name">{g?.name ?? id}</span>
              {e.doubleFinal && i === e.games.length - 1 && <span class="evening-chip-x2">×2</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Teams als Spalten; vor dem ersten Spiel per Klick ins nächste Team schieben. */
export function TeamColumns(props: { room: RoomState }) {
  const { room } = props;
  const api = useApi();
  const e = room.evening!;
  const teams = e.teams ?? [];
  const points = teamPoints(e);
  const byId = new Map(room.players.map((p) => [p.id, p]));
  return (
    <div class="team-columns" data-testid="team-columns" style={{ "--cols": teams.length }}>
      {teams.map((members, team) => (
        <section key={team} class="team-col" style={{ "--tc": teamColorVar(team) }} data-testid="team-col" data-team={team}>
          <header class="team-head">
            <span class="team-emoji" aria-hidden="true">
              {teamEmoji(team)}
            </span>
            <span class="team-name">{teamName(team)}</span>
            <span class="team-points">{pointsText(points[team] ?? 0)}</span>
          </header>
          <ul class="team-members">
            {members.length === 0 && <li class="muted team-empty">{t.evening.teamEmpty}</li>}
            {members.map((id) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <li key={id}>
                  <TeamMember player={p} locked={e.teamsLocked} onMove={() => api.send({ t: "evening.setTeam", playerId: id, team: (team + 1) % teams.length })} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TeamMember(props: { player: Player; locked: boolean; onMove: () => void }) {
  const { player: p } = props;
  const content = (
    <>
      <span class="avatar avatar-small" aria-hidden="true">
        {avatarEmoji(p.avatar)}
      </span>
      <span class="player-name">{p.name}</span>
    </>
  );
  const cls = `team-member ${p.connected ? "" : "is-offline"}`;
  if (props.locked) {
    return (
      <span class={cls} style={{ "--pc": playerColorVar(p.color) }} data-testid="team-member" data-player-id={p.id}>
        {content}
      </span>
    );
  }
  return (
    <button class={cls} style={{ "--pc": playerColorVar(p.color) }} data-nav="teams" data-testid="team-member" data-player-id={p.id} onClick={props.onMove}>
      {content}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Ergebnis: Wertungsspalte
// ---------------------------------------------------------------------------

function RowLabel(props: { row: EveningRow }) {
  const { row } = props;
  if (row.team !== null) {
    return (
      <>
        <span class="avatar avatar-small" style={{ "--pc": teamColorVar(row.team) }} aria-hidden="true">
          {teamEmoji(row.team)}
        </span>
        <span class="rank-name">{teamName(row.team)}</span>
      </>
    );
  }
  return (
    <>
      <span class="avatar avatar-small" style={{ "--pc": playerColorVar(row.player?.color ?? 0) }} aria-hidden="true">
        {avatarEmoji(row.avatar ?? "")}
      </span>
      <span class="rank-name">{row.name ?? t.evening.formerPlayer}</span>
    </>
  );
}

export function EveningSide(props: { room: RoomState }) {
  const { room } = props;
  const rows = eveningRows(room);
  const awards = new Map(lastAwards(room).map((a) => [a.key, a.points]));
  const last = room.evening?.rounds.at(-1);
  return (
    <aside class="evening-side" data-testid="evening-side">
      <h2>
        {t.evening.sideHeading}
        {last?.double && <span class="evening-final-badge">{t.evening.finalBadge}</span>}
      </h2>
      <p class="muted small">{t.evening.standings}</p>
      <ol class="evening-table">
        {rows.slice(0, 8).map((row, i) => {
          const award = awards.get(row.key);
          return (
            <li key={row.key} class="evening-row" style={{ "--delay": `${0.4 + i * 0.08}s` }} data-testid="evening-row" data-key={row.key} data-points={row.points}>
              <span class="rank-num">{fill(t.results.rank, { n: row.rank })}</span>
              <RowLabel row={row} />
              {award !== undefined && <span class="evening-award">{fill(t.evening.award, { n: award })}</span>}
              <span class="rank-score">{row.points}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Siegerehrung
// ---------------------------------------------------------------------------

export function EveningFinale(props: { room: RoomState; catalog: readonly GameManifest[] }) {
  const { room, catalog } = props;
  const api = useApi();
  const [planning, setPlanning] = useState(false);
  const rows = eveningRows(room);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const winners = rows.filter((r) => r.rank === 1);
  const end = (): void => api.send({ t: "evening.end" });
  useBack(BACK_LEVEL.screen, () => {
    end();
    return true;
  });

  return (
    <div class="screen results evening-finale" data-testid="evening-finale">
      <div class="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} style={{ "--i": i }} />
        ))}
      </div>
      <header class="results-head">
        <span class="results-icon" aria-hidden="true">
          🏆
        </span>
        <div>
          <h1>{t.evening.finaleTitle}</h1>
          <p class="muted">{plural(t.evening.finaleGames, room.evening?.rounds.length ?? 0)}</p>
        </div>
      </header>
      <p class="finale-winner" data-testid="finale-winner">
        {winners.map((w) => (w.team !== null ? `${teamEmoji(w.team)} ${teamName(w.team)}` : (w.name ?? t.evening.formerPlayer))).join(" & ")}
      </p>
      <ol class="podium">
        {podium.map((r, i) => {
          const color = r.team !== null ? teamColorVar(r.team) : playerColorVar(r.player?.color ?? 0);
          return (
            <li key={r.key} class={`podium-place place-${i + 1}`} style={{ "--pc": color }} data-testid="finale-row" data-key={r.key} data-rank={r.rank}>
              <span class="avatar podium-avatar" aria-hidden="true">
                {r.team !== null ? teamEmoji(r.team) : avatarEmoji(r.avatar ?? "")}
              </span>
              <span class="podium-name">{r.team !== null ? teamName(r.team) : (r.name ?? t.evening.formerPlayer)}</span>
              <span class="podium-score">{pointsText(r.points)}</span>
              <span class="podium-block">
                <span class="podium-rank">{fill(t.results.rank, { n: r.rank })}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {rest.length > 0 && (
        <ol class="ranking">
          {rest.map((r) => (
            <li key={r.key} class="rank-row" style={{ "--pc": r.team !== null ? teamColorVar(r.team) : playerColorVar(r.player?.color ?? 0) }} data-testid="finale-row" data-key={r.key} data-rank={r.rank}>
              <span class="rank-num">{fill(t.results.rank, { n: r.rank })}</span>
              <RowLabel row={r} />
              <span class="rank-score">{pointsText(r.points)}</span>
            </li>
          ))}
        </ol>
      )}
      <div class="button-row results-actions">
        <button class="btn btn-primary" data-nav="finale" data-nav-autofocus data-testid="finale-done" onClick={end}>
          {t.evening.done}
        </button>
        <button class="btn" data-nav="finale" data-testid="finale-new" onClick={() => setPlanning(true)}>
          {t.evening.newEvening}
        </button>
      </div>
      {planning && <EveningSetup room={room} catalog={catalog} onClose={() => setPlanning(false)} />}
    </div>
  );
}
