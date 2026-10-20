// Clientseitige Spielmodul-Schnittstelle. Framework-neutral: Ein Spiel liefert
// je eine Factory für die TV-View und die Controller-View. Die Apps (tv-web,
// controller-pwa) laden diese per dynamischem import() nach und rufen
// mount → update* → unmount auf. Spiele dürfen intern Preact verwenden
// (siehe "@couchplay/game-sdk/preact").
import type { GameId, Player, PlayerId, SettingsValues } from "@couchplay/protocol";

/** Gemeinsame API, die die App einer View beim mount übergibt. */
export interface ViewApiBase {
  readonly gameId: GameId;
  /** Settings der aktuellen Runde. */
  readonly settings: SettingsValues;
  /** Aktuelle Spielerliste des Raums (live; Namen, Farben, connected). */
  getPlayers(): readonly Player[];
  /** Teilnehmer-IDs der laufenden Runde. */
  getGamePlayerIds(): readonly PlayerId[];
  /** Serverzeit-Schätzung in ms (für Countdowns mit endsAt). */
  serverNow(): number;
}

export interface TvViewApi extends ViewApiBase {
  /** TV-Viewport ist 1920×1080-basiert; Views skalieren über CSS (rem). */
  readonly kind: "tv";
}

export interface ControllerViewApi<TInput = unknown> extends ViewApiBase {
  readonly kind: "controller";
  readonly playerId: PlayerId;
  isHost(): boolean;
  /** Sendet game.input { data: input }. Fehler (INVALID_INPUT) kommen über onError. */
  sendInput(input: TInput): void;
  /** Haptisches Feedback, falls verfügbar (no-op auf iOS). */
  vibrate(pattern: number | number[]): void;
}

/** TV-Ansicht eines Spiels. Erhält ausschließlich ctx.broadcastTv-Zustände. */
export interface GameTvView<TTvState = unknown> {
  mount(el: HTMLElement, api: TvViewApi): void;
  /** Neuer vollständiger Zustand (auch direkt nach mount, falls vorhanden). */
  update(state: TTvState): void;
  /** Optional: Spielerliste hat sich geändert (Name, connected, ...). */
  playersChanged?(players: readonly Player[]): void;
  unmount(): void;
}

/** Controller-Ansicht eines Spiels. Erhält ausschließlich die eigene ctx.sendToPlayer-Ansicht. */
export interface GameControllerView<TPlayerView = unknown, TInput = unknown> {
  mount(el: HTMLElement, api: ControllerViewApi<TInput>): void;
  update(view: TPlayerView): void;
  playersChanged?(players: readonly Player[]): void;
  /** Optional: Server hat eine Eingabe abgelehnt. */
  onError?(code: string, message: string): void;
  unmount(): void;
}

export type TvViewFactory<TTvState = unknown> = () => GameTvView<TTvState>;
export type ControllerViewFactory<TPlayerView = unknown, TInput = unknown> = () => GameControllerView<TPlayerView, TInput>;

/**
 * Modulkonvention (default export):
 *   games/<id>/src/tv/index.ts(x)         → export default <TvViewFactory>
 *   games/<id>/src/controller/index.ts(x) → export default <ControllerViewFactory>
 * Die Apps registrieren Loader: `{ quiz: () => import("@couchplay/game-quiz/tv") }`.
 */
export type ViewModuleLoader<TFactory> = () => Promise<{ default: TFactory }>;

export interface ClientGameRegistry {
  tv: Record<GameId, ViewModuleLoader<TvViewFactory>>;
  controller: Record<GameId, ViewModuleLoader<ControllerViewFactory>>;
}
