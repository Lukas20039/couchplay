package at.couchplay.tv

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * OTA-Update aus GitHub-Releases (BuildConfig.UPDATE_URL = …/releases/latest).
 *
 * Ablauf: neuestes Release lesen → `couchplay-tv-*-release.apk` + `.sha256` finden → versionCode aus dem
 * Tag (wie im APK-Workflow) mit der installierten Version vergleichen → herunterladen, Prüfsumme,
 * Paketname, versionCode und Signatur prüfen → per PackageInstaller-Session installieren (der Nutzer
 * bestätigt im System-Dialog). Android selbst lässt nur Updates mit demselben Signaturschlüssel zu;
 * die eigene Signaturprüfung sorgt nur für eine verständliche Fehlermeldung vorab.
 *
 * Netzwerk/IO blockieren – nur aus Hintergrund-Threads aufrufen.
 */
object Updater {
    private const val PREFS = "couchplay"
    private const val KEY_SNOOZED_CODE = "update_snoozed_code"
    private const val KEY_SNOOZED_AT = "update_snoozed_at"
    private const val SNOOZE_MS = 24L * 60 * 60 * 1000
    private const val MAX_APK_BYTES = 100L * 1024 * 1024
    private const val ACTION_INSTALL_STATUS = "at.couchplay.tv.UPDATE_INSTALL_STATUS"

    data class Release(val tag: String, val versionName: String, val versionCode: Int, val apkUrl: String, val sha256Url: String)

    class UpdateException(val reason: Reason, cause: Throwable? = null) : Exception(reason.name, cause)

    enum class Reason { NETWORK, NO_APK, CHECKSUM, WRONG_PACKAGE, NOT_NEWER, SIGNATURE, INSTALL }

    val enabled: Boolean get() = BuildConfig.UPDATE_URL.isNotEmpty()

    /** Neuestes Release, falls es neuer als die installierte Version ist; sonst null. */
    fun check(): Release? {
        if (!enabled) return null
        val json = JSONObject(httpGetText(BuildConfig.UPDATE_URL))
        if (json.optBoolean("draft") || json.optBoolean("prerelease")) return null
        val tag = json.getString("tag_name")
        val code = versionCodeOf(tag) ?: return null
        if (code <= BuildConfig.VERSION_CODE) return null
        val assets = json.getJSONArray("assets")
        var apk: String? = null
        var sha: String? = null
        for (i in 0 until assets.length()) {
            val asset = assets.getJSONObject(i)
            val name = asset.getString("name")
            val url = asset.getString("browser_download_url")
            if (name.startsWith("couchplay-tv-") && name.endsWith("-release.apk")) apk = url
            if (name.startsWith("couchplay-tv-") && name.endsWith("-release.apk.sha256")) sha = url
        }
        // Release ohne APK (z. B. Build noch nicht fertig) → wie „kein Update“ behandeln.
        if (apk == null || sha == null) return null
        return Release(tag, tag.removePrefix("v"), code, apk, sha)
    }

    /** Tag vX.Y.Z[-suffix] → versionCode = X·10⁶ + Y·10³ + Z (wie im APK-Workflow), sonst null. */
    fun versionCodeOf(tag: String): Int? {
        val core = tag.removePrefix("v").substringBefore('-')
        val parts = core.split('.')
        if (parts.size != 3) return null
        val (major, minor, patch) = parts.map { it.toIntOrNull() ?: return null }
        if (major < 0 || minor !in 0..999 || patch !in 0..999 || major > 2000) return null
        return major * 1_000_000 + minor * 1_000 + patch
    }

