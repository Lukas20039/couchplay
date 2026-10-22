package at.couchplay.tv

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.io.IOException
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

/**
 * Sucht CouchPlay-Server im eigenen Heimnetz: fragt alle Adressen des Subnetzes (höchstens /24)
 * auf den üblichen Ports unter DISCOVERY_PATH ab. Kein mDNS, weil Multicast das Standard-Docker-Netz
 * nicht verlässt – veröffentlichte TCP-Ports dagegen schon.
 */
object Discovery {
    /** Entspricht DISCOVERY_PATH/DISCOVERY_SERVICE im Protokoll-Paket. */
    private const val PATH = "/api/discover"
    private const val SERVICE = "couchplay"

    private const val CONNECT_TIMEOUT_MS = 500
    private const val READ_TIMEOUT_MS = 1500
    private const val THREADS = 64
    private const val MAX_BODY_BYTES = 4096

    /** Standard-Port des Containers und Port 80 (Container direkt auf 80 veröffentlicht). */
    private val DEFAULT_PORTS = listOf(8080, 80)

    /** Laufende Suche; cancel() bricht ab, ohne dass der Callback noch kommt. */
    class Search internal constructor(private val pool: ExecutorService) {
        internal val cancelled = AtomicBoolean(false)

        fun cancel() {
            cancelled.set(true)
            pool.shutdownNow()
        }
    }

    /**
     * Startet die Suche im Hintergrund. `done` läuft auf einem Hintergrund-Thread mit den gefundenen
     * Server-Adressen (normalisiert, ohne Duplikate, sortiert), auch leer – außer nach cancel().
     */
    fun start(context: Context, done: (List<String>) -> Unit): Search {
        val pool = Executors.newFixedThreadPool(THREADS)
        val search = Search(pool)
        val app = context.applicationContext
        Thread({
            val found = runCatching { scan(app, pool, search) }.getOrDefault(emptyList())
            pool.shutdownNow()
            if (!search.cancelled.get()) done(found)
        }, "couchplay-discovery").start()
        return search
    }

    private fun scan(context: Context, pool: ExecutorService, search: Search): List<String> {
        val (ip, prefix) = localIpv4(context) ?: return emptyList()
        val hosts = candidateHosts(ip, prefix)
        val ports = ports(context)
        val tasks = hosts.flatMap { host -> ports.map { port -> pool.submit<String?> { probe("http://$host:$port") } } }
        val found = tasks.mapNotNull { if (search.cancelled.get()) null else runCatching { it.get() }.getOrNull() }
        return found.distinct().map { preferred(it) }.distinct().sorted()
    }

    /** IPv4-Adresse und Präfixlänge des aktiven Netzes (WLAN/Ethernet), sonst null. */
    private fun localIpv4(context: Context): Pair<Int, Int>? {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return null
        val network = cm.activeNetwork ?: return null
        val caps = cm.getNetworkCapabilities(network)
        // Mobilfunk o. Ä.: dort gibt es kein Heimnetz zu durchsuchen.
        if (caps != null && !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
            !caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
        ) {
            return null
        }
        val link = cm.getLinkProperties(network) ?: return null
        val addr = link.linkAddresses.firstOrNull { it.address is Inet4Address && !it.address.isLoopbackAddress } ?: return null
        val b = addr.address.address
        val ip = ((b[0].toInt() and 0xff) shl 24) or ((b[1].toInt() and 0xff) shl 16) or
            ((b[2].toInt() and 0xff) shl 8) or (b[3].toInt() and 0xff)
        return ip to addr.prefixLength
    }

    /**
     * Zu prüfende Hosts: das eigene Subnetz ohne Netz-/Broadcast- und eigene Adresse. Größere Netze
     * (Präfix < 24) werden auf das eigene /24 beschränkt, sonst dauert die Suche zu lange.
     */
    fun candidateHosts(ip: Int, prefixLength: Int): List<String> {
        val prefix = prefixLength.coerceIn(24, 30)
        val mask = -1 shl (32 - prefix)
        val network = ip and mask
        val size = 1 shl (32 - prefix)
        return (1 until size - 1).map { network + it }.filter { it != ip }.map { ipText(it) }
    }

    private fun ipText(ip: Int): String = "${(ip ushr 24) and 0xff}.${(ip ushr 16) and 0xff}.${(ip ushr 8) and 0xff}.${ip and 0xff}"

    /** Standard-Ports plus der Port einer konfigurierten lokalen HTTP-Adresse (z. B. :3000). */
    private fun ports(context: Context): List<Int> {
        val extra = listOfNotNull(ServerConfig.serverUrl(context), ServerConfig.lastWorkingUrl(context))
            .mapNotNull { Origin.of(it) }
            .filter { it.scheme == "http" }
            .map { it.port }
        return (DEFAULT_PORTS + extra).distinct()
    }

    /** Server-Adresse, wenn unter `base` ein CouchPlay-Server antwortet; sonst null. */
    private fun probe(base: String): String? = discoverInfo(base)?.let { base }

    /** publicUrl des Servers, falls gesetzt und erreichbar (z. B. Domain hinter HTTPS-Proxy), sonst `base`. */
    private fun preferred(base: String): String {
        val info = discoverInfo(base) ?: return base
        val public = info.optString("publicUrl", "").takeIf { it.isNotBlank() && !info.isNull("publicUrl") }
            ?.let { ServerConfig.normalize(it) } ?: return base
        return if (public != base && discoverInfo(public) != null) public else base
    }

    /** Antwort von `${base}/api/discover` als JSON, wenn sie vom CouchPlay-Server stammt. */
    private fun discoverInfo(base: String): JSONObject? {
        if (Thread.currentThread().isInterrupted) return null
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL(base + PATH).openConnection() as HttpURLConnection).apply {
                connectTimeout = CONNECT_TIMEOUT_MS
                readTimeout = READ_TIMEOUT_MS
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/json")
            }
            if (conn.responseCode != HttpURLConnection.HTTP_OK) return null
            val bytes = conn.inputStream.use { input ->
                val buf = ByteArray(MAX_BODY_BYTES)
                var n = 0
                while (n < buf.size) {
                    val r = input.read(buf, n, buf.size - n)
                    if (r < 0) break
                    n += r
                }
                buf.copyOf(n)
            }
            val json = JSONObject(String(bytes, Charsets.UTF_8))
            if (json.optString("service") == SERVICE) json else null
        } catch (_: IOException) {
            null
        } catch (_: org.json.JSONException) {
            null
        } catch (_: RuntimeException) {
            null
        } finally {
            conn?.disconnect()
        }
    }
}
