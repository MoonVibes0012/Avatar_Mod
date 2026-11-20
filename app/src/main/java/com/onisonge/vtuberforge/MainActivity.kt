package com.onisonge.vtuberforge

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import org.json.JSONObject
import java.io.File

class MainActivity : Activity() {
    companion object {
        private const val TAG_MAIN = "VTuberForge_Main"
        private const val TAG_CACHE = "VTuberForge_Cache"
        private const val TAG_NAV = "VTuberForge_Nav"
        private const val TAG_PAGE = "VTuberForge_Page"
        private const val TAG_INTENT = "VTuberForge_Intent"
        private const val TAG_TRIM = "VTuberForge_Trim"
        private const val TAG_URI = "VTuberForge_URI"
        private const val FILE_CHOOSER_REQUEST_CODE = 100
        private const val CAMERA_PERMISSION_REQUEST_CODE = 101
        private const val CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000L
    }

    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private lateinit var webView: WebView
    private var isPageLoaded = false
    private var pendingModelUrl: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(true)

        cleanupOldCacheIntents()

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
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

            clearCache(true)
            clearHistory()
            setLayerType(WebView.LAYER_TYPE_HARDWARE, null)
            isLongClickable = false
            setOnLongClickListener { true }

            addJavascriptInterface(DebugBridge(this@MainActivity), "AndroidBridge")

