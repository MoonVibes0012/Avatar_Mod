/* ===== VTuber Forge — js/io/export.js ===== */
// Export OBJ, Export VRM (GLB+VRM extensions), Screenshot, dan helper download

(function () {
    'use strict';

    function setExportStatus(msg) {
        const el = document.getElementById('status');
        if (el) el.textContent = msg;
    }

    function logExport(msg) {
        if (typeof window.dbg === 'function') {
            try { window.dbg(msg); } catch (e) {}
        } else if (typeof console !== 'undefined') {
            console.log(msg);
        }
    }

    function getExportApp() {
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

    function downloadNative(filename, content) {
        if (window.AndroidBridge && typeof window.AndroidBridge.saveFile === 'function') {
            try {
                window.AndroidBridge.saveFile(filename, content);
                setExportStatus("✓ File disimpan ke Downloads: " + filename);
                return;
            } catch (e) {
                logExport("AndroidBridge.saveFile error: " + e.message);
            }
        }
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportStatus("✓ File diunduh: " + filename);
        } catch (e) {
            setExportStatus("⚠ Gagal download: " + e.message);
        }
    }
    window.downloadNative = downloadNative;

    function downloadBinary(filename, uint8Array, mimeType) {
        const safeMime = mimeType || 'application/octet-stream';
        if (window.AndroidBridge && typeof window.AndroidBridge.saveBinaryFile === 'function') {
            try {
                let binaryStr = '';
                const bytes = uint8Array;
                for (let i = 0; i < bytes.length; i++) {
                    binaryStr += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binaryStr);
                window.AndroidBridge.saveBinaryFile(filename, base64, safeMime);
                setExportStatus("✓ File binary disimpan ke Downloads: " + filename);
                return;
            } catch (e) {
                logExport("AndroidBridge.saveBinaryFile error: " + e.message);
            }
        }
        try {
            const blob = new Blob([uint8Array], { type: safeMime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setExportStatus("✓ File binary diunduh: " + filename);
        } catch (e) {
            setExportStatus("⚠ Gagal download binary: " + e.message);
        }
    }
    window.downloadBinary = downloadBinary;

    function exportOBJ() {
        const pcApp = getExportApp();
        if (!pcApp || !pcApp.root) return alert("Scene belum siap.");
        if (!S.selected) return alert("Pilih objek dulu!");
        const renderComp = typeof S.selected.findComponent === 'function' ? S.selected.findComponent('render') : null;
        if (!renderComp || !renderComp.meshInstances || renderComp.meshInstances.length === 0) {
            return alert("Objek tidak punya mesh untuk di-export ke OBJ.");
        }

        let objStr = `# VTuber Forge OBJ Export\n# Object: ${S.selected.name || 'Object'}\n\n`;
        let vertexOffset = 1;
        let hasAnyGeometry = false;

        renderComp.meshInstances.forEach((mi, idx) => {
            if (!mi || !mi.mesh || !mi.mesh.getPositions || !mi.mesh.getIndices) return;
            const pos = mi.mesh.getPositions();
            const indices = mi.mesh.getIndices();
            if (!pos || !indices || pos.length < 3 || indices.length < 3) return;

            hasAnyGeometry = true;
            objStr += `o ${(S.selected.name || 'Object').replace(/\s+/g, '_')}_part${idx}\n`;

            const vCount = Math.floor(pos.length / 3);
            for (let i = 0; i < vCount; i++) {
                objStr += `v ${(pos[i * 3] || 0).toFixed(6)} ${(pos[i * 3 + 1] || 0).toFixed(6)} ${(pos[i * 3 + 2] || 0).toFixed(6)}\n`;
            }

            const triLimit = indices.length - (indices.length % 3);
            for (let i = 0; i < triLimit; i += 3) {
                const a = indices[i] + vertexOffset;
                const b = indices[i + 1] + vertexOffset;
                const c = indices[i + 2] + vertexOffset;
                objStr += `f ${a} ${b} ${c}\n`;
            }

            vertexOffset += vCount;
        });

        if (!hasAnyGeometry) {
            return alert("Data posisi/index mesh kosong atau terkompresi.");
        }

        const cleanName = (S.selected.name || 'model').replace(/[^a-zA-Z0-9_-]/g, '_');
        downloadNative(`${cleanName}.obj`, objStr);
    }
    window.exportOBJ = exportOBJ;

    const xObjBtn = document.getElementById('x-obj');
    if (xObjBtn) xObjBtn.onclick = exportOBJ;

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

        const nodes = meshesGltf.map((_, i) => ({
            name: (entity.name || 'Node') + '_' + i,
            mesh: i
        }));

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
        const pcApp = getExportApp();
        if (!pcApp || !pcApp.root) return alert("Scene belum siap.");
        if (!S.selected) return alert("Pilih model dulu sebelum export VRM!");
        try {
            const glbData = buildVrmGlbBuffer(S.selected);
            const cleanName = (S.selected.name || 'avatar').replace(/[^a-zA-Z0-9_-]/g, '_');
            downloadBinary(`${cleanName}.vrm`, glbData, 'model/gltf-binary');
        } catch (err) {
            logExport("Export VRM error: " + err.message);
            alert("Gagal export VRM: " + err.message);
        }
    }
    window.exportVRM = exportVRM;

    function takeScreenshot() {
        const pcApp = getExportApp();
        if (!pcApp || !pcApp.graphicsDevice) return alert("Scene belum siap.");
        const canvas = document.getElementById('gl') || pcApp.graphicsDevice.canvas;
        if (!canvas) return alert("Canvas tidak ditemukan.");

        try {
            if (typeof pcApp.render === 'function') pcApp.render();
            const dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl || dataUrl === 'data:,') {
                throw new Error("Canvas kosong atau diblokir.");
            }
            const base64 = dataUrl.split(',')[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            downloadBinary(`vtuber_screenshot_${Date.now()}.png`, bytes, 'image/png');
        } catch (e) {
            logExport("Screenshot error: " + e.message);
            alert("Gagal mengambil screenshot: " + e.message);
        }
    }
    window.takeScreenshot = takeScreenshot;

    const shotBtn = document.getElementById('btnScreenshot');
    if (shotBtn) shotBtn.onclick = takeScreenshot;
})();
