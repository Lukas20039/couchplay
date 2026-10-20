package at.couchplay.tv

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * JS-Brücke `window.CouchPlayNative` für tv-web und die lokale Fehlerseite.
 * Aufrufe kommen auf einem WebView-Hintergrundthread an → auf den UI-Thread posten.
 * Dort prüft der Host, ob die aktuell geladene Seite vertrauenswürdig ist (Server-Origin
 * oder eigene Fehlerseite); sonst wird der Aufruf ignoriert.
 */
class NativeBridge(private val host: Host) {
    interface Host {
        /** Läuft im UI-Thread: gehört die aktuelle Seite zum Server bzw. ist es die Fehlerseite? */
        fun isTrustedPage(): Boolean
        fun exitApp()
        fun openSettings()
        fun retry()
    }

    private val main = Handler(Looper.getMainLooper())

    /** Web-App ist auf der Startseite und Zurück wurde gedrückt → App beenden. */
    @JavascriptInterface
    fun exitApp() {
        onUi { host.exitApp() }
    }

    /** Einstellungen (Server-Adresse) öffnen. */
    @JavascriptInterface
    fun openSettings() {
        onUi { host.openSettings() }
    }

    /** Fehlerseite: erneut versuchen. */
    @JavascriptInterface
    fun retry() {
        onUi { host.retry() }
    }

    private fun onUi(action: () -> Unit) {
        main.post { if (host.isTrustedPage()) action() }
    }

    companion object {
        const val NAME = "CouchPlayNative"
    }
}
