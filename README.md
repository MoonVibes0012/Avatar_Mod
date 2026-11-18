# VTuber Forge

Editor avatar Android offline yang mengutamakan perangkat seluler. Editor ini dibundel di dalam APK dan tidak memerlukan jaringan saat dijalankan.

## Diimplementasikan

- Editor anatomi per-bagian parametrik: tinggi, lebar, kedalaman, volume, pembentukan otot/jaringan lunak, tag wilayah, dan kontrol reset.
- Anatomi dasar yang dapat diedit secara detail: dada, payudara, panggul, leher, kepala, telinga, mata, hidung, mulut, rambut, lengan atas/bawah, tangan, jari-jari, paha, betis, kaki, dan jari kaki.
- Viewport 3D WebGL dengan orbit/zoom sentuh dan pemilihan ketuk
- Bagian avatar prosedural dan primitif
- Transformasi objek dan kontrol material
- Mode verteks dengan pengeditan per-verteks
- Hierarki tulang / status target IK dan kontrol ekspresi
- Status garis waktu/keyframe
- Penyimpanan otomatis offline ke penyimpanan lokal perangkat
- Simpan/muat proyek `.vforge.json`
- Ekspor OBJ
- Ekspor GLB
- Impor biner GLB/VRM untuk geometri mesh
- Ekspor biner VRM 1.0 dengan metadata humanoid, ekspresi, metadata orang-pertama/lihat-dan ekstensi spring-bone

## Build APK

GitHub Actions membangun `app-debug.apk` saat push atau dispatch manual. Alur kerja ini menginstal Android SDK 35 dan Gradle 8.10, lalu mengunggah APK sebagai `vtuber-forge-debug-apk`.

## Runtime

Tidak ada CDN, server web, akun, atau koneksi jaringan yang diperlukan oleh editor.

## Catatan penting tentang format

Ekspor VRM dihasilkan secara lokal sebagai biner glTF VRM 1.0 dengan metadata humanoid. Aset VRM kompleks yang dibuat secara eksternal mungkin berisi data skinning, morph, tekstur, MToon, dan spring yang belum dipertahankan oleh editor ringan ini saat impor bolak-balik.
