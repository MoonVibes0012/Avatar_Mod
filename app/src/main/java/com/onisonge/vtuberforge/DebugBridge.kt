package com.onisonge.vtuberforge

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
    companion object { const val TAG = "VTuberForge_Debug" }

    @JavascriptInterface
    fun log(message: String) {
        Log.d(TAG, "JS_LOG: $message")
    }

    @JavascriptInterface
    fun exitApp() {
        (context as MainActivity).runOnUiThread { context.finishAffinity() }
    }

    @JavascriptInterface
    fun downloadFile(filename: String, base64Data: String, mimeType: String) {
        try {
            val decodedBytes = Base64.decode(base64Data, Base64.DEFAULT)
            val downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            
            if (downloadsDir == null) {
                (context as MainActivity).runOnUiThread {
                    Toast.makeText(context, "Penyimpanan tidak tersedia!", Toast.LENGTH_SHORT).show()
                }
                return
            }

            val safeName = filename.replace(Regex("[^a-zA-Z0-9._-]"), "_")
            val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
            val nameWithoutExt = safeName.substringBeforeLast(".")
            val ext = safeName.substringAfterLast(".", "")
            val newFilename = "${nameWithoutExt}_${timeStamp}.$ext"
            
            val file = File(downloadsDir, newFilename)
            val fos = FileOutputStream(file)
            fos.write(decodedBytes)
            fos.close()
            
            (context as MainActivity).runOnUiThread {
                Toast.makeText(context, "Tersimpan: ${file.name}", Toast.LENGTH_LONG).show()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Gagal download: ${e.message}")
            (context as MainActivity).runOnUiThread {
                Toast.makeText(context, "Gagal menyimpan file", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
