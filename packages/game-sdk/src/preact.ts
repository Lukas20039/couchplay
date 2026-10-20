// Adapter: Preact-Komponente → GameTvView / GameControllerView.
// Optional – Spiele können die Schnittstelle auch ohne Preact implementieren.
import { h, render, type ComponentType } from "preact";
import type { Player } from "@couchplay/protocol";
import type {
  ControllerViewApi,
  ControllerViewFactory,
  GameControllerView,
  GameTvView,
  TvViewApi,
  TvViewFactory,
} from "./client.js";

export interface TvComponentProps<TTvState> {
  /** null, solange noch kein Zustand empfangen wurde. */
  state: TTvState | null;
  api: TvViewApi;
  players: readonly Player[];
}

export interface ControllerComponentProps<TPlayerView, TInput> {
  view: TPlayerView | null;
  api: ControllerViewApi<TInput>;
  players: readonly Player[];
  /** Letzter Fehler vom Server zu einer Eingabe (oder null). */
  error: { code: string; message: string } | null;
}

export function preactTvView<TTvState>(Component: ComponentType<TvComponentProps<TTvState>>): TvViewFactory<TTvState> {
  return (): GameTvView<TTvState> => {
    let el: HTMLElement | null = null;
    let api: TvViewApi | null = null;
    let state: TTvState | null = null;
    let players: readonly Player[] = [];
    const draw = (): void => {
      if (el && api) render(h(Component, { state, api, players }), el);
    };
    return {
      mount(target, a) {
        el = target;
        api = a;
        players = a.getPlayers();
        draw();
      },
      update(s) {
        state = s;
        draw();
      },
      playersChanged(p) {
        players = p;
        draw();
      },
      unmount() {
        if (el) render(null, el);
        el = null;
        api = null;
      },
    };
  };
}

export function preactControllerView<TPlayerView, TInput>(
  Component: ComponentType<ControllerComponentProps<TPlayerView, TInput>>,
): ControllerViewFactory<TPlayerView, TInput> {
  return (): GameControllerView<TPlayerView, TInput> => {
    let el: HTMLElement | null = null;
    let api: ControllerViewApi<TInput> | null = null;
    let view: TPlayerView | null = null;
    let players: readonly Player[] = [];
    let error: { code: string; message: string } | null = null;
    const draw = (): void => {
      if (el && api) render(h(Component, { view, api, players, error }), el);
    };
    return {
      mount(target, a) {
        el = target;
        api = a;
        players = a.getPlayers();
        draw();
      },
      update(v) {
        view = v;
        error = null;
        draw();
      },
      playersChanged(p) {
        players = p;
        draw();
      },
      onError(code, message) {
        error = { code, message };
        draw();
      },
      unmount() {
        if (el) render(null, el);
        el = null;
        api = null;
      },
    };
  };
}
