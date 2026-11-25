/* ===== VTuber Forge — js/core/pc_compat2.js ===== */
// Modul Pendamping & Optimasi untuk pc_compat.js (Buffer Pooling, Morph Guard, & Device Limits)

(function () {
    'use strict';

    // Pool sederhana untuk menghindari alokasi ulang TypedArray berulang kali pada mesh/morph
    const bufferPool = {
        f32: new Map(),
        u16: new Map(),
        u32: new Map(),
        u8: new Map()
    };

    const MAX_POOL_ENTRIES_PER_BUCKET = 4;

    function getGraphicsDevice(explicitDevice) {
        if (explicitDevice) return explicitDevice;
        if (typeof window.getPcApp === 'function') {
            const a = window.getPcApp();
            if (a && a.graphicsDevice) return a.graphicsDevice;
        }
        if (typeof window.app !== 'undefined' && window.app && window.app.graphicsDevice) {
            return window.app.graphicsDevice;
        }
        return null;
    }

    /**
     * Mengambil TypedArray dari pool atau membuat baru jika belum tersedia,
     * serta memastikan nilainya bersih (zero-filled).
     */
    function acquireTypedArray(type, length) {
        const len = Math.max(0, Math.floor(Number(length) || 0));
        if (len === 0) {
            if (type === 'u8') return new Uint8Array(0);
            if (type === 'u16') return new Uint16Array(0);
            if (type === 'u32') return new Uint32Array(0);
            return new Float32Array(0);
        }

        const bucketMap = bufferPool[type];
        if (bucketMap && bucketMap.has(len)) {
            const list = bucketMap.get(len);
            if (list && list.length > 0) {
                const reused = list.pop();
                reused.fill(0);
                return reused;
            }
        }

        if (type === 'u8') return new Uint8Array(len);
        if (type === 'u16') return new Uint16Array(len);
        if (type === 'u32') return new Uint32Array(len);
        return new Float32Array(len);
    }

    /**
     * Mengembalikan TypedArray sementara ke pool agar GC di Android WebView tidak bekerja terlalu berat.
     */
    function releaseTypedArray(arr) {
        if (!arr || !arr.buffer || typeof arr.length !== 'number' || arr.length <= 0) return;
        // Hindari menyimpan array raksasa (> 1 juta elemen) agar tidak menahan RAM
        if (arr.length > 1000000) return;

        let type = null;
        if (arr instanceof Float32Array) type = 'f32';
        else if (arr instanceof Uint32Array) type = 'u32';
        else if (arr instanceof Uint16Array) type = 'u16';
        else if (arr instanceof Uint8Array) type = 'u8';
        if (!type) return;

        const bucketMap = bufferPool[type];
        if (!bucketMap.has(arr.length)) {
            bucketMap.set(arr.length, []);
        }
        const list = bucketMap.get(arr.length);
        if (list.length < MAX_POOL_ENTRIES_PER_BUCKET) {
            list.push(arr);
        }
    }

    function clearBufferPool() {
        bufferPool.f32.clear();
        bufferPool.u16.clear();
        bufferPool.u32.clear();
        bufferPool.u8.clear();
    }

    /**
     * Mendeteksi batas kemampuan GPU WebGL/PlayCanvas pada perangkat saat ini
     * (misalnya dukungan index 32-bit, batas bone per mesh, max texture size).
     */
    function getDeviceCapabilities(explicitDevice) {
        const gd = getGraphicsDevice(explicitDevice);
        if (!gd) {
            return {
                ready: false,
                extUint32Index: true,
                maxBones: 64,
                maxTextureSize: 2048,
                webgl2: false
            };
        }

        return {
            ready: true,
            extUint32Index: Boolean(gd.extUintElement || gd.webgl2),
            maxBones: typeof gd.maxBones === 'number' && gd.maxBones > 0 ? gd.maxBones : 64,
            maxTextureSize: typeof gd.maxTextureSize === 'number' && gd.maxTextureSize > 0 ? gd.maxTextureSize : 2048,
            webgl2: Boolean(gd.webgl2)
        };
    }

    /**
     * Memastikan kelipatan panjang array dan byte alignment (4-byte aligned)
     * sebelum dikirim ke PlayCanvas untuk mencegah RangeError: Invalid typed array length.
     */
    function ensureAlignedIndexBuffer(idx, numVerts, explicitDevice) {
        const caps = getDeviceCapabilities(explicitDevice);
        const verts = Math.max(0, Math.floor(Number(numVerts) || 0));
        if (!idx || idx.length < 3 || verts <= 0) return null;

        const triCount = Math.floor(idx.length / 3) * 3;
        if (triCount <= 0) return null;

        let maxIdx = 0;
        for (let i = 0; i < triCount; i++) {
            const v = Number(idx[i]);
            if (Number.isFinite(v) && v >= 0 && v < verts && v > maxIdx) {
                maxIdx = Math.floor(v);
            }
        }

        // Jika indeks melebihi 65535 atau jumlah elemen ganjil (byteLength Uint16 tidak kelipatan 4)
        const need32 = (maxIdx > 65535) || (triCount % 2 !== 0);
        if (need32 && caps.extUint32Index) {
            const out32 = new Uint32Array(triCount);
            for (let i = 0; i < triCount; i++) {
                const v = Number(idx[i]);
                out32[i] = (Number.isFinite(v) && v >= 0 && v < verts) ? Math.floor(v) : 0;
            }
            return out32;
        }

        // Fallback jika WebGL1 tanpa OES_element_index_uint atau jumlah genap <= 65535:
        // Jika triCount ganjil pada Uint16, tambahkan 1 segitiga degeneratif (3 indeks = +3 elemen -> jadi genap!)
        const isOdd = (triCount % 2 !== 0);
        const finalLen = isOdd ? (triCount + 3) : triCount;
        const out16 = new Uint16Array(finalLen);
        for (let i = 0; i < triCount; i++) {
            const v = Number(idx[i]);
            out16[i] = (Number.isFinite(v) && v >= 0 && v < verts && v <= 65535) ? Math.floor(v) : 0;
        }
        // Padding 3 indeks nol (segitiga luas 0, tidak terlihat di render) agar jumlah elemen genap & byteLength kelipatan 4
        if (isOdd) {
            out16[triCount] = 0;
            out16[triCount + 1] = 0;
            out16[triCount + 2] = 0;
        }
        return out16;
    }

    /**
     * Normalisasi bobot tulang (skin weights) per vertex agar total bobot = 1.0
     * dan indeks tulang tidak melebihi jumlah bone valid.
     */
    function sanitizeSkinAttributes(joints, weights, numVerts, maxBoneCount) {
        const verts = Math.max(0, Math.floor(Number(numVerts) || 0));
        const boneLimit = Math.max(1, Math.floor(Number(maxBoneCount) || 256));
        const jOut = new Uint8Array(verts * 4);
        const wOut = new Float32Array(verts * 4);

        if (!joints || !weights || verts <= 0) {
            return { joints: jOut, weights: wOut, valid: false };
        }

        const has4J = joints.length >= verts * 4;
        const has4W = weights.length >= verts * 4;

        for (let v = 0; v < verts; v++) {
            const j0 = Math.max(0, Math.min(boneLimit - 1, Math.floor(Number(joints[v * 3]) || 0)));
            const j1 = Math.max(0, Math.min(boneLimit - 1, Math.floor(Number(joints[v * 3 + 1]) || 0)));
            const j2 = Math.max(0, Math.min(boneLimit - 1, Math.floor(Number(joints[v * 3 + 2]) || 0)));
            const j3 = has4J
                ? Math.max(0, Math.min(boneLimit - 1, Math.floor(Number(joints[v * 4 + 3]) || 0)))
                : 0;

            let w0 = Math.max(0, Number(weights[v * 3]) || 0);
            let w1 = Math.max(0, Number(weights[v * 3 + 1]) || 0);
            let w2 = Math.max(0, Number(weights[v * 3 + 2]) || 0);
            let w3 = has4W ? Math.max(0, Number(weights[v * 4 + 3]) || 0) : 0;

            const sum = w0 + w1 + w2 + w3;
            if (sum > 0.00001 && Number.isFinite(sum)) {
                const inv = 1.0 / sum;
                w0 *= inv;
                w1 *= inv;
                w2 *= inv;
                w3 *= inv;
            } else {
                w0 = 1.0;
                w1 = 0;
                w2 = 0;
                w3 = 0;
            }

            jOut[v * 4] = j0;
            jOut[v * 4 + 1] = j1;
            jOut[v * 4 + 2] = j2;
            jOut[v * 4 + 3] = j3;

            wOut[v * 4] = w0;
            wOut[v * 4 + 1] = w1;
            wOut[v * 4 + 2] = w2;
            wOut[v * 4 + 3] = w3;
        }

        return { joints: jOut, weights: wOut, valid: true };
    }

    /**
     * Pembungkus pembuatan pc.Morph yang aman terhadap target kosong atau delta array tidak selaras.
     */
    function buildMorphSafe(rawTargets, numVerts, explicitDevice) {
        const gd = getGraphicsDevice(explicitDevice);
        const verts = Math.max(0, Math.floor(Number(numVerts) || 0));
        if (!gd || !Array.isArray(rawTargets) || rawTargets.length === 0 || verts <= 0) {
            return null;
        }

        const expectedLen = verts * 3;
        const targets = [];

        for (let i = 0; i < rawTargets.length; i++) {
            const rt = rawTargets[i];
            if (!rt) continue;

            const dPos = new Float32Array(expectedLen);
            if (rt.deltaPositions && rt.deltaPositions.length > 0) {
                const copyLen = Math.min(rt.deltaPositions.length, expectedLen);
                for (let p = 0; p < copyLen; p++) {
                    const val = Number(rt.deltaPositions[p]);
                    dPos[p] = Number.isFinite(val) ? val : 0;
                }
            }

            let dNorm = null;
            if (rt.deltaNormals && rt.deltaNormals.length > 0) {
                dNorm = new Float32Array(expectedLen);
                const copyLen = Math.min(rt.deltaNormals.length, expectedLen);
                for (let p = 0; p < copyLen; p++) {
                    const val = Number(rt.deltaNormals[p]);
                    dNorm[p] = Number.isFinite(val) ? val : 0;
                }
            }

            targets.push(new pc.MorphTarget({
                name: rt.name || ('Shape_' + i),
                deltaPositions: dPos,
                deltaNormals: dNorm
            }));
        }

        if (targets.length === 0) return null;

        try {
            return new pc.Morph(targets, gd);
        } catch (err) {
            console.warn('pc_compat2: Gagal membuat pc.Morph, fallback tanpa morph:', err);
            return null;
        }
    }

    // Hubungkan otomatis ke window.VtfPcCompat jika sudah dimuat lebih dulu
    function attachToPrimaryCompat() {
        if (window.VtfPcCompat && typeof window.VtfPcCompat === 'object') {
            window.VtfPcCompat.optimizer = window.VtfPcCompat2;
            window.VtfPcCompat.buildSafeIndexArray = function (idx, numVerts) {
                return ensureAlignedIndexBuffer(idx, numVerts);
            };
        }
    }

    window.VtfPcCompat2 = {
        version: '1.0.0',
        acquireTypedArray: acquireTypedArray,
        releaseTypedArray: releaseTypedArray,
        clearBufferPool: clearBufferPool,
        getDeviceCapabilities: getDeviceCapabilities,
        ensureAlignedIndexBuffer: ensureAlignedIndexBuffer,
        sanitizeSkinAttributes: sanitizeSkinAttributes,
        buildMorphSafe: buildMorphSafe
    };

    attachToPrimaryCompat();
})();
