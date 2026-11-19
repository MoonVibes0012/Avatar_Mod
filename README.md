# VTuber Forge

Editor avatar Android offline yang mengutamakan perangkat seluler. Editor ini dibundel di dalam APK dan tidak memerlukan jaringan saat dijalankan.

## Fitur Utama

- Editor anatomi per-bagian parametrik: tinggi, lebar, kedalaman, volume, pembentukan otot/jaringan lunak, tag wilayah, dan kontrol reset
- Anatomi dasar yang dapat diedit secara detail: dada, payudara, panggul, leher, kepala, telinga, mata, hidung, mulut, rambut, lengan atas/bawah, tangan, jari-jari, paha, betis, kaki, dan jari kaki
- Viewport 3D WebGL dengan orbit/zoom sentuh dan pemilihan ketuk
- Bagian avatar prosedural dan primitif (cube, sphere, cylinder, capsule)
- Transformasi objek dan kontrol material (warna, gloss, metalness)
- Mode verteks dengan pengeditan per-verteks (maks 5000 vertex)
- Hierarki tulang / status target IK dan kontrol ekspresi
- Status garis waktu/keyframe
- Penyimpanan otomatis offline ke penyimpanan lokal perangkat
- Undo/Redo dengan stack management
- ASTC texture optimization untuk Mali GPU (otomatis saat import)
- Intent handler untuk membuka file GLB/VRM langsung dari file manager

## Editor Anatomi

- Kontrol parametrik per bagian tubuh
- Transformasi posisi, rotasi, dan scale dengan slider + number input
- Grid snap untuk presisi penempatan
- Mirror X untuk simetri
- Center untuk reset posisi
- Smooth mesh dengan algoritma Laplacian (maks 20k vertex)
- Split Parts untuk memisahkan mesh berdasarkan connected components
- Split Material untuk memisahkan mesh berdasarkan material berbeda

## Mode Editing

- Mode Object: transformasi objek (posisi/rotasi/scale)
- Mode Vertex: pengeditan per-vertex dengan slider X/Y/Z
- Mode Bone: rotasi bone individual untuk model skinned
- Reset Bone dan Reset All untuk kembali ke bind pose
- Duplicate, Delete, dan operasi objek lainnya
- New Scene untuk menghapus semua objek

## Animasi & Tracking

- Auto-Spin, Idle Pulse, dan Spring Wobble procedural
- Animation Clip playback (Play/Pause/Stop) dari model import
- Character Driver dengan fitur:
  - Auto-Blink (kedipan mata natural)
  - Breathing (gerakan napas pada spine/chest)
  - Idle Sway (goyangan badan halus)
  - Head Bob (anggukan kepala natural)
  - Walk Cycle (animasi jalan procedural)
  - Reset Pose dan Detach
- Face Tracking dengan MediaPipe + Kalidokit
- Blendshape/Morph Targets dengan slider per-morph
- Expression Presets: neutral, smile, laugh, surprise, angry, sad, wink, shock, happy, cool, love
- Custom Expression save/load ke localStorage
- Intensity control untuk expression

## Import & Export

- Import biner GLB/VRM untuk geometri mesh
- Import via file picker atau intent Android
- Export OBJ dengan vertex/UV/normal
- Export GLB (biner glTF)
- Export VRM 1.0 dengan metadata humanoid, ekspresi, metadata orang-pertama/lihat-dan ekstensi spring-bone
- Screenshot viewport ke PNG
- Save/Load scene ke `.vforge.json`
- Save Debug Log untuk troubleshooting

## Build APK

- GitHub Actions membangun `app-debug.apk` saat push atau dispatch manual
- Alur kerja ini menginstal Android SDK 35 dan Gradle 8.10
- APK diunggah sebagai artifact `vtuber-forge-debug-apk`
- Target SDK 35 (Android 15)
- Min SDK 26 (Android 8.0 Oreo)
- ABI filter: arm64-v8a dan armeabi-v7a
- Java 17 dan Kotlin 2.0.21

## Runtime

- Tidak ada CDN, server web, akun, atau koneksi jaringan yang diperlukan oleh editor
- WebView dengan hardware acceleration
- Large heap enabled untuk model besar
- Render process gone handler untuk crash recovery
- Trim memory handler untuk low memory condition
- Cache cleanup otomatis untuk file intent lama (>24 jam)
- File download ke folder Downloads dengan timestamp

## Catatan Penting tentang Format

- Ekspor VRM dihasilkan secara lokal sebagai biner glTF VRM 1.0 dengan metadata humanoid
- Aset VRM kompleks yang dibuat secara eksternal mungkin berisi data skinning, morph, tekstur, MToon, dan spring yang belum dipertahankan oleh editor ringan ini saat impor bolak-balik
- Model skinned tidak bisa di-duplicate, di-save ke JSON, atau di-undo/redo (batasan engine)
- Mesh Draco compressed tidak didukung untuk edit vertex
- File JSON hanya menyimpan bentuk/warna, tekstur gambar akan hilang (menjadi warna solid)
- Split Parts tidak mendukung skinned mesh (hanya mesh statis)

## Penjelasan Folder

- `.github/workflows/` — konfigurasi GitHub Actions untuk build APK otomatis
- `app/src/main/java/` — kode Kotlin untuk Android native (WebView host + JS bridge)
- `app/src/main/assets/` — file HTML, CSS, dan JavaScript editor
- `app/src/main/assets/js/core/` — konfigurasi, debug logging, dan inisialisasi aplikasi
- `app/src/main/assets/js/camera/` — kontrol kamera orbit, zoom, dan raycast
- `app/src/main/assets/js/entities/` — pembuatan, seleksi, operasi, dan split objek
- `app/src/main/assets/js/editing/` — mode edit vertex, bone, dan smooth mesh
- `app/src/main/assets/js/animation/` — character driver untuk animasi procedural
- `app/src/main/assets/js/io/` — import GLB/VRM, export OBJ/VRM, save/load JSON
- `app/src/main/assets/js/scene/` — serialisasi scene (placeholder)
- `app/src/main/assets/js/tracking/` — face tracking dengan MediaPipe
- `app/src/main/assets/js/ui/` — toolbar bindings dan expression presets
- `app/src/main/res/values/` — string resources dan theme styling Android
