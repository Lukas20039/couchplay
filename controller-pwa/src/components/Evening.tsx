// Spieleabend am Handy: Planer (Host), Abend-Karte mit Spielplan und Teams (alle),
// Abendwertung im Ergebnis und Siegerehrung nach dem letzten Spiel.
import type { Evening, GameManifest, Player, RoomState } from "@couchplay/protocol";
import { EVENING_MAX_GAMES, EVENING_MIN_GAMES, TEAM_EMOJI, avatarEmoji } from "@couchplay/protocol/constants";
import { eveningCurrentGame, eveningFinished, eveningIsFinal, teamOfKey, teamOfPlayer } from "@couchplay/protocol/evening";
import { useState } from "preact/hooks";
import { useApp, useAppState } from "../hooks.js";
import { t } from "../i18n/index.js";
import { Avatar } from "./common.js";
import { ConfirmDialog } from "./ConfirmDialog.js";

export const teamName = (team: number): string => t.evening.teamNames[team] ?? `Team ${team + 1}`;
const teamColor = (team: number): string => `var(--p${team % 4})`;
const teamLabel = (team: number): string => `${TEAM_EMOJI[team] ?? "⭐"} ${teamName(team)}`;

/** Siegerehrung zeigen: Abend fertig und wieder in der Lobby. */
export function showFinale(room: RoomState | null): boolean {
  return !!room?.evening && room.phase === "lobby" && eveningFinished(room.evening);
}

/** Planer-Auswahl umschalten (Reihenfolge = Tippreihenfolge). */
export function toggleGame(selection: readonly string[], id: string): string[] {
  if (selection.includes(id)) return selection.filter((x) => x !== id);
  return selection.length >= EVENING_MAX_GAMES ? [...selection] : [...selection, id];
}

/** Startvorschlag: bis zu 5 Spiele, die zur Spielerzahl passen. */
export function suggestGames(catalog: readonly GameManifest[], players: number): string[] {
  const n = Math.max(1, players);
  const fitting = catalog.filter((g) => g.minPlayers <= n && g.maxPlayers >= Math.min(n, 2));
  return (fitting.length >= 2 ? fitting : catalog).slice(0, 5).map((g) => g.id);
}

/** Text des Start-Buttons im Abend. */
export function eveningStartLabel(e: Evening): string {
  return eveningIsFinal(e) ? t.evening.startFinal : t.evening.startGame(e.rounds.length + 1);
}

// ---------------------------------------------------------------------------
// Planer (Host)
// ---------------------------------------------------------------------------