            webViewClient = createWebViewClient()
            webChromeClient = createWebChromeClient()
        }

        setContentView(webView)
        webView.loadUrl("file:///android_asset/app.html")
        handleIntent(intent)
    }

    private fun cleanupOldCacheIntents() {
        Thread {
            try {
                val now = System.currentTimeMillis()
                cacheDir.listFiles { f -> f.name.startsWith("intent_") }?.forEach { f ->
                    if (now - f.lastModified() > CACHE_MAX_AGE_MS) {
                        if (!f.delete()) {
                            Log.w(TAG_CACHE, "Gagal menghapus file cache lama: ${f.name}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG_CACHE, "Cache cleanup fail: ${e.message}", e)
            }
        }.start()
    }

    private fun createWebViewClient(): WebViewClient {
        return object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val targetUrl = request?.url?.toString() ?: return false
                return handleUrlNavigation(targetUrl)
            }

            @Deprecated("Deprecated in API 24")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                val targetUrl = url ?: return false
                return handleUrlNavigation(targetUrl)
            }

            private fun handleUrlNavigation(url: String): Boolean {
                if (
                    url.startsWith("file:///android_asset/") ||
                    url.startsWith("data:") ||
                    url.startsWith("blob:")
                ) {
                    return false
                }
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                    } catch (e: Exception) {
                        Log.e(TAG_NAV, "Gagal membuka URL eksternal: ${e.message}", e)
                    }
                    return true
                }
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                isPageLoaded = true
                Log.d(TAG_PAGE, "Page finished: $url")

                webView.evaluateJavascript(
                    "if (typeof dbg === 'function') dbg('=== PAGE READY from Kotlin, JS exec OK ===');",
                    null
                )

                pendingModelUrl?.let { rawUrl ->
                    dispatchLoadModelToJs(rawUrl)
                    pendingModelUrl = null
                }
            }

            override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
            ): Boolean {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (detail?.didCrash() == true) {
                        Toast.makeText(
                            this@MainActivity,
                            "Memori Grafis Penuh! Memuat ulang...",
                            Toast.LENGTH_LONG
                        ).show()
                        pendingWebPermissionRequest?.deny()
                        pendingWebPermissionRequest = null
                        filePathCallback?.onReceiveValue(null)
                        filePathCallback = null
                        view?.destroy()
                        recreate()
                        return true
                    }
                }
                return super.onRenderProcessGone(view, detail)
            }
        }
    }

    private fun createWebChromeClient(): WebChromeClient {
        return object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                if (
                    consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR ||
                    consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.WARNING
                ) {
                    Log.d(
                        "WebViewJS",
                        "${consoleMessage.message()} -- Line ${consoleMessage.lineNumber()}"
                    )
                }
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val resources = request.resources ?: emptyArray()
                val wantsVideo = resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)

                if (wantsVideo && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val hasCameraPerm = checkSelfPermission(Manifest.permission.CAMERA) ==
                        PackageManager.PERMISSION_GRANTED
                    if (!hasCameraPerm) {
                        pendingWebPermissionRequest?.deny()
                        pendingWebPermissionRequest = request
                        requestPermissions(
                            arrayOf(Manifest.permission.CAMERA),
                            CAMERA_PERMISSION_REQUEST_CODE
                        )
                        return
                    }
                }

                try {
                    request.grant(resources)
                } catch (e: Exception) {
                    Log.e(TAG_MAIN, "Gagal grant WebView permission: ${e.message}", e)
                    try {
                        request.deny()
                    } catch (_: Exception) {
                    }
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(
                        Intent.EXTRA_MIME_TYPES,
                        arrayOf(
                            "application/octet-stream",
                            "model/gltf-binary",
                            "model/gltf+json",
                            "application/json",
                            "text/plain",
                            "*/*"
                        )
                    )
                }

                return try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST_CODE)
                    true
                } catch (e: Exception) {
                    Log.e(TAG_MAIN, "Gagal membuka file chooser: ${e.message}", e)
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }
    }

    private fun dispatchLoadModelToJs(fileUrl: String) {
        val quotedUrl = JSONObject.quote(fileUrl)
        webView.evaluateJavascript(
            "if (typeof window.loadModelFromIntent === 'function') { window.loadModelFromIntent($quotedUrl); }",
            null
        )
    }

    override fun onNewIntent(intent: Intent?) {
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

        uri?.let { targetUri ->
            try {
                contentResolver.openInputStream(targetUri)?.use { inputStream ->
                    val rawSegment = targetUri.lastPathSegment ?: "intent_model.glb"
                    val cleanName = rawSegment.substringAfterLast('/').ifBlank { "intent_model.glb" }
                    val safeName = cleanName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                        .ifBlank { "intent_model.glb" }
                    val cacheFile = File(
                        cacheDir,
                        "intent_${System.currentTimeMillis()}_$safeName"
                    )
                    cacheFile.outputStream().use { out ->
                        inputStream.copyTo(out)
                    }

                    val fileUrl = "file://" + cacheFile.absolutePath
                    if (isPageLoaded) {
                        dispatchLoadModelToJs(fileUrl)
                    } else {
                        pendingModelUrl = fileUrl
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG_INTENT, "Gagal baca intent URI: ${e.message}", e)
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            val webReq = pendingWebPermissionRequest
            pendingWebPermissionRequest = null
            if (webReq != null) {
                val granted = grantResults.isNotEmpty() &&
                    grantResults[0] == PackageManager.PERMISSION_GRANTED
                try {
                    if (granted) {
                        webReq.grant(webReq.resources ?: emptyArray())
                    } else {
                        webReq.deny()
                        Toast.makeText(
                            this,
                            "Izin kamera ditolak. Face tracking tidak dapat aktif.",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                } catch (e: Exception) {
                    Log.e(TAG_MAIN, "Error menyelesaikan permission request: ${e.message}", e)
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            val callback = filePathCallback
            filePathCallback = null
            if (callback == null) return

            val results: Array<Uri>? = if (resultCode == Activity.RESULT_OK && data != null) {
                val uri = data.data
                if (uri != null) {
                    try {
                        contentResolver.takePersistableUriPermission(
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                        )
                    } catch (e: Exception) {
                        Log.d(TAG_URI, "Persistable permission tidak tersedia untuk URI ini: ${e.message}")
                    }
                }
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else {
                null
            }
            callback.onReceiveValue(results)
        } else {
            @Suppress("DEPRECATION")
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (isPageLoaded) {
                webView.evaluateJavascript(
                    "if (typeof window.handleAndroidBack === 'function') { window.handleAndroidBack(); } else if (window.AndroidBridge && window.AndroidBridge.exitApp) { window.AndroidBridge.exitApp(); }",
                    null
                )
            } else {
                finishAffinity()
            }
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    override fun onTrimMemory(level: Int) {
        super.onTrimMemory(level)
        if (level >= TRIM_MEMORY_RUNNING_LOW) {
            try {
                webView.evaluateJavascript(
                    "if (typeof window.clearUndoStack === 'function') window.clearUndoStack();",
                    null
                )
            } catch (e: Exception) {
                Log.e(TAG_TRIM, "Gagal clear undo: ${e.message}", e)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        if (::webView.isInitialized) {
            webView.onPause()
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
        }
    }

    override fun onDestroy() {
        pendingWebPermissionRequest?.deny()
        pendingWebPermissionRequest = null
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null

        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.webChromeClient = null
            webView.webViewClient = WebViewClient()
            webView.removeJavascriptInterface("AndroidBridge")
            webView.destroy()
        }
        super.onDestroy()
    }
}
