package at.couchplay.tv

import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface

/**
 * JS-Brücke `window.CouchPlayNative` für tv-web und die lokale Fehlerseite.
 * Aufrufe kommen auf einem WebView-Hintergrundthread an → auf den UI-Thread posten.
 */
class NativeBridge(private val host: Host) {
    interface Host {
        fun exitApp()
        fun openSettings()
        fun retry()
    }

    private val main = Handler(Looper.getMainLooper())

    /** Web-App ist auf der Startseite und Zurück wurde gedrückt → App beenden. */
    @JavascriptInterface
    fun exitApp() {
        main.post { host.exitApp() }
    }

    /** Einstellungen (Server-Adresse) öffnen. */
    @JavascriptInterface
    fun openSettings() {
        main.post { host.openSettings() }
    }

    /** Fehlerseite: erneut versuchen. */
    @JavascriptInterface
    fun retry() {
        main.post { host.retry() }
    }

    companion object {
        const val NAME = "CouchPlayNative"
    }
}
