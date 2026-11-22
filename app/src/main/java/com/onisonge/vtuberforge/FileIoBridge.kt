package com.vtuberforge

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.nio.charset.StandardCharsets

class FileIoBridge(private val context: Context) {

    data class PickedFilePayload(
        val fileName: String,
        val mimeType: String,
        val base64Data: String,
        val sizeBytes: Int
    )

    fun readFileToBase64(uri: Uri, maxBytes: Int = MAX_PICK_BYTES): PickedFilePayload? {
        return try {
            val resolver = context.contentResolver
            val mimeType = resolver.getType(uri) ?: guessMimeFromUri(uri)
            val fileName = queryDisplayName(uri) ?: "imported_asset"

            val bytes = resolver.openInputStream(uri)?.use { input ->
                readBoundedBytes(input, maxBytes)
            } ?: return null

            val encoded = Base64.encodeToString(bytes, Base64.NO_WRAP)
            PickedFilePayload(
                fileName = fileName,
                mimeType = mimeType,
                base64Data = encoded,
                sizeBytes = bytes.size
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed reading file from uri: $uri", e)
            null
        }
    }

    fun saveTextFile(
        fileName: String,
        content: String,
        mimeType: String = "application/json"
    ): Boolean {
        val cleanName = sanitizeFileName(fileName)
        val rawBytes = content.toByteArray(StandardCharsets.UTF_8)
        return writeBytesToDownloadsOrAppDir(cleanName, rawBytes, mimeType)
    }

    fun saveBase64File(
        fileName: String,
        base64Data: String,
        mimeType: String = "application/octet-stream"
    ): Boolean {
        return try {
            val cleanName = sanitizeFileName(fileName)
            val rawBytes = Base64.decode(base64Data, Base64.DEFAULT)
            writeBytesToDownloadsOrAppDir(cleanName, rawBytes, mimeType)
        } catch (e: Exception) {
            Log.e(TAG, "Failed decoding base64 for file: $fileName", e)
            false
        }
    }

    private fun writeBytesToDownloadsOrAppDir(
        fileName: String,
        bytes: ByteArray,
        mimeType: String
    ): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/VTuberForge")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: return writeToFallbackDir(fileName, bytes)

                resolver.openOutputStream(itemUri)?.use { out ->
                    out.write(bytes)
                    out.flush()
                }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(itemUri, values, null, null)
                true
            } else {
                writeToFallbackDir(fileName, bytes)
            }
        } catch (e: Exception) {
            Log.w(TAG, "MediaStore save failed, trying fallback dir for $fileName", e)
            writeToFallbackDir(fileName, bytes)
        }
    }

    private fun writeToFallbackDir(fileName: String, bytes: ByteArray): Boolean {
        return try {
            val outDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir
            val folder = File(outDir, "VTuberForge").apply {
                if (!exists()) mkdirs()
            }
            val target = File(folder, fileName)
            FileOutputStream(target).use { fos ->
                fos.write(bytes)
                fos.flush()
            }
            true
        } catch (e: Exception) {
            Log.e(TAG, "Fallback file save failed for $fileName", e)
            false
        }
    }

    private fun readBoundedBytes(input: InputStream, maxBytes: Int): ByteArray {
        val buffer = ByteArray(16 * 1024)
        val out = ByteArrayOutputStream()
        var total = 0
        while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            total += read
            if (total > maxBytes) {
                throw IllegalArgumentException("Ukuran file melebihi batas maksimum (${maxBytes / (1024 * 1024)} MB).")
            }
            out.write(buffer, 0, read)
        }
        return out.toByteArray()
    }

    private fun queryDisplayName(uri: Uri): String? {
        return try {
            context.contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)
                ?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                        if (idx >= 0) cursor.getString(idx) else null
                    } else {
                        null
                    }
                }
        } catch (e: Exception) {
            null
        }
    }

    private fun guessMimeFromUri(uri: Uri): String {
        val lower = (uri.lastPathSegment ?: uri.toString()).lowercase()
        return when {
            lower.endsWith(".dds") -> "image/vnd-ms.dds"
            lower.endsWith(".glb") || lower.endsWith(".vrm") -> "model/gltf-binary"
            lower.endsWith(".gltf") -> "model/gltf+json"
            lower.endsWith(".obj") -> "text/plain"
            lower.endsWith(".json") -> "application/json"
            else -> "application/octet-stream"
        }
    }

    private fun sanitizeFileName(raw: String): String {
        val base = raw.substringAfterLast('/').substringAfterLast('\\').trim()
        val cleaned = base.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        return if (cleaned.isBlank()) "vtuber_forge_file" else cleaned
    }

    companion object {
        private const val TAG = "FileIoBridge"
        const val MAX_PICK_BYTES = 64 * 1024 * 1024
    }
}
