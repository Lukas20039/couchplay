// Preact-Anbindung an den AppController.
import { createContext } from "preact";
import { useContext, useEffect, useReducer } from "preact/hooks";
import type { AppController } from "./app.js";
import type { AppState } from "./state/store.js";

export const AppContext = createContext<AppController | null>(null);

export function useApp(): AppController {
  const app = useContext(AppContext);
  if (!app) throw new Error("AppContext fehlt");
  return app;
}

/** Aktueller Zustand; rendert bei jeder Änderung neu (die App ist klein). */
export function useAppState(): AppState {
  const app = useApp();
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const unsubscribe = app.store.subscribe(() => force(undefined));
    // Änderungen zwischen erstem Render und diesem Effekt (z. B. Rejoin-Antworten
    // nach einem Reload) wären sonst verloren, bis der nächste Zustand kommt.
    force(undefined);
    return unsubscribe;
  }, [app]);
  return app.store.getState();
}
