import { render } from "preact";
import { App } from "./App.js";
import { createApp } from "./app.js";
import { registerServiceWorker } from "./sw-register.js";
import "./styles.css";

// iOS ignoriert user-scalable=no: Pinch-Zoom per Gesture-Events unterbinden.
document.addEventListener("gesturestart", (e) => e.preventDefault());

const root = document.getElementById("app");
if (root) render(<App app={createApp()} />, root);

if (import.meta.env.PROD) registerServiceWorker();
