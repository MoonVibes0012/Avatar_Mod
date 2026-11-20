/* ===== VTuber Forge — js/io/vrm_exporter.js ===== */
// Pembentukan buffer binary GLB + ekstensi VRM 0.0 dan fungsi exportVRM

(function () {
    'use strict';

    function logVrmExport(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getVrmExportApp() {
        if (typeof window.getPcApp === 'function') {
            const pcApp = window.getPcApp();
            if (pcApp) return pcApp;
        }
        if (typeof window.app !== 'undefined' && window.app) return window.app;
        try {
            if (typeof app !== 'undefined' && app) return app;
        } catch (e) {}
        return null;
    }

    function getSelectedEntitySafe() {
        if (typeof window.S !== 'undefined' && window.S) return window.S.selected || null;
        try {
            if (typeof S !== 'undefined' && S) return S.selected || null;
        } catch (e) {}
        return null;
    }

    function extractNodeTransform(entity) {
        const nodeTransform = {};
        if (!entity) return nodeTransform;

        try {
            if (typeof entity.getLocalPosition === 'function') {
                const p = entity.getLocalPosition();
                if (p && isFinite(p.x) && isFinite(p.y) && isFinite(p.z)) {
                    nodeTransform.translation = [Number(p.x), Number(p.y), Number(p.z)];
                }
            }
        } catch (e) {}

        try {
            if (typeof entity.getLocalRotation === 'function') {
                const q = entity.getLocalRotation();
                if (q && isFinite(q.x) && isFinite(q.y) && isFinite(q.z) && isFinite(q.w)) {
                    nodeTransform.rotation = [Number(q.x), Number(q.y), Number(q.z), Number(q.w)];
                }
            }
        } catch (e) {}

        try {
            if (typeof entity.getLocalScale === 'function') {
                const s = entity.getLocalScale();
                if (s && isFinite(s.x) && isFinite(s.y) && isFinite(s.z)) {
                    nodeTransform.scale = [Number(s.x), Number(s.y), Number(s.z)];
                }
            }
        } catch (e) {}

        return nodeTransform;
    }

    function buildVrmGlbBuffer(entity) {
        const renderComp = typeof entity.findComponent === 'function' ? entity.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
            throw new Error("Objek tidak memiliki mesh.");
        }

        const meshesGltf = [];
        const accessors = [];
        const bufferViews = [];
        const binaryChunks = [];
        let byteOffset = 0;

        const appendBufferChunk = (typedArray, target) => {
            const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
            const paddedLen = Math.ceil(bytes.length / 4) * 4;
            const padded = new Uint8Array(paddedLen);
            padded.set(bytes);
            binaryChunks.push(padded);

            const bvIdx = bufferViews.length;
            bufferViews.push({
                buffer: 0,
                byteOffset: byteOffset,
                byteLength: bytes.length,
                target: target || 34962
            });
            byteOffset += paddedLen;
            return bvIdx;
        };

        renderComp.meshInstances.forEach((mi) => {
            if (!mi || !mi.mesh || !mi.mesh.getPositions || !mi.mesh.getIndices) return;
            const pos = mi.mesh.getPositions();
            const indices = mi.mesh.getIndices();
            if (!pos || !indices || pos.length < 3 || indices.length < 3) return;

            const posArr = new Float32Array(pos);
            const vCount = Math.floor(posArr.length / 3);
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            for (let i = 0; i < vCount; i++) {
                const x = posArr[i * 3], y = posArr[i * 3 + 1], z = posArr[i * 3 + 2];
                if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
                if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
            }

            const posBv = appendBufferChunk(posArr, 34962);
            const posAcc = accessors.length;
            accessors.push({
                bufferView: posBv,
                componentType: 5126,
                count: vCount,
                type: 'VEC3',
                min: [minX, minY, minZ],
                max: [maxX, maxY, maxZ]
            });

            const idxArr = new Uint32Array(indices);
            const idxBv = appendBufferChunk(idxArr, 34963);
            const idxAcc = accessors.length;
            accessors.push({
                bufferView: idxBv,
                componentType: 5125,
                count: idxArr.length,
                type: 'SCALAR'
            });

            meshesGltf.push({
                primitives: [{
                    attributes: { POSITION: posAcc },
                    indices: idxAcc
                }]
            });
        });

        if (meshesGltf.length === 0) {
            throw new Error("Tidak ada geometri mesh valid untuk di-export ke VRM.");
        }

        const baseTransform = extractNodeTransform(entity);
        const nodes = meshesGltf.map((_, i) => {
            const nodeObj = {
                name: (entity.name || 'Node') + '_' + i,
                mesh: i
            };
            if (i === 0) {
                if (baseTransform.translation) nodeObj.translation = baseTransform.translation;
                if (baseTransform.rotation) nodeObj.rotation = baseTransform.rotation;
                if (baseTransform.scale) nodeObj.scale = baseTransform.scale;
            }
            return nodeObj;
        });

        const gltfJson = {
            asset: { version: '2.0', generator: 'VTuber Forge VRM Exporter' },
            scene: 0,
            scenes: [{ nodes: nodes.map((_, i) => i) }],
            nodes: nodes,
            meshes: meshesGltf,
            buffers: [{ byteLength: byteOffset }],
            bufferViews: bufferViews,
            accessors: accessors,
            extensionsUsed: ['VRM'],
            extensions: {
                VRM: {
                    exporterVersion: 'VTuber Forge v0.1',
                    specVersion: '0.0',
                    meta: {
                        title: entity.name || 'VTuberAvatar',
                        author: 'VTuber Forge',
                        allowedUserName: 'Everyone',
                        licenseName: 'Other'
                    },
                    humanoid: { humanBones: [] },
                    blendShapeMaster: { blendShapeGroups: [] }
                }
            }
        };

        const jsonStr = JSON.stringify(gltfJson);
        const jsonEncoder = new TextEncoder();
        let jsonBytes = jsonEncoder.encode(jsonStr);
        const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
        if (jsonPad > 0) {
            const paddedJson = new Uint8Array(jsonBytes.length + jsonPad);
            paddedJson.set(jsonBytes);
            for (let i = jsonBytes.length; i < paddedJson.length; i++) paddedJson[i] = 0x20;
            jsonBytes = paddedJson;
        }

        const binLength = byteOffset;
        const totalLength = 12 + 8 + jsonBytes.length + (binLength > 0 ? (8 + binLength) : 0);
        const out = new Uint8Array(totalLength);
        const view = new DataView(out.buffer);

        // GLB Header: magic "glTF" (0x46546C67), version 2, length
        view.setUint32(0, 0x46546C67, true);
        view.setUint32(4, 2, true);
        view.setUint32(8, totalLength, true);

        // JSON Chunk: length, type "JSON" (0x4E4F534A)
        view.setUint32(12, jsonBytes.length, true);
        view.setUint32(16, 0x4E4F534A, true);
        out.set(jsonBytes, 20);

        if (binLength > 0) {
            const binChunkStart = 20 + jsonBytes.length;
            view.setUint32(binChunkStart, binLength, true);
            view.setUint32(binChunkStart + 4, 0x004E4942, true);
            let cursor = binChunkStart + 8;
            for (const chunk of binaryChunks) {
                out.set(chunk, cursor);
                cursor += chunk.length;
            }
        }

        return out;
    }

    function exportVRM() {
        const pcApp = getVrmExportApp();
        if (!pcApp || !pcApp.root) return alert("Scene belum siap.");
        const selected = getSelectedEntitySafe();
        if (!selected) return alert("Pilih model dulu sebelum export VRM!");
        try {
            const glbData = buildVrmGlbBuffer(selected);
            const cleanName = (selected.name || 'avatar').replace(/[^a-zA-Z0-9_-]/g, '_');
            if (typeof window.downloadBinary === 'function') {
                window.downloadBinary(`${cleanName}.vrm`, glbData, 'model/gltf-binary');
            } else {
                throw new Error("Helper downloadBinary belum siap.");
            }
        } catch (err) {
            logVrmExport("Export VRM error: " + err.message);
            alert("Gagal export VRM: " + err.message);
        }
    }
    window.exportVRM = exportVRM;

    logVrmExport("✅ vrm_exporter.js loaded");
})();
