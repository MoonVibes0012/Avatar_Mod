/* ===== VTuber Forge — js/core/pc_compat.js ===== */
// Modul Kompatibilitas PlayCanvas (Safe Mesh Streams, Indices, Normals & Morph)

(function () {
    'use strict';

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

    function toFloat32Safe(arr, expectedLen) {
        const len = Math.max(0, Math.floor(Number(expectedLen) || 0));
        const out = new Float32Array(len);
        if (!arr || len === 0) return out;
        const copyLen = Math.min(arr.length || 0, len);
        for (let i = 0; i < copyLen; i++) {
            const v = Number(arr[i]);
            out[i] = Number.isFinite(v) ? v : 0;
        }
        return out;
    }

    function toUint8Safe(arr, expectedLen) {
        const len = Math.max(0, Math.floor(Number(expectedLen) || 0));
        const out = new Uint8Array(len);
        if (!arr || len === 0) return out;
        const copyLen = Math.min(arr.length || 0, len);
        for (let i = 0; i < copyLen; i++) {
            const v = Number(arr[i]);
            out[i] = Number.isFinite(v) ? Math.max(0, Math.min(255, Math.floor(v))) : 0;
        }
        return out;
    }

    function buildSafeIndexArray(idx, numVerts) {
        const verts = Math.max(0, Math.floor(Number(numVerts) || 0));
        if (!idx || idx.length < 3 || verts <= 0) return null;

        const triCount = Math.floor(idx.length / 3) * 3;
        if (triCount <= 0) return null;

        let maxIdx = 0;
        const plain = new Array(triCount);
        for (let i = 0; i < triCount; i++) {
            let v = Number(idx[i]);
            if (!Number.isFinite(v) || v < 0 || v >= verts) v = 0;
            else v = Math.floor(v);
            plain[i] = v;
            if (v > maxIdx) maxIdx = v;
        }

        // Gunakan Uint32Array jika indeks > 65535 atau jumlah elemen ganjil (menghindari byteLength kelipatan 2 non-4)
        const useUint32 = (maxIdx > 65535) || (plain.length % 2 !== 0);
        return useUint32 ? new Uint32Array(plain) : new Uint16Array(plain);
    }

    function computeNormalsSafe(posArr, idxArr, numVerts) {
        const verts = Math.max(0, Math.floor(Number(numVerts) || 0));
        const fallback = new Float32Array(verts * 3);
        for (let i = 1; i < fallback.length; i += 3) {
            fallback[i] = 1; // (0, 1, 0)
        }

        if (!posArr || posArr.length < verts * 3 || verts <= 0) return fallback;

        try {
            if (typeof pc !== 'undefined' && typeof pc.calculateNormals === 'function') {
                const idxArg = (idxArr && idxArr.length >= 3)
                    ? Array.from(idxArr)
                    : Array.from({ length: verts }, (_, k) => k);
                const calc = pc.calculateNormals(posArr, idxArg);
                if (calc && calc.length >= verts * 3) {
                    return toFloat32Safe(calc, verts * 3);
                }
            }
        } catch (e) {
            // Fallback ke normal default jika pc.calculateNormals gagal pada variasi mesh tertentu
        }
        return fallback;
    }

    function setVertexStreamSafe(mesh, semantic, dataTypedArray, components, dataType, normalize) {
        if (!mesh || !dataTypedArray || dataTypedArray.length === 0) return false;
        if (typeof mesh.setVertexStream !== 'function') return false;

        try {
            mesh.setVertexStream(semantic, dataTypedArray, components, dataType, !!normalize);
            return true;
        } catch (e1) {
            // Beberapa versi PlayCanvas menerima setVertexStream tanpa argumen ke-5/ke-6 atau dengan semantic string
            try {
                mesh.setVertexStream(semantic, dataTypedArray, components, dataType);
                return true;
            } catch (e2) {
                return false;
            }
        }
    }

    function updateMeshSafe(mesh) {
        if (!mesh || typeof mesh.update !== 'function') return false;
        try {
            mesh.update();
            return true;
        } catch (e1) {
            try {
                mesh.update(true, true);
                return true;
            } catch (e2) {
                throw e1;
            }
        }
    }

    function buildMeshCompat(opts) {
        const o = opts || {};
        const gd = getGraphicsDevice(o.graphicsDevice);
        if (!gd || typeof pc === 'undefined' || !pc.Mesh) {
            throw new Error('PlayCanvas GraphicsDevice atau pc.Mesh belum tersedia.');
        }

        const numVerts = Math.max(0, Math.floor(Number(o.numVerts) || 0));
        if (numVerts <= 0) {
            throw new Error('Jumlah vertex tidak valid (numVerts <= 0).');
        }

        const mesh = new pc.Mesh(gd);
        const posArr = toFloat32Safe(o.positions, numVerts * 3);
        const safeIdx = buildSafeIndexArray(o.indices, numVerts);

        let normArr;
        if (o.normals && o.normals.length >= numVerts * 3) {
            normArr = toFloat32Safe(o.normals, numVerts * 3);
        } else {
            normArr = computeNormalsSafe(posArr, safeIdx, numVerts);
        }

        mesh.setPositions(posArr);
        mesh.setNormals(normArr);

        if (o.uvs && o.uvs.length >= numVerts * 2) {
            const uvArr = toFloat32Safe(o.uvs, numVerts * 2);
            if (typeof mesh.setUvs === 'function') {
                mesh.setUvs(0, uvArr);
            }
        }

        let skinApplied = false;
        if (o.joints && o.weights && o.joints.length >= numVerts * 3 && o.weights.length >= numVerts * 3) {
            const jArr = new Uint8Array(numVerts * 4);
            const wArr = new Float32Array(numVerts * 4);
            const has4J = o.joints.length >= numVerts * 4;
            const has4W = o.weights.length >= numVerts * 4;

            for (let v = 0; v < numVerts; v++) {
                jArr[v * 4] = toUint8Safe([o.joints[v * 3]], 1)[0];
                jArr[v * 4 + 1] = toUint8Safe([o.joints[v * 3 + 1]], 1)[0];
                jArr[v * 4 + 2] = toUint8Safe([o.joints[v * 3 + 2]], 1)[0];
                jArr[v * 4 + 3] = has4J ? toUint8Safe([o.joints[v * 4 + 3]], 1)[0] : 0;

                wArr[v * 4] = Number.isFinite(Number(o.weights[v * 3])) ? Number(o.weights[v * 3]) : 0;
                wArr[v * 4 + 1] = Number.isFinite(Number(o.weights[v * 3 + 1])) ? Number(o.weights[v * 3 + 1]) : 0;
                wArr[v * 4 + 2] = Number.isFinite(Number(o.weights[v * 3 + 2])) ? Number(o.weights[v * 3 + 2]) : 0;
                wArr[v * 4 + 3] = has4W && Number.isFinite(Number(o.weights[v * 4 + 3]))
                    ? Number(o.weights[v * 4 + 3])
                    : 0;
            }

            const okJ = setVertexStreamSafe(mesh, pc.SEMANTIC_BLENDINDICES, jArr, 4, pc.TYPE_UINT8, false);
            const okW = setVertexStreamSafe(mesh, pc.SEMANTIC_BLENDWEIGHT, wArr, 4, pc.TYPE_FLOAT32, false);
            skinApplied = okJ && okW;
        }

        if (safeIdx && safeIdx.length >= 3) {
            mesh.setIndices(safeIdx);
        }

        updateMeshSafe(mesh);

        return {
            mesh: mesh,
            posArr: posArr,
            normArr: normArr,
            safeIdx: safeIdx,
            skinApplied: skinApplied
        };
    }

    window.VtfPcCompat = {
        version: '1.0.0',
        toFloat32Safe: toFloat32Safe,
        toUint8Safe: toUint8Safe,
        buildSafeIndexArray: buildSafeIndexArray,
        computeNormalsSafe: computeNormalsSafe,
        setVertexStreamSafe: setVertexStreamSafe,
        updateMeshSafe: updateMeshSafe,
        buildMeshCompat: buildMeshCompat
    };
})();
