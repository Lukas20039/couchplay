package at.couchplay.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.TextUtils
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

/**
 * Vollbild-WebView, die `${serverUrl}/tv/` lädt. D-Pad-Navigation macht die Web-App;
 * Hardware-Back/Menü werden als `couchplay:back`/`couchplay:menu`-Events weitergereicht.
 */
class MainActivity : Activity(), NativeBridge.Host {
    private lateinit var container: FrameLayout
    private var webView: WebView? = null

    /** In den Einstellungen konfigurierte Adresse, mit der zuletzt geladen wurde (für onResume-Vergleich). */
    private var loadedServerUrl: String? = null

    /**
     * Erlaubte Origin für Navigation und JS-Brücke. Startet als Origin von loadedServerUrl;
     * leitet der Server von http auf https desselben Hosts um, wird sie auf https umgestellt.
     */
    private var allowedOrigin: Origin? = null

    /** Renderer-Abstürze seit dem letzten erfolgreichen Laden (Schutz vor Reload-Schleifen). */
    private var renderCrashes = 0

    /** true, solange die lokale Fehlerseite angezeigt wird. */
    private var showingError = false

    /** true, sobald die Web-App (nicht die Fehlerseite) fertig geladen ist. */
    private var webAppReady = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        container = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#120F24")) }
        setContentView(container)
        // CDP-Zugriff (Emulator-E2E) nur in Debug-Builds.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        createWebView()
        loadApp()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
        webView?.resumeTimers()
        // Server-Adresse in den Einstellungen geändert → neu laden.
        if (loadedServerUrl != null && loadedServerUrl != ServerConfig.serverUrl(this)) loadApp()
    }

    override fun onPause() {
        webView?.onPause()
        // JS-Timer (WebSocket-Pings, Auto-Retry der Fehlerseite) im Hintergrund anhalten.
        webView?.pauseTimers()
        super.onPause()
    }

    override fun onDestroy() {
        destroyWebView()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun createWebView() {
        val wv = WebView(this)
        wv.setBackgroundColor(Color.parseColor("#120F24"))
        wv.isFocusable = true
        wv.isFocusableInTouchMode = true
        with(wv.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            // Nur Same-Origin-Inhalte; Mixed Content wird nicht benötigt.
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            userAgentString = "$userAgentString CouchPlayTV/${BuildConfig.VERSION_NAME}"
        }
        wv.addJavascriptInterface(NativeBridge(this), NativeBridge.NAME)
        wv.webViewClient = Client()
        container.addView(wv, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        wv.requestFocus()
        webView = wv
    }

    private fun destroyWebView() {
        webView?.let {
            container.removeView(it)
            it.stopLoading()
            it.destroy()
        }
        webView = null
    }

    private fun loadApp() {
        val server = ServerConfig.serverUrl(this)
        loadedServerUrl = server
        allowedOrigin = Origin.of(server)
        showingError = false
        webAppReady = false
        webView?.loadUrl(server + ServerConfig.TV_PATH)
    }

    /** Lokale, gestylte Fehlerseite aus assets/error.html. */
    private fun showError(detail: String?) {
        if (showingError) return
        showingError = true
        webAppReady = false
        val template = assets.open("error.html").bufferedReader(Charsets.UTF_8).use { it.readText() }
        val html = template
            .replace("{{SERVER}}", TextUtils.htmlEncode(loadedServerUrl ?: ServerConfig.serverUrl(this)))
            .replace("{{DETAIL}}", TextUtils.htmlEncode(detail ?: ""))
        // historyUrl = Basis-URL, damit webView.url eindeutig die Fehlerseite meldet (Brücken-Prüfung).
        webView?.loadDataWithBaseURL(ERROR_BASE_URL, html, "text/html", "utf-8", ERROR_BASE_URL)
    }

    private fun isServerUrl(url: Uri): Boolean {
        val allowed = allowedOrigin ?: return false
        return Origin.of(url) == allowed
    }

    override fun isTrustedPage(): Boolean {
        if (isFinishing || isDestroyed) return false
        val url = webView?.url ?: return false
        if (showingError && url == ERROR_BASE_URL) return true
        return !showingError && isServerUrl(Uri.parse(url))
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            if (isServerUrl(url) || url.toString() == ERROR_BASE_URL) return false
            val target = Origin.of(url)
            val allowed = allowedOrigin
            // Server leitet http → https desselben Hosts um (Reverse-Proxy): erlauben und merken.
            if (request.isForMainFrame && request.isRedirect && target != null && allowed != null &&
                allowed.scheme == "http" && target.scheme == "https" && target.sameHost(allowed)
            ) {
                allowedOrigin = target
                return false
            }
            // Nur der eigene Server darf in der WebView laufen (JS-Brücke!). Blockierte
            // Hauptseiten-Navigation → Fehlerseite statt schwarzem Bild.
            if (request.isForMainFrame) showError(getString(R.string.error_blocked, target?.toString() ?: url.scheme ?: ""))
            return true
        }

        override fun onPageFinished(view: WebView, url: String) {
            webAppReady = !showingError && url != ERROR_BASE_URL && url != "about:blank"
            if (webAppReady) renderCrashes = 0
            view.requestFocus()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame && !showingError) showError("${error.errorCode} ${error.description}")
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (request.isForMainFrame && response.statusCode >= 400 && !showingError) showError("HTTP ${response.statusCode}")
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            // Renderer abgestürzt/beendet (z. B. Speicherdruck auf schwachen TVs): WebView neu aufbauen.
            if (view == webView) {
                renderCrashes++
                destroyWebView()
                createWebView()
                showingError = false
                if (renderCrashes <= MAX_RENDER_CRASHES) {
                    loadApp()
                } else {
                    // Wiederholter Absturz (z. B. zu wenig Speicher): nicht endlos neu laden.
                    showError(getString(R.string.error_renderer))
                }
            }
            return true
        }
    }

    // ---------------------------------------------------------------- Tasten

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        when (event.keyCode) {
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_ESCAPE -> {
                if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) onBackKey()
                return true
            }
            KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS -> {
                if (event.action == KeyEvent.ACTION_UP) onMenuKey()
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    /** Zurück an die Web-App; hat sie das Event nicht verarbeitet → App beenden. */
    private fun onBackKey() {
        val wv = webView
        if (wv == null || showingError || !webAppReady) {
            finish()
            return
        }
        wv.evaluateJavascript(dispatchScript("couchplay:back")) { result ->
            // dispatchEvent liefert false, wenn die Web-App preventDefault() aufgerufen hat.
            if (result != "false") finish()
        }
    }

    private fun onMenuKey() {
        val wv = webView
        if (wv == null || showingError || !webAppReady) {
            openSettings()
            return
        }
        wv.evaluateJavascript(dispatchScript("couchplay:menu")) { result ->
            if (result != "false") openSettings()
        }
    }

    private fun dispatchScript(name: String): String =
        "(function(){try{return window.dispatchEvent(new CustomEvent('$name',{cancelable:true}));}catch(e){return true;}})()"

    // ---------------------------------------------------------------- Brücke

    override fun exitApp() {
        if (isFinishing) return
        finish()
    }

    override fun openSettings() {
        if (isFinishing || isDestroyed) return
        startActivity(Intent(this, SettingsActivity::class.java))
    }

    override fun retry() {
        if (isFinishing || isDestroyed) return
        renderCrashes = 0
        loadApp()
    }

    // ---------------------------------------------------------------- Vollbild

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                )
        }
    }

    companion object {
        /** Basis-URL der lokalen Fehlerseite (für Herkunftsprüfung). */
        private const val ERROR_BASE_URL = "file:///android_asset/error.html"

        private const val MAX_RENDER_CRASHES = 3
    }
}
