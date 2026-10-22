package at.couchplay.tv

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.Button
import android.widget.EditText
import android.widget.TextView

/** Server-Adresse ändern (per Fernbedienung bedienbar). Zurück = Abbrechen. */
class SettingsActivity : Activity() {
    private lateinit var input: EditText
    private lateinit var error: TextView
    private lateinit var searchStatus: TextView
    private var search: Discovery.Search? = null
    private var pickDialog: AlertDialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        input = findViewById(R.id.server_url)
        error = findViewById(R.id.error)
        searchStatus = findViewById(R.id.search_status)
        findViewById<Button>(R.id.search).setOnClickListener { startSearch() }
        findViewById<TextView>(R.id.default_url).text = getString(R.string.settings_default, ServerConfig.defaultUrl)
        findViewById<TextView>(R.id.version).text = getString(R.string.settings_version, BuildConfig.VERSION_NAME)

        input.setText(ServerConfig.serverUrl(this))
        input.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                findViewById<Button>(R.id.save).requestFocus()
                true
            } else {
                false
            }
        }
        findViewById<Button>(R.id.save).setOnClickListener { save() }
        findViewById<Button>(R.id.reset).setOnClickListener {
            ServerConfig.setServerUrl(this, null)
            finish()
        }
        findViewById<Button>(R.id.cancel).setOnClickListener { finish() }
        findViewById<Button>(R.id.update).apply {
            visibility = if (Updater.enabled) View.VISIBLE else View.GONE
            setOnClickListener { startActivity(Intent(this@SettingsActivity, UpdateActivity::class.java)) }
        }
        val unreachable = intent.getStringExtra(EXTRA_UNREACHABLE)
        if (unreachable != null) {
            // Aus MainActivity nach einem Verbindungsfehler: gleich die Adresse bearbeiten lassen.
            error.text = getString(R.string.settings_unreachable, unreachable)
            error.visibility = View.VISIBLE
            input.requestFocus()
            input.setSelection(input.text.length)
            // MainActivity hat schon gesucht → Funde zeigen, sonst jetzt suchen.
            val found = intent.getStringArrayListExtra(EXTRA_FOUND)
            if (found != null) showFound(found) else startSearch()
        } else {
            // Fokus zuerst auf „Speichern“: OK übernimmt, Pfeil hoch bearbeitet die Adresse.
            findViewById<Button>(R.id.save).requestFocus()
        }
    }

    override fun onDestroy() {
        search?.cancel()
        search = null
        pickDialog?.dismiss()
        pickDialog = null
        super.onDestroy()
    }

    private fun startSearch() {
        search?.cancel()
        searchStatus.setText(R.string.discovery_running)
        searchStatus.visibility = View.VISIBLE
        findViewById<Button>(R.id.search).isEnabled = false
        search = Discovery.start(this) { found ->
            runOnUiThread {
                search = null
                if (isFinishing || isDestroyed) return@runOnUiThread
                findViewById<Button>(R.id.search).isEnabled = true
                showFound(found)
            }
        }
    }

    /** Ein Fund → Adresse eintragen; mehrere → Auswahl; keiner → Hinweis auf manuelle Eingabe. */
    private fun showFound(found: List<String>) {
        searchStatus.visibility = View.VISIBLE
        when (found.size) {
            0 -> searchStatus.setText(R.string.discovery_none)
            1 -> useFound(found[0])
            else -> {
                searchStatus.setText(R.string.discovery_many)
                pickDialog?.dismiss()
                pickDialog = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                    .setTitle(R.string.discovery_pick)
                    .setItems(found.toTypedArray()) { _, i -> useFound(found[i]) }
                    .setNegativeButton(R.string.settings_cancel, null)
                    .setOnDismissListener { pickDialog = null }
                    .show()
            }
        }
    }

    private fun useFound(url: String) {
        input.setText(url)
        error.visibility = View.GONE
        searchStatus.text = getString(R.string.discovery_one, url)
        searchStatus.visibility = View.VISIBLE
        findViewById<Button>(R.id.save).requestFocus()
    }

    private fun save() {
        if (ServerConfig.setServerUrl(this, input.text.toString())) {
            finish()
        } else {
            error.setText(R.string.settings_invalid)
            error.visibility = View.VISIBLE
            input.requestFocus()
        }
    }

    companion object {
        /** Adresse, die gerade nicht erreichbar war (öffnet die Einstellungen mit Hinweis und Fokus auf der Eingabe). */
        const val EXTRA_UNREACHABLE = "at.couchplay.tv.extra.UNREACHABLE"

        /** Bereits gefundene Server (MainActivity hat schon gesucht). */
        const val EXTRA_FOUND = "at.couchplay.tv.extra.FOUND"
    }
}
