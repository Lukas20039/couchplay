package at.couchplay.tv

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import java.io.File

/**
 * App-Update per Fernbedienung: sucht nach einer neuen Version, lädt sie herunter und startet die
 * Installation. Mit [EXTRA_INSTALL] (aus dem Start-Dialog) geht es nach der Suche direkt weiter.
 */
class UpdateActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var detail: TextView
    private lateinit var progress: ProgressBar
    private lateinit var primary: Button
    private lateinit var secondary: Button

    private val main = Handler(Looper.getMainLooper())
    private var release: Updater.Release? = null
    private var installAfterCheck = false
    private var waitingForPermission = false

    /** Erhöht bei jedem neuen Hintergrundauftrag; veraltete Ergebnisse werden verworfen. */
    private var job = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_update)
        status = findViewById(R.id.status)
        detail = findViewById(R.id.detail)
        progress = findViewById(R.id.progress)
        primary = findViewById(R.id.primary)
        secondary = findViewById(R.id.secondary)
        findViewById<TextView>(R.id.version).text = getString(R.string.settings_version, BuildConfig.VERSION_NAME)
        secondary.setOnClickListener { finish() }
        installAfterCheck = intent.getBooleanExtra(EXTRA_INSTALL, false)
        // Auch während der System-Dialog im Vordergrund ist (Activity pausiert) Status empfangen.
        Updater.statusListener = statusListener
        check()
    }

    override fun onResume() {
        super.onResume()
        // Zurück aus „Unbekannte Apps installieren“: Berechtigung erteilt → weiter.
        if (waitingForPermission && Updater.canInstall(this)) {
            waitingForPermission = false
            startDownload()
        }
    }

    override fun onDestroy() {
        job++
        if (Updater.statusListener === statusListener) Updater.statusListener = null
        super.onDestroy()
    }

    private val statusListener: (Boolean, String?) -> Unit = { success, message -> onInstallStatus(success, message) }

    private fun check() {
        if (!Updater.enabled) {
            show(getString(R.string.update_disabled))
            return
        }
        show(getString(R.string.update_checking))
        background({ Updater.check() }) { result ->
            release = result
            when {
                result == null -> show(getString(R.string.update_current, BuildConfig.VERSION_NAME))
                installAfterCheck -> {
                    installAfterCheck = false
                    startInstall()
                }
                else -> showAvailable(result)
            }
        }
    }

    private fun showAvailable(r: Updater.Release) {
        show(
            getString(R.string.update_available, r.versionName),
            detail = getString(R.string.update_available_detail, BuildConfig.VERSION_NAME),
            primary = getString(R.string.update_install) to ::startInstall,
            secondaryText = getString(R.string.update_later),
        )
    }

    private fun startInstall() {
        if (!Updater.canInstall(this)) {
            waitingForPermission = true
            show(
                getString(R.string.update_permission),
                detail = getString(R.string.update_permission_detail),
                primary = getString(R.string.update_permission_open) to ::openInstallPermission,
            )
            return
        }
        startDownload()
    }

    private fun openInstallPermission() {
        val intents = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                add(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
            }
            // Manche TV-Oberflächen haben die Seite pro App nicht.
            add(Intent(Settings.ACTION_SECURITY_SETTINGS))
            add(Intent(Settings.ACTION_SETTINGS))
        }
        for (intent in intents) {
            try {
                startActivity(intent)
                return
            } catch (_: ActivityNotFoundException) {
                // nächste Variante
            }
        }
    }

    private fun startDownload() {
        val r = release ?: return check()
        show(getString(R.string.update_downloading, r.versionName), progress = 0)
        val context: Context = applicationContext
        background({
            Updater.download(context, r) { percent -> main.post { showProgress(percent) } }
        }) { apk -> startSystemInstaller(apk) }
    }

    private fun startSystemInstaller(apk: File) {
        show(getString(R.string.update_installing), detail = getString(R.string.update_installing_detail))
        val context: Context = applicationContext
        background({ Updater.install(context, apk) }) { /* Ergebnis kommt über onInstallStatus */ }
    }

    private fun onInstallStatus(success: Boolean, message: String?) {
        val r = release
        when {
            // Nach erfolgreicher Installation beendet Android den alten Prozess; bis dahin Hinweis zeigen.
            success -> show(getString(R.string.update_done))
            message != null -> showError(getString(R.string.update_error_install, message))
            r != null -> showAvailable(r) // vom Nutzer abgebrochen
            else -> check()
        }
    }

    private fun showProgress(percent: Int) {
        progress.isIndeterminate = percent < 0
        if (percent >= 0) progress.progress = percent
    }

    private fun showError(text: String) {
        show(
            text,
            primary = getString(R.string.update_retry) to { if (release != null) startInstall() else check() },
        )
    }

    private fun errorText(e: Throwable): String = when ((e as? Updater.UpdateException)?.reason) {
        Updater.Reason.NETWORK -> getString(R.string.update_error_network)
        Updater.Reason.CHECKSUM -> getString(R.string.update_error_checksum)
        Updater.Reason.SIGNATURE -> getString(R.string.update_error_signature)
        Updater.Reason.WRONG_PACKAGE, Updater.Reason.NO_APK, Updater.Reason.NOT_NEWER -> getString(R.string.update_error_apk)
        Updater.Reason.INSTALL -> getString(R.string.update_error_install, e.cause?.message ?: "")
        null -> getString(R.string.update_error_apk)
    }

    private fun show(
        text: String,
        detail: String? = null,
        primary: Pair<String, () -> Unit>? = null,
        secondaryText: String = getString(R.string.update_close),
        progress: Int? = null,
    ) {
        status.text = text
        this.detail.text = detail ?: ""
        this.detail.visibility = if (detail == null) View.GONE else View.VISIBLE
        this.progress.visibility = if (progress == null) View.GONE else View.VISIBLE
        if (progress != null) showProgress(progress)
        secondary.text = secondaryText
        if (primary != null) {
            this.primary.text = primary.first
            this.primary.setOnClickListener { primary.second() }
            this.primary.visibility = View.VISIBLE
            this.primary.requestFocus()
        } else {
            this.primary.visibility = View.GONE
            secondary.requestFocus()
        }
    }

    /** Führt [work] in einem Hintergrund-Thread aus; Ergebnis bzw. Fehler kommen im UI-Thread an. */
    private fun <T> background(work: () -> T, onDone: (T) -> Unit) {
        val id = ++job
        Thread({
            val result = runCatching(work)
            main.post {
                if (id != job || isFinishing || isDestroyed) return@post
                result.fold(onDone) { showError(errorText(it)) }
            }
        }, "couchplay-update").start()
    }

    companion object {
        /** Nach der Suche ohne weitere Rückfrage herunterladen und installieren. */
        const val EXTRA_INSTALL = "at.couchplay.tv.extra.INSTALL"
    }
}
