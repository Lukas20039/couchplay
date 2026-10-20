// Test-Harness für Spiele: führt eine GameDefinition mit virtueller Uhr und
// festem Seed aus und zeichnet alle Ausgaben auf. Nur in Tests verwenden.
import { AVATAR_IDS, defaultSettings, validateSettings, type GameResults, type PlayerId, type SettingsValues } from "@couchplay/protocol";
import { ManualClock } from "./clock.js";
import type { AnyGameDefinition, GamePlayer } from "./definition.js";
import { createGameSession, type GameSession, type InputResult } from "./session.js";

/** Erzeugt n Testspieler p1..pn. */
export function makePlayers(n: number): GamePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Spieler ${i + 1}`,
    avatar: AVATAR_IDS[i % AVATAR_IDS.length] as (typeof AVATAR_IDS)[number],
    color: i % 8,
  }));
}

export interface HarnessOptions {
  /** Anzahl oder konkrete Spieler. Standard: manifest.minPlayers. */
  players?: number | GamePlayer[];
  /** Teilmenge der Settings; Rest = Defaults. Ungültige Werte → Exception. */
  settings?: SettingsValues;
  /** Standard: 42. */
  seed?: number;
  /** Simuliert eine Vorrunde (ctx.previous). */
  previous?: GameResults | null;
}

export interface GameHarness<TTv = unknown, TView = unknown> {
  readonly session: GameSession;
  readonly clock: ManualClock;
  readonly players: GamePlayer[];
  /** Alle gesendeten TV-Zustände in Reihenfolge. */
  readonly tvStates: TTv[];
  /** Alle gesendeten Ansichten je Spieler. */
  readonly views: Map<PlayerId, TView[]>;
  /** Ergebnis nach ctx.end(), sonst null. */
  results: GameResults | null;
  /** Exception aus dem Spielcode, sonst null. */
  crash: unknown;
  lastTv(): TTv | undefined;
  lastView(playerId: PlayerId): TView | undefined;
  input(playerId: PlayerId, data: unknown): InputResult;
  /** Virtuelle Zeit vorspulen (feuert Timer/Ticks). */
  advance(ms: number): void;
  leave(playerId: PlayerId): void;
  setConnected(playerId: PlayerId, connected: boolean): void;
}

export function createTestHarness<TTv = unknown, TView = unknown>(
  def: AnyGameDefinition,
  options: HarnessOptions = {},
): GameHarness<TTv, TView> {
  const players = typeof options.players === "object" ? options.players : makePlayers(options.players ?? def.manifest.minPlayers);
  const validation = validateSettings(def.manifest.settings, options.settings ?? {}, defaultSettings(def.manifest.settings));
  if (!validation.ok) throw new Error(`Ungültige Test-Settings: ${JSON.stringify(validation.errors)}`);

  const clock = new ManualClock();
  const connected = new Map(players.map((p) => [p.id, true]));
  const tvStates: TTv[] = [];
  const views = new Map<PlayerId, TView[]>(players.map((p) => [p.id, []]));

  const harness = {
    clock,
    players,
    tvStates,
    views,
    results: null as GameResults | null,
    crash: null as unknown,
  } as GameHarness<TTv, TView> & { session: GameSession };

  const session = createGameSession(def, {
    players,
    settings: validation.settings,
    seed: options.seed ?? 42,
    previous: options.previous ?? null,
    clock,
    isConnected: (id) => connected.get(id) ?? false,
    sink: {
      tv: (state) => tvStates.push(structuredClone(state) as TTv),
      player: (id, view) => views.get(id)?.push(structuredClone(view) as TView),
      end: (results) => {
        harness.results = results;
      },
      crash: (error) => {
        harness.crash = error;
      },
    },
  });

  return Object.assign(harness, {
    session,
    lastTv: () => tvStates.at(-1),
    lastView: (id: PlayerId) => views.get(id)?.at(-1),
    input: (id: PlayerId, data: unknown) => session.input(id, data),
    advance: (ms: number) => clock.advance(ms),
    leave: (id: PlayerId) => session.playerLeft(id),
    setConnected: (id: PlayerId, value: boolean) => {
      connected.set(id, value);
      session.connectionChanged(id, value);
    },
  });
}