export function EveningPlanner({ onClose }: { onClose(): void }) {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const connected = room.players.filter((p) => p.connected).length;
  const [games, setGames] = useState(() => suggestGames(s.catalog, connected));
  const [teams, setTeams] = useState(0);
  const [doubleFinal, setDoubleFinal] = useState(true);
  const ok = games.length >= EVENING_MIN_GAMES && games.length <= EVENING_MAX_GAMES;
  const modes = [0, 2, 3, 4];

  return (
    <section class="panel evening-planner" aria-labelledby="evening-h" data-testid="evening-planner">
      <h2 id="evening-h" class="subtitle">
        {t.evening.heading}
      </h2>
      <p class="hint">{t.evening.gamesHint}</p>
      <div class="evening-picks">
        {s.catalog.map((g) => {
          const pos = games.indexOf(g.id);
          return (
            <button
              key={g.id}
              type="button"
              role="checkbox"
              aria-checked={pos >= 0}
              class={`evening-pick${pos >= 0 ? " evening-pick--on" : ""}`}
              style={g.accentColor ? { "--a": g.accentColor } : undefined}
              data-testid={`evening-game-${g.id}`}
              onClick={() => setGames(toggleGame(games, g.id))}
            >
              <span class="evening-pick__order">{pos >= 0 ? pos + 1 : ""}</span>
              <span class="evening-pick__icon" aria-hidden="true">
                {g.icon ?? "🎮"}
              </span>
              <span class="evening-pick__name">{g.name}</span>
            </button>
          );
        })}
      </div>
      <div class="setting" role="group" aria-labelledby="evening-mode">
        <span id="evening-mode" class="setting__label">
          {t.evening.mode}
        </span>
        <div class="segmented segmented--wrap">
          {modes.map((n, i) => {
            const disabled = n > 0 && connected < n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={teams === n}
                disabled={disabled}
                class={`segmented__opt${teams === n ? " segmented__opt--on" : ""}`}
                data-testid={`evening-mode-${n}`}
                onClick={() => setTeams(n)}
              >
                {t.evening.modes[i]}
              </button>
            );
          })}
        </div>
      </div>
      <div class="setting setting--row">
        <span id="evening-double" class="setting__label">
          {t.evening.doubleFinal}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={doubleFinal}
          aria-labelledby="evening-double"
          class={`switch${doubleFinal ? " switch--on" : ""}`}
          data-testid="evening-double"
          onClick={() => setDoubleFinal(!doubleFinal)}
        >
          <span class="switch__knob" />
        </button>
      </div>
      <div class="evening-planner__actions">
        <button
          type="button"
          class="btn btn--primary"
          disabled={!ok}
          data-testid="evening-start"
          onClick={() => {
            app.send({ t: "evening.start", games, teams, doubleFinal });
            onClose();
          }}
        >
          {t.evening.start}
        </button>
        <button type="button" class="btn btn--ghost" onClick={onClose}>
          {t.evening.cancel}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Lobby: Abend-Karte
// ---------------------------------------------------------------------------

export function EveningCard() {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const e = room.evening!;
  const host = room.hostId === s.playerId;
  const [askEnd, setAskEnd] = useState(false);
  const done = e.rounds.length;
  const byGame = new Map(s.catalog.map((g) => [g.id, g]));
  const myTeam = s.playerId ? teamOfPlayer(e, s.playerId) : null;

  return (
    <section class="panel evening" data-testid="evening-card">
      <div class="evening__head">
        <h2 class="subtitle">{t.evening.title}</h2>
        <span class="evening__progress">
          {t.evening.progress(Math.min(done + 1, e.games.length), e.games.length)}
          {eveningIsFinal(e) && <span class="evening__badge">{t.evening.finalBadge}</span>}
        </span>
      </div>
      <ol class="evening__plan">
        {e.games.map((id, i) => {
          const g = byGame.get(id);
          const state = i < done ? "done" : i === done ? "current" : "todo";
          return (
            <li key={`${i}-${id}`} class={`evening__game evening__game--${state}`} style={g?.accentColor ? { "--a": g.accentColor } : undefined} data-state={state}>
              <span aria-hidden="true">{state === "done" ? "✓" : (g?.icon ?? "🎮")}</span>
              {g?.name ?? id}
            </li>
          );
        })}
      </ol>
      {e.teams ? (
        <TeamPicker room={room} evening={e} myTeam={myTeam} />
      ) : (
        <Standings room={room} evening={e} selfId={s.playerId} />
      )}
      {host && e.teams && !e.teamsLocked && (
        <button type="button" class="btn btn--ghost btn--small" data-testid="evening-shuffle" onClick={() => app.send({ t: "evening.shuffle" })}>
          {t.evening.shuffle}
        </button>
      )}
      {host && (
        <button type="button" class="link link--quiet" data-testid="evening-end" onClick={() => setAskEnd(true)}>
          {t.evening.end}
        </button>
      )}
      {askEnd && (
        <ConfirmDialog
          text={t.evening.endConfirm}
          confirmLabel={t.evening.endYes}
          cancelLabel={t.dialog.cancel}
          onConfirm={() => {
            setAskEnd(false);
            app.send({ t: "evening.end" });
          }}
          onCancel={() => setAskEnd(false)}
        />
      )}
    </section>
  );
}

function TeamPicker({ room, evening, myTeam }: { room: RoomState; evening: Evening; myTeam: number | null }) {
  const app = useApp();
  const s = useAppState();
  const byId = new Map(room.players.map((p) => [p.id, p]));
  const locked = evening.teamsLocked;
  return (
    <>
      <div class="teams" data-testid="team-picker">
        {(evening.teams ?? []).map((members, team) => {
          const mine = team === myTeam;
          const points = evening.standings.find((x) => teamOfKey(x.key) === team)?.points ?? 0;
          const body = (
            <>
              <span class="team__head">
                <span class="team__name">{teamLabel(team)}</span>
                <span class="team__points">{t.evening.points(points)}</span>
              </span>
              <span class="team__members">
                {members.length === 0 && <span class="hint">{t.evening.empty}</span>}
                {members.map((id) => {
                  const p = byId.get(id);
                  return p ? <MemberChip key={id} player={p} self={id === s.playerId} /> : null;
                })}
              </span>
              {mine ? <span class="team__you">{t.evening.yourTeam}</span> : !locked && <span class="team__join">{t.evening.join}</span>}
            </>
          );
          const cls = `team${mine ? " team--mine" : ""}`;
          return locked || mine || !s.playerId ? (
            <div key={team} class={cls} style={{ "--c": teamColor(team) }} data-testid={`team-${team}`}>
              {body}
            </div>
          ) : (
            <button
              key={team}
              type="button"
              class={cls}
              style={{ "--c": teamColor(team) }}
              data-testid={`team-${team}`}
              onClick={() => app.send({ t: "evening.setTeam", playerId: s.playerId!, team })}
            >
              {body}
            </button>
          );
        })}
      </div>
      <p class="hint">{locked ? t.evening.teamsLocked : t.evening.teamHint}</p>
    </>
  );
}

function MemberChip({ player, self }: { player: Player; self: boolean }) {
  return (
    <span class={`team__member${self ? " team__member--self" : ""}${player.connected ? "" : " player--away"}`}>
      <Avatar player={player} size="s" />
      {player.name}
    </span>
  );
}

/** Gesamtwertung (Teams oder Spieler). `awards` = Punkte der letzten Runde. */
export function Standings({ room, evening, selfId, awards }: { room: RoomState; evening: Evening; selfId: string | null; awards?: ReadonlyMap<string, number> }) {
  const byId = new Map(room.players.map((p) => [p.id, p]));
  const myTeam = selfId ? teamOfPlayer(evening, selfId) : null;
  return (
    <ol class="ranking evening__standings" data-testid="evening-standings">
      {evening.standings.map((row) => {
        const team = teamOfKey(row.key);
        const p = team === null ? byId.get(row.key) : undefined;
        const me = team === null ? row.key === selfId : team === myTeam;
        const award = awards?.get(row.key);
        return (
          <li
            key={row.key}
            class={`ranking__row${me ? " ranking__row--me" : ""}`}
            style={{ "--c": team !== null ? teamColor(team) : p ? `var(--p${p.color})` : "var(--line)" }}
            data-testid="evening-row"
            data-key={row.key}
          >
            <span class="ranking__rank">{row.rank}</span>
            {team !== null ? (
              <span class="avatar avatar--s" style={{ "--c": teamColor(team) }} aria-hidden="true">
                {TEAM_EMOJI[team] ?? "⭐"}
              </span>
            ) : p ? (
              <Avatar player={p} size="s" />
            ) : (
              <span class="avatar avatar--s" aria-hidden="true">
                {avatarEmoji(row.avatar ?? "")}
              </span>
            )}
            <span class="ranking__name">{team !== null ? teamName(team) : (p?.name ?? row.name ?? t.evening.formerPlayer)}</span>
            {award !== undefined && <span class="evening__award">+{award}</span>}
            <span class="ranking__score">{row.points}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Ergebnis: Abendpunkte dieser Runde + Gesamtwertung
// ---------------------------------------------------------------------------

export function EveningResults() {
  const s = useAppState();
  const room = s.room!;
  const e = room.evening!;
  const last = e.rounds.at(-1);
  const awards = new Map((last?.awards ?? []).map((a) => [a.key, a.points]));
  const myTeam = s.playerId ? teamOfPlayer(e, s.playerId) : null;
  const myKey = e.teams ? (myTeam !== null ? `team:${myTeam}` : null) : s.playerId;
  const mine = myKey ? awards.get(myKey) : undefined;
  return (
    <section class="panel evening evening--results" data-testid="evening-results">
      <p class="evening__mine" data-testid="evening-award">
        {mine === undefined ? t.evening.noAward : e.teams && myTeam !== null ? t.evening.awardTeam(teamName(myTeam), mine) : t.evening.award(mine)}
        {last?.double && <span class="evening__badge">{t.evening.finalBadge}</span>}
      </p>
      <h2 class="subtitle">{t.evening.standings}</h2>
      <Standings room={room} evening={e} selfId={s.playerId} awards={awards} />
    </section>
  );
}

/** Nächstes Spiel des Plans (für „Weiter: …“). */
export function nextGameName(room: RoomState, catalog: readonly GameManifest[]): string | null {
  const id = room.evening ? eveningCurrentGame(room.evening) : null;
  return (id && catalog.find((g) => g.id === id)?.name) || null;
}

// ---------------------------------------------------------------------------
// Siegerehrung
// ---------------------------------------------------------------------------

export function EveningFinale() {
  const app = useApp();
  const s = useAppState();
  const room = s.room!;
  const e = room.evening!;
  const host = room.hostId === s.playerId;
  const [planning, setPlanning] = useState(false);
  const myTeam = s.playerId ? teamOfPlayer(e, s.playerId) : null;
  const myKey = e.teams ? (myTeam !== null ? `team:${myTeam}` : null) : s.playerId;
  const mine = e.standings.find((x) => x.key === myKey);
  const winners = e.standings.filter((x) => x.rank === 1);
  const winnerText = winners
    .map((w) => {
      const team = teamOfKey(w.key);
      if (team !== null) return teamLabel(team);
      return room.players.find((p) => p.id === w.key)?.name ?? w.name ?? t.evening.formerPlayer;
    })
    .join(" & ");

  return (
    <main class="screen screen--results">
      <section class="results" data-testid="evening-finale">
        <h1 class="subtitle">🏆 {t.evening.finaleTitle}</h1>
        <p class="finale__winner" data-testid="finale-winner">
          {winnerText}
        </p>
        {mine && (
          <div class={`place${mine.rank === 1 ? " place--first" : ""}`}>
            <span class="place__rank">{t.evening.yourFinalPlace(mine.rank)}</span>
            <span class="place__score">{t.evening.points(mine.points)}</span>
          </div>
        )}
        <Standings room={room} evening={e} selfId={s.playerId} />
        {host && planning && <EveningPlanner onClose={() => setPlanning(false)} />}
      </section>
      <footer class="actions">
        {host ? (
          <>
            <button type="button" class="btn btn--primary" data-testid="finale-done" onClick={() => app.send({ t: "evening.end" })}>
              {t.evening.done}
            </button>
            {!planning && (
              <button type="button" class="btn btn--ghost" data-testid="finale-new" onClick={() => setPlanning(true)}>
                {t.evening.newEvening}
              </button>
            )}
          </>
        ) : (
          <p class="hint">{t.results.waitHost}</p>
        )}
      </footer>
    </main>
  );
}
