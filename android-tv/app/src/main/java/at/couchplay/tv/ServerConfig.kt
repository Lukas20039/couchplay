package at.couchplay.tv

import android.content.Context
import android.net.Uri

/**
 * Server-Adresse der TV-App: Build-Default (BuildConfig.SERVER_URL) oder vom Nutzer
 * in den Einstellungen gesetzt (SharedPreferences).
 */
object ServerConfig {
    private const val PREFS = "couchplay"
    private const val KEY_SERVER_URL = "server_url"

    /** Pfad der TV-Web-UI auf dem Server (entspricht TV_PATH im Protokoll-Paket). */
    const val TV_PATH = "/tv/"

    val defaultUrl: String get() = normalize(BuildConfig.SERVER_URL) ?: BuildConfig.SERVER_URL

    fun serverUrl(context: Context): String {
        val stored = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SERVER_URL, null)
        return stored?.let { normalize(it) } ?: defaultUrl
    }

    fun tvUrl(context: Context): String = serverUrl(context) + TV_PATH

    /** Speichert eine Adresse; null/leer = Standard. Gibt false bei ungültiger Eingabe zurück. */
    fun setServerUrl(context: Context, raw: String?): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        if (raw.isNullOrBlank()) {
            prefs.remove(KEY_SERVER_URL).apply()
            return true
        }
        val url = normalize(raw) ?: return false
        if (url == defaultUrl) prefs.remove(KEY_SERVER_URL) else prefs.putString(KEY_SERVER_URL, url)
        prefs.apply()
        return true
    }

    /**
     * Prüft und vereinheitlicht eine Adresse: nur http/https mit Host, ohne Query/Fragment,
     * ohne abschließenden Slash. Fehlt das Schema, wird http:// angenommen (Heimnetz).
     */
    fun normalize(raw: String): String? {
        var text = raw.trim()
        if (text.isEmpty()) return null
        if (!text.contains("://")) text = "http://$text"
        val uri = runCatching { Uri.parse(text) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase() ?: return null
        if (scheme != "http" && scheme != "https") return null
        val host = uri.host ?: return null
        if (host.isEmpty() || host.contains(' ')) return null
        val port = if (uri.port != -1) ":${uri.port}" else ""
        val path = (uri.path ?: "").trimEnd('/')
        // /tv/ gehört nicht zur Server-Adresse – falls jemand die volle TV-URL einträgt.
        val cleanPath = path.removeSuffix("/tv")
        return "$scheme://$host$port$cleanPath"
    }
}
