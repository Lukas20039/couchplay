package at.couchplay.tv

import android.app.Activity
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        input = findViewById(R.id.server_url)
        error = findViewById(R.id.error)
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
        } else {
            // Fokus zuerst auf „Speichern“: OK übernimmt, Pfeil hoch bearbeitet die Adresse.
            findViewById<Button>(R.id.save).requestFocus()
        }
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
    }
}
