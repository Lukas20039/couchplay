// App-weite Abhängigkeiten für Komponenten (Senden, Serverzeit, Neustart).
import { createContext } from "preact";
import { useContext, useEffect, useRef } from "preact/hooks";
import type { ClientMessage } from "@couchplay/protocol";
import { tvNav } from "../nav/navigator.js";

export interface AppApi {
  send(msg: ClientMessage): void;
  serverNow(): number;
  retryNow(): void;
  newRoom(): void;
  reload(): void;
}

export const ApiContext = createContext<AppApi | null>(null);

export function useApi(): AppApi {
  const api = useContext(ApiContext);
  if (!api) throw new Error("ApiContext fehlt");
  return api;
}

/** Ebenen für Zurück-Handler: höhere Ebene gewinnt. */
export const BACK_LEVEL = { screen: 1, overlay: 2 } as const;

/**
 * Registriert einen Zurück-Handler, solange die Komponente gemountet ist.
 * Handler gibt true zurück, wenn er die Taste verbraucht hat.
 */
export function useBack(level: number, handler: () => boolean, active = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    return tvNav.addBack(level, () => ref.current());
  }, [level, active]);
}
