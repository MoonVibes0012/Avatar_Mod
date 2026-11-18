package com.onisonge.vtuberforge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.*
import java.io.File

class MainActivity : Activity() {
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserRequestCode = 100
    private lateinit var webView: WebView
    private var isPageLoaded = false
    private var pendingModelUrl: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(true)

        // Cleanup old cache intents
        Thread {
            try {
                cacheDir.listFiles { f -> f.name.startsWith("intent_") }?.forEach { f ->
                    if (System.currentTimeMillis() - f.lastModified() > 24 * 60 * 60 * 1000L) {
                        f.delete()
                    }
                }
            } catch (e: Exception) {
                Log.e("VTuberForge_Cache", "Cache cleanup fail: ${e.message}")
            }
        }.start()

        webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            allowFileAccessFromFileURLs = true
            allowUniversalAccessFromFileURLs = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                forceDark = WebSettings.FORCE_DARK_OFF
            }
        }
        
        webView.clearCache(true)
        webView.clearHistory()
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null)
        webView.isLongClickable = false
        webView.setOnLongClickListener { true }
        
        webView.addJavascriptInterface(DebugBridge(this), "AndroidBridge")
        
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                if (url?.startsWith("http") == true) return true
                return false
            }
            
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                isPageLoaded = true
                Log.d("VTuberForge_Page", "Page finished: $url")
                
                webView.evaluateJavascript(
                    "dbg && dbg('=== PAGE READY from Kotlin, JS exec OK ===')",
                    null
                )
                
                pendingModelUrl?.let { path ->
                    webView.evaluateJavascript("window.loadModelFromIntent && window.loadModelFromIntent('$path')", null)
                    pendingModelUrl = null
                }
            }
            
            override fun onRenderProcessGone(view: WebView?, detail: RenderProcessGoneDetail?): Boolean {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (detail?.didCrash() == true) {
                        android.widget.Toast.makeText(this@MainActivity, "Memori Grafis Penuh! Memuat ulang...", android.widget.Toast.LENGTH_LONG).show()
                        view?.destroy()
                        recreate()
                        return true
                    }
                }
                return super.onRenderProcessGone(view, detail)
            }
        }
        
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR || 
                    consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.WARNING) {
                    Log.d("WebViewJS", "${consoleMessage.message()} -- Line ${consoleMessage.lineNumber()}")
                }
                return true
            }
            
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
                intent.addCategory(Intent.CATEGORY_OPENABLE)
                intent.type = "*/*"
                return try {
                    startActivityForResult(intent, fileChooserRequestCode)
                    true
                } catch (e: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }
        
        setContentView(webView)
        webView.loadUrl("file:///android_asset/app.html")
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val uri: Uri? = when (intent?.action) {
            Intent.ACTION_VIEW -> intent.data
            Intent.ACTION_SEND -> {
                @Suppress("DEPRECATION")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                } else {
                    intent.getParcelableExtra(Intent.EXTRA_STREAM)
                }
            }
            else -> null
        }
        
        uri?.let {
            try {
                val inputStream = contentResolver.openInputStream(uri)
                if (inputStream != null) {
                    val fileName = uri.lastPathSegment ?: "intent_model.glb"
                    val safeName = fileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                    val cacheFile = File(cacheDir, "intent_${System.currentTimeMillis()}_$safeName")
                    cacheFile.outputStream().use { inputStream.copyTo(it) }
                    inputStream.close()
                    
                    val fileUrl = "file://" + cacheFile.absolutePath
                    val escapedUrl = fileUrl.replace("'", "\\'")
                    
                    if (isPageLoaded) {
                        webView.evaluateJavascript("window.loadModelFromIntent && window.loadModelFromIntent('$escapedUrl')", null)
                    } else {
                        pendingModelUrl = escapedUrl
                    }
                }
            } catch (e: Exception) {
                Log.e("VTuberForge_Intent", "Gagal baca intent URI: ${e.message}")
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == fileChooserRequestCode) {
            if (filePathCallback == null) return
            val results = if (resultCode == Activity.RESULT_OK && data != null) {
                val uri = data.data
                if (uri != null) {
                    try {
                        contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    } catch (e: Exception) { Log.e("URI", "Gagal ambil izin permanen") }
                }
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else { null }
            filePathCallback?.onReceiveValue(results)
            filePathCallback = null
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            webView.evaluateJavascript("window.handleAndroidBack();", null)
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= TRIM_MEMORY_RUNNING_LOW) {
            try {
                webView.evaluateJavascript("window.clearUndoStack && window.clearUndoStack();", null)
            } catch (e: Exception) {
                Log.e("VTuberForge_Trim", "Gagal clear undo: ${e.message}")
            }
        }
    }

    override fun onPause() { super.onPause(); webView.onPause() }
    override fun onResume() { super.onResume(); webView.onResume() }
    
    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}
