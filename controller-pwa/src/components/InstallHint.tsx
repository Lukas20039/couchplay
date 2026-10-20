// Dezenter Hinweis „Zum Home-Bildschirm“ – nur iOS-Safari, nur außerhalb des Standalone-Modus.
// (Android Chrome bietet die Installation selbst an.)
import { useState } from "preact/hooks";
import { t } from "../i18n/index.js";
import { isIos, isStandalone } from "../lib/platform.js";
import { dismissInstallHint, isInstallHintDismissed } from "../lib/storage.js";

export function InstallHint() {
  const [show, setShow] = useState(() => isIos() && !isStandalone() && !isInstallHintDismissed());
  if (!show) return null;
  return (
    <p class="install" data-testid="install-hint">
      <span>{t.install.ios}</span>
      <button
        type="button"
        class="install__x"
        aria-label={t.install.dismiss}
        onClick={() => {
          dismissInstallHint();
          setShow(false);
        }}
      >
        ×
      </button>
    </p>
  );
}
