package com.onisonge.vtuberforge

import android.app.Activity
import android.content.Context
import android.os.Environment
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DebugBridge(private val context: Context) {
    companion object {
        const val TAG = "VTuberForge_Debug"
    }

    private fun runOnUiThreadSafe(action: () -> Unit) {
        val act = context as? Activity
        if (act != null && !act.isFinishing && !act.isDestroyed) {
            act.runOnUiThread {
                if (!act.isFinishing && !act.isDestroyed) {
                    action()
                }
            }
        }
    }

    @JavascriptInterface
    fun log(message: String) {
        Log.d(TAG, "JS_LOG: $message")
    }

    @JavascriptInterface
    fun exitApp() {
        runOnUiThreadSafe {
            val act = context as? Activity
            act?.finishAffinity()
        }
    }

    @JavascriptInterface
    fun downloadFile(filename: String, base64Data: String, mimeType: String) {
        try {
            val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
            val downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)

            if (downloadsDir == null) {
                runOnUiThreadSafe {
                    Toast.makeText(context, "Penyimpanan tidak tersedia!", Toast.LENGTH_SHORT).show()
                }
                return
            }

            val rawName = if (filename.isBlank()) "vtuber_export" else filename
            val safeName = rawName.replace(Regex("[^a-zA-Z0-9._-]"), "_").ifBlank { "vtuber_export" }
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val hasDot = safeName.contains(".") && !safeName.startsWith(".")
            val nameWithoutExt = if (hasDot) safeName.substringBeforeLast(".") else safeName
            val ext = if (hasDot) safeName.substringAfterLast(".", "") else ""
            val newFilename = if (ext.isNotEmpty()) {
                "${nameWithoutExt}_${timeStamp}.$ext"
            } else {
                "${nameWithoutExt}_${timeStamp}"
            }

            val file = File(downloadsDir, newFilename)
            FileOutputStream(file).use { fos ->
                fos.write(decodedBytes)
            }

            runOnUiThreadSafe {
                Toast.makeText(context, "Tersimpan: ${file.name}", Toast.LENGTH_LONG).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gagal download: ${e.message}")
            runOnUiThreadSafe {
                Toast.makeText(context, "Gagal menyimpan file", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
