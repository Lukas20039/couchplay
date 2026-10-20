import { render } from "preact";
import { App } from "./App.js";
import { tvNav } from "./nav/navigator.js";
import { TvClient, wsUrlFromLocation } from "./net/client.js";
import { createStore } from "./state/store.js";
import "./styles.css";

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = createStore();
const client = new TvClient({ url: wsUrlFromLocation(location), dispatch: store.dispatch, storage: safeStorage() });

tvNav.install(window);
client.start();

// Netz wieder da / App wieder sichtbar → aktiv prüfen statt auf Backoff/Heartbeat zu warten.
const wake = (): void => client.probe();
window.addEventListener("online", wake);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") wake();
});

const root = document.getElementById("app");
if (root) render(<App store={store} client={client} />, root);
