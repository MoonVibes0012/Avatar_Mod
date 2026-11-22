package com.vtuberforge

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

class WebViewBridge(
    private val webView: WebView,
    private val fileIoBridge: FileIoBridge,
    private val onRequestFilePick: ((acceptMime: String) -> Unit)? = null
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun postMessage(rawPayload: String?) {
        if (rawPayload.isNullOrBlank()) return
        mainHandler.post {
            try {
                val json = JSONObject(rawPayload)
                val type = json.optString("type", "")
                when (type) {
                    "debug" -> {
                        val msg = json.optString("message", "")
                        Log.d(TAG, "JS Debug: $msg")
                    }
                    "status" -> {
                        val msg = json.optString("message", "")
                        Log.i(TAG, "JS Status: $msg")
                    }
                    "pickFile" -> {
                        val accept = json.optString("accept", "*/*")
                        onRequestFilePick?.invoke(accept)
                    }
                    "saveText" -> {
                        val fileName = json.optString("fileName", "scene.json")
                        val content = json.optString("content", "")
                        val mimeType = json.optString("mimeType", "application/json")
                        val ok = fileIoBridge.saveTextFile(fileName, content, mimeType)
                        dispatchEventToJs(
                            "nativeSaveResult",
                            JSONObject()
                                .put("ok", ok)
                                .put("fileName", fileName)
                        )
                    }
                    "gpuInfo" -> {
                        val info = json.optJSONObject("info") ?: JSONObject()
                        Log.d(TAG, "GPU Info: $info")
                    }
                    else -> {
                        Log.d(TAG, "Unhandled bridge event [$type]: $rawPayload")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to parse bridge payload: $rawPayload", e)
            }
        }
    }

    @JavascriptInterface
    fun log(message: String?) {
        if (!message.isNullOrEmpty()) {
            Log.d(TAG, message)
        }
    }

    fun dispatchEventToJs(eventName: String, payload: JSONObject) {
        val safeEvent = JSONObject.quote(eventName)
        val safePayload = JSONObject.quote(payload.toString())
        val script = """
            (function() {
                if (typeof window.onNativeBridgeEvent === 'function') {
                    window.onNativeBridgeEvent($safeEvent, $safePayload);
                }
                window.dispatchEvent(new CustomEvent('vtuberforge:native', {
                    detail: { event: $safeEvent, payload: $safePayload }
                }));
            })();
        """.trimIndent()

        mainHandler.post {
            try {
                webView.evaluateJavascript(script, null)
            } catch (e: Exception) {
                Log.e(TAG, "evaluateJavascript failed for event: $eventName", e)
            }
        }
    }

    companion object {
        private const val TAG = "WebViewBridge"
        const val BRIDGE_NAME = "VTuberNativeBridge"
    }
}
