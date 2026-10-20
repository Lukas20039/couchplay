package at.couchplay.tv

import android.content.Context
import android.net.Uri
import java.util.Locale

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
     * Prüft und vereinheitlicht eine Adresse: nur http/https mit Host, Host kleingeschrieben,
     * Standard-Ports (80/443) entfernt, ohne Query/Fragment und abschließenden Slash.
     * Fehlt das Schema: http:// für lokale Adressen (private IPs, localhost, *.local, Namen ohne Punkt),
     * sonst https:// (öffentliche Hosts laufen hinter einem HTTPS-Proxy).
     */
    fun normalize(raw: String): String? {
        var text = raw.trim()
        if (text.isEmpty()) return null
        if (!text.contains("://")) {
            val hostPart = text.substringBefore('/').substringBefore(':').lowercase(Locale.ROOT)
            text = (if (isLocalHost(hostPart)) "http://" else "https://") + text
        }
        val uri = runCatching { Uri.parse(text) }.getOrNull() ?: return null
        val origin = Origin.of(uri) ?: return null
        val path = (uri.path ?: "").trimEnd('/')
        // /tv gehört nicht zur Server-Adresse – falls jemand die volle TV-URL einträgt.
        val cleanPath = path.removeSuffix("/tv")
        return origin.toString() + cleanPath
    }

    /** Heimnetz-/Test-Adressen, für die ohne Schema HTTP angenommen wird. */
    fun isLocalHost(host: String): Boolean {
        val h = host.lowercase(Locale.ROOT).trim('[', ']')
        if (h == "localhost" || h.endsWith(".local") || h.endsWith(".lan") || h.endsWith(".home.arpa")) return true
        if (!h.contains('.') && !h.contains(':')) return true // einfacher Rechnername
        val parts = h.split('.').mapNotNull { it.toIntOrNull() }
        if (parts.size == 4) {
            val (a, b) = parts[0] to parts[1]
            return a == 10 || a == 127 || (a == 192 && b == 168) || (a == 172 && b in 16..31) || (a == 169 && b == 254)
        }
        return h.startsWith("fe80:") || h.startsWith("fd") || h == "::1"
    }
}

/** Schema + Host (kleingeschrieben) + effektiver Port – Vergleich unabhängig von Schreibweise/Standard-Port. */
data class Origin(val scheme: String, val host: String, val port: Int) {
    override fun toString(): String {
        val defaultPort = if (scheme == "https") 443 else 80
        val hostText = if (host.contains(':')) "[$host]" else host
        return if (port == defaultPort) "$scheme://$hostText" else "$scheme://$hostText:$port"
    }

    fun sameHost(other: Origin): Boolean = host.equals(other.host, ignoreCase = true)

    companion object {
        fun of(uri: Uri?): Origin? {
            uri ?: return null
            val scheme = uri.scheme?.lowercase(Locale.ROOT) ?: return null
            if (scheme != "http" && scheme != "https") return null
            val host = uri.host?.lowercase(Locale.ROOT)?.trim('[', ']') ?: return null
            if (host.isEmpty() || host.contains(' ')) return null
            val port = if (uri.port != -1) uri.port else if (scheme == "https") 443 else 80
            return Origin(scheme, host, port)
        }

        fun of(url: String?): Origin? = url?.let { runCatching { Uri.parse(it) }.getOrNull() }?.let { of(it) }
    }
}
