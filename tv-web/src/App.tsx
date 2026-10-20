// GERÜST (Phase 1). Wird vom Frontend-Agent ersetzt.
import { t } from "./i18n/index.js";

export function App() {
  return (
    <main>
      <h1>{t.appName}</h1>
      <p>{t.placeholder}</p>
    </main>
  );
}