    /** Lädt die APK in den Cache und prüft sie. [onProgress] erhält 0..100 (oder -1 ohne Größenangabe). */
    fun download(context: Context, release: Release, onProgress: (Int) -> Unit): File {
        val expected = httpGetText(release.sha256Url).trim().substringBefore(' ').lowercase()
        if (!Regex("[0-9a-f]{64}").matches(expected)) throw UpdateException(Reason.CHECKSUM)

        val dir = File(context.cacheDir, "update").apply { mkdirs() }
        dir.listFiles()?.forEach { it.delete() }
        val file = File(dir, "couchplay-tv-${release.versionName}.apk")
        val digest = MessageDigest.getInstance("SHA-256")
        try {
            val conn = open(release.apkUrl)
            try {
                val total = conn.contentLengthLong
                if (total > MAX_APK_BYTES) throw UpdateException(Reason.NO_APK)
                conn.inputStream.use { input ->
                    file.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        var done = 0L
                        var lastPercent = -2
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            done += n
                            if (done > MAX_APK_BYTES) throw UpdateException(Reason.NO_APK)
                            digest.update(buffer, 0, n)
                            output.write(buffer, 0, n)
                            val percent = if (total > 0) (done * 100 / total).toInt() else -1
                            if (percent != lastPercent) {
                                lastPercent = percent
                                onProgress(percent)
                            }
                        }
                    }
                }
            } finally {
                conn.disconnect()
            }
        } catch (e: IOException) {
            file.delete()
            throw UpdateException(Reason.NETWORK, e)
        }

        val actual = digest.digest().joinToString("") { "%02x".format(it) }
        if (actual != expected) {
            file.delete()
            throw UpdateException(Reason.CHECKSUM)
        }
        verifyArchive(context, file)
        return file
    }

    /** Paketname, versionCode und (ab Android 9) Signaturschlüssel der heruntergeladenen APK prüfen. */
    @Suppress("DEPRECATION")
    private fun verifyArchive(context: Context, file: File) {
        val pm = context.packageManager
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else 0
        val archive = pm.getPackageArchiveInfo(file.path, flags) ?: fail(file, Reason.NO_APK)
        if (archive.packageName != context.packageName) fail(file, Reason.WRONG_PACKAGE)
        if (versionCode(archive) <= BuildConfig.VERSION_CODE) fail(file, Reason.NOT_NEWER)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val installed = pm.getPackageInfo(context.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
            val own = signers(installed)
            val theirs = signers(archive)
            // Leer = Signatur nicht lesbar; dann entscheidet der Installer.
            if (own.isNotEmpty() && theirs.isNotEmpty() && own.intersect(theirs).isEmpty()) fail(file, Reason.SIGNATURE)
        }
    }

    private fun fail(file: File, reason: Reason): Nothing {
        file.delete()
        throw UpdateException(reason)
    }

    @Suppress("DEPRECATION")
    private fun versionCode(info: PackageInfo): Long =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

    private fun signers(info: PackageInfo): Set<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return emptySet()
        val signing = info.signingInfo ?: return emptySet()
        // Bei Schlüsselrotation enthält die Historie auch frühere Schlüssel.
        val certs = if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        return certs.orEmpty().map { it.toCharsString() }.toSet()
    }

    /** Darf die App Pakete installieren? (Android 8+: „Unbekannte Apps installieren“ pro App.) */
    fun canInstall(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

    /** Übergibt die APK an den PackageInstaller; der System-Dialog fragt den Nutzer. */
    fun install(context: Context, apk: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            setSize(apk.length())
        }
        val sessionId = installer.createSession(params)
        try {
            installer.openSession(sessionId).use { session ->
                session.openWrite("couchplay-tv.apk", 0, apk.length()).use { out ->
                    apk.inputStream().use { it.copyTo(out) }
                    session.fsync(out)
                }
                val intent = Intent(context, UpdateInstallReceiver::class.java).setAction(ACTION_INSTALL_STATUS)
                // FLAG_MUTABLE: der Installer trägt Status und Bestätigungs-Intent als Extras ein.
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
                val pending = PendingIntent.getBroadcast(context, sessionId, intent, flags)
                session.commit(pending.intentSender)
            }
        } catch (e: Exception) {
            runCatching { installer.abandonSession(sessionId) }
            throw UpdateException(Reason.INSTALL, e)
        }
    }

    /** Wurde dieses Update beim Start schon abgelehnt („Später“, 24 h Ruhe)? */
    fun isSnoozed(context: Context, release: Release): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val at = prefs.getLong(KEY_SNOOZED_AT, 0)
        return prefs.getInt(KEY_SNOOZED_CODE, 0) == release.versionCode && System.currentTimeMillis() - at in 0 until SNOOZE_MS
    }

    fun snooze(context: Context, release: Release) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putInt(KEY_SNOOZED_CODE, release.versionCode)
            .putLong(KEY_SNOOZED_AT, System.currentTimeMillis())
            .apply()
    }

    /** Meldet Installationsfehler an die gerade sichtbare UpdateActivity (nur im UI-Thread benutzen). */
    var statusListener: ((success: Boolean, message: String?) -> Unit)? = null

    private fun open(url: String): HttpURLConnection {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        conn.instanceFollowRedirects = true
        conn.setRequestProperty("User-Agent", "CouchPlayTV/${BuildConfig.VERSION_NAME}")
        conn.setRequestProperty("Accept", "application/vnd.github+json, application/octet-stream, */*")
        val status = conn.responseCode
        if (status !in 200..299) {
            conn.disconnect()
            throw IOException("HTTP $status")
        }
        return conn
    }

    private fun httpGetText(url: String): String {
        try {
            val conn = open(url)
            try {
                return conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            } finally {
                conn.disconnect()
            }
        } catch (e: IOException) {
            throw UpdateException(Reason.NETWORK, e)
        }
    }
}

/** Statusmeldungen der PackageInstaller-Session (nicht exportiert: nur das System sendet über das PendingIntent). */
class UpdateInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirm = confirmIntent(intent) ?: return report(context, false, null)
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                runCatching { context.startActivity(confirm) }.onFailure { report(context, false, it.message) }
            }
            PackageInstaller.STATUS_SUCCESS -> report(context, true, null)
            // Abbruch durch den Nutzer ist kein Fehler.
            PackageInstaller.STATUS_FAILURE_ABORTED -> report(context, false, null)
            else -> report(context, false, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "Status $status")
        }
    }

    @Suppress("DEPRECATION")
    private fun confirmIntent(intent: Intent): Intent? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
            intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }

    private fun report(context: Context, success: Boolean, message: String?) {
        Handler(Looper.getMainLooper()).post {
            val listener = Updater.statusListener
            if (listener != null) {
                listener(success, message)
            } else if (!success && message != null) {
                Toast.makeText(context, context.getString(R.string.update_error_install, message), Toast.LENGTH_LONG).show()
            }
        }
    }
}
